import { trialForBillingWorkspace } from "./billingAgreementScope.service";
import { historicalBillingState } from "@/services/legacyCommercialCompatibility";
import { prisma } from "@/lib/prisma";
import { getBillingPlan, isCheckoutBillingPlanId, type BillingPlanId } from "@/lib/billingPlans";
import { deriveWorkspaceBillingState, projectedBillableStatuses } from "@/lib/billingState";
import type { BillingExperience, BillingExperienceOperation } from "@/types/billingExperience";
import type { OrganizationBillingChange } from "@/app/generated/prisma/client";
import { BillingResourceNotFoundError } from "@/lib/billingErrors";
import { EntitlementService } from "./entitlement.service";
import { resolveRazorpayMode } from "@/lib/razorpay";
import { deriveAuthorizedReplacementOverride } from "@/services/billingReplacement.service";
import { isSupportedRecurringPaymentMethod } from "@/services/billingReplacementPolicy";
import { getSafeReplacementCycleBoundary, REPLACEMENT_SAFE_CYCLE_LEAD_MS } from "./billingReplacementPolicy";
import {
  BILLING_PAID_EVIDENCE_INCLUDE,
  resolveTrustedPaidThrough,
} from "@/services/billingPaidEvidence.service";

const DAY_MS = 24 * 60 * 60 * 1000;
const ACTIVE_OPERATION_STATUSES = [
  "CHECKOUT_OPEN",
  "VERIFYING",
  "AWAITING_PROVIDER_CONFIRMATION",
] as const;
const TERMINAL_OPERATION_FAILURES = ["DECLINED", "ABANDONED", "FAILED"] as const;

function isCustomerVisibleOperationFailure(change: OrganizationBillingChange | null) {
  if (!change || !TERMINAL_OPERATION_FAILURES.includes(
    change.operationStatus as typeof TERMINAL_OPERATION_FAILURES[number]
  )) {
    return false;
  }
  if (change.operationStatus !== "ABANDONED") return true;

  // ABANDONED is also the persisted operation state for an intentional undo,
  // superseded change, or discarded pending branch. Only an actual Checkout
  // dismissal is a customer-facing payment outcome.
  return change.type === "SUBSCRIPTION_AUTHORIZATION"
    && change.failureCategory === "CHECKOUT_ABANDONED";
}

function experiencePlan(plan: string | null | undefined) {
  return isCheckoutBillingPlanId(plan) ? plan : "NONE" as const;
}

function selectedPlan(subscription: {
  plan: string;
  providerPaymentMethod: string;
  status: string;
} | null) {
  if (!subscription || !isSupportedRecurringPaymentMethod(subscription.providerPaymentMethod)) return null;
  if (["CREATED", "EXPIRED", "CANCELLED", "COMPLETED"].includes(subscription.status)) return null;
  const plan = experiencePlan(subscription.plan);
  return plan === "NONE" ? null : plan;
}

function serializeOperation(change: OrganizationBillingChange): BillingExperienceOperation {
  return {
    id: change.id,
    type: change.type,
    status: change.operationStatus,
    returnPath: change.returnPath,
    confirmationDeadlineAt: change.confirmationDeadlineAt?.toISOString() ?? null,
    effectiveAt: change.effectiveAt?.toISOString() ?? null,
    failureCategory: change.failureCategory,
    failureCode: change.failureCode,
    providerPaymentId: change.providerPaymentId,
    branchId: change.branchId,
    toPlan: isCheckoutBillingPlanId(change.toPlan) ? change.toPlan : null,
    toQuantity: change.toQuantity,
    lastError: change.lastError,
  };
}

