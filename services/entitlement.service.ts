import { historicalEntitlementProfile } from "@/services/legacyCommercialCompatibility";
import { prisma } from "@/lib/prisma";
import {
  getBillingPlan, billingPlanRank,
  type BillingEntitlement,
  type BillingPlanId,
} from "@/lib/billingPlans";
import type { BranchBillingStatus, Prisma } from "@/app/generated/prisma/client";
import { TERMINAL_STATUSES, deriveWorkspaceBillingState, type BillingAccessMode } from "@/lib/billingState";
import { resolveRazorpayMode } from "@/lib/razorpay";
import { deriveAuthorizedReplacementOverride } from "@/services/billingReplacement.service";
import {
  BILLING_PAID_EVIDENCE_INCLUDE,
  resolveTrustedPaidThrough,
} from "@/services/billingPaidEvidence.service";

export class SubscriptionEntitlementError extends Error {
  readonly code = "SUBSCRIPTION_UPGRADE_REQUIRED";

  constructor(message: string) {
    super(`Unauthorized: ${message}`);
    this.name = "SubscriptionEntitlementError";
  }
}

export class BillingReadOnlyError extends Error {
  readonly code = "BILLING_READ_ONLY";

  constructor(message: string) {
    super(`Unauthorized: ${message}`);
    this.name = "BillingReadOnlyError";
  }
}

export type OrganizationEntitlementProfile = {
  organizationId: string;
  plan: BillingPlanId | null;
  effectivePlan: BillingPlanId;
  subscriptionStatus: string | null;
  fallbackAccess: boolean;
  entitlements: BillingEntitlement[];
  limits: { maxBranches: number | null };
  usage: { branches: number };
  accessMode: BillingAccessMode;
  canWrite: boolean;
  accessReason: string;
  trial: { status: string; endsAt: Date | null } | null;
};

type Client = Prisma.TransactionClient | typeof prisma;

const agreementEvidence = {
  subscription: { include: BILLING_PAID_EVIDENCE_INCLUDE },
  pendingSubscriptionReplacement: {
    select: {
      id: true,
      organizationId: true,
      agreementBranchId: true,
      replacesSubscriptionId: true,
      providerMode: true,
      plan: true,
      quantity: true,
      status: true,
      providerPaymentMethod: true,
      replacementBillingChange: {
        select: {
          organizationId: true,
          agreementBranchId: true,
          type: true,
          status: true,
          failureCategory: true,
          organizationSubscriptionId: true,
          replacementSubscriptionId: true,
          effectiveAt: true,
          accessGrantedAt: true,
          accessRevokedAt: true,
          accessGraceEndsAt: true,
        },
      },
    },
  },
} as const;
const trialEvidence = {
  select: { status: true, trialEndsAt: true, trialPlan: true, ownerId: true, organizationId: true },
} as const;
const organizationEvidence = {
  id: true, ownerId: true, billingModelVersion: true,
  ...agreementEvidence, ownerTrialGrant: trialEvidence,
  _count: { select: { branches: { where: { billingStatus: { not: "ARCHIVED" } } } } },
} as const;
type CommercialEvidence = Prisma.OrganizationGetPayload<{select: typeof organizationEvidence}>;

