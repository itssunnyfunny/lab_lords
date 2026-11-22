import { beforeEach, describe, expect, it, vi } from "vitest";
import { getBranchSnapshot } from "@/analytics/branch.analytics";
import { detectBranchRisks } from "@/ai/riskDetection/branchRiskDetector";

const mocks = vi.hoisted(() => ({
  groupStudents: vi.fn(), countStudents: vi.fn(), stats: vi.fn(), overdue: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: {
  branch: { findUnique: async () => ({ name: "Fixture" }) },
  student: { groupBy: mocks.groupStudents, count: mocks.countStudents },
  $transaction: (reads: Promise<unknown>[]) => Promise.all(reads),
} }));
vi.mock("@/analytics/seat.analytics", () => ({ getSeatOccupancySnapshot: async () => ({
  totalShiftCapacity: 4, totalUsedSlots: 4, totalOccupancyPercent: 100, shifts: [],
}) }));
vi.mock("@/analytics/payment.analytics", () => ({ getPaymentStats: mocks.stats, getOverduePayments: mocks.overdue }));

const asOf = new Date(2026, 10, 18, 12);
const dueDate = new Date(2026, 10, 1, 12);

describe("branch health risk evidence", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.groupStudents.mockResolvedValue([{ status: "ACTIVE", _count: { _all: 4 } }]);
    mocks.countStudents.mockResolvedValue(0);
    mocks.stats.mockResolvedValue({ dueCount: 0, paidCount: 4, overdueCount: 0 });
    mocks.overdue.mockResolvedValue({ payments: [] });
  });

  it("counts active students with at least one overdue fee, independently of the number of overdue rows", async () => {
    const studentIds = ["active-1", "active-1", "active-1", "inactive"];
    mocks.groupStudents.mockResolvedValue([{ status: "ACTIVE", _count: { _all: 4 } }, { status: "INACTIVE", _count: { _all: 1 } }]);
    mocks.stats.mockResolvedValue({ dueCount: 4, paidCount: 0, overdueCount: 4 });
    mocks.overdue.mockResolvedValue({ payments: studentIds.map(studentId => ({ studentId, amount: 500, dueDate })) });
    mocks.countStudents.mockResolvedValue(1);
    const snapshot = await getBranchSnapshot("branch", asOf);
    expect(mocks.groupStudents).toHaveBeenCalledWith({ by: ["status"], where: { branchId: "branch" }, _count: { _all: true } });
    expect(mocks.countStudents).toHaveBeenCalledWith({ where: {
      branchId: "branch", status: "ACTIVE", payments: { some: {
        branchId: "branch", status: "DUE", amount: { gt: 0 }, dueDate: { lt: new Date(2026, 10, 11) },
      } },
    } });
    expect(snapshot.payments).toMatchObject({ overdueCount: 4, activeStudentsWithOverdueFees: 1 });
    expect(detectBranchRisks(snapshot)).toMatchObject([{ type: "PAYMENT_OVERDUE", severity: "MEDIUM" }]);
    mocks.groupStudents.mockResolvedValue([{ status: "ACTIVE", _count: { _all: 1 } }]);
    const risk = detectBranchRisks(await getBranchSnapshot("branch", asOf))[0];
    expect(risk.explanation).toContain("100.0% of active students");
  });
});
