import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBranch, createOrg, createSaasSubscription, createUser } from "@/tests/factories";
import { resetDatabase, disconnectDatabase, testPrisma as db } from "@/tests/setup/db";
import { BranchBillingConversion } from "@/services/branchBillingConversion.service";
import { BillingExperienceService } from "@/services/billingExperience.service";
import { BillingHistoryService } from "@/services/billingHistory.service";
import { BranchService } from "@/services/branch.service";
import { EntitlementService } from "@/services/entitlement.service";
import { setRazorpayClientForTests, type RazorpayApiClient, type RazorpayInvoice } from "@/lib/razorpay";
import { UserService } from "@/services/user.service";

describe("independently billed branches", () => {
    beforeEach(resetDatabase);
    afterEach(() => { setRazorpayClientForTests(null); vi.unstubAllEnvs(); vi.useRealTimers(); });
    afterAll(disconnectDatabase);

    it("projects three settled plans in the same directory and limits invoice reads to the selected agreement", async () => {
        const owner = await createUser();
        const org = await createOrg({ ownerId: owner.id, billingModelVersion: "BRANCH_V3" });
        const branches = [];
        for (const plan of ["BASIC", "STANDARD", "PRO"] as const) {
            const branch = await createBranch({ organizationId: org.id, name: plan });
            await db.branchBillingAgreement.create({ data: { organizationId: org.id, branchId: branch.id, selectedPlan: plan } });
            const sub = await createSaasSubscription({ organizationId: org.id, agreementBranchId: branch.id, plan });
            branches.push({ branch, sub, plan });
            expect(await BillingExperienceService.getForBranch(branch.id, owner.id)).toMatchObject({ effectivePlan: plan, accessMode: "FULL", confirmedQuantity: 1 });
            const { items } = await BillingHistoryService.page(owner.id, org.id, "invoices", null, branch.id);
            expect(items).toHaveLength(1);
            expect(items[0]).toMatchObject({ agreementBranchId: branch.id });
        }
        const { organizations } = await UserService.getWorkspaceDirectory(owner.id);
        expect(organizations[0].branches.map(b => b.billing?.effectivePlan).sort()).toEqual(["BASIC", "PRO", "STANDARD"]);
        expect(organizations[0].branches.reduce((sum, b) => sum + (b.billing?.monthlyCommitment ?? 0), 0)).toEqual(89700);
        await db.organizationSubscription.update({ where: { id: branches[1].sub.id }, data: { status: "HALTED" } });
        expect(await EntitlementService.getBranchProfile(branches[1].branch.id)).toMatchObject({ canWrite: false, entitlements: [] });
        expect(await EntitlementService.getBranchProfile(branches[2].branch.id)).toMatchObject({ canWrite: true, effectivePlan: "PRO" });
        await expect(BillingHistoryService.page(owner.id, org.id, "invoices", null, "unknown")).rejects.toThrow("not found");
    });

    it("keeps a single Pro trial when a Basic future plan is chosen and replays only matching creation requests", async () => {
        const owner = await createUser();
        const org = await createOrg({ ownerId: owner.id, billingModelVersion: "BRANCH_V3" });
        const ends = new Date(Date.now() + 5 * 86400000);
        await db.ownerTrialGrant.create({ data: { ownerId: owner.id, organizationId: org.id, trialPlan: "PRO",
            status: "ACTIVE", source: "ONBOARDING", trialEndsAt: ends, consumedAt: new Date() } });
        const input = { userId: owner.id, organizationId: org.id, name: "Library", contactPhone: "9876543210",
            futurePlan: "BASIC" as const, idempotencyKey: "create-first" };
        const first = await BranchService.createBranchForOrg(input);
        expect((await BranchService.createBranchForOrg(input)).id).toBe(first.id);
        await expect(BranchService.createBranchForOrg({ ...input, futurePlan: "PRO" })).rejects.toThrow("different branch plan");
        expect(await BillingExperienceService.getForBranch(first.id, owner.id)).toMatchObject({
            effectivePlan: "PRO", selectedPostTrialPlan: "BASIC", trialEndsAt: ends.toISOString(), currentMonthlyTotal: 0,
        });
        await expect(BranchService.scheduleBillingRemoval(owner.id, first.id, "last")).rejects.toThrow("final billable");
        const second = await BranchService.createBranchForOrg({ ...input, name: "Second", idempotencyKey: "create-second" });
        const scheduled = await BranchService.scheduleBillingRemoval(owner.id, second.id, "archive");
        expect(scheduled.branch.billingStatus).toBe("REMOVAL_SCHEDULED");
        await BranchService.undoBillingRemoval(owner.id, second.id, scheduled.change.id);
        expect(await db.ownerTrialGrant.count()).toBe(1);
        expect((await db.ownerTrialGrant.findUniqueOrThrow({ where: { ownerId: owner.id } })).trialEndsAt).toEqual(ends);
        expect(await db.organizationSubscription.count()).toBe(0);
    });

    it("previews all successors together, marks future coverage conditional and leaves every mandate untouched", async () => {
        const owner = await createUser();
        const org = await createOrg({ ownerId: owner.id, billingModelVersion: "WORKSPACE_V2" });
        const basic = await createBranch({ organizationId: org.id });
        const pro = await createBranch({ organizationId: org.id });
        const archived = await createBranch({ organizationId: org.id, billingStatus: "ARCHIVED" });
        const choices = { [basic.id]: "BASIC", [pro.id]: "PRO", [archived.id]: "STANDARD" } as const;
        const end = new Date(Date.now() + 2 * 86400000);
        const source = await createSaasSubscription({ organizationId: org.id, plan: "STANDARD", quantity: 2, paidThrough: end });
        const grant = await db.ownerTrialGrant.create({ data: { ownerId: owner.id, organizationId: org.id,
            status: "ACTIVE", source: "ONBOARDING", trialPlan: "PRO", trialEndsAt: end, consumedAt: new Date() } });
        const { snapshot, digest } = await BranchBillingConversion.preflight(org.id, choices);
        const roster = snapshot.renewingCohort!;
        expect(roster).toMatchObject({ sourceId: source.id, sourcePlan: "STANDARD", sourceStatus: "ACTIVE",
            authorizationState: "NOT_STAGED", timingReason: "This candidate requires a later source renewal and its exact settlement." });
        expect(roster.candidateCommonStartAt!.getTime()).toBeGreaterThan(end.getTime());
        expect(roster.candidateAuthorizeBy!.getTime()).toBe(roster.candidateCommonStartAt!.getTime() - 72 * 3600000);
        expect(roster.successors).toHaveLength(3);
        expect(roster.successors).toEqual(expect.arrayContaining([
            expect.objectContaining({ branchId: basic.id, proposedPlan: "BASIC", proposedQuantity: 1, catalogueUnitAmountSubunits: 9900,
                proposedMonthlyGrossSubunits: 9900, sourcePaidThrough: end, ownerTrial: { plan: "PRO", endsAt: end } }),
            expect.objectContaining({ branchId: pro.id, proposedPlan: "PRO", proposedQuantity: 1, proposedMonthlyGrossSubunits: 49900, sourcePaidThrough: end }),
            expect.objectContaining({ branchId: archived.id, proposedPlan: "STANDARD", proposedQuantity: 0,
                catalogueUnitAmountSubunits: 29900, proposedMonthlyGrossSubunits: 0, sourcePaidThrough: null, ownerTrial: null }),
        ]));
        await expect(BranchBillingConversion.apply(org.id, choices, digest)).rejects.toThrow("held");
        await db.ownerTrialGrant.update({ where: { id: grant.id }, data: { trialEndsAt: new Date(roster.candidateCommonStartAt!.getTime() + 86400000) } });
        const laterTrial = await BranchBillingConversion.preflight(org.id, choices);
        expect(laterTrial.snapshot.renewingCohort).toMatchObject({ candidateCommonStartAt: null, candidateAuthorizeBy: null,
            timingReason: "The original owner trial extends past the candidate source boundary." });
        const incomplete = await BranchBillingConversion.preflight(org.id, { [basic.id]: "BASIC" });
        expect(incomplete.snapshot.holds).toContain("Review a catalogue plan for every branch including archived branches");
        expect(incomplete.snapshot.renewingCohort).toMatchObject({ candidateCommonStartAt: null, candidateAuthorizeBy: null });
        expect(await db.branchBillingAgreement.count()).toBe(0);
        expect(await db.organizationSubscription.findMany()).toEqual([source]);
    });

    it("holds a live or unreconciled aggregate, then carries the final settled interval for both branches", async () => {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date(Math.floor(Date.now() / 1000) * 1000));
        const owner = await createUser();
        const org = await createOrg({ ownerId: owner.id, billingModelVersion: "WORKSPACE_V2" });
        const branch = await createBranch({ organizationId: org.id });
        const sibling = await createBranch({ organizationId: org.id });
        const source = await createSaasSubscription({ organizationId: org.id, plan: "STANDARD", quantity: 2 });
        const choices = { [branch.id]: "PRO" as const, [sibling.id]: "BASIC" as const };
        const original = await db.organizationSubscriptionInvoice.findMany({ where: { organizationId: org.id } });
        const held = await BranchBillingConversion.preflight(org.id, choices);
        expect(held.snapshot.holds).toContain("Reconcile all mandates and confirm recurring collection has ended");
        expect(held.snapshot.renewingCohort).toMatchObject({ candidateCommonStartAt: source.paidThrough,
            timingReason: "The candidate uses the currently settled source boundary.", authorizationState: "NOT_STAGED" });
        await expect(BranchBillingConversion.apply(org.id, choices, held.digest)).rejects.toThrow("held");
        await db.organizationSubscription.update({ where: { id: source.id }, data: { status: "CANCELLED" } });
        const remoteMandate = { id: source.razorpaySubscriptionId, entity: "subscription",
            plan_id: source.razorpayPlanId, quantity: 2, status: "cancelled", has_scheduled_changes: false,
            paid_count: 1, current_start: source.currentStart!.getTime() / 1000, current_end: source.currentEnd!.getTime() / 1000 };
        const remoteInvoice: RazorpayInvoice = { id: original[0].razorpayInvoiceId, entity: "invoice",
            subscription_id: remoteMandate.id, payment_id: source.lastConfirmedPaymentId, status: "paid", amount: 59800,
            amount_paid: 59800, amount_due: 0, currency: "INR", paid_at: original[0].paidAt!.getTime() / 1000,
            billing_start: remoteMandate.current_start, billing_end: remoteMandate.current_end };
        const remotePayment = { id: source.lastConfirmedPaymentId, entity: "payment", status: "captured", captured: true,
            invoice_id: remoteInvoice.id, subscription_id: remoteMandate.id, amount: remoteInvoice.amount, currency: "INR", amount_refunded: 0 };
        const provider = { fetchSubscription: vi.fn(async () => remoteMandate),
            fetchSubscriptionInvoices: vi.fn(async () => ({ entity: "collection", count: 1, items: [remoteInvoice] })),
            fetchPayment: vi.fn(async () => remotePayment) };
        setRazorpayClientForTests(provider as unknown as RazorpayApiClient);
        const review = await BranchBillingConversion.preflight(org.id, choices);
        expect(review.snapshot.holds).toEqual([]);
        // No local webhook or durable invoice identifies this late final capture yet.
        provider.fetchSubscription.mockResolvedValueOnce({ ...remoteMandate, paid_count: 2 });
        provider.fetchSubscriptionInvoices.mockResolvedValueOnce({ entity: "collection", count: 2, items: [
            remoteInvoice, { ...remoteInvoice, id: "inv_unobserved", payment_id: "pay_unobserved",
                billing_start: remoteMandate.current_end, billing_end: remoteMandate.current_end + 86400 }] });
        await expect(BranchBillingConversion.apply(org.id, choices, review.digest)).rejects.toThrow("held");
        provider.fetchSubscription.mockResolvedValueOnce({ ...remoteMandate, current_end: remoteMandate.current_end + 86400 });
        await expect(BranchBillingConversion.apply(org.id, choices, review.digest)).rejects.toThrow("held");
        provider.fetchPayment.mockResolvedValueOnce({ ...remotePayment, amount_refunded: remoteInvoice.amount });
        await expect(BranchBillingConversion.apply(org.id, choices, review.digest)).rejects.toThrow("held");
        await expect(BranchBillingConversion.apply(org.id, { ...choices, [branch.id]: "BASIC" }, review.digest)).rejects.toThrow("held");
        expect(await db.branchBillingAgreement.count({ where: { organizationId: org.id } })).toBe(0);
        expect(await db.organization.findUniqueOrThrow({ where: { id: org.id } })).toMatchObject({ billingModelVersion: "WORKSPACE_V2" });
        expect(await BranchBillingConversion.apply(org.id, choices, review.digest)).toMatchObject({ agreementsCreated: 2, providerWrites: 0 });
        expect(await db.organizationSubscriptionInvoice.findMany({ where: { organizationId: org.id } })).toEqual(original);
        expect(await BillingExperienceService.getForBranch(branch.id, owner.id)).toMatchObject({ effectivePlan: "STANDARD",
            legacyCoverageEndsAt: source.paidThrough!.toISOString(), selectedPostTrialPlan: "PRO", paidThrough: null, confirmedQuantity: 0 });
        expect(await BillingExperienceService.getForBranch(sibling.id, owner.id)).toMatchObject({ effectivePlan: "STANDARD",
            legacyCoverageEndsAt: source.paidThrough!.toISOString(), selectedPostTrialPlan: "BASIC", paidThrough: null, confirmedQuantity: 0 });
        expect((await BillingHistoryService.page(owner.id, org.id, "invoices", null, branch.id)).items).toEqual([]);
        const added = await BranchService.createBranchForOrg({ organizationId: org.id, userId: owner.id, name: "New branch", contactPhone: "9876543210",
            futurePlan: "PRO", idempotencyKey: "new-after-conversion" });
        expect(added.billingStatus).toBe("PENDING_ACTIVATION");
        expect(await EntitlementService.getBranchProfile(added.id)).toMatchObject({ canWrite: false, entitlements: [] });
        expect(await db.organizationSubscription.count()).toBe(1);
        const trialEndsAt = new Date(Date.now() + 5 * 86400000);
        await db.ownerTrialGrant.create({ data: { ownerId: owner.id, organizationId: org.id, trialPlan: "BASIC",
            status: "ACTIVE", source: "ONBOARDING", trialEndsAt, consumedAt: new Date() } });
        expect(await BillingExperienceService.getForBranch(branch.id, owner.id)).toMatchObject({
            effectivePlan: "STANDARD", customerState: "STANDARD_ACTIVE", billingAccessSource: "PAID",
            accessGrantEndsAt: source.paidThrough!.toISOString(), trialEndsAt: trialEndsAt.toISOString(),
        });
        await db.ownerTrialGrant.update({ where: { ownerId: owner.id }, data: { trialPlan: "PRO" } });
        expect(await BillingExperienceService.getForBranch(branch.id, owner.id)).toMatchObject({
            effectivePlan: "PRO", customerState: "TRIAL_ACTIVE", billingAccessSource: "TRIAL",
            accessGrantEndsAt: null, legacyCoverageEndsAt: source.paidThrough!.toISOString(),
        });
    });
});
