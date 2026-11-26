import { afterAll, afterEach, beforeEach, expect, it, vi } from "vitest";
import { BranchService } from "@/services/branch.service";
import { EntitlementService } from "@/services/entitlement.service";
import { IndependentBranchLifecycle } from "@/services/independentBranchLifecycle.service";
import { OwnerTrialService } from "@/services/ownerTrial.service";
import { OnboardingService } from "@/services/onboarding.service";
import { randomUUID } from "node:crypto";
import { createBranch, createOrg, createSaasSubscription, createUser } from "@/tests/factories";
import { disconnectDatabase, resetDatabase, testPrisma as db } from "@/tests/setup/db";

beforeEach(resetDatabase);
afterEach(() => vi.unstubAllEnvs());
afterAll(disconnectDatabase);

it("enrolls the first branch once, keeping its selected Pro owner trial distinct from its future Basic plan", async () => {
    const owner = await createUser();
    const input = { userId: owner.id, idempotencyKey: randomUUID(), ownerPhone: "9876543210",
        selectedPostTrialPlan: "BASIC" as const, trialPlan: "PRO" as const,
        orgData: { name: "Study rooms" }, branchData: { name: "Main" },
        shifts: [{ name: "Daily", startTime: "06:00", endTime: "22:00", price: 500 }], multiShifts: [] };
    const first = await OnboardingService.createNetwork(input);
    expect(await OnboardingService.createNetwork(input)).toEqual(first);
    expect(await db.organization.findUniqueOrThrow({ where: { id: first.org.id } })).toMatchObject({ billingModelVersion: "BRANCH_V3" });
    expect(await db.branchBillingAgreement.findUniqueOrThrow({ where: { branchId: first.branch.id } })).toMatchObject({
        organizationId: first.org.id, selectedPlan: "BASIC",
    });
    expect(await EntitlementService.getBranchProfile(first.branch.id)).toMatchObject({ billingStatus: "ACTIVE", effectivePlan: "PRO" });
    expect(await db.ownerTrialGrant.count({ where: { ownerId: owner.id, trialPlan: "PRO", status: "ACTIVE" } })).toBe(1);
    expect(await db.organizationSubscription.count()).toBe(0);
});

it("claims an available migrated trial once for never-billed branches after pending checkouts resolve", async () => {
    const owner = await createUser();
    const org = await createOrg({ ownerId: owner.id, billingModelVersion: "BRANCH_V3" });
    const branch = await createBranch({ organizationId: org.id, billingStatus: "PENDING_ACTIVATION", selectedPlan: "PRO" });
    const archived = await createBranch({ organizationId: org.id, billingStatus: "ARCHIVED", selectedPlan: "PRO" });
    await db.ownerTrialGrant.create({ data: { ownerId: owner.id, source: "MIGRATION", status: "AVAILABLE", trialPlan: "BASIC" } });
    await db.branchBillingAgreement.update({ where: { branchId: branch.id }, data: { billingMutationLeaseToken: "mock-checkout" } });
    await expect(OwnerTrialService.claimMigratedTrial(owner.id, org.id)).rejects.toThrow("pending branch checkout");
    await db.branchBillingAgreement.update({ where: { branchId: branch.id }, data: { billingMutationLeaseToken: null } });
    const claimed = await OwnerTrialService.claimMigratedTrial(owner.id, org.id);
    expect(claimed).toMatchObject({ trialPlan: "BASIC", organizationId: org.id });
    expect(await EntitlementService.getBranchProfile(branch.id)).toMatchObject({ effectivePlan: "BASIC", billingStatus: "ACTIVE", canWrite: true });
    expect(await EntitlementService.getBranchProfile(archived.id)).toMatchObject({ billingStatus: "ARCHIVED", canWrite: false });
    expect(await db.branchBillingAgreement.findUniqueOrThrow({ where: { branchId: branch.id } })).toMatchObject({ selectedPlan: "PRO" });
    await expect(OwnerTrialService.claimMigratedTrial(owner.id, org.id)).rejects.toThrow("No migrated trial");
    expect(await db.organizationSubscription.count()).toBe(0);
});

