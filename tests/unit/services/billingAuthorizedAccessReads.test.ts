import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  organizationFindUnique: vi.fn(),
  latestChange: vi.fn(),
  scheduledChanges: vi.fn(),
  staffFindFirst: vi.fn(),
  branchFindFirst: vi.fn(),
  branchFindUnique: vi.fn(),
  agreementFindFirst: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    organization: { findUnique: mocks.organizationFindUnique },
    branchBillingAgreement: { findFirst: mocks.agreementFindFirst },
    organizationBillingChange: {
      findFirst: mocks.latestChange,
      findMany: mocks.scheduledChanges,
    },
    staff: { findFirst: mocks.staffFindFirst },
    branch: {
      findFirst: mocks.branchFindFirst,
      findUnique: mocks.branchFindUnique,
    },
  },
}));

vi.mock("@/lib/razorpay", () => ({
  resolveRazorpayMode: () => "TEST",
  getRazorpayClient: vi.fn(),
}));

import { BillingExperienceService } from "@/services/billingExperience.service";
import { EntitlementService } from "@/services/entitlement.service";
import { BILLING_FEATURE_POLICIES, hasFeatureEntitlement } from "@/lib/billingPolicy";

const paidThrough = new Date("2026-10-01T00:00:00.000Z");
const paidPeriodStart = new Date("2026-08-01T00:00:00.000Z");
const paidAt = new Date("2026-08-01T00:01:00.000Z");
const paidConfirmedAt = new Date("2026-08-01T00:02:00.000Z");
const accessGrantedAt = new Date("2026-08-10T00:00:00.000Z");
const effectiveAt = new Date("2026-09-01T00:00:00.000Z");
const accessGraceEndsAt = new Date("2026-09-04T00:00:00.000Z");