function customerPresentation(input: {
  trialActive: boolean;
  trialPlan?: BillingPlanId;
  effectivePlan: "BASIC" | "STANDARD" | "PRO" | "STANDARD_TRIAL" | "NONE";
  providerStatus: string | null;
  operationStatus: string | null;
  operationFailureVisible: boolean;
  postTrialPlanSelected: boolean;
}) {
  if (input.operationStatus === "VERIFYING" || input.operationStatus === "AWAITING_PROVIDER_CONFIRMATION") {
    return { state: "CONFIRMING" as const, message: "Your payment is being confirmed. Existing access remains unchanged." };
  }
  if (input.operationStatus === "ABANDONED" && input.operationFailureVisible) {
    return { state: "PAYMENT_NOT_COMPLETED" as const, message: input.trialActive ? `Payment was not completed. Your ${getBillingPlan(input.trialPlan ?? "STANDARD")!.shortName} trial continues.` : "Payment was not completed. Your current plan remains unchanged." };
  }
  if (input.operationStatus === "DECLINED") {
    return { state: "PAYMENT_DECLINED" as const, message: "The recurring payment authorization was declined. Try another method supported by Razorpay." };
  }
  if (input.operationStatus === "FAILED") {
    return { state: "PAYMENT_FAILED" as const, message: "We could not complete the billing change. Your confirmed plan and quantity remain unchanged." };
  }
  if (input.trialActive) return { state: "TRIAL_ACTIVE" as const, message: `Your ${getBillingPlan(input.trialPlan ?? "STANDARD")!.shortName} trial is active without a plan charge.` };
  if (input.providerStatus === "PENDING") return { state: "PAYMENT_RETRYING" as const, message: "Your renewal payment is being retried. Access remains available." };
  if (input.providerStatus === "PAUSED") return { state: "PAYMENT_RETRYING" as const, message: "The recurring mandate is paused. Resume it in your UPI app when available, or authorize a replacement payment method." };
  if (input.providerStatus === "HALTED") return { state: "PAYMENT_HALTED" as const, message: "Payment retries are exhausted. Recover the mandate or authorize another payment method to restore full access after confirmation." };
  if (input.effectivePlan === "STANDARD") return { state: "STANDARD_ACTIVE" as const, message: "Standard is active for this workspace." };
  if (input.effectivePlan === "PRO") return { state: "PRO_ACTIVE" as const, message: "Pro is active for this workspace." };
  if (input.effectivePlan === "BASIC") return { state: "BASIC_ACTIVE" as const, message: "Basic is active for this workspace." };
  if (["CANCELLED", "COMPLETED", "EXPIRED"].includes(input.providerStatus ?? "")) return { state: "ACCESS_ENDED" as const, message: "The paid access period has ended. Your data is preserved." };
  return {
    state: "AUTHORIZATION_REQUIRED" as const,
    message: input.postTrialPlanSelected
      ? "Authorize the selected plan to activate billing for this workspace."
      : "Choose a plan and authorize a supported recurring payment method for this workspace.",
  };
}

