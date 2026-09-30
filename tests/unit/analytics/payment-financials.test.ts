import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  paymentAggregate: vi.fn(),
  paymentFindMany: vi.fn(),
  collectionAggregate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: {
  payment: { aggregate: mocks.paymentAggregate, findMany: mocks.paymentFindMany },
  feeCollection: { aggregate: mocks.collectionAggregate },
} }));

import { getPaymentPeriodStats } from "@/analytics/payment.analytics";
import { getPaymentTrend } from "@/analytics/trends/payment.trends";

type Status = "DUE" | "PAID" | "WAIVED";
type DateRange = { gte?: Date; lte?: Date };
type Payment = {
  id: string; branchId: string; studentId: string; status: Status;
  amount: number; collectedAmount: number; waivedAmount: number; ledgerBacked: boolean;
  dueDate: Date; paidAt: Date | null; imported: boolean; type: "MONTHLY";
  student: { id: string; name: string; phone: null };
};
type PaymentWhere = {
  branchId?: string; status?: Status | { not: Status }; ledgerBacked?: boolean;
  dueDate?: DateRange; paidAt?: DateRange; OR?: PaymentWhere[];
  resolutionEvents?: { none: { source: string } };
};
type Collection = { branchId: string; amount: number; collectedAt: Date; voidedAt: Date | null };

const day = (date: number, month = 8) => new Date(2026, month, date, 12);
let payments: Payment[];
let collections: Collection[];

function payment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: "fee", branchId: "branch", studentId: "student", status: "DUE",
    amount: 1200, collectedAmount: 0, waivedAmount: 0, ledgerBacked: true,
    dueDate: day(1), paidAt: null, imported: false, type: "MONTHLY",
    student: { id: "student", name: "Fixture student", phone: null },
    ...overrides,
  };
}
function within(value: Date | null, range: DateRange) {
  return value !== null
    && (!range.gte || value >= range.gte)
    && (!range.lte || value <= range.lte);
}
function matches(row: Payment, where: PaymentWhere): boolean {
  return (!where.branchId || row.branchId === where.branchId)
    && (!where.status || (typeof where.status === "string"
      ? row.status === where.status : row.status !== where.status.not))
    && (where.ledgerBacked === undefined || row.ledgerBacked === where.ledgerBacked)
    && (!where.dueDate || within(row.dueDate, where.dueDate))
    && (!where.paidAt || within(row.paidAt, where.paidAt))
    && (!where.OR || where.OR.some(condition => matches(row, condition)))
    && (!where.resolutionEvents || !row.imported);
}

beforeEach(() => {
  vi.resetAllMocks();
  payments = [];
  collections = [];
  // These fixture reads honor the actual implementation's filters and requested
  // sums; they do not replace either analytics implementation under test.
  mocks.paymentAggregate.mockImplementation(async ({ where, _sum }: {
    where: PaymentWhere; _sum: Partial<Record<"amount" | "waivedAmount", true>>;
  }) => {
    const rows = payments.filter(row => matches(row, where));
    return { _sum: Object.fromEntries(Object.keys(_sum).map(key => [
      key, rows.reduce((total, row) => total + row[key as "amount" | "waivedAmount"], 0),
    ])) };
  });
  mocks.paymentFindMany.mockImplementation(async ({ where }: { where: PaymentWhere }) =>
    payments.filter(row => matches(row, where)));
  mocks.collectionAggregate.mockImplementation(async ({ where }: {
    where: { branchId: string; voidedAt: null; collectedAt: DateRange };
  }) => ({ _sum: { amount: collections
    .filter(row => row.branchId === where.branchId && row.voidedAt === where.voidedAt
      && within(row.collectedAt, where.collectedAt))
    .reduce((total, row) => total + row.amount, 0) } }));
});