function organization(overrides: {
  accessRevokedAt?: Date | null;
  candidateStatus?: string;
  candidatePaymentMethod?: string;
  changeStatus?: string;
  failureCategory?: string | null;
} = {}) {
  const replacementBillingChange = {
    id: "change_upgrade",
    organizationId: "org_1",
    organizationSubscriptionId: "sub_source_row",
    replacementSubscriptionId: "sub_candidate_row",
    branchId: null,
    sequence: 1,
    idempotencyKey: "upgrade-1",
    type: "PLAN_UPGRADE",
    status: overrides.changeStatus ?? "SCHEDULED",
    operationStatus: "AWAITING_PROVIDER_CONFIRMATION",
    fromPlan: "BASIC",
    toPlan: "PRO",
    fromQuantity: 1,
    toQuantity: 1,
    effectiveAt,
    undoCutoffAt: new Date("2026-08-29T00:00:00.000Z"),
    providerInvoiceId: null,
    providerPaymentId: null,
    attemptCount: 1,
    processingStartedAt: null,
    appliedAt: null,
    undoneAt: null,
    failedAt: null,
    lastError: null,
    returnPath: null,
    confirmationDeadlineAt: null,
    failureCategory: overrides.failureCategory ?? null,
    failureCode: null,
    checkoutOpenedAt: null,
    verificationStartedAt: null,
    providerConfirmedAt: accessGrantedAt,
    accessGrantedAt,
    accessRevokedAt: overrides.accessRevokedAt ?? null,
    accessGraceEndsAt,
    abandonedAt: null,
    declinedAt: null,
    resolvedAt: null,
    createdByUserId: "owner_1",
    createdAt: accessGrantedAt,
    updatedAt: accessGrantedAt,
  };
  return {
    id: "org_1",
    ownerId: "owner_1",
    billingModelVersion: "WORKSPACE_V2",
    selectedPostTrialPlan: null,
    ownerTrialGrant: null,
    subscription: {
      id: "sub_source_row",
      organizationId: "org_1",
      providerMode: "TEST",
      plan: "BASIC",
      amount: 299,
      amountSubunits: 29900,
      currency: "INR",
      period: "monthly",
      interval: 1,
      quantity: 1,
      razorpayPlanId: "plan_basic",
      razorpaySubscriptionId: "sub_basic",
      status: "ACTIVE",
      providerPaymentMethod: "UPI",
      paidThrough,
      currentStart: paidPeriodStart,
      currentEnd: paidThrough,
      lastConfirmedInvoiceId: "invoice_basic",
      lastConfirmedPaymentId: "payment_basic",
      lastPaymentConfirmedAt: paidConfirmedAt,
      confirmedCommercialIntentChangeId: "change_basic_paid",
      billingOfferId: null,
      billingOffer: null,
      replacesSubscriptionId: null,
      replacesSubscription: null,
      invoices: [{
        organizationId: "org_1",
        organizationSubscriptionId: "sub_source_row",
        razorpayInvoiceId: "invoice_basic",
        razorpayPaymentId: "payment_basic",
        status: "paid",
        amountSubunits: 29900,
        amountPaidSubunits: 29900,
        amountDueSubunits: 0,
        currency: "INR",
        commercialEvidenceVersion: 1,
        commercialIntentChangeId: "change_basic_paid",
        providerMode: "TEST",
        razorpaySubscriptionId: "sub_basic",
        razorpayPlanId: "plan_basic",
        providerQuantity: 1,
        razorpayOfferId: null,
        paymentAmountSubunits: 29900,
        paymentCurrency: "INR",
        paymentStatus: "captured",
        paymentCaptured: true,
        evidenceConfirmedAt: paidConfirmedAt,
        evidenceFailureCode: null,
        periodStart: paidPeriodStart,
        periodEnd: paidThrough,
        paidAt,
        createdAt: paidConfirmedAt,
        commercialIntentChange: {
          id: "change_basic_paid",
          organizationId: "org_1",
          organizationSubscriptionId: "sub_source_row",
          replacementSubscriptionId: null,
          status: "APPLIED",
          operationStatus: "APPLIED",
          failureCategory: null,
          failureCode: null,
          appliedAt: paidConfirmedAt,
          providerConfirmedAt: paidConfirmedAt,
          toPlan: "BASIC",
          toQuantity: 1,
          commercialIntentVersion: 1,
          commercialIntentCapturedAt: new Date("2026-07-31T00:00:00.000Z"),
          authorizedProviderMode: "TEST",
          authorizedSourceRazorpaySubscriptionId: "sub_basic",
          authorizedRazorpaySubscriptionId: "sub_basic",
          authorizedSourceRazorpayPlanId: "plan_basic",
          authorizedRazorpayPlanId: "plan_basic",
          authorizedPlan: "BASIC",
          authorizedQuantity: 1,
          authorizedRazorpayOfferId: null,
          authorizedUnitAmountSubunits: 29900,
          authorizedGrossAmountSubunits: 29900,
          authorizedExpectedAmountSubunits: 29900,
          authorizedOfferValidThroughPaidCount: null,
          authorizedCurrency: "INR",
          authorizedPeriod: "monthly",
          authorizedInterval: 1,
        },
      }],
      chargeAt: new Date("2026-10-01T00:00:00.000Z"),
    },
    pendingSubscriptionReplacement: {
      organizationId: "org_1",
      id: "sub_candidate_row",
      providerMode: "TEST",
      plan: "PRO",
      quantity: 1,
      status: overrides.candidateStatus ?? "AUTHENTICATED",
      providerPaymentMethod: overrides.candidatePaymentMethod ?? "UPI",
      replacementBillingChange,
    },
    branches: [{ id: "branch_1" }, { id: "branch_2" }],
    _count: { branches: 2 },
  };
}

