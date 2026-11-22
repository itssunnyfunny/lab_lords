import { beforeEach, describe, expect, it, vi } from "vitest";
import { SeatService } from "@/services/seat.service";
import { ShiftService } from "@/services/shift.service";

const mocks = vi.hoisted(() => {
  const tx = {
    branch: { update: vi.fn() },
    seat: { create: vi.fn(), createMany: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() },
    shift: { create: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() },
  };
  return { tx, branch: vi.fn(), allocations: vi.fn(), authorize: vi.fn() };
});
vi.mock("@/lib/prisma", () => ({ prisma: {
  branch: { findUnique: mocks.branch }, seatAllocation: { findMany: mocks.allocations },
  $transaction: (write: (tx: typeof mocks.tx) => Promise<unknown>) => write(mocks.tx),
} }));
vi.mock("@/services/accessPolicy.service", () => ({ AccessPolicy: { authorizeAction: mocks.authorize } }));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.branch.mockResolvedValue({ _count: { seats: 2 }, shifts: [{ id: "shift", name: "Morning" }] });
});

describe("capacity changes invalidate the branch's cached AI report", () => {
  it.each(["seat", "seat batch", "shift"])("updates freshness inside the %s creation transaction", async kind => {
    mocks.tx.seat.findMany.mockResolvedValue([]);
    mocks.tx.shift.findMany.mockResolvedValue([]);
    if (kind === "seat") await SeatService.createSeat("actor", "branch", "A");
    else if (kind === "seat batch") await SeatService.generateSeats("actor", "branch", { mode: "SIMPLE", count: 2 });
    else await ShiftService.createShift("actor", "branch", { name: "Morning", startTime: "08:00", endTime: "12:00", price: 0 });
    expect(mocks.authorize).toHaveBeenCalledWith("actor", "branch", "manage_branch", mocks.tx, true);
    expect(mocks.tx.branch.update).toHaveBeenCalledExactlyOnceWith({ where: { id: "branch" }, data: { lastDataChange: expect.any(Date) } });
  });

  it("leaves freshness unchanged when creation is rejected", async () => {
    mocks.tx.seat.findFirst.mockResolvedValue({ id: "existing" });
    await expect(SeatService.createSeat("actor", "branch", "A")).rejects.toThrow("already exists");
    expect(mocks.tx.branch.update).not.toHaveBeenCalled();
  });
});

describe("occupancy at the instant of a seat move", () => {
  it("counts only the allocation covering the requested instant before, during, and after a noon move", async () => {
    const instant = (hour: number) => new Date(2026, 10, 18, hour);
    const history = [
      { seat: "A", shiftId: "shift", start: instant(8), end: instant(12) },
      { seat: "B", shiftId: "shift", start: instant(12), end: null },
    ];
    mocks.allocations.mockImplementation(({ where }) => history.filter(row =>
      row.start <= where.startDate.lte && (row.end === null || row.end > where.OR[1].endDate.gt)));
    for (const hour of [9, 12, 15]) {
      const result = await SeatService.generateOccupancySnapshot("branch", instant(hour));
      expect(result).toMatchObject({ totalUsedSlots: 1, totalOccupancyPercent: 50 });
    }
  });
});
