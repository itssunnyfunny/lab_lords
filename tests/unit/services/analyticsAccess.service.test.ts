import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorizeCapability: vi.fn(),
  operational: vi.fn(),
  fullHealth: vi.fn(),
  paymentPeriod: vi.fn(),
  operationalTrend: vi.fn(),
  fullHealthTrend: vi.fn(),
  paymentTrend: vi.fn(),
}));
vi.mock("@/services/accessPolicy.service", () => ({ AccessPolicy: { authorizeCapability: mocks.authorizeCapability } }));
vi.mock("@/analytics/branch.analytics", () => ({
  getBranchOperationalSnapshot: mocks.operational,
  getBranchHealthSnapshot: mocks.fullHealth,
}));
vi.mock("@/analytics/payment.analytics", () => ({ getPaymentPeriodStats: mocks.paymentPeriod, getOverduePaymentsPage: vi.fn() }));
vi.mock("@/analytics/trends/branch.trends", () => ({
  getBranchOperationalTrend: mocks.operationalTrend,
  getBranchHealthTrend: mocks.fullHealthTrend,
}));
vi.mock("@/analytics/trends/payment.trends", () => ({ getPaymentTrend: mocks.paymentTrend }));
vi.mock("@/analytics/trends/seat.trends", () => ({ getSeatUtilizationTrend: vi.fn() }));

import { AnalyticsAccessService } from "@/services/analyticsAccess.service";

describe("interactive branch analytics payment boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorizeCapability.mockResolvedValue({ permissions: { analytics: true, view_payments: false } });
    mocks.operational.mockResolvedValue({ seats: { occupancySnapshot: { totalUsedSlots: 2 } }, students: { status: { active: 3 } } });
    mocks.fullHealth.mockResolvedValue({
      seats: { occupancySnapshot: { totalUsedSlots: 2 } },
      students: { status: { active: 3 } },
      payments: { overdueCount: 7 },
    });
    mocks.paymentPeriod.mockResolvedValue({ revenueAmount: 901, paidAmount: 800, dueAmount: 101, collectionRate: 89 });
    mocks.operationalTrend.mockResolvedValue([]);
    mocks.fullHealthTrend.mockResolvedValue([]);
    mocks.paymentTrend.mockResolvedValue([]);
  });

  it("returns a payment-free operational snapshot under explicit payment denial", async () => {
    const result = await AnalyticsAccessService.branchSnapshot("staff", "branch", "month");
    expect(result.health.students.status.active).toBe(3);
    expect(result.finance).toBeNull();
    expect(mocks.authorizeCapability).toHaveBeenCalledWith("staff", "branch", "analyticsView");
    expect(mocks.operational).toHaveBeenCalledWith("branch");
    expect(mocks.fullHealth).not.toHaveBeenCalled();
    expect(mocks.paymentPeriod).not.toHaveBeenCalled();
  });

  it("preserves authorized owner financial aggregates", async () => {
    mocks.authorizeCapability.mockResolvedValue({ permissions: { analytics: true, view_payments: true } });
    const result = await AnalyticsAccessService.branchSnapshot("owner", "branch", "month");
    expect(result.finance).toEqual({ revenueAmount: 901, paidAmount: 800, dueAmount: 101, collectionRate: 89 });
    expect(mocks.paymentPeriod).toHaveBeenCalledWith("branch", undefined, "month");
  });

  it("uses a financial capability for payment trends and never reads denied trends", async () => {
    mocks.authorizeCapability.mockRejectedValueOnce(new Error("Unauthorized: Permission 'view_payments' is disabled"));
    await expect(AnalyticsAccessService.paymentTrend("staff", "branch", new Date("2026-09-01"), new Date("2026-09-02"), "all"))
      .rejects.toThrow("view_payments");
    expect(mocks.authorizeCapability).toHaveBeenCalledWith("staff", "branch", "analyticsFinanceView");
    expect(mocks.paymentTrend).not.toHaveBeenCalled();
  });

  it("keeps nonfinancial health trends independent of payment reads", async () => {
    await AnalyticsAccessService.healthTrend("staff", "branch", new Date("2026-09-01"), new Date("2026-09-02"));
    expect(mocks.authorizeCapability).toHaveBeenCalledWith("staff", "branch", "analyticsView");
    expect(mocks.operationalTrend).toHaveBeenCalledOnce();
    expect(mocks.fullHealthTrend).not.toHaveBeenCalled();
  });
});