describe("authorized replacement access reads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-15T00:00:00.000Z"));
    mocks.organizationFindUnique.mockResolvedValue(organization());
    mocks.latestChange.mockResolvedValue(null);
    mocks.scheduledChanges.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("updates every advanced feature gate across settled Basic, Standard, Pro and downgraded tiers", async () => {
    for (const plan of ["BASIC", "STANDARD", "PRO", "STANDARD", "BASIC"] as const) {
      const stored = organization();
      const amount = plan === "BASIC" ? 9900 : plan === "STANDARD" ? 29900 : 49900;
      const providerPlan = plan === "BASIC" ? "plan_basic" : "plan_standard";
      Object.assign(stored, { pendingSubscriptionReplacement: null });
      Object.assign(stored.subscription, { plan, amount: amount / 100, amountSubunits: amount, razorpayPlanId: providerPlan });
      const invoice = stored.subscription.invoices[0];
      Object.assign(invoice, { amountSubunits: amount, amountPaidSubunits: amount, paymentAmountSubunits: amount, razorpayPlanId: providerPlan });
      Object.assign(invoice.commercialIntentChange, { toPlan: plan, authorizedPlan: plan,
        authorizedRazorpayPlanId: providerPlan, authorizedUnitAmountSubunits: amount,
        authorizedGrossAmountSubunits: amount, authorizedExpectedAmountSubunits: amount });
      mocks.organizationFindUnique.mockResolvedValue(stored);

      const profile = await EntitlementService.assertOrganizationWritable("org_1");
      const experience = await BillingExperienceService.getBillingExperience("org_1", "owner_1");
      expect(profile.effectivePlan).toBe(plan);
      expect(experience.effectivePlan).toBe(plan);
      for (const [feature, policy] of Object.entries(BILLING_FEATURE_POLICIES)) {
        expect(hasFeatureEntitlement(profile.entitlements, feature as keyof typeof BILLING_FEATURE_POLICIES)).toBe(plan !== "BASIC");
        expect(experience.entitlements.includes(policy.entitlement)).toBe(plan !== "BASIC");
        const access = EntitlementService.assertOrganizationEntitlement("org_1", policy.entitlement);
        if (plan !== "BASIC") await expect(access).resolves.toMatchObject({ effectivePlan: plan });
        else await expect(access).rejects.toMatchObject({ code: "SUBSCRIPTION_UPGRADE_REQUIRED" });
      }
    }
  });

  it("does not unlock Standard from provider ACTIVE or a paid date without exact settlement", async () => {
    const stored = organization();
    Object.assign(stored, { pendingSubscriptionReplacement: null });
    Object.assign(stored.subscription, { plan: "PRO", amountSubunits: 49900, razorpayPlanId: "plan_standard", invoices: [] });
    mocks.organizationFindUnique.mockResolvedValue(stored);
    await expect(EntitlementService.getOrganizationProfile("org_1")).resolves.toMatchObject({
      effectivePlan: "BASIC", accessMode: "READ_ONLY", canWrite: false, entitlements: [],
    });
    await expect(EntitlementService.assertOrganizationEntitlement("org_1", "AI_ACCESS"))
      .rejects.toMatchObject({ code: "SUBSCRIPTION_UPGRADE_REQUIRED" });
  });

  it("exposes upgrade entitlements while retaining canonical billing facts", async () => {
    const entitlement = await EntitlementService.getOrganizationProfile("org_1");
    const experience = await BillingExperienceService.getBillingExperience("org_1", "owner_1");

    expect(entitlement).toMatchObject({
      plan: "BASIC",
      effectivePlan: "PRO",
      subscriptionStatus: "ACTIVE",
      accessMode: "FULL",
      canWrite: true,
    });
    expect(entitlement.entitlements).toContain("AI_ACCESS");
    expect(experience).toMatchObject({
      effectivePlan: "PRO",
      providerStatus: "ACTIVE",
      paidThrough: paidThrough.toISOString(),
      confirmedQuantity: 1,
      currentUnitAmount: 299,
      authorizationStatus: "AUTHORIZED",
    });
    expect(experience.entitlements).toContain("AI_ACCESS");
  });

  it("stops exposing complimentary entitlements after revocation", async () => {
    mocks.organizationFindUnique.mockResolvedValue(
      organization({ accessRevokedAt: new Date("2026-08-11T00:00:00.000Z") })
    );

    const entitlement = await EntitlementService.getOrganizationProfile("org_1");
    const experience = await BillingExperienceService.getBillingExperience("org_1", "owner_1");

    expect(entitlement.effectivePlan).toBe("BASIC");
    expect(entitlement.entitlements).not.toContain("AI_ACCESS");
    expect(experience.effectivePlan).toBe("BASIC");
    expect(experience.entitlements).not.toContain("AI_ACCESS");
  });

  it.each([
    ["pending before cutover", { candidateStatus: "PENDING" }],
    ["paused mandate", { candidateStatus: "PAUSED" }],
    ["manual review", { failureCategory: "MANUAL_REVIEW_REQUIRED" }],
    ["closed replacement", { changeStatus: "FAILED" }],
  ] as const)("fails closed across entitlement readers for a %s", async (_label, overrides) => {
    mocks.organizationFindUnique.mockResolvedValue(organization(overrides));

    const entitlement = await EntitlementService.getOrganizationProfile("org_1");
    const experience = await BillingExperienceService.getBillingExperience("org_1", "owner_1");

    expect(entitlement.effectivePlan).toBe("BASIC");
    expect(entitlement.entitlements).not.toContain("AI_ACCESS");
    expect(experience.effectivePlan).toBe("BASIC");
    expect(experience.entitlements).not.toContain("AI_ACCESS");
  });

  it("honors only the bounded eMandate confirmation grace", async () => {
    vi.setSystemTime(new Date("2026-09-02T00:00:00.000Z"));
    mocks.organizationFindUnique.mockResolvedValue(organization({
      candidateStatus: "PENDING",
      candidatePaymentMethod: "EMANDATE",
    }));

    await expect(EntitlementService.getOrganizationProfile("org_1"))
      .resolves.toMatchObject({ effectivePlan: "PRO", accessMode: "FULL" });
    await expect(BillingExperienceService.getBillingExperience("org_1", "owner_1"))
      .resolves.toMatchObject({ effectivePlan: "PRO" });

    vi.setSystemTime(accessGraceEndsAt);
    await expect(EntitlementService.getOrganizationProfile("org_1"))
      .resolves.toMatchObject({ effectivePlan: "BASIC" });
    await expect(BillingExperienceService.getBillingExperience("org_1", "owner_1"))
      .resolves.toMatchObject({ effectivePlan: "BASIC" });
  });

  it("keeps authenticated replacement access after the pending-debit grace", async () => {
    vi.setSystemTime(new Date("2026-09-05T00:00:00.000Z"));
    mocks.organizationFindUnique.mockResolvedValue(organization({
      candidateStatus: "AUTHENTICATED",
      candidatePaymentMethod: "UPI",
    }));

    await expect(EntitlementService.getOrganizationProfile("org_1"))
      .resolves.toMatchObject({ effectivePlan: "PRO", accessMode: "FULL" });
    await expect(BillingExperienceService.getBillingExperience("org_1", "owner_1"))
      .resolves.toMatchObject({ effectivePlan: "PRO" });
  });
});

