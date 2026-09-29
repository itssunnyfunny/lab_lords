import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ branch: vi.fn(), staff: vi.fn(), shifts: vi.fn(), bundles: vi.fn(), bundle: vi.fn(), seats: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {
    branch: { findUnique: mocks.branch }, staff: { findUnique: mocks.staff },
    shift: { findMany: mocks.shifts }, multiShift: { findMany: mocks.bundles, findUnique: mocks.bundle },
    seat: { findMany: mocks.seats },
} }));

import { SeatService } from "@/services/seat.service";
import { MultiShiftService } from "@/services/multiShift.service";

const morning = { id: "morning", name: "Morning", branchId: "branch", status: "ACTIVE", startTime: "06:00", endTime: "10:00", price: 500, isReserved: false };
const evening = { ...morning, id: "evening", name: "Evening", startTime: "16:00", endTime: "20:00" };
const inactive = { ...evening, id: "inactive", status: "INACTIVE" };
const foreign = { ...evening, id: "foreign", branchId: "other" };
function bundle(id: string, shifts = [morning, evening]) {
    return {
        id, branchId: "branch", name: id, price: 900, createdAt: new Date("2026-01-01"),
        components: shifts.map((shift, order) => ({ shiftId: shift.id, order, shift })),
    };
}
const bundles = [bundle("valid"), bundle("inactive_bundle", [morning, inactive]), bundle("foreign_component", [morning, foreign]), bundle("empty", []), bundle("single", [morning])];
beforeEach(() => {
    vi.resetAllMocks();
    mocks.branch.mockResolvedValue({ id: "branch", name: "Main", organizationId: "org", organization: { ownerId: "owner" } });
    mocks.staff.mockResolvedValue({ id: "staff", role: "STAFF", permissionOverrides: [] });
    mocks.shifts.mockImplementation(async ({ where }: { where: { branchId: string; status: string } }) =>
        [morning, evening, inactive, foreign].filter(shift => shift.branchId === where.branchId && shift.status === where.status));
    mocks.bundles.mockResolvedValue(bundles);
    mocks.bundle.mockResolvedValue(bundles[0]);
    mocks.seats.mockResolvedValue([{ id: "seat", label: "A1", seatAllocations: [] }]);
});

describe("active component boundary for multi-shift availability", () => {
    it("advertises only complete active same-branch bundles in the allocation chooser", async () => {
        const result = await SeatService.getShiftsCapacityWithMulti("staff-user", "branch");
        expect(result.map(item => item.shiftId)).toEqual(["morning", "evening", "valid"]);
        expect(result.find(item => item.type === "MULTISHIFT")).toMatchObject({
            componentShiftIds: ["morning", "evening"], available: 1, isFull: false,
        });
        expect(mocks.shifts).toHaveBeenCalledWith(expect.objectContaining({ where: { branchId: "branch", status: "ACTIVE" } }));
        expect(mocks.bundles).toHaveBeenCalledWith(expect.objectContaining({ where: { branchId: "branch" } }));
    });

    it("drops a bundle if a component disappears between the two capacity reads", async () => {
        mocks.shifts.mockResolvedValueOnce([morning, evening]).mockResolvedValueOnce([morning]);
        const result = await SeatService.getShiftsCapacityWithMulti("staff-user", "branch");
        expect(result.filter(item => item.type === "MULTISHIFT")).toEqual([]);
    });

    it.each(["inactive_bundle", "foreign_component", "empty", "single"])("rejects the picker map for %s", async id => {
        mocks.bundle.mockResolvedValue(bundles.find(item => item.id === id));
        await expect(SeatService.getSeatMap("staff-user", "branch", "morning", id)).rejects.toThrow("Multi-shift not found");
    });

    it("keeps valid bundle map availability and explicit replacement exclusions", async () => {
        const map = await SeatService.getSeatMap("staff-user", "branch", "morning", "valid", ["current"]);
        expect(map).toMatchObject({ shiftId: "valid", availableCount: 1, occupiedCount: 0 });
        expect(mocks.seats).toHaveBeenCalledWith(expect.objectContaining({
            where: { branchId: "branch" }, include: { seatAllocations: {
                where: { endDate: null, id: { notIn: ["current"] } }, include: { student: { select: { name: true } } },
            } },
        }));
    });

    it("preserves management visibility of inactive-component bundles and their prices for repair", async () => {
        const result = await MultiShiftService.listMultiShifts("owner", "branch");
        expect(result.find(item => item.id === "inactive_bundle")).toMatchObject({
            price: 900, components: [{ shiftId: "morning" }, { shiftId: "inactive" }],
        });
        expect(mocks.shifts).not.toHaveBeenCalled();
    });

    it("retains allocation permission checks before exposing capacity or maps", async () => {
        mocks.staff.mockResolvedValue(null);
        await expect(SeatService.getShiftsCapacityWithMulti("foreign-user", "branch")).rejects.toThrow("Branch not found");
        await expect(SeatService.getSeatMap("foreign-user", "branch", "morning", "valid")).rejects.toThrow("Branch not found");
        expect(mocks.bundles).not.toHaveBeenCalled(); expect(mocks.bundle).not.toHaveBeenCalled();
    });
});
