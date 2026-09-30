import { beforeEach, describe, expect, it, vi } from "vitest";
import { assertTrendRange, parseTrendDate } from "@/analytics/trends/range";
const { snapshot, seatSnapshot, paymentSnapshot } = vi.hoisted(() => ({ snapshot: vi.fn(), seatSnapshot: vi.fn(), paymentSnapshot: vi.fn() }));
vi.mock("@/analytics/branch.analytics", () => ({ getBranchOperationalSnapshot: snapshot }));
vi.mock("@/analytics/seat.analytics", () => ({ getSeatOccupancySnapshot: seatSnapshot }));
vi.mock("@/analytics/payment.analytics", () => ({ getPaymentPeriodStats: paymentSnapshot }));
import { getBranchOperationalTrend } from "@/analytics/trends/branch.trends";
import { getSeatUtilizationTrend } from "@/analytics/trends/seat.trends";
import { getPaymentTrend } from "@/analytics/trends/payment.trends";

describe("bounded trend ranges", () => {
  beforeEach(() => vi.clearAllMocks());
  it.each(["2026-02-30", "2025-02-29", "2026-13-01", "2026-09-05T24:00:00Z", "yesterday", "2026-09-05junk"])(
    "rejects a non-real date %s", value => expect(() => parseTrendDate(value)).toThrow());
  it("allows leap day and the existing 31-point month-to-date preset", () => {
    expect(parseTrendDate("2024-02-29").getUTCDate()).toBe(29);
    expect(() => assertTrendRange(new Date(2026, 7, 1), new Date(2026, 7, 31, 23, 59))).not.toThrow();
  });
  it.each([["2026-01-01", "2026-02-01"], ["2026-02-01", "2026-01-01"]])(
    "rejects %s through %s before any snapshot query", async (from, to) => {
      await expect(getBranchOperationalTrend("branch", new Date(from), new Date(to))).rejects.toThrow();
      await expect(getSeatUtilizationTrend("branch", new Date(from), new Date(to))).rejects.toThrow();
      await expect(getPaymentTrend("branch", new Date(from), new Date(to))).rejects.toThrow();
      expect(snapshot).not.toHaveBeenCalled();
      expect(seatSnapshot).not.toHaveBeenCalled();
      expect(paymentSnapshot).not.toHaveBeenCalled();
    });
  it("reads the operational helper for a valid one-point range", async () => {
    snapshot.mockResolvedValue({ students: { status: { active: 1 } } });
    const day = new Date("2026-09-01T00:00:00.000Z");
    const result = await getBranchOperationalTrend("branch", day, day);
    expect(result).toHaveLength(1);
    expect(result[0].asOf).toEqual(day);
    expect(snapshot).toHaveBeenCalledOnce();
    expect(snapshot.mock.calls[0][0]).toBe("branch");
  });
});
