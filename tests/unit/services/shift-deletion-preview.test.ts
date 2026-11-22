import { beforeEach, describe, expect, it, vi } from "vitest";
import { ShiftService } from "@/services/shift.service";

const db = vi.hoisted(() => ({
    shift: { findUnique: vi.fn(), findFirst: vi.fn(), count: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    seatAllocation: { findMany: vi.fn(), updateMany: vi.fn(), createMany: vi.fn() },
    seat: { count: vi.fn(), findMany: vi.fn() },
    student: { updateMany: vi.fn() }, branch: { update: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/services/accessPolicy.service", () => ({ AccessPolicy: { authorizeAction: vi.fn(), authorizeRecord: vi.fn() } }));
vi.mock("@/lib/allocationTransaction", () => ({ runAllocationTransaction: (operation: (tx: typeof db) => unknown) => operation(db) }));

const shifts = [
    { id: "morning", name: "Morning", startTime: "08:00", endTime: "12:00" },
    { id: "afternoon", name: "Afternoon", startTime: "12:00", endTime: "16:00" },
    { id: "evening", name: "Evening", startTime: "16:00", endTime: "20:00" },
].map(shift => ({ ...shift, branchId: "branch", status: "ACTIVE" }));
function source(studentId: string, status = "ACTIVE", multiShiftId: string | null = null) {
    return { id: studentId, studentId, seatId: studentId, multiShiftId, shiftId: "morning",
        student: { id: studentId, name: studentId, status, branchId: "branch" }, seat: { label: studentId, branchId: "branch" } };
}
describe("shift deletion targets", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        db.shift.findUnique.mockResolvedValue(shifts[0]);
        db.shift.findFirst.mockResolvedValue(shifts[0]);
        db.shift.count.mockResolvedValue(shifts.length);
        db.shift.findMany.mockImplementation(({ where }) =>
            Promise.resolve(where.id?.in ? shifts.filter(s => where.id.in.includes(s.id)) : shifts));
        db.seat.count.mockResolvedValue(4);
        db.seat.findMany.mockResolvedValue([{ id: "seat1", label: "1" }, { id: "seat2", label: "2" }]);
    });
    it("excludes a spare target for an already assigned student, while keeping it available to other students", async () => {
        const sources = [source("student1"), source("student2")];
        const evening = [{ studentId: "student1", seatId: "seat1", shiftId: "evening" }];
        db.seatAllocation.findMany.mockImplementation(({ where }) => Promise.resolve(where.shiftId ? sources : evening));
        const preview = await ShiftService.analyzeShiftDeletion("actor", "morning");
        expect(preview.otherShifts.find(s => s.shiftId === "evening")?.emptySeats).toBe(3);
        expect(preview.shiftsWithEnoughCapacity).toEqual(["afternoon"]);
        expect(preview.allocations.map(a => a.eligibleTargetShiftIds)).toEqual([["afternoon"], ["afternoon", "evening"]]);
        await expect(ShiftService.deleteShift("actor", "morning", { type: "REALLOCATE_BULK", targetShiftId: "evening" }))
            .rejects.toThrow("already allocated");
        await expect(ShiftService.deleteShift("actor", "morning", { type: "REALLOCATE_MANUAL", assignments: [
            { allocationId: "student1", targetShiftId: "afternoon" }, { allocationId: "student2", targetShiftId: "evening" },
        ] })).resolves.toEqual({ success: true });
    });
    it("makes the seat and target available after release of the student's bundle sibling", async () => {
        db.seat.count.mockResolvedValue(1);
        const original = source("student1", "ACTIVE", "bundle");
        db.seatAllocation.findMany.mockImplementation(({ where }) => Promise.resolve(where.shiftId ? [original] : []));
        const preview = await ShiftService.analyzeShiftDeletion("actor", "morning");
        const released = db.seatAllocation.findMany.mock.calls[1][0].where.NOT;
        expect(released.OR).toContainEqual({
            studentId: "student1", seatId: "student1", multiShiftId: "bundle",
        });
        expect(preview.shiftsWithEnoughCapacity).toContain("evening");
        expect(preview.allocations[0].eligibleTargetShiftIds).toContain("evening");
        await ShiftService.deleteShift("actor", "morning", { type: "REALLOCATE_BULK", targetShiftId: "evening" });
        expect(db.seatAllocation.updateMany).toHaveBeenCalledWith({ where: released, data: { endDate: expect.any(Date) } });
        expect(db.seatAllocation.createMany).toHaveBeenCalledWith({ data: [expect.objectContaining({ studentId: "student1", shiftId: "evening" })] });
    });
    it("warns before manual selection when students compete for the same eligible seat", async () => {
        db.seat.count.mockResolvedValue(3);
        const sources = [source("one"), source("two")];
        const remaining = [
            { studentId: "one", seatId: "A", shiftId: "evening" },
            { studentId: "two", seatId: "B", shiftId: "evening" },
            { studentId: "three", seatId: "A", shiftId: "afternoon" },
            { studentId: "four", seatId: "B", shiftId: "afternoon" },
        ];
        db.seatAllocation.findMany.mockResolvedValueOnce(sources).mockResolvedValueOnce(remaining);
        const preview = await ShiftService.analyzeShiftDeletion("actor", "morning");
        expect(preview.totalEmptyElsewhere).toBe(2);
        expect(preview.allocations.map(a => a.eligibleTargetShiftIds)).toEqual([["afternoon"], ["afternoon"]]);
        expect(preview.willOverflowBy).toBe(1);
    });

    it("can move a flexible student to another shift to make room for a restricted student", async () => {
        db.seat.count.mockResolvedValue(2);
        const sources = [source("flexible"), source("restricted")];
        const remaining = [
            { studentId: "other", seatId: "A", shiftId: "afternoon" },
            { studentId: "restricted", seatId: "A", shiftId: "evening" },
        ];
        for (const order of [sources, [...sources].reverse()]) {
            db.seatAllocation.findMany.mockResolvedValueOnce(order).mockResolvedValueOnce(remaining);
            const preview = await ShiftService.analyzeShiftDeletion("actor", "morning");
            expect(preview.shiftsWithEnoughCapacity).toEqual([]);
            expect(preview.willOverflowBy).toBe(0);
        }
    });
    it("uses the writer's overlap rule even when an existing assignment belongs to a retired shift", async () => {
        const late = { ...shifts[2], id: "late", startTime: "19:00", endTime: "23:00", status: "INACTIVE" };
        db.shift.findMany.mockImplementation(({ where }) => Promise.resolve(where.id?.in ? [shifts[2]] : [...shifts, late]));
        const active = [{ shiftId: "late", studentId: "student1", seatId: "seat1" }];
        db.seatAllocation.findMany.mockImplementation(({ where }) => Promise.resolve(where.shiftId ? [source("student1")] : active));
        const preview = await ShiftService.analyzeShiftDeletion("actor", "morning");
        expect(preview.shiftsWithEnoughCapacity).toEqual(["afternoon"]);
        expect(preview.allocations[0].eligibleTargetShiftIds).toEqual(["afternoon"]);
        await expect(ShiftService.deleteShift("actor", "morning", { type: "REALLOCATE_MANUAL",
            assignments: [{ allocationId: "student1", targetShiftId: "evening" }] })).rejects.toThrow("already allocated");
    });
    it("excludes inactive students from every target before confirmation", async () => {
        db.seatAllocation.findMany.mockResolvedValueOnce([source("student1", "INACTIVE")]).mockResolvedValueOnce([]);
        const preview = await ShiftService.analyzeShiftDeletion("actor", "morning");
        expect(preview.shiftsWithEnoughCapacity).toEqual([]);
        expect(preview.allocations[0].eligibleTargetShiftIds).toEqual([]);
        expect(preview.willOverflowBy).toBe(1);
    });
});