function profileFromEvidence(organization: CommercialEvidence, agreementBranchId: string | null): OrganizationEntitlementProfile {
  const organizationId = organization.id;
  const now = new Date();
  const subscription = organization.subscription
    && organization.subscription.providerMode === resolveRazorpayMode()
    && organization.subscription.organizationId === organizationId
    && (organization.subscription.agreementBranchId ?? null) === agreementBranchId
    && (!agreementBranchId || organization.subscription.quantity === 1)
    ? organization.subscription
    : null;
  const pendingReplacement = organization.pendingSubscriptionReplacement
    && organization.pendingSubscriptionReplacement.providerMode === resolveRazorpayMode()
    && organization.pendingSubscriptionReplacement.organizationId === organizationId
    && (organization.pendingSubscriptionReplacement.agreementBranchId ?? null) === agreementBranchId
    && (!agreementBranchId || organization.pendingSubscriptionReplacement.quantity === 1)
    ? organization.pendingSubscriptionReplacement
    : null;
  const replacementChange = pendingReplacement?.replacementBillingChange;
  const replacementOverride = subscription && pendingReplacement && replacementChange
    && replacementChange.organizationId === organizationId
    && (replacementChange.agreementBranchId ?? null) === agreementBranchId
    && (!agreementBranchId || pendingReplacement.replacesSubscriptionId === subscription.id)
    ? deriveAuthorizedReplacementOverride({
        changeType: replacementChange.type,
        changeStatus: replacementChange.status,
        failureCategory: replacementChange.failureCategory,
        sourceSubscriptionId: subscription.id,
        changeSourceSubscriptionId: replacementChange.organizationSubscriptionId,
        candidateSubscriptionId: pendingReplacement.id,
        changeCandidateSubscriptionId: replacementChange.replacementSubscriptionId,
        sourcePlan: subscription.plan,
        sourceQuantity: subscription.quantity,
        candidatePlan: pendingReplacement.plan,
        candidateQuantity: pendingReplacement.quantity,
        candidateStatus: pendingReplacement.status,
        candidatePaymentMethod: pendingReplacement.providerPaymentMethod,
        accessGrantedAt: replacementChange.accessGrantedAt,
        accessRevokedAt: replacementChange.accessRevokedAt,
        effectiveAt: replacementChange.effectiveAt,
        accessGraceEndsAt: replacementChange.accessGraceEndsAt,
        now,
      })
    : null;
  const authorizedReplacement = replacementOverride
    && getBillingPlan(replacementOverride.plan as BillingPlanId)
    ? { ...replacementOverride, plan: replacementOverride.plan as BillingPlanId }
    : null;
  const trustedPaidThrough = resolveTrustedPaidThrough(subscription, now);

  if (organization.billingModelVersion !== "LEGACY") {
    const state = deriveWorkspaceBillingState({
      now,
      trial: organization.ownerTrialGrant
        ? {
            status: organization.ownerTrialGrant.status,
            endsAt: organization.ownerTrialGrant.trialEndsAt,
            plan: organization.ownerTrialGrant.trialPlan,
          }
        : null,
      subscription: subscription
        ? {
            status: subscription.status,
            plan: subscription.plan as BillingPlanId,
            paidThrough: trustedPaidThrough,
          }
        : null,
      authorizedReplacement,
    });
    const entitledPlanId = state.source === "NONE"
      ? "BASIC"
      : state.effectivePlan ?? "BASIC";
    const selectedPlan = getBillingPlan(entitledPlanId);
    if (!selectedPlan) throw new Error("Subscription plan configuration is missing");

    return {
      organizationId,
      plan: subscription?.plan as BillingPlanId | undefined ?? null,
      effectivePlan: selectedPlan.id,
      subscriptionStatus: subscription?.status ?? null,
      fallbackAccess: state.source === "NONE",
      entitlements: [...selectedPlan.entitlements],
      limits: { maxBranches: null },
      usage: { branches: organization._count.branches },
      accessMode: state.accessMode,
      canWrite: state.canWrite,
      accessReason: state.reason,
      trial: organization.ownerTrialGrant
        ? {
            status: organization.ownerTrialGrant.status,
            endsAt: organization.ownerTrialGrant.trialEndsAt,
          }
        : null,
    };
  }

  return historicalEntitlementProfile({organizationId, subscription, trustedPaidThrough, branches: organization._count.branches});
}

const branchEvidence = {
  id: true, name: true, billingStatus: true, organizationId: true,
  organization: { select: organizationEvidence },
  billingAgreement: { select: {
    branchId: true, organizationId: true, whatsAppEligibleSince: true, ...agreementEvidence,
    legacyCoverageEndsAt: true, legacyCoverageSubscriptionId: true,
    legacyCoverageSubscription: { include: BILLING_PAID_EVIDENCE_INCLUDE },
  } },
} as const;
type BranchEvidence = Prisma.BranchGetPayload<{ select: typeof branchEvidence }>;

