import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const session = vi.hoisted(() => ({ user: null as { id: string } | null }));
vi.mock("@/lib/auth", () => ({ getSessionUser: async () => session.user }));
import { GET as listStaffRoute } from "@/app/api/branches/[branchId]/staff/route";
import { EntitlementService } from "@/services/entitlement.service";
import { BillingExperienceService } from "@/services/billingExperience.service";
import { WhatsAppAuthorizationService } from "@/services/whatsappAuthorization.service";
import { StaffService } from "@/services/staff.service";
import { createOrg, createSaasSubscription, createUser } from "@/tests/factories";
import { disconnectDatabase, resetDatabase, testPrisma } from "@/tests/setup/db";

async function createSubscription(
  organizationId: string,
  plan: "BASIC" | "STANDARD" | "PRO",
  status: "AUTHENTICATED" | "ACTIVE" | "EXPIRED" = "ACTIVE",
  options: { confirmedPaidPeriod?: boolean; paidThrough?: Date | null } = {}
) {
  return createSaasSubscription({
    organizationId,
    plan,
    status,
    confirmedPaidPeriod: options.confirmedPaidPeriod,
    paidThrough: options.paidThrough,
  });
}

describe("subscription entitlements", () => {
  afterAll(async () => {
    await disconnectDatabase();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("gives organizations without a subscription Basic fallback access", async () => {
    const user = await createUser();
    const org = await createOrg({ ownerId: user.id });

    const profile = await EntitlementService.getOrganizationProfile(org.id);

    expect(profile).toMatchObject({
      plan: null,
      effectivePlan: "BASIC",
      fallbackAccess: true,
      limits: { maxBranches: null },
    });
    expect(profile.entitlements).not.toContain("ADVANCED_ANALYTICS");
    expect(profile.entitlements).not.toContain("AI_ACCESS");
    expect(profile.entitlements).not.toContain("WHATSAPP_AUTOMATION");
  });

  it("lets Basic add billable branches while keeping premium features unavailable", async () => {
    const user = await createUser();
    const org = await createOrg({ ownerId: user.id });
    await createSubscription(org.id, "BASIC");
    const branch = await testPrisma.branch.create({
      data: { organizationId: org.id, name: "Main", contactPhone: "+919876543210" },
    });

    await expect(EntitlementService.assertCanCreateBranch(org.id)).resolves.toMatchObject({
      effectivePlan: "BASIC",
      limits: { maxBranches: null },
    });
    await expect(StaffService.authorize(user.id, branch.id, "analytics")).rejects.toThrow("upgraded subscription");
    await expect(StaffService.authorize(user.id, branch.id, "view_whatsapp")).rejects.toThrow("upgraded subscription");
    await expect(StaffService.listStaff(user.id, branch.id)).rejects.toThrow("upgraded subscription");
  });

  it.each(["BASIC", "STANDARD", "PRO"] as const)("enforces %s server access independently of client plan selection", async plan => {
    const owner = await createUser();
    const org = await createOrg({ ownerId: owner.id, billingModelVersion: "WORKSPACE_V2" });
    await createSubscription(org.id, plan);
    const branch = await testPrisma.branch.create({ data: { organizationId: org.id, name: "Plan boundary" } });
    session.user = { id: owner.id };
    const response = await listStaffRoute(new NextRequest(`http://test.local/api/branches/${branch.id}/staff`), { params: Promise.resolve({ branchId: branch.id }) });
    expect(response.status).toBe(plan === "BASIC" ? 403 : 200);
    for (const entitlement of ["STAFF_MANAGEMENT", "ADVANCED_ANALYTICS", "AI_ACCESS", "WHATSAPP_AUTOMATION"] as const) {
      const call = EntitlementService.assertOrganizationEntitlement(org.id, entitlement);
      const allowed = entitlement === "WHATSAPP_AUTOMATION" ? plan === "PRO" : plan !== "BASIC";
      if (allowed) await expect(call).resolves.toMatchObject({ effectivePlan: plan });
      else await expect(call).rejects.toMatchObject({ code: "SUBSCRIPTION_UPGRADE_REQUIRED" });
    }
    const whatsapp = WhatsAppAuthorizationService.assertOwnerCanWrite(owner.id, org.id);

    if (plan === "PRO") { await expect(whatsapp).resolves.toEqual({ id: org.id }); await expect(StaffService.authorize(owner.id, branch.id, "view_whatsapp")).resolves.toBe(true); }
    else { await expect(whatsapp).rejects.toMatchObject({ code: "SUBSCRIPTION_UPGRADE_REQUIRED" }); await expect(StaffService.authorize(owner.id, branch.id, "view_whatsapp")).rejects.toThrow("upgraded subscription"); }
    const stranger = await createUser();
    await expect(WhatsAppAuthorizationService.assertOwnerCanWrite(stranger.id, org.id)).rejects.toThrow();
  });

  it("enables Pro multi-branch, staff, analytics, and AI capabilities", async () => {
    const user = await createUser();
    const org = await createOrg({ ownerId: user.id });
    await createSubscription(org.id, "PRO");
    const branch = await testPrisma.branch.create({
      data: { organizationId: org.id, name: "Main", contactPhone: "+919876543210" },
    });

    const profile = await EntitlementService.assertCanCreateBranch(org.id);
    expect(profile).toMatchObject({
      effectivePlan: "PRO",
      fallbackAccess: false,
      limits: { maxBranches: null },
    });
    expect(profile.entitlements).toContain("AI_ACCESS");
    expect(profile.entitlements).toContain("WHATSAPP_AUTOMATION");
    await expect(BillingExperienceService.getBillingExperience(org.id, user.id)).resolves.toMatchObject({
      effectivePlan: "PRO",
      accessMode: "FULL",
    });
    await expect(StaffService.authorize(user.id, branch.id, "analytics")).resolves.toBe(true);
    await expect(StaffService.authorize(user.id, branch.id, "view_whatsapp")).resolves.toBe(true);
    await expect(StaffService.listStaff(user.id, branch.id)).resolves.toEqual([]);
  });

  it.each(["AUTHENTICATED", "ACTIVE"] as const)(
    "does not grant legacy premium access from %s without settlement evidence",
    async status => {
      const user = await createUser();
      const org = await createOrg({ ownerId: user.id });
      await createSubscription(org.id, "PRO", status, { confirmedPaidPeriod: false });

      const profile = await EntitlementService.getOrganizationProfile(org.id);

      expect(profile).toMatchObject({
        plan: "PRO",
        effectivePlan: "BASIC",
        fallbackAccess: true,
        accessMode: "FULL",
        canWrite: true,
      });
      expect(profile.entitlements).not.toContain("AI_ACCESS");
      expect(profile.entitlements).not.toContain("WHATSAPP_AUTOMATION");
    }
  );

  it("does not trust a legacy future paidThrough without exact settlement evidence", async () => {
    const user = await createUser();
    const org = await createOrg({ ownerId: user.id });
    await createSubscription(org.id, "PRO", "ACTIVE", {
      confirmedPaidPeriod: false,
      paidThrough: new Date(Date.now() + 86_400_000),
    });

    await expect(EntitlementService.getOrganizationProfile(org.id)).resolves.toMatchObject({
      effectivePlan: "BASIC",
      fallbackAccess: true,
      accessMode: "FULL",
      canWrite: true,
    });
    await expect(BillingExperienceService.getBillingExperience(org.id, user.id)).resolves.toMatchObject({
      effectivePlan: "BASIC",
      accessMode: "FULL",
      paidThrough: null,
    });
  });

  it("does not trust a V2 future paidThrough without exact settlement evidence", async () => {
    const user = await createUser();
    const org = await createOrg({ ownerId: user.id, billingModelVersion: "WORKSPACE_V2" });
    await createSubscription(org.id, "PRO", "ACTIVE", {
      confirmedPaidPeriod: false,
      paidThrough: new Date(Date.now() + 86_400_000),
    });

    await expect(EntitlementService.getOrganizationProfile(org.id)).resolves.toMatchObject({
      effectivePlan: "BASIC",
      accessMode: "READ_ONLY",
      canWrite: false,
    });
  });

  it("keeps a bounded owner trial independent from paid settlement evidence", async () => {
    const user = await createUser();
    const org = await createOrg({ ownerId: user.id, billingModelVersion: "WORKSPACE_V2" });
    await testPrisma.ownerTrialGrant.create({
      data: {
        ownerId: user.id,
        organizationId: org.id,
        source: "ONBOARDING",
        status: "ACTIVE",
        trialStartedAt: new Date(Date.now() - 60_000),
        trialEndsAt: new Date(Date.now() + 86_400_000),
        consumedAt: new Date(Date.now() - 60_000),
      },
    });

    const profile = await EntitlementService.getOrganizationProfile(org.id);

    expect(profile).toMatchObject({
      effectivePlan: "STANDARD",
      accessMode: "FULL",
      canWrite: true,
    });
    expect(profile.entitlements).toContain("AI_ACCESS");
    expect(profile.entitlements).not.toContain("WHATSAPP_AUTOMATION");
  });

  it("removes premium entitlements after a subscription expires", async () => {
    const user = await createUser();
    const org = await createOrg({ ownerId: user.id });
    await createSubscription(org.id, "PRO", "EXPIRED");

    const profile = await EntitlementService.getOrganizationProfile(org.id);

    expect(profile.entitlements).not.toContain("ADVANCED_ANALYTICS");
    expect(profile.entitlements).not.toContain("AI_ACCESS");
    expect(profile.entitlements).not.toContain("WHATSAPP_AUTOMATION");
    expect(profile.effectivePlan).toBe("BASIC");
    expect(profile.fallbackAccess).toBe(true);
    expect(profile.limits.maxBranches).toBeNull();
  });

  it("never grants paid entitlements from a subscription in the other provider mode", async () => {
    const user = await createUser();
    const org = await createOrg({ ownerId: user.id });
    await createSubscription(org.id, "PRO");
    vi.stubEnv("RAZORPAY_MODE", "LIVE");
    vi.stubEnv("RAZORPAY_KEY_ID", "rzp_live_entitlement_guard");
    vi.stubEnv("VERCEL_ENV", "production");

    const profile = await EntitlementService.getOrganizationProfile(org.id);

    expect(profile).toMatchObject({
      plan: null,
      effectivePlan: "BASIC",
      subscriptionStatus: null,
      fallbackAccess: true,
    });
    expect(profile.entitlements).not.toContain("ADVANCED_ANALYTICS");
    expect(profile.entitlements).not.toContain("AI_ACCESS");
    expect(profile.entitlements).not.toContain("WHATSAPP_AUTOMATION");
  });

  it("holds a V2 workspace read-only when its stored subscription is from another mode", async () => {
    const user = await createUser();
    const org = await createOrg({ ownerId: user.id, billingModelVersion: "WORKSPACE_V2" });
    const subscription = await createSubscription(org.id, "PRO");
    await testPrisma.organizationSubscription.update({
      where: { id: subscription.id },
      data: { paidThrough: new Date(Date.now() + 86_400_000), providerPaymentMethod: "CARD" },
    });
    vi.stubEnv("RAZORPAY_MODE", "LIVE");
    vi.stubEnv("RAZORPAY_KEY_ID", "rzp_live_v2_entitlement_guard");
    vi.stubEnv("VERCEL_ENV", "production");

    const profile = await EntitlementService.getOrganizationProfile(org.id);

    expect(profile).toMatchObject({
      plan: null,
      effectivePlan: "BASIC",
      subscriptionStatus: null,
      accessMode: "READ_ONLY",
      canWrite: false,
    });
    expect(profile.entitlements).not.toContain("AI_ACCESS");
    expect(profile.entitlements).not.toContain("WHATSAPP_AUTOMATION");
  });
});
