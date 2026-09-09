import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createBranch, createOrg, createPayment, createStaff, createStudent, createTestWorld, createUser } from "@/tests/factories";
import { disconnectDatabase, resetDatabase, testPrisma } from "@/tests/setup/db";
import { RenewalsService } from "@/services/renewals.service";
import { PaymentService } from "@/services/payment.service";
import { renewalQuerySchema, type FollowUpInput } from "@/lib/renewals";

const day = (s: string) => new Date(`${s}T00:00:00`);
const today = day("2026-09-08");
const query = renewalQuerySchema.parse({});
const input = (studentId: string): FollowUpInput => ({ studentId, type: "MONTHLY",
    periodStart: day("2026-08-10").toISOString(), note: "Call tomorrow", outcome: "ATTEMPTED", nextFollowUpAt: "2026-09-09" });
describe("Renewals and dues", () => {
    beforeEach(resetDatabase);
    afterAll(disconnectDatabase);

    it("reads without writes, preserves earlier debt, and refreshes totals after existing collection", async () => {
        const { user, branch } = await createTestWorld();
        const student = await createStudent({ branchId: branch.id, joinedAt: day("2026-01-10") });
        const payment = await createPayment({ branchId: branch.id, studentId: student.id,
            periodStart: day("2026-07-10"), periodEnd: day("2026-08-10"), dueDate: day("2026-08-10"), amount: 900 });
        const before = await testPrisma.payment.findMany();
        const page = await RenewalsService.list(user.id, branch.id, query, today);
        expect(page.items).toHaveLength(2);
        expect(page.items.map(r => r.expected)).toEqual([false, true]);
        expect(page.outstandingAmount).toBe(900);
        expect(page.expectedAmount).toBe(1000);
        expect(page.counts).toEqual({ ALL: 2, TODAY: 0, UPCOMING: 1, OUTSTANDING: 1, OVERDUE: 1 });
        expect(await testPrisma.payment.findMany()).toEqual(before);
        expect(await testPrisma.renewalFollowUp.count()).toBe(0);
        await PaymentService.markPaymentAsPaid(user.id, payment.id, "CASH");
        const refreshed = await RenewalsService.list(user.id, branch.id, query, today);
        expect(refreshed.items).toHaveLength(1);
        expect(refreshed.items[0].expected).toBe(true);
        expect(refreshed.outstandingAmount).toBe(0);
    });
    it.each(["PAID", "WAIVED", "DUE"] as const)("suppresses duplicate projection for an existing %s cycle", async status => {
        const { user, branch } = await createTestWorld();
        const student = await createStudent({ branchId: branch.id, joinedAt: day("2026-01-10") });
        await createPayment({ branchId: branch.id, studentId: student.id, periodStart: day("2026-08-10"),
            periodEnd: day("2026-09-10"), dueDate: day("2026-09-10"), status });
        const page = await RenewalsService.list(user.id, branch.id, query, today);
        expect(page.items).toHaveLength(status === "DUE" ? 1 : 0);
        expect(page.items.some(r => r.expected)).toBe(false);
    });
    it("retains inactive debts while excluding inactive and billingStartAt projections", async () => {
        const { user, branch } = await createTestWorld();
        const inactive = await createStudent({ branchId: branch.id, joinedAt: day("2026-01-10") });
        await testPrisma.student.update({ where: { id: inactive.id }, data: { status: "INACTIVE" } });
        await createPayment({ branchId: branch.id, studentId: inactive.id, dueDate: day("2026-08-10"),
            periodStart: day("2026-07-10"), periodEnd: day("2026-08-10") });
        await createStudent({ branchId: branch.id, joinedAt: day("2026-01-10"), billingStartAt: day("2026-08-11") });
        const page = await RenewalsService.list(user.id, branch.id, query, today);
        expect(page.items).toHaveLength(1);
        expect(page.items[0]).toMatchObject({ studentStatus: "INACTIVE", expected: false });
    });
    it("uses the legacy calendar-day guard without treating admission as a monthly fee", async () => {
        const { user, branch } = await createTestWorld();
        const student = await createStudent({ branchId: branch.id, joinedAt: day("2026-01-10") });
        await createPayment({ branchId: branch.id, studentId: student.id, type: "ADMISSION", status: "PAID",
            periodStart: day("2026-08-10"), periodEnd: day("2026-09-10"), dueDate: day("2026-09-10") });
        expect((await RenewalsService.list(user.id, branch.id, query, today)).items).toHaveLength(1);
        await createPayment({ branchId: branch.id, studentId: student.id, status: "WAIVED",
            periodStart: day("2026-08-01"), periodEnd: day("2026-09-10"), dueDate: new Date("2026-09-10T12:00:00") });
        expect((await RenewalsService.list(user.id, branch.id, query, today)).items).toHaveLength(0);
    });
    it("saves, replaces and clears follow-up details and retains the cycle link after generation", async () => {
        const { user, branch } = await createTestWorld();
        const student = await createStudent({ branchId: branch.id, joinedAt: day("2026-01-10") });
        const saved = await RenewalsService.saveFollowUp(user.id, branch.id, input(student.id), today);
        expect(saved.author?.name).toBe(user.name);
        expect(saved.nextFollowUpAt).not.toBeNull();
        await RenewalsService.saveFollowUp(user.id, branch.id, { ...input(student.id), note: "", outcome: "CONTACTED", nextFollowUpAt: null }, today);
        expect(await testPrisma.renewalFollowUp.count()).toBe(1);
        const page = await RenewalsService.list(user.id, branch.id, query, today);
        expect(page.items[0].followUp).toMatchObject({ note: "", outcome: "CONTACTED", nextFollowUpAt: null });
        await PaymentService.generateDuePaymentsForBranch(user.id, branch.id, day("2026-09-10"));
        const generated = await RenewalsService.list(user.id, branch.id, query, day("2026-09-10"));
        expect(generated.items.find(r => r.periodStart === input(student.id).periodStart)).toMatchObject({ expected: false,
            followUp: { outcome: "CONTACTED", nextFollowUpAt: null } });
    });
    it.each(["PAID", "WAIVED", "DUE"] as const)("rejects stale projected follow-ups covered by a legacy %s payment", async status => {
        const { user, branch } = await createTestWorld();
        const student = await createStudent({ branchId: branch.id, joinedAt: day("2026-01-10") });
        await createPayment({ branchId: branch.id, studentId: student.id, type: "ADMISSION", status: "PAID",
            periodStart: day("2026-08-10"), periodEnd: day("2026-09-10"), dueDate: day("2026-09-10") });
        await RenewalsService.saveFollowUp(user.id, branch.id, input(student.id), today);
        await createPayment({ branchId: branch.id, studentId: student.id, status,
            periodStart: day("2026-08-01"), periodEnd: day("2026-09-10"), dueDate: new Date("2026-09-10T12:00:00") });
        await expect(RenewalsService.saveFollowUp(user.id, branch.id, { ...input(student.id), note: "Stale edit" }, today))
            .rejects.toThrow("no longer");
        expect((await testPrisma.renewalFollowUp.findFirst())?.note).toBe("Call tomorrow");
    });
    it("enforces staff overrides, branch writability and generic cross-tenant boundaries", async () => {
        const { user, branch } = await createTestWorld();
        const student = await createStudent({ branchId: branch.id, joinedAt: day("2026-01-10") });
        const other = await createUser();
        const org = await createOrg({ ownerId: other.id });
        const foreignBranch = await createBranch({ organizationId: org.id });
        const foreignStudent = await createStudent({ branchId: foreignBranch.id });
        await expect(RenewalsService.list(other.id, branch.id, query, today)).rejects.toThrow("Branch not found");
        await expect(RenewalsService.saveFollowUp(user.id, branch.id, input(foreignStudent.id), today)).rejects.toThrow("Student not found");
        await expect(RenewalsService.saveFollowUp(user.id, branch.id, input("missing"), today)).rejects.toThrow("Student not found");
        const staffUser = await createUser();
        const staff = await createStaff({ userId: staffUser.id, branchId: branch.id, role: "STAFF" });
        await RenewalsService.saveFollowUp(staffUser.id, branch.id, input(student.id), today);
        await testPrisma.staffPermissionOverride.create({ data: { staffId: staff.id, action: "MARK_PAYMENT_PAID", allowed: false } });
        await expect(RenewalsService.saveFollowUp(staffUser.id, branch.id, input(student.id), today)).rejects.toThrow("Permission");
        expect((await RenewalsService.list(staffUser.id, branch.id, query, today)).items[0].followUp?.author?.name).toBe(staffUser.name);
        await testPrisma.staffPermissionOverride.create({ data: { staffId: staff.id, action: "VIEW_PAYMENTS", allowed: false } });
        await expect(RenewalsService.list(staffUser.id, branch.id, query, today)).rejects.toThrow("Permission");
        await testPrisma.branch.update({ where: { id: branch.id }, data: { billingStatus: "ARCHIVED" } });
        await expect(RenewalsService.saveFollowUp(user.id, branch.id, input(student.id), today)).rejects.toThrow("archived");
        expect((await RenewalsService.list(user.id, branch.id, query, today)).items).toHaveLength(1);
    });
    it("rejects forged cycles and resolved payment follow-ups", async () => {
        const { user, branch } = await createTestWorld();
        const student = await createStudent({ branchId: branch.id, joinedAt: day("2026-01-10") });
        await expect(RenewalsService.saveFollowUp(user.id, branch.id, { ...input(student.id), periodStart: day("2026-08-11").toISOString() }, today)).rejects.toThrow("no longer");
        await createPayment({ branchId: branch.id, studentId: student.id, periodStart: day("2026-08-10"),
            dueDate: day("2026-09-10"), periodEnd: day("2026-09-10"), status: "PAID" });
        await expect(RenewalsService.saveFollowUp(user.id, branch.id, input(student.id), today)).rejects.toThrow("resolved");
    });
    it("paginates without duplicate cycles and applies name/phone search to counts", async () => {
        const { user, branch } = await createTestWorld();
        for (let index = 0; index < 3; index++) await createStudent({ branchId: branch.id,
            joinedAt: day("2026-01-10"), name: `Renewal ${index}`, phone: `987654321${index}` });
        const first = await RenewalsService.list(user.id, branch.id, { ...query, limit: 2 }, today);
        expect(first.counts.ALL).toBe(3);
        const next = await RenewalsService.list(user.id, branch.id, { ...query, limit: 2, cursor: first.nextCursor! }, today);
        expect(next.items).toHaveLength(1);
        expect(next.nextCursor).toBeNull();
        expect(new Set([...first.items, ...next.items].map(r => r.key)).size).toBe(3);
        expect((await RenewalsService.list(user.id, branch.id, { ...query, search: "renewal 1" }, today)).counts.ALL).toBe(1);
        expect((await RenewalsService.list(user.id, branch.id, { ...query, search: "9876543212" }, today)).counts.ALL).toBe(1);
    });
    it("enforces the composite tenant foreign key for follow-up storage", async () => {
        const { user, branch } = await createTestWorld();
        const foreign = await createTestWorld();
        const student = await createStudent({ branchId: foreign.branch.id });
        await expect(testPrisma.renewalFollowUp.create({ data: { branchId: branch.id, studentId: student.id,
            type: "MONTHLY", periodStart: today, authorId: user.id } })).rejects.toThrow();
    });
    it("counts across bounded student batches without truncating a branch", async () => {
        const { user, branch } = await createTestWorld();
        await testPrisma.student.createMany({ data: Array.from({ length: 260 }, (_, index) => ({
            id: `renewal_batch_${index.toString().padStart(3, "0")}`, name: `Batch ${index}`, branchId: branch.id,
            joinedAt: day("2026-01-10"), monthlyFee: 1000,
        })) });
        const result = await RenewalsService.list(user.id, branch.id, query, today);
        expect(result.counts.UPCOMING).toBe(260);
        expect(result.items).toHaveLength(25);
        expect(result.expectedAmount).toBe(260000);
        expect(await testPrisma.payment.count()).toBe(0);
    });
    it("retains separate older periods and the upcoming cycle after paying only one due", async () => {
        const { user, branch } = await createTestWorld();
        const student = await createStudent({ branchId: branch.id, joinedAt: day("2026-01-10") });
        for (const [start, end, amount] of [["2026-06-10", "2026-07-10", 800], ["2026-07-10", "2026-08-10", 900]] as const) {
            await createPayment({ branchId: branch.id, studentId: student.id, periodStart: day(start), periodEnd: day(end), dueDate: day(end), amount });
        }
        const page = await RenewalsService.list(user.id, branch.id, query, today);
        expect(page.items.map(r => r.amount)).toEqual([800, 900, 1000]);
        expect(page.outstandingAmount).toBe(1700);
        await PaymentService.markPaymentAsPaid(user.id, page.items[0].paymentId!, "CASH");
        const next = await RenewalsService.list(user.id, branch.id, query, today);
        expect(next.items.map(r => r.amount)).toEqual([900, 1000]);
        expect(next.outstandingAmount).toBe(900);
    });
});