it("pairs paid branch removal with its exact cancellation and keeps reopening separate from paid activation", async () => {
    vi.stubEnv("RAZORPAY_BILLING_WRITES_ENABLED", "true");
    const owner = await createUser();
    const org = await createOrg({ ownerId: owner.id, billingModelVersion: "BRANCH_V3" });
    const branches = [];
    for (const plan of ["STANDARD", "PRO"] as const) {
        const branch = await createBranch({ organizationId: org.id, selectedPlan: plan });
        const scope = { organizationId: org.id, branchId: branch.id };
        const source = await createSaasSubscription({ organizationId: org.id, agreementBranchId: branch.id, plan });
        branches.push({ branch, scope, source });
    }
    const [{ branch, scope, source }, sibling] = branches;
    const invoice = await db.organizationSubscriptionInvoice.findFirstOrThrow({ where: { organizationSubscriptionId: source.id } });
    await expect(db.organizationSubscriptionInvoice.update({ where: { id: invoice.id }, data: { agreementBranchId: sibling.branch.id } })).rejects.toThrow();
    await expect(db.organizationSubscription.update({ where: { id: source.id }, data: { quantity: 2 } })).rejects.toThrow();
    expect(await db.organizationSubscriptionInvoice.findUniqueOrThrow({ where: { id: invoice.id } })).toMatchObject({
        agreementBranchId: branch.id, organizationSubscriptionId: source.id,
    });
    const first = await BranchService.scheduleBillingRemoval(owner.id, branch.id, "remove-1");
    expect(first.change).toMatchObject({ agreementBranchId: branch.id, organizationSubscriptionId: source.id, effectiveAt: source.paidThrough });
    const paired = await db.organizationBillingChange.findFirstOrThrow({ where: { ...scope, type: "CANCELLATION" } });
    expect(paired).toMatchObject({ sequence: first.change.sequence - 1, organizationSubscriptionId: source.id, status: "QUEUED" });
    await BranchService.undoBillingRemoval(owner.id, branch.id, first.change.id);
    expect(await db.organizationBillingChange.count({ where: { ...scope, status: "UNDONE" } })).toBe(2);

    const second = await BranchService.scheduleBillingRemoval(owner.id, branch.id, "remove-2");
    const boundary = second.change.effectiveAt!;
    expect(await IndependentBranchLifecycle.archive(scope, second.change.id, boundary)).toBe(false);
    // The old source reaches terminal state before the scheduled cancellation
    // dispatch. The prior exact reconciliation now proves it cannot renew.
    await db.organizationSubscription.update({ where: { id: source.id }, data: { status: "CANCELLED", lastReconciledAt: new Date() } });
    expect(await IndependentBranchLifecycle.archive(scope, second.change.id, new Date(boundary.getTime() - 1))).toBe(false);
    expect(await IndependentBranchLifecycle.archive(scope, second.change.id, boundary)).toBe(true);
    expect(await db.organizationBillingChange.findFirst({ where: { ...scope, type: "CANCELLATION", sequence: second.change.sequence - 1 } }))
        .toMatchObject({ status: "SUPERSEDED" });
    expect(await EntitlementService.getBranchProfile(branch.id)).toMatchObject({ billingStatus: "ARCHIVED", canWrite: false });
    await BranchService.reactivateArchivedBranch(owner.id, branch.id, "reopen");
    expect(await EntitlementService.getBranchProfile(branch.id)).toMatchObject({ billingStatus: "PENDING_ACTIVATION", canWrite: false });
    expect(await EntitlementService.getBranchProfile(sibling.branch.id)).toMatchObject({ effectivePlan: "PRO", canWrite: true });
    expect(await db.organizationSubscriptionInvoice.count({ where: { organizationId: org.id } })).toBe(2);
    expect(await db.ownerTrialGrant.count()).toBe(0);
});
