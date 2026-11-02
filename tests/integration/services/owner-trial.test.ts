import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { OnboardingService } from "@/services/onboarding.service";
import { OwnerTrialService, TRIAL_DAYS } from "@/services/ownerTrial.service";
import { createOrg, createSaasSubscription, createUser } from "@/tests/factories";
import { disconnectDatabase, resetDatabase, testPrisma } from "@/tests/setup/db";
import { randomUUID } from "node:crypto";
import { EntitlementService } from "@/services/entitlement.service";
import { BillingExperienceService } from "@/services/billingExperience.service";
import { AccessPolicy } from "@/services/accessPolicy.service";
import { getBillingPlan } from "@/lib/billingPlans";
import { workspacePresentation } from "@/lib/workspacePresentation";

describe("owner-level trials", () => {
  it("keeps a verified paid Standard subscription above a Basic trial without relabelling the paid plan", async () => {
    const owner = await createUser();
    const result = await OnboardingService.createNetwork({ userId: owner.id, idempotencyKey: randomUUID(), trialPlan: "BASIC", selectedPostTrialPlan: "BASIC", ownerPhone: "9876543210", orgData: { name: "Paid library" }, branchData: { name: "Main" }, shifts: [{ name: "Daily", startTime: "06:00", endTime: "22:00", price: 0 }], multiShifts: [] });
    const grant = await testPrisma.ownerTrialGrant.findUniqueOrThrow({ where: { ownerId: owner.id } });
    const subscription = await createSaasSubscription({ organizationId: result.org.id, plan: "STANDARD" });
    expect(await BillingExperienceService.getBillingExperience(result.org.id, owner.id)).toMatchObject({ effectivePlan: "STANDARD", billingAccessSource: "PAID", paidThrough: subscription.paidThrough!.toISOString(), trialPlan: "BASIC" });
    expect(await testPrisma.ownerTrialGrant.findUniqueOrThrow({ where: { ownerId: owner.id } })).toEqual(grant);
    expect(await testPrisma.organizationSubscription.findUniqueOrThrow({ where: { id: subscription.id } })).toEqual(subscription);
  });
  it.each(["BASIC", "STANDARD", "PRO"] as const)("persists a real %s trial with one original expiry and no provider subscription", async trialPlan => {
    const owner = await createUser();
    const input = { userId: owner.id, idempotencyKey: randomUUID(), trialPlan, selectedPostTrialPlan: trialPlan,
      ownerPhone: "9876543210", orgData: { name: "Trial Library" }, branchData: { name: "Main location" },
      seatCount: 2, shifts: [{ name: "Daily", startTime: "06:00", endTime: "22:00", price: 500 }], multiShifts: [] };
    const result = await OnboardingService.createNetwork(input);
    const grant = await testPrisma.ownerTrialGrant.findUniqueOrThrow({ where: { ownerId: owner.id } });
    expect(grant.trialPlan).toBe(trialPlan);
    expect(grant.trialEndsAt!.getTime() - grant.trialStartedAt!.getTime()).toBe(TRIAL_DAYS * 86_400_000);
    expect(await testPrisma.multiShift.count({ where: { branchId: result.branch.id } })).toBe(0);
    expect(await testPrisma.organizationSubscription.count()).toBe(0);
    expect(await testPrisma.billingProviderAction.count()).toBe(0);
    const profile = await EntitlementService.getOrganizationProfile(result.org.id);
    expect(profile).toMatchObject({ effectivePlan: trialPlan, canWrite: true, entitlements: getBillingPlan(trialPlan)!.entitlements });
    expect(await BillingExperienceService.getBillingExperience(result.org.id, owner.id)).toMatchObject({
      effectivePlan: trialPlan === "STANDARD" ? "STANDARD_TRIAL" : trialPlan, trialPlan, customerState: "TRIAL_ACTIVE", planFeeDueToday: 0,
    });
    const access = await AccessPolicy.branchProjection(owner.id, result.branch.id);
    expect(workspacePresentation(access)).toBe(trialPlan === "BASIC" ? "simple" : "full");
    await expect(AccessPolicy.authorizeCapability(owner.id, result.branch.id, "importStudents")).resolves.toBeDefined();
    const foreign = await createUser();
    await expect(AccessPolicy.authorizeCapability(foreign.id, result.branch.id, "importStudents")).rejects.toThrow();
    await expect(OnboardingService.createNetwork(input)).resolves.toEqual(result);
    await expect(OnboardingService.createNetwork({ ...input, trialPlan: trialPlan === "BASIC" ? "PRO" : "BASIC" }))
      .rejects.toMatchObject({ code: "ONBOARDING_KEY_CONFLICT" });
    await expect(OnboardingService.createNetwork({ ...input, idempotencyKey: randomUUID() }))
      .rejects.toMatchObject({ code: "ORGANIZATION_ALREADY_EXISTS" });
    await testPrisma.organization.update({ where: { id: result.org.id }, data: { selectedPostTrialPlan: trialPlan === "PRO" ? "BASIC" : "PRO" } });
    expect(await EntitlementService.getOrganizationProfile(result.org.id)).toMatchObject({ effectivePlan: trialPlan });
    expect(await testPrisma.ownerTrialGrant.findUniqueOrThrow({ where: { ownerId: owner.id } })).toEqual(grant);
    await testPrisma.ownerTrialGrant.update({ where: { ownerId: owner.id }, data: { trialEndsAt: new Date(Date.now() - 1000) } });
    expect(await EntitlementService.getOrganizationProfile(result.org.id)).toMatchObject({ canWrite: false, accessMode: "READ_ONLY" });
    await expect(AccessPolicy.authorizeCapability(owner.id, result.branch.id, "importStudents")).rejects.toMatchObject({ code: "BILLING_READ_ONLY" });
  });

  it("does not start another trial for a previously consumed owner", async () => {
    const owner = await createUser();
    const consumed = await testPrisma.ownerTrialGrant.create({ data: { ownerId: owner.id, source: "ONBOARDING", status: "EXPIRED", trialPlan: "STANDARD", trialStartedAt: new Date("2026-01-01"), trialEndsAt: new Date("2026-01-31") } });
    const result = await OnboardingService.createNetwork({ userId: owner.id, idempotencyKey: randomUUID(), selectedPostTrialPlan: "PRO", trialPlan: "PRO", ownerPhone: "9876543210", orgData: { name: "Later library" }, branchData: { name: "Main" }, shifts: [{ name: "Daily", startTime: "06:00", endTime: "22:00", price: 0 }], multiShifts: [] });
    expect(await testPrisma.ownerTrialGrant.findUniqueOrThrow({ where: { ownerId: owner.id } })).toEqual(consumed);
    expect(await EntitlementService.getOrganizationProfile(result.org.id)).toMatchObject({ canWrite: false });
  });

  it("retains Standard for legacy commands even when the post-trial preference is Pro", async () => {
    const owner = await createUser();
    const result = await onboarding(owner.id, "legacy");
    expect(await testPrisma.ownerTrialGrant.findUniqueOrThrow({ where: { ownerId: owner.id } })).toMatchObject({ trialPlan: "STANDARD" });
    expect(await EntitlementService.getOrganizationProfile(result.org.id)).toMatchObject({ effectivePlan: "STANDARD" });
  });
  beforeEach(async () => {
    process.env.WORKSPACE_BRANCH_BILLING_V2_ENABLED = "true";
    await resetDatabase();
  });
  afterEach(() => { delete process.env.WORKSPACE_BRANCH_BILLING_V2_ENABLED; });
  afterAll(async () => { await disconnectDatabase(); });

  const onboarding = (userId: string, suffix: string) => OnboardingService.createNetwork({
    userId,
    idempotencyKey: randomUUID(),
    selectedPostTrialPlan: "PRO",
    ownerPhone: "9876543210",
    orgData: { name: `Owner Org ${suffix}` },
    branchData: { name: `Main ${suffix}` },
  });

  it("starts exactly one 30-day trial when first-branch onboarding completes", async () => {
    const owner = await createUser();
    const before = Date.now();
    const first = await onboarding(owner.id, "A");
    await expect(onboarding(owner.id, "B")).rejects.toMatchObject({ code: "ORGANIZATION_ALREADY_EXISTS", status: 409 });
    const after = Date.now();

    const grants = await testPrisma.ownerTrialGrant.findMany({ where: { ownerId: owner.id } });
    expect(grants).toHaveLength(1);
    expect(grants[0]).toMatchObject({
      organizationId: first.org.id,
      source: "ONBOARDING",
      status: "ACTIVE",
    });
    expect(grants[0].trialStartedAt!.getTime()).toBeGreaterThanOrEqual(before);
    expect(grants[0].trialStartedAt!.getTime()).toBeLessThanOrEqual(after);
    expect(grants[0].trialEndsAt!.getTime() - grants[0].trialStartedAt!.getTime())
      .toBe(TRIAL_DAYS * 24 * 60 * 60 * 1000);
    expect((await testPrisma.organization.findUniqueOrThrow({ where: { id: first.org.id } })).billingModelVersion).toBe("WORKSPACE_V2");
    expect(await testPrisma.organization.count({ where: { ownerId: owner.id } })).toBe(1);
  });

  it("lets the owner claim one migrated grant for a never-billed organization", async () => {
    const owner = await createUser();
    const organization = await createOrg({ ownerId: owner.id, billingModelVersion: "WORKSPACE_V2" });
    await testPrisma.ownerTrialGrant.create({
      data: { ownerId: owner.id, source: "MIGRATION", status: "AVAILABLE" },
    });
    const now = new Date("2026-08-03T10:00:00.000Z");

    const claimed = await OwnerTrialService.claimMigratedTrial(owner.id, organization.id, now);

    expect(claimed).toMatchObject({
      organizationId: organization.id,
      status: "ACTIVE",
      trialStartedAt: now,
      consumedAt: now,
    });
    expect(claimed.trialEndsAt?.toISOString()).toBe("2026-09-02T10:00:00.000Z");
    await expect(OwnerTrialService.claimMigratedTrial(owner.id, organization.id, now))
      .rejects.toThrow("No migrated trial is available");
  });
});