function lifecycleBlock(status: BranchBillingStatus) {
  if (status === "ARCHIVED") return "This branch is archived";
  if (status === "PENDING_ACTIVATION") return "This branch is awaiting provider-confirmed billing activation";
  if (status === "REMOVAL_SCHEDULED") return "This branch is read-only while removal is scheduled";
  return null;
}

function branchProfile(branch: BranchEvidence) {
  const org = branch.organization;
  const agreement = branch.billingAgreement;
  const independent = org.billingModelVersion === "BRANCH_V3";
  const exact = agreement && agreement.organizationId === org.id && agreement.branchId === branch.id;
  const grant = org.ownerTrialGrant;
  const profile = independent ? profileFromEvidence({
    ...org,
    subscription: exact ? agreement.subscription : null,
    pendingSubscriptionReplacement: exact ? agreement.pendingSubscriptionReplacement : null,
    ownerTrialGrant: exact && grant?.organizationId === org.id && grant.ownerId === org.ownerId ? grant : null,
  }, branch.id) : profileFromEvidence(org, null);
  // Conversion can preserve the remaining settled interval of the retired
  // aggregate mandate. Its invoice never becomes a successor payment.
  const legacy = independent && exact ? agreement.legacyCoverageSubscription : null;
  const cutoff = agreement?.legacyCoverageEndsAt;
  const now = new Date();
  const paidEnd = legacy && legacy.id === agreement?.legacyCoverageSubscriptionId
    && legacy.organizationId === org.id && legacy.agreementBranchId === null
    && legacy.providerMode === resolveRazorpayMode() && TERMINAL_STATUSES.has(legacy.status)
    ? resolveTrustedPaidThrough(legacy, now) : null;
  const legacyCoverageEndsAt = cutoff && cutoff > now && paidEnd && paidEnd >= cutoff ? cutoff : null;
  const legacyCoverageProvidesAccess = Boolean(legacy && legacyCoverageEndsAt
    && (!profile.canWrite || billingPlanRank(legacy.plan) > billingPlanRank(profile.effectivePlan)));
  if (legacy && legacyCoverageProvidesAccess) {
    const plan = getBillingPlan(legacy.plan)!;
    profile.effectivePlan = plan.id;
    profile.entitlements = [...plan.entitlements];
    profile.canWrite = true;
    profile.accessMode = "FULL";
    profile.fallbackAccess = false;
    profile.accessReason = "The previous subscription covers this branch through its settled period";
  }
  const reason = lifecycleBlock(branch.billingStatus);
  if (reason) {
    profile.canWrite = false;
    profile.accessMode = "READ_ONLY";
    profile.accessReason = reason;
    if (independent) {
      profile.entitlements = [];
      profile.effectivePlan = "BASIC";
    }
  }
  return { ...profile, independent, legacyCoverageEndsAt, legacyCoverageProvidesAccess: legacyCoverageProvidesAccess && !reason, whatsAppEligibleSince: independent && exact ? agreement.whatsAppEligibleSince : null, branchId: branch.id, billingStatus: branch.billingStatus };
}

export class EntitlementService {
  static async getOrganizationProfile(organizationId: string, client: Client = prisma): Promise<OrganizationEntitlementProfile> {
    const org = await client.organization.findUnique({where: {id: organizationId}, select: organizationEvidence});
    if (!org) throw new Error("Organization not found");
    if (org.billingModelVersion === "BRANCH_V3") {
      // The owner can manage the organization and create pending branches even
      // when every branch is read-only. An organization has no premium rights.
      return {
        organizationId, plan: null, effectivePlan: "BASIC", subscriptionStatus: null,
        fallbackAccess: false, entitlements: [], limits: {maxBranches: null}, usage: {branches: org._count.branches},
        accessMode: "FULL", canWrite: true, accessReason: "Plans are managed per branch", trial: null,
      };
    }
    return profileFromEvidence(org, null);
  }

