import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { resetDatabase, disconnectDatabase, testPrisma } from "@/tests/setup/db";
import { createBranch, createOrg, createStudent, createUser } from "@/tests/factories";
import { PaymentService } from "@/services/payment.service";

beforeEach(resetDatabase);
afterAll(disconnectDatabase);
describe("documented dues-policy investigation", () => {
    it("characterizes the existing system cron exception without granting user writes or SaaS access", async () => {
        const owner = await createUser();
        const organization = await createOrg({ ownerId: owner.id, billingModelVersion: "WORKSPACE_V2" });
        const branch = await createBranch({ organizationId: organization.id });
        const student = await createStudent({ branchId: branch.id, joinedAt: new Date("2026-01-31T00:00:00Z"), monthlyFee: 1100 });
        const asOf = new Date("2026-03-31T00:00:00Z");
        const orgBefore = await testPrisma.organization.findUniqueOrThrow({ where: { id: organization.id } });
        await expect(PaymentService.generateDuePaymentsForBranch(owner.id, branch.id, asOf)).rejects.toThrow(/paid subscription/i);
        // This is the known discrepancy in domain-invariants.md, not approval
        // for a new machine entitlement bypass. The owner must decide its policy.
        await PaymentService.generateDuePaymentsForAllActiveStudents(new Date("2026-02-28T00:00:00Z"));
        const first = await testPrisma.payment.findMany({ where: { studentId: student.id } });
        expect(first.length).toBeGreaterThan(0);
        expect(first.every(row => row.status === "DUE")).toBe(true);
        await PaymentService.generateDuePaymentsForAllActiveStudents(asOf);
        const later = await testPrisma.payment.findMany({ where: { studentId: student.id }, orderBy: { dueDate: "asc" } });
        expect(later.length).toBeGreaterThan(first.length);
        const indiaDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" });
        expect(later.map(row => indiaDay.format(row.dueDate))).toEqual(["2026-02-28", "2026-03-31"]);
        expect(later.every(row => row.status === "DUE")).toBe(true);
        const repeat = await PaymentService.generateDuePaymentsForAllActiveStudents(asOf);
        expect(repeat.generatedCount).toBe(0);
        expect(await testPrisma.payment.findMany({ where: { studentId: student.id }, orderBy: { dueDate: "asc" } })).toEqual(later);
        expect(await testPrisma.organization.findUniqueOrThrow({ where: { id: organization.id } })).toEqual(orgBefore);
        expect(await testPrisma.billingProviderAction.count()).toBe(0);
        expect(await testPrisma.organizationSubscriptionHistory.count()).toBe(0);
    });
});