function independentBranch(id: string, plan: "BASIC" | "STANDARD" | "PRO") {
  const source = organization().subscription;
  source.plan = plan;
  source.razorpaySubscriptionId += id;
  source.razorpayPlanId = `plan_${plan.toLowerCase()}`;
  const invoice = source.invoices[0]!;
  invoice.razorpayPlanId = source.razorpayPlanId;
  invoice.razorpaySubscriptionId = source.razorpaySubscriptionId;
  Object.assign(invoice, { agreementBranchId: id });
  Object.assign(invoice.commercialIntentChange, {
    agreementBranchId: id, authorizedPlan: plan, toPlan: plan,
    authorizedRazorpayPlanId: source.razorpayPlanId, authorizedSourceRazorpayPlanId: source.razorpayPlanId,
    authorizedRazorpaySubscriptionId: source.razorpaySubscriptionId,
    authorizedSourceRazorpaySubscriptionId: source.razorpaySubscriptionId,
  });
  const parent = { ...organization(), billingModelVersion: "BRANCH_V3" };
  return {
    id, organizationId:parent.id, billingStatus:"ACTIVE", organization:parent,
    billingAgreement:{branchId:id, organizationId:parent.id, selectedPlan:plan,
      subscription:{...source, agreementBranchId:id},
      pendingSubscriptionReplacement:null as ReturnType<typeof organization>["pendingSubscriptionReplacement"] | null},
  };
}