describe("billable revenue after ledger waivers", () => {
  it.each([
    { label: "partial collection", status: "DUE", collected: 700, waived: 0, revenue: 1200, due: 500 },
    { label: "waived remainder", status: "WAIVED", collected: 700, waived: 500, revenue: 700, due: 0 },
    { label: "void after waiver", status: "DUE", collected: 0, waived: 500, revenue: 700, due: 700 },
    { label: "recollection after void", status: "WAIVED", collected: 700, waived: 500, revenue: 700, due: 0 },
    { label: "fully waived fee", status: "WAIVED", collected: 0, waived: 1200, revenue: 0, due: 0 },
  ] as const)("$label preserves received money and excludes forgiven rupees", async fixture => {
    payments.push(payment({ status: fixture.status, collectedAmount: fixture.collected, waivedAmount: fixture.waived }));
    if (fixture.label === "void after waiver" || fixture.label === "recollection after void") {
      collections.push({ branchId: "branch", amount: 700, collectedAt: day(5), voidedAt: day(7) });
    }
    if (fixture.collected) collections.push({ branchId: "branch", amount: fixture.collected, collectedAt: day(8), voidedAt: null });

    const result = await getPaymentPeriodStats("branch", day(20), "month");

    expect(result).toMatchObject({
      revenueAmount: fixture.revenue,
      paidAmount: fixture.collected,
      dueAmount: fixture.due,
      collectionRate: fixture.revenue ? fixture.collected / fixture.revenue * 100 : 0,
    });
    expect(payments[0].amount).toBe(1200);
  });

  it("retains historical non-ledger waived-row exclusion", async () => {
    payments.push(
      payment({ ledgerBacked: false, status: "WAIVED", amount: 900 }),
      payment({ id: "legacy-paid", ledgerBacked: false, status: "PAID", amount: 300, paidAt: day(5) }),
      payment({ id: "foreign", branchId: "foreign", amount: 800 }),
    );

    expect(await getPaymentPeriodStats("branch", day(20), "all")).toMatchObject({
      revenueAmount: 300, paidAmount: 300, dueAmount: 0, collectionRate: 100,
    });
  });
});

describe("monthly payment trends use each plotted day's cutoff", () => {
  it("does not backdate receipts or later billable fees into earlier points", async () => {
    payments.push(payment({ amount: 700, collectedAmount: 700, status: "PAID", dueDate: day(20) }));
    collections.push({ branchId: "branch", amount: 700, collectedAt: day(20), voidedAt: null });

    const points = await getPaymentTrend("branch", day(18), day(20), "DAY", "month");

    expect(points.map(point => point.paidAmount)).toEqual([0, 0, 700]);
    expect(points.map(point => point.revenueAmount)).toEqual([0, 0, 700]);
  });

  it("resets monthly totals across the month boundary and preserves all-time totals", async () => {
    collections.push(
      { branchId: "branch", amount: 100, collectedAt: day(31, 7), voidedAt: null },
      { branchId: "branch", amount: 200, collectedAt: day(1), voidedAt: null },
    );

    const monthly = await getPaymentTrend("branch", day(31, 7), day(1), "DAY", "month");
    const allTime = await getPaymentTrend("branch", day(31, 7), day(1), "DAY", "all");

    expect(monthly.map(point => point.paidAmount)).toEqual([100, 200]);
    expect(allTime.map(point => point.paidAmount)).toEqual([100, 300]);
  });

  it("uses legacy paidAt evidence, excludes imports/unknown dates/voids, and avoids ledger double counting", async () => {
    payments.push(
      payment({ amount: 700, collectedAmount: 700, status: "PAID", paidAt: day(20) }),
      payment({ id: "legacy", ledgerBacked: false, status: "PAID", amount: 300, paidAt: day(19) }),
      payment({ id: "unknown-date", ledgerBacked: false, status: "PAID", amount: 400 }),
      payment({ id: "imported", ledgerBacked: false, status: "PAID", amount: 500, paidAt: day(18), imported: true }),
    );
    collections.push(
      { branchId: "branch", amount: 700, collectedAt: day(20), voidedAt: null },
      { branchId: "branch", amount: 600, collectedAt: day(18), voidedAt: day(20) },
      { branchId: "foreign", amount: 800, collectedAt: day(18), voidedAt: null },
    );

    const points = await getPaymentTrend("branch", day(18), day(20), "DAY", "month");

    expect(points.map(point => point.paidAmount)).toEqual([0, 300, 1000]);
  });

  it("keeps the monthly summary's full-month cohort separate from trend cutoffs", async () => {
    payments.push(payment({ amount: 700, dueDate: day(20) }));
    collections.push({ branchId: "branch", amount: 700, collectedAt: day(20), voidedAt: null });

    const summary = await getPaymentPeriodStats("branch", day(18), "month");
    const [point] = await getPaymentTrend("branch", day(18), day(18), "DAY", "month");

    expect(summary).toMatchObject({ revenueAmount: 700, paidAmount: 700 });
    expect(point).toMatchObject({ revenueAmount: 0, paidAmount: 0 });
  });
});
