import { beforeEach, describe, expect, it, vi } from "vitest";
import { SeatService } from "@/services/seat.service";

const mocks = vi.hoisted(() => ({
    authorize: vi.fn(), branch: vi.fn(), multiShift: vi.fn(), shifts: vi.fn(), seats: vi.fn(),
}));
vi.mock("@/services/staff.service", () => ({ StaffService: { authorize: mocks.authorize } }));
vi.mock("@/lib/prisma", () => ({ prisma: {
    branch: { findUnique: mocks.branch }, multiShift: { findUnique: mocks.multiShift },
    shift: { findMany: mocks.shifts }, seat: { findMany: mocks.seats },
} }));

const morning = { id: "morning", startTime: "06:00", endTime: "10:00" };
const evening = { id: "evening", startTime: "16:00", endTime: "20:00" };
const windows = [morning, evening,
    { id: "evening_overlap", startTime: "19:00", endTime: "21:00" },
    { id: "boundary", startTime: "20:00", endTime: "22:00" },
    { id: "overnight", startTime: "23:00", endTime: "07:00" },
    { id: "full_day", startTime: null, endTime: null },
];
beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorize.mockResolvedValue(undefined);
    mocks.branch.mockResolvedValue({ id: "branch_1" });
    mocks.multiShift.mockResolvedValue({
        id: "bundle", branchId: "branch_1", name: "Morning and evening",
        components: [morning, evening].map(shift => ({ shiftId: shift.id, shift })),
    });
    mocks.shifts.mockResolvedValue(windows);
});

describe("bundle seat-map conflict scope", () => {
    it.each([
        ["evening", true], ["evening_overlap", true], ["overnight", true], ["full_day", true], ["boundary", false],
    ])("checks allocation %s against every component without changing overlap boundaries", async (shiftId, occupied) => {
        mocks.seats.mockResolvedValue([{
            id: "seat_1", label: "A1",
            seatAllocations: [{ shiftId, multiShiftId: null, student: { name: "Existing student" } }],
        }]);
        const map = await SeatService.getSeatMap("actor", "branch_1", "morning", "bundle");
        expect(map.seats[0].occupied).toBe(occupied);
        expect(map.availableCount).toBe(occupied ? 0 : 1);
        expect(mocks.authorize).toHaveBeenCalledWith("actor", "branch_1", "seat_allocation");
    });

    it("retains branch, active-allocation, and explicit exclusion filters", async () => {
        mocks.seats.mockResolvedValue([]);
        await SeatService.getSeatMap("actor", "branch_1", "morning", "bundle", ["current_allocation"]);
        expect(mocks.seats).toHaveBeenCalledWith(expect.objectContaining({
            where: { branchId: "branch_1" }, include: { seatAllocations: {
                where: { endDate: null, id: { notIn: ["current_allocation"] } },
                include: { student: { select: { name: true } } },
            } },
        }));
    });
});