describe("independent branch evidence", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-15T00:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  function ownerReads(branch: ReturnType<typeof independentBranch>) {
    mocks.organizationFindUnique.mockResolvedValue(branch.organization);
    mocks.branchFindUnique.mockResolvedValue(branch);
    mocks.branchFindFirst.mockResolvedValue({ id: branch.id, name: "Selected", billingStatus: "ACTIVE" });
    mocks.agreementFindFirst.mockResolvedValue(branch.billingAgreement);
    mocks.latestChange.mockResolvedValue(null);
    mocks.scheduledChanges.mockResolvedValue([]);
    return () => BillingExperienceService.getBillingExperience(branch.organizationId, "owner_1", branch.id);
  }

  it.each(["FAILED", "SCHEDULED"])("offers exact source cancellation reconciliation for persisted %s behind a newer operation", async operationStatus => {
    const branch = independentBranch("selected", "BASIC");
    branch.billingAgreement.subscription.status = "PENDING";
    const read = ownerReads(branch);
    const receipt = { ...organization().pendingSubscriptionReplacement.replacementBillingChange,
      status: "FAILED", operationStatus, failureCategory: "MANUAL_REVIEW_REQUIRED",
      failureCode: "SOURCE_CANCELLATION_OUTCOME_UNKNOWN" };
    const newer = { ...receipt, id: "newer", status: "APPLIED", operationStatus: "APPLIED", failureCategory: null, failureCode: null };
    mocks.latestChange.mockResolvedValue(newer);
    mocks.scheduledChanges.mockResolvedValue([receipt]);
    await expect(read()).resolves.toMatchObject({
      paymentAction: "RECONCILE_SOURCE_CANCELLATION", activeOperation: { id: receipt.id },
      latestOperation: { id: newer.id }, scheduledChanges: [],
    });
    expect(mocks.scheduledChanges).toHaveBeenLastCalledWith(expect.objectContaining({ where: expect.objectContaining({
      organizationId: branch.organizationId, agreementBranchId: branch.id,
      AND: [{ OR: [{ operationStatus: "SCHEDULED" }, { organizationSubscriptionId: branch.billingAgreement.subscription.id,
        failureCategory: "MANUAL_REVIEW_REQUIRED", failureCode: { startsWith: "SOURCE_CANCELLATION_" } }] }],
    }) }));
    mocks.scheduledChanges.mockResolvedValue([{ ...receipt, organizationSubscriptionId: "retired_source" }]);
    await expect(read()).resolves.toMatchObject({ paymentAction: "UPDATE_CARD", activeOperation: null });
  });

  it.each(["AUTHENTICATED", "ACTIVE"])("quotes both dates for a near-boundary %s source with no provider charge date", async status => {
    const branch = independentBranch("selected", "BASIC");
    const read = ownerReads(branch);
    const upcoming = new Date("2026-08-16T04:30:00Z");
    Object.assign(branch.billingAgreement.subscription, { status, currentEnd: status === "ACTIVE" ? upcoming : null,
      currentStart: null, paidThrough: null, invoices: [], providerStartAt: upcoming, chargeAt: null });
    if (status === "AUTHENTICATED") Object.assign(branch.organization, { ownerTrialGrant: {
      ownerId: "owner_1", organizationId: branch.organizationId, status: "ACTIVE", trialEndsAt: upcoming, trialPlan: "BASIC",
    } });
    await expect(read()).resolves.toMatchObject({
      planChangeEffectiveAt: "2026-09-16T04:30:00.000Z", planChangeUndoCutoffAt: "2026-09-14T04:30:00.000Z",
      planChangePriorBoundary: { firstCharge: status === "AUTHENTICATED", at: upcoming.toISOString() }, nextChargeAt: null,
    });
  });

  it.each([
    ["BASIC","STANDARD"], ["BASIC","PRO"], ["STANDARD","PRO"],
    ["STANDARD","BASIC"], ["PRO","BASIC"], ["PRO","STANDARD"],
  ] as const)("changes %s to %s only when the branch has the applicable evidence", async (from, to) => {
    const branch = independentBranch("selected", from);
    const sibling = independentBranch("sibling", "PRO");
    mocks.branchFindUnique.mockImplementation(async ({where}) => where.id === branch.id ? branch : sibling);
    branch.billingAgreement.selectedPlan = to;
    const candidate = organization().pendingSubscriptionReplacement;
    Object.assign(candidate, { agreementBranchId: branch.id, replacesSubscriptionId:branch.billingAgreement.subscription.id, plan:to });
    const increase = ["BASIC","STANDARD","PRO"].indexOf(to) > ["BASIC","STANDARD","PRO"].indexOf(from);
    Object.assign(candidate.replacementBillingChange, { agreementBranchId:branch.id, type: increase ? "PLAN_UPGRADE" : "PLAN_DOWNGRADE",
      accessGrantedAt:null });
    branch.billingAgreement.pendingSubscriptionReplacement = candidate;
    await expect(EntitlementService.getBranchProfile(branch.id)).resolves.toMatchObject({plan:from, effectivePlan:from, canWrite:true});
    Object.assign(candidate.replacementBillingChange, { accessGrantedAt });
    await expect(EntitlementService.getBranchProfile(branch.id)).resolves.toMatchObject({plan:from, effectivePlan:increase ? to : from});
    // Received and promoted a new exact settled period for this agreement.
    branch.billingAgreement.subscription = independentBranch(branch.id, to).billingAgreement.subscription;
    branch.billingAgreement.pendingSubscriptionReplacement = null;
    await expect(EntitlementService.getBranchProfile(branch.id)).resolves.toMatchObject({plan:to, effectivePlan:to, canWrite:true});
    await expect(EntitlementService.getBranchProfile(sibling.id)).resolves.toMatchObject({plan:"PRO", effectivePlan:"PRO", canWrite:true});
  });

  it.each(["sibling","other_tenant"])("withholds a temporary grant and paid invoice with a foreign %s scope", async target => {
    const branch = independentBranch("selected","BASIC");
    const candidate = organization().pendingSubscriptionReplacement;
    Object.assign(candidate,{agreementBranchId:branch.id, replacesSubscriptionId:branch.billingAgreement.subscription.id});
    Object.assign(candidate.replacementBillingChange, target === "sibling"
      ? {agreementBranchId:"sibling"} : {agreementBranchId:branch.id, organizationId:target});
    branch.billingAgreement.pendingSubscriptionReplacement = candidate;
    mocks.branchFindUnique.mockResolvedValue(branch);
    await expect(EntitlementService.getBranchProfile(branch.id)).resolves.toMatchObject({effectivePlan:"BASIC", canWrite:true});
    Object.assign(branch.billingAgreement.subscription.invoices[0],target === "sibling"
      ? {agreementBranchId:"sibling"} : {organizationId:target});
    await expect(EntitlementService.getBranchProfile(branch.id)).resolves.toMatchObject({accessMode:"READ_ONLY",canWrite:false,entitlements:[]});
    await expect(EntitlementService.assertBranchEntitlement(branch.id, "AI_ACCESS")).rejects.toMatchObject({code:"BILLING_READ_ONLY"});
  });
});
