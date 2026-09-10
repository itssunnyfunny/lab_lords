import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { FeeCollectionService } from "@/services/feeCollection.service";
import { PaymentService } from "@/services/payment.service";
import { RenewalsService } from "@/services/renewals.service";
import { getOpenPaymentLedger, getPaymentPeriodStats, getPaymentStats } from "@/analytics/payment.analytics";
import { createTestWorld, createStudent, createPayment, createUser, createStaff } from "@/tests/factories";
import { resetDatabase, disconnectDatabase, testPrisma } from "@/tests/setup/db";
import { remainingFee } from "@/lib/feeBalance";
import { collectionAcknowledgementIsCurrent } from "@/services/collectionAcknowledgement.service";
import type { CollectionInput, FeeReceiptSnapshot } from "@/lib/feeCollections";
import type { Prisma } from "@/app/generated/prisma/client";

async function fixture() {
    const world = await createTestWorld();
    const student = await createStudent({ branchId: world.branch.id, monthlyFee: 1200 });
    const payment = await createPayment({ branchId: world.branch.id, studentId: student.id, amount: 1200,
        periodStart: new Date("2026-06-01"), periodEnd: new Date("2026-07-01"), dueDate: new Date("2026-07-01") });
    const input: CollectionInput = { studentId: student.id, paymentIds: [payment.id], amount: 1200,
        method: "CASH", reference: "", note: "", idempotencyKey: randomUUID() };
    return { ...world, student, payment, input };
}
describe("Fee collections — real PostgreSQL", () => {
    beforeEach(resetDatabase); afterAll(disconnectDatabase);
    it("full collection creates one receipt, immutable snapshot, allocation and audit", async () => {
        const f = await fixture();
        const c = await FeeCollectionService.collect(f.user.id, f.branch.id, f.input);
        expect(c.receiptNumber).toMatch(/^LL-/);
        expect(await testPrisma.payment.findUnique({ where: { id: f.payment.id } })).toMatchObject({ amount: 1200, collectedAmount: 1200, status: "PAID" });
        expect(await testPrisma.feeCollectionAllocation.count()).toBe(1);
        expect(await testPrisma.auditLog.count({ where: { paymentId: f.payment.id, action: "FEE_COLLECTED" } })).toBe(1);
        await testPrisma.student.update({ where: { id: f.student.id }, data: { name: "Changed student" } });
        await testPrisma.branch.update({ where: { id: f.branch.id }, data: { name: "Changed branch" } });
        const reprint = await FeeCollectionService.get(f.user.id, f.branch.id, c.id);
        expect(reprint.snapshot).toEqual(c.snapshot); expect(reprint.receiptNumber).toBe(c.receiptNumber);
        await expect(testPrisma.feeCollection.update({ where: { id: c.id }, data: { snapshot: {} } })).rejects.toThrow();
    });
    it("700 cash then 500 UPI preserves fee and separate receipts without double-counting", async () => {
        const f = await fixture();
        const first = await FeeCollectionService.collect(f.user.id, f.branch.id, { ...f.input, amount: 700 });
        expect(await getOpenPaymentLedger(f.branch.id)).toMatchObject({ dueAmount: 500 });
        expect((await getPaymentPeriodStats(f.branch.id)).paidAmount).toBe(700);
        expect((await testPrisma.payment.findUniqueOrThrow({ where: { id: f.payment.id } })).status).toBe("DUE");
        const renewals = await RenewalsService.list(f.user.id, f.branch.id, { days: 7, filter: "OUTSTANDING", search: "", limit: 50 });
        expect(renewals.items.find(p => p.paymentId === f.payment.id)?.amount).toBe(500);
        const second = await FeeCollectionService.collect(f.user.id, f.branch.id, { ...f.input, amount: 500, method: "UPI", idempotencyKey: randomUUID() });
        expect(first.receiptNumber).not.toBe(second.receiptNumber);
        expect((first.snapshot as unknown as FeeReceiptSnapshot).remainingBalance).toBe(500);
        expect((second.snapshot as unknown as FeeReceiptSnapshot).remainingBalance).toBe(0);
        expect((await getPaymentPeriodStats(f.branch.id)).paidAmount).toBe(1200);
        expect((await testPrisma.paymentResolutionEvent.findFirstOrThrow()).amount).toBe(500);
    });
    it("allocates oldest selected first and leaves an unselected older due alone", async () => {
        const f = await fixture();
        const other = await createPayment({ branchId: f.branch.id, studentId: f.student.id, amount: 800,
            periodStart: new Date("2026-07-01"), periodEnd: new Date("2026-08-01"), dueDate: new Date("2026-08-01") });
        const untouched = await createPayment({ branchId: f.branch.id, studentId: f.student.id, amount: 200,
            periodStart: new Date("2026-05-01"), periodEnd: new Date("2026-06-01"), dueDate: new Date("2026-06-01") });
        await FeeCollectionService.collect(f.user.id, f.branch.id, { ...f.input, paymentIds: [other.id, f.payment.id], amount: 1500 });
        expect(remainingFee(await testPrisma.payment.findUniqueOrThrow({ where: { id: other.id } }))).toBe(500);
        expect(remainingFee(await testPrisma.payment.findUniqueOrThrow({ where: { id: untouched.id } }))).toBe(200);
    });
    it.each([0, -1, 1201, 1.5, NaN, Infinity, "700", null])("rejects invalid amount %s without writes", async amount => {
        const f = await fixture();
        await expect(FeeCollectionService.collect(f.user.id, f.branch.id, { ...f.input, amount: amount as number })).rejects.toThrow();
        expect(await testPrisma.feeCollection.count()).toBe(0);
    });
    it("same-key concurrent and lost-response retries return the original collection; changed payload rejects", async () => {
        const f = await fixture();
        const [a,b] = await Promise.all([FeeCollectionService.collect(f.user.id, f.branch.id, f.input), FeeCollectionService.collect(f.user.id, f.branch.id, f.input)]);
        expect(a.id).toBe(b.id);
        expect((await FeeCollectionService.collect(f.user.id, f.branch.id, f.input)).id).toBe(a.id);
        await expect(FeeCollectionService.collect(f.user.id, f.branch.id, { ...f.input, method: "UPI" })).rejects.toThrow(/different collection/);
        expect(await testPrisma.feeCollection.count()).toBe(1);
    });
    it("competing operators cannot overcollect", async () => {
        const f = await fixture();
        const results = await Promise.allSettled([700,700].map(amount => FeeCollectionService.collect(f.user.id, f.branch.id, { ...f.input, amount, idempotencyKey: randomUUID() })));
        expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
        expect(remainingFee(await testPrisma.payment.findUniqueOrThrow({ where: { id: f.payment.id } }))).toBe(500);
    });
    it("audit failure rolls back collection, allocation, receipt and fee together", async () => {
        const f = await fixture();
        await expect(testPrisma.$transaction(async tx => {
            const failing = new Proxy(tx, { get(target, key) {
                if (key === "auditLog") return { create: () => { throw new Error("forced audit failure"); } };
                const value = Reflect.get(target, key); return typeof value === "function" ? value.bind(target) : value;
            } }) as Prisma.TransactionClient;
            await FeeCollectionService.collectInTransaction(f.user.id, f.branch.id, f.input, failing);
        })).rejects.toThrow("forced audit failure");
        expect(await testPrisma.feeCollection.count()).toBe(0);
        expect(await testPrisma.feeCollectionAllocation.count()).toBe(0);
        expect((await testPrisma.payment.findUniqueOrThrow({ where: { id: f.payment.id } })).collectedAmount).toBe(0);
    });
    it("waives only the remainder; an owner void reverses money once and keeps the waiver", async () => {
        const f = await fixture();
        const c = await FeeCollectionService.collect(f.user.id, f.branch.id, { ...f.input, amount: 700 });
        await PaymentService.markPaymentAsWaived(f.user.id, f.payment.id);
        expect(await testPrisma.payment.findUnique({ where: { id: f.payment.id } })).toMatchObject({ status: "WAIVED", collectedAmount: 700, waivedAmount: 500 });
        const staff = await createUser(); await createStaff({ branchId: f.branch.id, userId: staff.id, role: "MANAGER" });
        await expect(FeeCollectionService.void(staff.id, f.branch.id, c.id, "Mistake")).rejects.toThrow(/Only the owner/);
        await expect(FeeCollectionService.void(f.user.id, f.branch.id, c.id, "  ")).rejects.toThrow(/reason/);
        await FeeCollectionService.void(f.user.id, f.branch.id, c.id, "Wrong student");
        await FeeCollectionService.void(f.user.id, f.branch.id, c.id, "Retry");
        expect(await testPrisma.payment.findUnique({ where: { id: f.payment.id } })).toMatchObject({ status: "DUE", collectedAmount: 0, waivedAmount: 500 });
        const current = await FeeCollectionService.get(f.user.id, f.branch.id, c.id);
        expect(current.voidReason).toBe("Wrong student"); expect(current.receiptNumber).toBe(c.receiptNumber);
        expect(current.snapshot).toEqual(c.snapshot);
        expect(await testPrisma.auditLog.count({ where: { action: "FEE_COLLECTION_VOIDED" } })).toBe(1);
        await FeeCollectionService.collect(f.user.id, f.branch.id, { ...f.input, amount: 700, idempotencyKey: randomUUID() });
        expect(await testPrisma.payment.findUnique({ where: { id: f.payment.id } })).toMatchObject({ status: "WAIVED", collectedAmount: 700, waivedAmount: 500 });
    });
    it("foreign student/payment/receipt IDs and denied permissions do not write", async () => {
        const f = await fixture(); const foreign = await fixture();
        await expect(FeeCollectionService.collect(f.user.id, f.branch.id, { ...f.input, studentId: foreign.student.id })).rejects.toThrow(/not found/);
        await expect(FeeCollectionService.collect(f.user.id, f.branch.id, { ...f.input, paymentIds: [foreign.payment.id] })).rejects.toThrow(/not found/);
        const c = await FeeCollectionService.collect(foreign.user.id, foreign.branch.id, foreign.input);
        await expect(FeeCollectionService.get(f.user.id, f.branch.id, c.id)).rejects.toThrow(/not found/);
        await expect(FeeCollectionService.get(f.user.id, foreign.branch.id, c.id)).rejects.toThrow(/not found/);
        const staff = await createUser(); await createStaff({ branchId: f.branch.id, userId: staff.id });
        await testPrisma.staffPermissionOverride.create({ data: { staffId: (await testPrisma.staff.findFirstOrThrow({ where: { userId: staff.id } })).id, action: "MARK_PAYMENT_PAID", allowed: false } });
        await expect(FeeCollectionService.collect(staff.id, f.branch.id, f.input)).rejects.toThrow(/Unauthorized/);
    });
    it("concurrent voids reverse once and old acknowledgements stay invalid after recollection", async () => {
        const f = await fixture();
        const c = await FeeCollectionService.collect(f.user.id, f.branch.id, f.input);
        const old = await testPrisma.paymentResolutionEvent.findFirstOrThrow({ include: { payment: true } });
        await Promise.all(["Wrong amount", "Duplicate click"].map(reason => FeeCollectionService.void(f.user.id, f.branch.id, c.id, reason)));
        expect(await testPrisma.auditLog.count({ where: { action: "FEE_COLLECTION_VOIDED" } })).toBe(1);
        await FeeCollectionService.collect(f.user.id, f.branch.id, { ...f.input, idempotencyKey: randomUUID() });
        expect(await collectionAcknowledgementIsCurrent(testPrisma, old)).toBe(false);
        const newest = await testPrisma.paymentResolutionEvent.findFirstOrThrow({ where: { id: { not: old.id } }, include: { payment: true } });
        expect(await collectionAcknowledgementIsCurrent(testPrisma, newest)).toBe(true);
    });
    it("historical imports have no manufactured collection date or receipt; full actions settle only remaining", async () => {
        const f = await fixture();
        await testPrisma.$transaction(tx => PaymentService.markPaymentAsPaidInTransaction(f.user.id, f.payment.id, undefined, undefined, tx, { source: "IMPORT_EXECUTION" }));
        expect(await testPrisma.payment.findUnique({ where: { id: f.payment.id } })).toMatchObject({ paidAt: null, ledgerBacked: false });
        expect(await testPrisma.feeCollection.count()).toBe(0);
        expect((await getPaymentPeriodStats(f.branch.id)).paidAmount).toBe(0);
        expect(await getPaymentStats(f.branch.id)).toMatchObject({ paidCount: 1, paidAmount: 0 });
        const second = await fixture();
        await FeeCollectionService.collect(second.user.id, second.branch.id, { ...second.input, amount: 700 });
        await PaymentService.markPaymentAsPaid(second.user.id, second.payment.id, "UPI");
        expect((await getPaymentPeriodStats(second.branch.id)).paidAmount).toBe(1200);
        expect((await testPrisma.feeCollection.findMany({ where: { branchId: second.branch.id }, orderBy: { collectedAt: "asc" } })).map(c => c.amount)).toEqual([700,500]);
    });
    it("a legacy full-payment retry after void cannot report an outstanding fee as collected", async () => {
        const f = await fixture();
        await PaymentService.markPaymentAsPaid(f.user.id, f.payment.id);
        const original = await testPrisma.feeCollection.findFirstOrThrow();
        await FeeCollectionService.void(f.user.id, f.branch.id, original.id, "Recorded by mistake");
        await expect(PaymentService.markPaymentAsPaid(f.user.id, f.payment.id)).rejects.toThrow(/voided.*Collect fee/);
        expect(await testPrisma.payment.findUniqueOrThrow({ where: { id: f.payment.id } })).toMatchObject({ status: "DUE", collectedAmount: 0 });
        expect(await testPrisma.feeCollection.count()).toBe(1);
        await FeeCollectionService.collect(f.user.id, f.branch.id, f.input);
        expect(await testPrisma.payment.findUniqueOrThrow({ where: { id: f.payment.id } })).toMatchObject({ status: "PAID", collectedAmount: 1200 });
        expect(await testPrisma.feeCollection.count()).toBe(2);
    });
});
