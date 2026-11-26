import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { BranchService } from "@/services/branch.service";
import { EntitlementService } from "@/services/entitlement.service";
import { createBranch, createOrg, createSaasSubscription, createUser } from "@/tests/factories";
import { disconnectDatabase, resetDatabase, testPrisma } from "@/tests/setup/db";

describe("branch billing lifecycle", () => {
  beforeEach(resetDatabase);
  afterAll(disconnectDatabase);

  async function trialOrganization() {
    const owner = await createUser();
    const organization = await createOrg({ ownerId: owner.id, billingModelVersion: "BRANCH_V3" });
    const first = await createBranch({ organizationId: organization.id, name: "First" });
    const trialEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await testPrisma.ownerTrialGrant.create({
      data: {
        ownerId: owner.id,
        organizationId: organization.id,
        source: "ONBOARDING",
        status: "ACTIVE",
        trialStartedAt: new Date(),
        trialEndsAt,
        consumedAt: new Date(),
      },
    });
    return { owner, organization, first, trialEndsAt };
  }

  it("adds active trial branches without extending the owner trial", async () => {
    const { owner, organization, trialEndsAt } = await trialOrganization();
    const branch = await BranchService.createBranchForOrg({
      organizationId: organization.id,
      userId: owner.id,
      name: "Second", futurePlan: "PRO",
      contactPhone: "9876543210",
      idempotencyKey: "trial-second-branch",
    });

    expect(branch.billingStatus).toBe("ACTIVE");
    await expect(testPrisma.ownerTrialGrant.findUniqueOrThrow({ where: { ownerId: owner.id } }))
      .resolves.toMatchObject({ trialEndsAt });
  });

  it("replays the same branch-create key to the original branch and change", async () => {
    const { owner, organization } = await trialOrganization();
    const input = {
      organizationId: organization.id,
      userId: owner.id,
      name: "Replay-safe branch", futurePlan: "BASIC" as const,
      contactPhone: "9876543210",
      city: "Delhi",
      defaultFee: 1200,
      idempotencyKey: "create-replay-safe-branch",
    };

    const first = await BranchService.createBranchForOrg(input);
    const replay = await BranchService.createBranchForOrg(input);

    expect(replay.id).toBe(first.id);
    expect(replay.billingChangeId).toBe(first.billingChangeId);
    await expect(testPrisma.branch.count({ where: { organizationId: organization.id } })).resolves.toBe(2);
    await expect(testPrisma.organizationBillingChange.count({
      where: { idempotencyKey: input.idempotencyKey },
    })).resolves.toBe(1);
  });

  it("rejects a reused branch-create key when persisted details differ", async () => {
    const { owner, organization } = await trialOrganization();
    const input = {
      organizationId: organization.id,
      userId: owner.id,
      name: "Original branch", futurePlan: "STANDARD" as const,
      contactPhone: "9876543210",
      city: "Delhi",
      defaultFee: 1200,
      idempotencyKey: "create-payload-mismatch",
    };
    await BranchService.createBranchForOrg(input);

    await expect(BranchService.createBranchForOrg({ ...input, name: "Different branch" }))
      .rejects.toThrow("different branch details");
    await expect(testPrisma.branch.count({ where: { organizationId: organization.id } })).resolves.toBe(2);
  });

  it("keeps branch setup and its receipt atomic when two owners submit the same request key", async () => {
    const tenants = await Promise.all([trialOrganization(), trialOrganization()]);
    const results = await Promise.allSettled(tenants.map(({ owner, organization }) =>
      BranchService.createBranchForOrg({
        organizationId: organization.id, userId: owner.id, name: "Second branch",
        contactPhone: "9876543210", seatCount: 3, futurePlan: "STANDARD",
        idempotencyKey: "duplicate-across-tenants",
      })
    ));
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter(result => result.status === "rejected")).toHaveLength(1);
    const receipt = await testPrisma.organizationBillingChange.findUniqueOrThrow({
      where: { idempotencyKey: "duplicate-across-tenants" },
    });
    const created = await testPrisma.branch.findMany({
      where: { name: "Second branch" },
      include: { billingAgreement: true, _count: { select: { seats: true, staff: true } } },
    });
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({
      id: receipt.agreementBranchId, organizationId: receipt.organizationId,
      billingAgreement: { organizationId: receipt.organizationId, selectedPlan: "STANDARD" },
      _count: { seats: 3, staff: 1 },
    });
  });

  it("schedules, undoes, and archives a trial branch without deleting data", async () => {
    const { owner, organization, first, trialEndsAt } = await trialOrganization();
    const second = await createBranch({ organizationId: organization.id, name: "Second" });

    const scheduled = await BranchService.scheduleBillingRemoval(owner.id, second.id, "remove-second-1");
    expect(scheduled.change).toMatchObject({ status: "SCHEDULED", effectiveAt: trialEndsAt });
    await BranchService.undoBillingRemoval(owner.id, second.id);
    await expect(testPrisma.branch.findUniqueOrThrow({ where: { id: second.id } }))
      .resolves.toMatchObject({ billingStatus: "ACTIVE" });

    const again = await BranchService.scheduleBillingRemoval(owner.id, second.id, "remove-second-2");
    await BranchService.archiveDueBillingRemovals(new Date(trialEndsAt.getTime() + 1));
    await expect(testPrisma.branch.findUniqueOrThrow({ where: { id: second.id } }))
      .resolves.toMatchObject({ billingStatus: "ARCHIVED" });
    await expect(testPrisma.organizationBillingChange.findUniqueOrThrow({ where: { id: again.change.id } }))
      .resolves.toMatchObject({ status: "APPLIED" });
    await expect(testPrisma.branch.findUnique({ where: { id: first.id } })).resolves.not.toBeNull();
  });

  it("replays branch removal without creating another change", async () => {
    const { owner, organization } = await trialOrganization();
    const second = await createBranch({ organizationId: organization.id, name: "Second" });

    const first = await BranchService.scheduleBillingRemoval(owner.id, second.id, "remove-replay-safe");
    const replay = await BranchService.scheduleBillingRemoval(owner.id, second.id, "remove-replay-safe");

    expect(replay.branch.id).toBe(first.branch.id);
    expect(replay.change.id).toBe(first.change.id);
    await expect(testPrisma.organizationBillingChange.count({
      where: { idempotencyKey: "remove-replay-safe" },
    })).resolves.toBe(1);
  });

  it("keeps a billable branch after two trial removal requests and the deadline", async () => {
    const { owner, organization, first, trialEndsAt } = await trialOrganization();
    const second = await createBranch({ organizationId: organization.id, name: "Second" });
    const results = await Promise.allSettled([
      BranchService.scheduleBillingRemoval(owner.id, first.id, "remove-first-in-trial"),
      BranchService.scheduleBillingRemoval(owner.id, second.id, "remove-second-in-trial"),
    ]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(results.find(result => result.status === "rejected")?.reason.message).toMatch(/final billable branch/);
    await BranchService.archiveDueBillingRemovals(new Date(trialEndsAt.getTime() + 1));
    const statuses = await testPrisma.branch.findMany({ where: { organizationId: organization.id }, select: { billingStatus: true } });
    expect(statuses.map(row => row.billingStatus).sort()).toEqual(["ACTIVE", "ARCHIVED"]);
  });

  it("opens the pending branch's own checkout without a sibling quantity mutation", async () => {
    const owner = await createUser();
    const otherOwner = await createUser();
    const org = await createOrg({ ownerId: owner.id });
    const existing = await createBranch({ organizationId: org.id, selectedPlan: "PRO" });
    const source = await createSaasSubscription({ organizationId: org.id, agreementBranchId: existing.id, plan: "PRO" });
    const input = { organizationId: org.id, userId: owner.id, name: "New Basic", futurePlan: "BASIC" as const,
      contactPhone: "9876543210", idempotencyKey: "pending-branch" };
    const branch = await BranchService.createBranchForOrg(input);
    expect(branch.billingStatus).toBe("PENDING_ACTIVATION");
    expect(await BranchService.retryPendingActivation(owner.id, branch.id)).toMatchObject({
      processingUrl: `/account/billing?organizationId=${org.id}&branchId=${branch.id}`,
    });
    await expect(BranchService.retryPendingActivation(otherOwner.id, branch.id)).rejects.toThrow("Branch not found");
    await expect(BranchService.discardPendingActivation(otherOwner.id, branch.id)).rejects.toThrow("Branch not found");
    await expect(EntitlementService.assertBranchWritable(branch.id)).rejects.toThrow("awaiting provider-confirmed billing activation");
    expect(await testPrisma.organizationSubscription.findUniqueOrThrow({ where: { id: source.id } })).toEqual(source);
    expect(await testPrisma.billingProviderAction.count()).toBe(0);
    expect(await BranchService.discardPendingActivation(owner.id, branch.id)).toEqual({ archived: true });
    expect((await BranchService.createBranchForOrg(input)).billingStatus).toBe("ARCHIVED");
    expect(await EntitlementService.getBranchProfile(existing.id)).toMatchObject({ canWrite: true, effectivePlan: "PRO" });
  });

  it.each(["lease", "unresolved action"] as const)("holds discard during a branch %s but leaves siblings available", async reason => {
    const { owner, organization, first } = await trialOrganization();
    const pending = await createBranch({ organizationId: organization.id, billingStatus: "PENDING_ACTIVATION" });
    if (reason === "lease") {
      await testPrisma.branchBillingAgreement.update({ where: { branchId: pending.id }, data: { billingMutationLeaseToken: "leased" } });
    } else {
      await testPrisma.organizationBillingChange.create({ data: { organizationId: organization.id, agreementBranchId: pending.id,
        type: "SUBSCRIPTION_AUTHORIZATION", sequence: 1, idempotencyKey: "uncertain-action", status: "FAILED", failureCategory: "MANUAL_REVIEW_REQUIRED" } });
    }
    await expect(BranchService.discardPendingActivation(owner.id, pending.id)).rejects.toThrow("Resolve the current branch billing operation");
    expect(await testPrisma.branch.findUniqueOrThrow({ where: { id: pending.id } })).toMatchObject({ billingStatus: "PENDING_ACTIVATION" });
    expect(await EntitlementService.getBranchProfile(first.id)).toMatchObject({ canWrite: true });
    expect(await testPrisma.billingProviderAction.count()).toBe(0);
  });

  it.each(["remove", "reactivate"] as const)("rolls back the %s lifecycle write when the receipt insert fails", async action => {
    const { owner, organization } = await trialOrganization();
    const billingStatus = action === "remove" ? "ACTIVE" : "ARCHIVED";
    const branch = await createBranch({ organizationId: organization.id, billingStatus });
    // Introduce an inconsistent synthetic sequence to fail the next insert inside the transaction.
    await testPrisma.organizationBillingChange.create({ data: { organizationId: organization.id, agreementBranchId: branch.id,
      idempotencyKey: "existing-sequence", sequence: 1, type: "LEGACY_TRANSITION", status: "APPLIED", resolvedAt: new Date() } });
    const operation = action === "remove" ? BranchService.scheduleBillingRemoval : BranchService.reactivateArchivedBranch;
    await expect(operation(owner.id, branch.id, "next")).rejects.toThrow();
    expect(await testPrisma.branchBillingAgreement.findUniqueOrThrow({ where: { branchId: branch.id } })).toMatchObject({ billingMutationSequence: 0 });
    expect(await testPrisma.branch.findUniqueOrThrow({ where: { id: branch.id } })).toMatchObject({ billingStatus });
  });
});