  static async getBranchProfile(branchId: string, client: Client = prisma) {
    const branch = await client.branch.findUnique({where: {id: branchId}, select: branchEvidence});
    if (!branch) throw new Error("Branch not found");
    return branchProfile(branch);
  }

  static async getEligibleBranchScope(organizationId: string, entitlement: BillingEntitlement, client: Client = prisma) {
    const branches = await client.branch.findMany({
      where: {organizationId}, select: branchEvidence, orderBy: {id: "asc"},
    });
    const included: {id: string; name: string}[] = [];
    const excluded: typeof included = [];
    for (const branch of branches) {
      const profile = branchProfile(branch);
      const destination = profile.entitlements.includes(entitlement) ? included : excluded;
      destination.push({id: branch.id, name: branch.name});
    }
    return { included, excluded };
  }

  /** Shared sender management and owner reporting can be used when at least one
   * branch qualifies. Consumers of branch data must filter by the returned IDs. */
  static async getOrganizationFeatureScope(organizationId: string, entitlement: BillingEntitlement, client: Client = prisma) {
    const organization = await client.organization.findUnique({
      where: { id: organizationId }, select: organizationEvidence,
    });
    if (!organization) throw new Error("Organization not found");
    if (organization.billingModelVersion !== "BRANCH_V3") {
      const profile = profileFromEvidence(organization, null);
      return { entitled: profile.entitlements.includes(entitlement), canWrite: profile.canWrite, branches: null };
    }
    const branches = await this.getEligibleBranchScope(organizationId, entitlement, client);
    return { entitled: branches.included.length > 0, canWrite: branches.included.length > 0, branches };
  }

  static async assertOrganizationEntitlement(
    organizationId: string,
    entitlement: BillingEntitlement,
    client: Prisma.TransactionClient | typeof prisma = prisma
  ) {
    const profile = await this.getOrganizationProfile(organizationId, client);
    if (!profile.entitlements.includes(entitlement)) {
      throw new SubscriptionEntitlementError(
        `${entitlement.replaceAll("_", " ").toLowerCase()} requires an upgraded subscription plan`
      );
    }
    return profile;
  }

  static async assertBranchEntitlement(
    branchId: string,
    entitlement: BillingEntitlement,
    client: Prisma.TransactionClient | typeof prisma = prisma
  ) {
    const profile = await this.getBranchProfile(branchId, client);
    if (!profile.entitlements.includes(entitlement)) {
      if (profile.independent && !profile.canWrite) throw new BillingReadOnlyError(profile.accessReason);
      throw new SubscriptionEntitlementError(`${entitlement.replaceAll("_", " ").toLowerCase()} requires an upgraded subscription plan`);
    }
    return profile;
  }

  static async assertCanCreateBranch(
    organizationId: string,
    client: Prisma.TransactionClient | typeof prisma = prisma
  ) {
    const profile = await this.getOrganizationProfile(organizationId, client);
    if (!profile.canWrite) {
      throw new BillingReadOnlyError(profile.accessReason);
    }
    const maxBranches = profile.limits.maxBranches;
    if (maxBranches !== null && profile.usage.branches >= maxBranches) {
      throw new SubscriptionEntitlementError(
        `Your current subscription supports up to ${maxBranches} ${maxBranches === 1 ? "branch" : "branches"}`
      );
    }
    return profile;
  }

  static async assertOrganizationWritable(
    organizationId: string,
    client: Prisma.TransactionClient | typeof prisma = prisma
  ) {
    const profile = await this.getOrganizationProfile(organizationId, client);
    if (!profile.canWrite) throw new BillingReadOnlyError(profile.accessReason);
    return profile;
  }

  static async assertBranchWritable(
    branchId: string,
    client: Prisma.TransactionClient | typeof prisma = prisma
  ) {
    const profile = await this.getBranchProfile(branchId, client);
    if (!profile.canWrite) throw new BillingReadOnlyError(profile.accessReason);
    return profile;
  }
}
