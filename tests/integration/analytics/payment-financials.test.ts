import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getPaymentPeriodStats } from "@/analytics/payment.analytics";
import { getPaymentTrend } from "@/analytics/trends/payment.trends";
import { FeeCollectionService } from "@/services/feeCollection.service";
import { PaymentService } from "@/services/payment.service";
import { createPayment, createStudent, createTestWorld } from "@/tests/factories";
import { disconnectDatabase, resetDatabase, testPrisma } from "@/tests/setup/db";

const day = (dayOfMonth: number) => new Date(2026, 8, dayOfMonth, 12);

describe("payment financial analytics — real PostgreSQL", () => {
  beforeEach(resetDatabase);
  afterEach(() => vi.useRealTimers());
  afterAll(disconnectDatabase);

  it("excludes later receipts and fees from each daily point while retaining the full-month summary", async () => {
    const { user, branch } = await createTestWorld();
    const earlyStudent = await createStudent({ branchId: branch.id });
    const laterStudent = await createStudent({ branchId: branch.id });
    const earlyFee = await createPayment({
      branchId: branch.id, studentId: earlyStudent.id, amount: 1200,
      dueDate: day(18), periodStart: day(1), periodEnd: day(30),
    });
    const laterFee = await createPayment({
      branchId: branch.id, studentId: laterStudent.id, amount: 700,
      dueDate: day(20), periodStart: day(1), periodEnd: day(30),
    });

    // Keep real timers and PostgreSQL scheduling; only receipt timestamps use
    // controlled application time. Collection evidence is DB-immutable.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(day(18));
    await FeeCollectionService.collect(user.id, branch.id, {
      studentId: earlyStudent.id, paymentIds: [earlyFee.id], amount: 500,
      method: "CASH", reference: "", note: "", idempotencyKey: randomUUID(),
    });
    vi.setSystemTime(day(20));
    await FeeCollectionService.collect(user.id, branch.id, {
      studentId: laterStudent.id, paymentIds: [laterFee.id], amount: 700,
      method: "UPI", reference: "", note: "", idempotencyKey: randomUUID(),
    });

    const points = await getPaymentTrend(branch.id, day(18), day(20), "DAY", "month");
    expect(points.map(point => point.revenueAmount)).toEqual([1200, 1200, 1900]);
    expect(points.map(point => point.paidAmount)).toEqual([500, 500, 1200]);
    expect(await getPaymentPeriodStats(branch.id, day(18), "month")).toMatchObject({
      revenueAmount: 1900, paidAmount: 1200,
    });
    expect(await testPrisma.feeCollection.count({ where: { branchId: branch.id } })).toBe(2);
  });

  it("subtracts waived debt without losing a partial receipt, then follows void and recollection", async () => {
    const { user, branch } = await createTestWorld();
    const student = await createStudent({ branchId: branch.id });
    const fee = await createPayment({
      branchId: branch.id, studentId: student.id, amount: 1200,
      dueDate: day(1), periodStart: day(1), periodEnd: day(30),
    });

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(day(5));
    const first = await FeeCollectionService.collect(user.id, branch.id, {
      studentId: student.id, paymentIds: [fee.id], amount: 700,
      method: "CASH", reference: "", note: "", idempotencyKey: randomUUID(),
    });
    vi.setSystemTime(day(6));
    await PaymentService.markPaymentAsWaived(user.id, fee.id);
    expect(await testPrisma.payment.findUniqueOrThrow({ where: { id: fee.id } })).toMatchObject({
      amount: 1200, collectedAmount: 700, waivedAmount: 500, status: "WAIVED",
    });
    expect(await getPaymentPeriodStats(branch.id, day(20), "month")).toMatchObject({
      revenueAmount: 700, paidAmount: 700, dueAmount: 0, collectionRate: 100,
    });

    vi.setSystemTime(day(7));
    await FeeCollectionService.void(user.id, branch.id, first.id, "Correct the recorded receipt");
    expect(await getPaymentPeriodStats(branch.id, day(20), "month")).toMatchObject({
      revenueAmount: 700, paidAmount: 0, dueAmount: 700, collectionRate: 0,
    });

    vi.setSystemTime(day(8));
    await FeeCollectionService.collect(user.id, branch.id, {
      studentId: student.id, paymentIds: [fee.id], amount: 700,
      method: "UPI", reference: "", note: "", idempotencyKey: randomUUID(),
    });
    expect(await testPrisma.payment.findUniqueOrThrow({ where: { id: fee.id } })).toMatchObject({
      amount: 1200, collectedAmount: 700, waivedAmount: 500, status: "WAIVED",
    });
    expect(await getPaymentPeriodStats(branch.id, day(20), "month")).toMatchObject({
      revenueAmount: 700, paidAmount: 700, dueAmount: 0, collectionRate: 100,
    });
    expect(await testPrisma.feeCollection.count({ where: { branchId: branch.id, voidedAt: null } })).toBe(1);
  });
});