export class BillingExperienceService {
  static async getBillingExperience(organizationId: string, userId: string, branchId?: string) {
    const now = new Date();
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        subscription: { include: BILLING_PAID_EVIDENCE_INCLUDE },
        pendingSubscriptionReplacement: {
          include: { replacementBillingChange: true },
        },
        ownerTrialGrant: true,
        branches: {
          where: { billingStatus: { in: projectedBillableStatuses } },
          select: { id: true },
        },
      },
    });
    if (!organization) throw new Error("Organization not found");
    const independent = organization.billingModelVersion === "BRANCH_V3";
    if (independent && !branchId) throw new BillingResourceNotFoundError("Branch not found");
    const agreement = independent && branchId ? await prisma.branchBillingAgreement.findFirst({
      where: { branchId, organizationId },
      include: {
        subscription: { include: BILLING_PAID_EVIDENCE_INCLUDE },
        pendingSubscriptionReplacement: { include: { replacementBillingChange: true } },
      },
    }) : null;
    if (independent && !agreement) throw new BillingResourceNotFoundError("Branch not found");
    const owner = agreement ?? organization;
    const providerMode = owner.subscription || owner.pendingSubscriptionReplacement ? resolveRazorpayMode() : null;
    const subscription = owner.subscription?.providerMode === providerMode
      && (!independent || owner.subscription.agreementBranchId === branchId)
      ? owner.subscription
      : null;
    const pendingReplacement = owner.pendingSubscriptionReplacement?.providerMode === providerMode
      && (!independent || owner.pendingSubscriptionReplacement.agreementBranchId === branchId)
      ? owner.pendingSubscriptionReplacement
      : null;
    const replacementChange = pendingReplacement?.replacementBillingChange;
    const replacementOverride = subscription && pendingReplacement && replacementChange
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
      && getBillingPlan(replacementOverride.plan)
      ? { ...replacementOverride, plan: replacementOverride.plan as BillingPlanId }
      : null;
    const trustedPaidThrough = resolveTrustedPaidThrough(subscription, now);
    const isOwner = organization.ownerId === userId;
    if (!isOwner) {
      const membership = await prisma.staff.findFirst({
        where: { userId, branch: { organizationId, ...(branchId ? { id: branchId } : {}) } },
        select: { id: true },
      });
      if (!membership) throw new Error("Unauthorized");
    }

    const branch = branchId
      ? await prisma.branch.findFirst({
          where: { id: branchId, organizationId },
          select: { id: true, name: true, billingStatus: true },
        })
      : null;
    if (branchId && !branch) throw new Error("Branch not found");

    const [latestOperation, scheduledChanges] = await Promise.all([
      prisma.organizationBillingChange.findFirst({
        where: {
          organizationId,
          agreementBranchId: agreement?.branchId ?? null,
          ...(providerMode ? {
            OR: [
              { organizationSubscriptionId: null },
              { organizationSubscription: { providerMode } },
            ],
          } : {}),
        },
        orderBy: { sequence: "desc" },
      }),
      prisma.organizationBillingChange.findMany({
        where: {
          organizationId,
          agreementBranchId: agreement?.branchId ?? null,
          operationStatus: "SCHEDULED",
          ...(providerMode ? {
            OR: [
              { organizationSubscriptionId: null },
              { organizationSubscription: { providerMode } },
            ],
          } : {}),
        },
        orderBy: { sequence: "asc" },
      }),
    ]);

    const trial = trialForBillingWorkspace(organization);
    const trialActive = trial?.status === "ACTIVE"
      && trial.trialEndsAt != null
      && trial.trialEndsAt > now;
    const state = independent || organization.billingModelVersion === "WORKSPACE_V2"
      ? deriveWorkspaceBillingState({
          now,
          trial: trial
            ? { status: trial.status, endsAt: trial.trialEndsAt, plan: trial.trialPlan }
            : null,
          subscription: subscription
            ? { status: subscription.status, plan: subscription.plan, paidThrough: trustedPaidThrough }
            : null,
          authorizedReplacement,
        })
      : historicalBillingState(subscription?.plan ?? null, trustedPaidThrough);

    const profile = agreement ? await EntitlementService.getBranchProfile(agreement.branchId) : null;
    const lifecycleBlocked = Boolean(profile && profile.billingStatus !== "ACTIVE");
    const accessSource = lifecycleBlocked ? "NONE" : profile?.legacyCoverageProvidesAccess ? "PAID" : state.source;
    const trialProvidesAccess = trialActive && accessSource === "TRIAL"
      && (!independent || profile?.effectivePlan === trial?.trialPlan);
    const effectivePlan = profile && (profile.fallbackAccess || lifecycleBlocked) ? "NONE" : trialProvidesAccess && (profile?.effectivePlan ?? state.effectivePlan) === "STANDARD"
      ? "STANDARD_TRIAL" as const
      : state.source === "NONE" && organization.billingModelVersion === "WORKSPACE_V2"
        ? "NONE" as const
        : experiencePlan(profile?.effectivePlan ?? state.effectivePlan);
    const entitlementPlan = effectivePlan === "STANDARD_TRIAL" ? "STANDARD"
      : isCheckoutBillingPlanId(effectivePlan) ? effectivePlan : "BASIC";
    const entitlements = profile?.entitlements ?? getBillingPlan(entitlementPlan)?.entitlements ?? [];
    const providerPostTrialPlan = selectedPlan(subscription);
    const postTrialPlan = independent ? agreement!.selectedPlan : providerPostTrialPlan
      ?? (isCheckoutBillingPlanId(organization.selectedPostTrialPlan) ? organization.selectedPostTrialPlan : null);
    const projectedPlanId = postTrialPlan;
    const projectedUnitAmount = projectedPlanId ? getBillingPlan(projectedPlanId)?.amount ?? 0 : 0;
    const currentUnitAmount = subscription?.amount ?? 0;
    const boundary = subscription?.currentEnd ?? trustedPaidThrough;
    let planChangeEffectiveAt: Date | null = null;
    if (subscription && !subscription.billingOfferId && subscription.period === "monthly" && subscription.interval > 0) {
      if (boundary) planChangeEffectiveAt = getSafeReplacementCycleBoundary({ now, currentCycleEnd: boundary, intervalMonths: subscription.interval });
      else if (subscription.providerStartAt && subscription.providerStartAt.getTime() >= now.getTime() + REPLACEMENT_SAFE_CYCLE_LEAD_MS) {
        planChangeEffectiveAt = subscription.providerStartAt;
      }
    }
    const confirmedQuantity = subscription?.quantity ?? 0;
    const projectedQuantity = independent ? Number(branch?.billingStatus !== "ARCHIVED" && branch?.billingStatus !== "REMOVAL_SCHEDULED") : organization.branches.length;
    const activeOperation = latestOperation
      && ACTIVE_OPERATION_STATUSES.includes(latestOperation.operationStatus as typeof ACTIVE_OPERATION_STATUSES[number])
      ? latestOperation
      : null;
    const authorizationStatus = ["VERIFYING", "AWAITING_PROVIDER_CONFIRMATION"].includes(activeOperation?.operationStatus ?? "")
      ? "VERIFYING" as const
      : providerPostTrialPlan
        ? "AUTHORIZED" as const
        : "NOT_AUTHORIZED" as const;
    const presentation = customerPresentation({
      trialActive: independent ? trialProvidesAccess : trialActive,
      trialPlan: trial?.trialPlan,
      effectivePlan,
      providerStatus: subscription?.status ?? null,
      operationStatus: latestOperation?.operationStatus ?? null,
      operationFailureVisible: isCustomerVisibleOperationFailure(latestOperation),
      postTrialPlanSelected: postTrialPlan != null,
    });

    const latestFailed = isCustomerVisibleOperationFailure(latestOperation);
    const paymentAction = activeOperation?.operationStatus === "CHECKOUT_OPEN"
      ? "CONTINUE_CHECKOUT" as const
      : ["VERIFYING", "AWAITING_PROVIDER_CONFIRMATION"].includes(activeOperation?.operationStatus ?? "")
        ? "WAIT_FOR_CONFIRMATION" as const
        : ["PENDING", "HALTED", "PAUSED"].includes(subscription?.status ?? "")
          ? "UPDATE_CARD" as const
          : latestFailed && latestOperation?.type === "SUBSCRIPTION_AUTHORIZATION"
            ? "RETRY_AUTHORIZATION" as const
            : latestFailed
              ? "RETRY_BILLING_CHANGE" as const
            : trialActive && !providerPostTrialPlan
              ? postTrialPlan
                ? "AUTHORIZE_CARD" as const
                : "CHOOSE_PLAN" as const
              : state.accessMode === "READ_ONLY"
                ? postTrialPlan
                  ? "AUTHORIZE_CARD" as const
                  : "CHOOSE_PLAN" as const
                : "NONE" as const;

    const recurring = subscription && providerPostTrialPlan && !subscription.cancelAtCycleEnd
      && !["HALTED", "PAUSED"].includes(subscription.status) ? subscription : null;
    const nextChargeAt = independent
      ? recurring?.chargeAt?.toISOString() ?? null
      : authorizationStatus === "AUTHORIZED" ? subscription?.chargeAt?.toISOString() ?? null : null;
    const result: BillingExperience = {
      ...(independent ? {
        independentBilling: true,
        planChangeEffectiveAt: planChangeEffectiveAt?.toISOString() ?? null,
        legacyCoverageEndsAt: profile?.legacyCoverageEndsAt?.toISOString() ?? null,
        monthlyCommitmentSubunits: recurring?.billingOfferId || pendingReplacement ? null : recurring?.amountSubunits ?? 0,
        nextChargeAmountSubunits: nextChargeAt && !recurring?.billingOfferId && !pendingReplacement ? recurring?.amountSubunits ?? null : null,
      } : {}),
      organizationId,
      accessMode: profile?.accessMode ?? state.accessMode,
      billingAccessSource: accessSource,
      accessGrantEndsAt: lifecycleBlocked ? null : profile?.legacyCoverageProvidesAccess ? profile.legacyCoverageEndsAt?.toISOString() ?? null
        : authorizedReplacement?.graceEndsAt?.toISOString() ?? null,
      effectivePlan,
      selectedPostTrialPlan: postTrialPlan,
      providerStatus: subscription?.status ?? null,
      customerState: presentation.state,
      customerMessage: independent && branch?.billingStatus !== "ACTIVE" ? profile!.accessReason : presentation.message,
      trialEndsAt: trial?.trialEndsAt?.toISOString() ?? null,
      trialPlan: trial?.trialPlan ?? null,
      trialDaysRemaining: trialActive && trial?.trialEndsAt
        ? Math.max(1, Math.ceil((trial.trialEndsAt.getTime() - now.getTime()) / DAY_MS))
        : null,
      paidThrough: trustedPaidThrough?.toISOString() ?? null,
      confirmedQuantity,
      projectedQuantity,
      currentUnitAmount,
      currentMonthlyTotal: currentUnitAmount * confirmedQuantity,
      projectedUnitAmount,
      projectedMonthlyTotal: projectedUnitAmount * projectedQuantity,
      authorizationStatus,
      planFeeDueToday: trialActive || profile?.legacyCoverageEndsAt || (trustedPaidThrough?.getTime() ?? 0) > now.getTime()
        ? 0
        : projectedUnitAmount * projectedQuantity,
      nextChargeAt,
      paymentAction,
      entitlements: [...entitlements],
      latestOperation: latestOperation ? serializeOperation(latestOperation) : null,
      activeOperation: activeOperation ? serializeOperation(activeOperation) : null,
      scheduledChanges: scheduledChanges.map(serializeOperation),
      branch: branch ? { ...branch } : null,
      viewer: { isOwner, canManageBilling: isOwner },
    };
    return result;
  }

  static async getForBranch(branchId: string, userId: string) {
    const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { organizationId: true } });
    if (!branch) throw new Error("Branch not found");
    return this.getBillingExperience(branch.organizationId, userId, branchId);
  }
}
