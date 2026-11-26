import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBranch, createOrg, createSaasSubscription, createUser } from "@/tests/factories";
import { resetDatabase, disconnectDatabase, testPrisma as db } from "@/tests/setup/db";
import { BillingExperienceService } from "@/services/billingExperience.service";
import { BillingHistoryService } from "@/services/billingHistory.service";
import { BranchService } from "@/services/branch.service";
import { EntitlementService } from "@/services/entitlement.service";
import { setRazorpayClientForTests } from "@/lib/razorpay";
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
            const branch = await createBranch({ organizationId: org.id, name: plan, selectedPlan: plan });
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

    it("initializes one historical tenant repeatably without moving its invoices or granting settlement", async () => {
        const owner = await createUser();
        const org = await createOrg({ ownerId: owner.id, billingModelVersion: "WORKSPACE_V2", selectedPostTrialPlan: "STANDARD" });
        const foreign = await createOrg({ ownerId: owner.id, billingModelVersion: "LEGACY" });
        const branch = await createBranch({ organizationId: org.id });
        const archived = await createBranch({ organizationId: org.id, billingStatus: "ARCHIVED" });
        const other = await createBranch({ organizationId: foreign.id });
        const source = await createSaasSubscription({ organizationId: org.id, plan: "PRO", quantity: 2 });
        const invoices = await db.organizationSubscriptionInvoice.findMany({ where: { organizationId: org.id } });
        const before = await db.branch.findMany({ where: { organizationId: org.id }, orderBy: { id: "asc" } });
        const initialize = () => db.$queryRaw`SELECT * FROM initialize_branch_billing(${org.id})`;

        expect(await initialize()).toEqual([{ branches_seen: 2n, agreements_created: 2n, organizations_updated: 1n }]);
        for (const row of [branch, archived]) {
            expect(await db.branchBillingAgreement.findUniqueOrThrow({ where: { branchId: row.id },
                include: { subscription: true, pendingSubscriptionReplacement: true } })).toMatchObject({
                organizationId: org.id, selectedPlan: "STANDARD", legacyCoverageSubscriptionId: null,
                subscription: null, pendingSubscriptionReplacement: null,
            });
            expect(await EntitlementService.getBranchProfile(row.id)).toMatchObject({ canWrite: false });
            expect((await BillingHistoryService.page(owner.id, org.id, "invoices", null, row.id)).items).toEqual([]);
        }
        await db.branchBillingAgreement.update({ where: { branchId: branch.id }, data: { selectedPlan: "BASIC" } });
        expect(await initialize()).toEqual([{ branches_seen: 2n, agreements_created: 0n, organizations_updated: 0n }]);
        expect(await db.branchBillingAgreement.findUniqueOrThrow({ where: { branchId: branch.id } })).toMatchObject({ selectedPlan: "BASIC" });
        expect(await db.branchBillingAgreement.findUnique({ where: { branchId: other.id } })).toBeNull();
        expect(await db.organization.findUniqueOrThrow({ where: { id: foreign.id } })).toMatchObject({ billingModelVersion: "LEGACY" });
        expect(await db.branch.findMany({ where: { organizationId: org.id }, orderBy: { id: "asc" } })).toEqual(before);
        expect(await db.organizationSubscription.findUniqueOrThrow({ where: { id: source.id } })).toEqual(source);
        expect(await db.organizationSubscriptionInvoice.findMany({ where: { organizationId: org.id } })).toEqual(invoices);
        expect(await db.billingProviderAction.count()).toBe(0);
    });

    it("leaves an old closure for review while an aggregate mandate could still collect", async () => {
        const owner = await createUser();
        const org = await createOrg({ ownerId: owner.id, billingModelVersion: "WORKSPACE_V2" });
        const closing = await createBranch({ organizationId: org.id, billingStatus: "REMOVAL_SCHEDULED" });
        await createBranch({ organizationId: org.id });
        const mandate = await createSaasSubscription({ organizationId: org.id, plan: "PRO", quantity: 2 });
        const original = await db.organizationBillingChange.create({ data: {
            organizationId: org.id, branchId: closing.id, type: "BRANCH_REMOVAL",
            sequence: 2, idempotencyKey: "scheduled-before-mandate", status: "SCHEDULED",
            operationStatus: "SCHEDULED", effectiveAt: new Date(), createdByUserId: owner.id,
        } });
        await db.$queryRaw`SELECT * FROM initialize_branch_billing(${org.id})`;
        expect(await db.$queryRaw`SELECT * FROM initialize_branch_closures(${org.id})`)
            .toEqual([{ closures_initialized: 0n, closures_needing_review: 1n }]);
        expect(await db.organizationBillingChange.count({ where: { agreementBranchId: closing.id } })).toBe(0);
        expect(await db.organizationBillingChange.findUniqueOrThrow({ where: { id: original.id } })).toEqual(original);
        expect(await db.organizationSubscription.findUniqueOrThrow({ where: { id: mandate.id } })).toEqual(mandate);
        expect(await db.billingProviderAction.count()).toBe(0);
    });

    it("carries an existing provider-free closure to the same branch and reports uncertain closures", async () => {
        const owner = await createUser();
        const org = await createOrg({ownerId: owner.id, billingModelVersion: "WORKSPACE_V2"});
        await createBranch({organizationId: org.id});
        const closing = await createBranch({organizationId: org.id, billingStatus: "REMOVAL_SCHEDULED"});
        const unresolved = await createBranch({organizationId: org.id, billingStatus: "REMOVAL_SCHEDULED"});
        const verifying = await createBranch({organizationId: org.id, billingStatus: "REMOVAL_SCHEDULED"});
        const effectiveAt = new Date(Date.now() + 86400000);
        const original = await db.organizationBillingChange.create({data: {
            organizationId: org.id, branchId: closing.id, type: "BRANCH_REMOVAL",
            sequence: 1, idempotencyKey: "original-closure", status: "SCHEDULED",
            operationStatus: "SCHEDULED", effectiveAt, createdByUserId: owner.id,
        }});
        const ambiguous = await db.organizationBillingChange.create({data: {
            organizationId: org.id, branchId: verifying.id, type: "BRANCH_REMOVAL",
            sequence: 2, idempotencyKey: "ambiguous-closure", status: "SCHEDULED",
            operationStatus: "VERIFYING", effectiveAt, createdByUserId: owner.id,
        }});
        await db.$queryRaw`SELECT * FROM initialize_branch_billing(${org.id})`;
        const initialize = () => db.$queryRaw`SELECT * FROM initialize_branch_closures(${org.id})`;
        expect(await initialize()).toEqual([{closures_initialized: 1n, closures_needing_review: 2n}]);
        expect(await initialize()).toEqual([{closures_initialized: 0n, closures_needing_review: 2n}]);
        const receipt = await db.organizationBillingChange.findFirstOrThrow({where: {
            organizationId: org.id, agreementBranchId: closing.id, type: "BRANCH_REMOVAL",
        }});
        expect(receipt).toMatchObject({branchId: closing.id, effectiveAt, undoCutoffAt: effectiveAt,
            organizationSubscriptionId: null, idempotencyKey: "initialized-branch-closure:" + original.id});
        await BranchService.undoBillingRemoval(owner.id, closing.id, receipt.id);
        expect(await db.branch.findUniqueOrThrow({where: {id: closing.id}})).toMatchObject({billingStatus: "ACTIVE"});
        expect(await db.branch.findUniqueOrThrow({where: {id: unresolved.id}})).toMatchObject({billingStatus: "REMOVAL_SCHEDULED"});
        expect(await db.organizationBillingChange.findUniqueOrThrow({where: {id: original.id}})).toEqual(original);
        expect(await db.organizationBillingChange.findUniqueOrThrow({where: {id: ambiguous.id}})).toEqual(ambiguous);
        expect(await db.billingProviderAction.count()).toBe(0);
        expect(await db.organizationSubscription.count()).toBe(0);
    });
});
