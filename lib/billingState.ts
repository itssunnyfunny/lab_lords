import { billingPlanName, billingPlanRank, type BillingPlanId } from "@/lib/billingPlans";
import type { BranchBillingStatus, SaasSubscriptionStatus } from "@/app/generated/prisma/enums";
import type { BillingExperience } from "@/types/billingExperience";
import type { OrganizationBillingChange, OrganizationSubscription } from "@/app/generated/prisma/client";

/** Branches counted when checking that a workspace retains a billable branch. */
export const projectedBillableStatuses: BranchBillingStatus[] = ["ACTIVE", "PENDING_ACTIVATION"];
export const TERMINAL_STATUSES = new Set<SaasSubscriptionStatus>(["CANCELLED", "COMPLETED", "EXPIRED"]);

/** Recovery uses the existing mandate and requires the next settled invoice. */
export function isPaymentRecoveryAuthorization(change: { type: string; idempotencyKey: string }) {
  return change.type === "SUBSCRIPTION_AUTHORIZATION" && change.idempotencyKey.startsWith("payment-recovery:");
}

export const PAYMENT_RECOVERY_REVIEW_MESSAGE = "Razorpay has not confirmed this payment. You can check its status again.";

export function requiresPaymentRecoveryReview(change: {
  type: string; idempotencyKey: string; agreementBranchId: string | null;
  status: string; failureCategory: string | null; resolvedAt: Date | null;
}) {
  return change.agreementBranchId != null && isPaymentRecoveryAuthorization(change)
    && change.failureCategory === "MANUAL_REVIEW_REQUIRED" && change.resolvedAt === null
    && (change.status === "FAILED" || change.status === "AWAITING_PAYMENT");
}

export function isRecoverableMandateStatus(status: string) {
  return ["PENDING", "HALTED", "PAUSED"].includes(status.toUpperCase());
}

export function canResumePaymentRecovery(
  change: Pick<OrganizationBillingChange, "type" | "idempotencyKey" | "agreementBranchId" | "organizationId"
    | "organizationSubscriptionId" | "authorizedRazorpaySubscriptionId" | "authorizedProviderMode"
    | "operationStatus" | "status" | "failureCategory" | "resolvedAt" | "sequence"> | null | undefined,
  subscription: Pick<OrganizationSubscription, "id" | "organizationId" | "agreementBranchId" | "currentAgreementBranchId"
    | "razorpaySubscriptionId" | "providerMode" | "status"> | null | undefined,
  branchStatus: BranchBillingStatus | null | undefined,
  latestSequence?: number,
) {
  if (!change?.agreementBranchId || !subscription || !branchStatus || !projectedBillableStatuses.includes(branchStatus)
    || !isPaymentRecoveryAuthorization(change) || change.failureCategory === "MANUAL_REVIEW_REQUIRED") return false;
  const pending = change.status === "AWAITING_PAYMENT" && !change.resolvedAt
    && ["CHECKOUT_OPEN", "AWAITING_PROVIDER_CONFIRMATION"].includes(change.operationStatus);
  // Earlier clients recorded dismissal as Undo. Reuse it only while it is still the latest intent.
  const dismissed = change.status === "UNDONE" && change.operationStatus === "ABANDONED"
    && change.failureCategory === "CHECKOUT_ABANDONED" && change.sequence === latestSequence;
  return (pending || dismissed)
    && change.agreementBranchId === subscription.agreementBranchId
    && change.agreementBranchId === subscription.currentAgreementBranchId
    && change.organizationId === subscription.organizationId && change.organizationSubscriptionId === subscription.id
    && change.authorizedProviderMode === subscription.providerMode
    && change.authorizedRazorpaySubscriptionId === subscription.razorpaySubscriptionId
    && isRecoverableMandateStatus(subscription.status);
}

export function needsSourceCancellationReview(change: { failureCategory?: string | null; failureCode?: string | null } | null | undefined) {
  return change?.failureCategory === "MANUAL_REVIEW_REQUIRED"
    && change.failureCode?.startsWith("SOURCE_CANCELLATION_") === true;
}

export function hasActiveBillingTrial(experience?: Pick<BillingExperience, "effectivePlan" | "trialDaysRemaining" | "independentBilling" | "billingAccessSource"> | null) {
  if (experience?.independentBilling && experience.billingAccessSource !== undefined) return experience.billingAccessSource === "TRIAL";
  return experience?.effectivePlan === "STANDARD_TRIAL" || (experience?.trialDaysRemaining ?? 0) > 0;
}

export type BillingAccessMode = "FULL" | "WARNING" | "READ_ONLY";

export type BillingStateInput = {
  now: Date;
  trial?: {
    status: "AVAILABLE" | "ACTIVE" | "EXPIRED" | "REVOKED";
    endsAt: Date | null;
    plan?: BillingPlanId;
  } | null;
  subscription?: {
    status: string;
    plan: BillingPlanId;
    paidThrough: Date | null;
  } | null;
  authorizedReplacement?: {
    plan: BillingPlanId;
    accessGrantedAt: Date | null;
    accessRevokedAt: Date | null;
    graceEndsAt: Date | null;
  } | null;
};

function applyAuthorizedReplacement(
  state: BillingState,
  replacement: BillingStateInput["authorizedReplacement"],
  now: Date
): BillingState {
  if (!replacement?.accessGrantedAt
    || replacement.accessGrantedAt > now
    || replacement.accessRevokedAt) return state;
  if (state.accessMode === "FULL" || state.accessMode === "WARNING") {
    return {
      ...state,
      effectivePlan: billingPlanRank(replacement.plan) > billingPlanRank(state.effectivePlan) ? replacement.plan : state.effectivePlan,
      reason: "A replacement mandate is authorized for the next billing cycle",
    };
  }
  if (replacement.graceEndsAt && replacement.graceEndsAt > now) {
    return {
      accessMode: "WARNING",
      canWrite: true,
      effectivePlan: replacement.plan,
      source: "PAYMENT_RETRY",
      reason: "The replacement mandate charge is awaiting bank confirmation",
    };
  }
  return state;
}

export type BillingState = {
  accessMode: BillingAccessMode;
  canWrite: boolean;
  effectivePlan: BillingPlanId | null;
  source: "TRIAL" | "PAID" | "PAYMENT_RETRY" | "NONE";
  reason: string;
};

export function deriveWorkspaceBillingState(input: BillingStateInput): BillingState {
  const activeTrial = input.trial?.status === "ACTIVE"
    && input.trial.endsAt != null
    && input.trial.endsAt > input.now;

  if (activeTrial) {
    const trialPlan = input.trial?.plan ?? "STANDARD";
    const paidHigherPlan = input.subscription != null
      && billingPlanRank(input.subscription.plan) > billingPlanRank(trialPlan)
      && input.subscription.status !== "HALTED"
      && input.subscription.paidThrough != null && input.subscription.paidThrough > input.now;
    return applyAuthorizedReplacement({
      accessMode: "FULL",
      canWrite: true,
      effectivePlan: paidHigherPlan ? input.subscription!.plan : trialPlan,
      source: paidHigherPlan ? "PAID" : "TRIAL",
      reason: paidHigherPlan
        ? `Provider-confirmed ${billingPlanName(input.subscription!.plan)} paid period is active`
        : `${billingPlanName(trialPlan)} trial is active`,
    }, input.authorizedReplacement, input.now);
  }

  const subscription = input.subscription;
  if (!subscription) {
    return {
      accessMode: "READ_ONLY",
      canWrite: false,
      effectivePlan: null,
      source: "NONE",
      reason: "A paid subscription is required",
    };
  }

  const paidPeriodActive = subscription.paidThrough != null
    && subscription.paidThrough > input.now;

  if (subscription.status === "HALTED") {
    return applyAuthorizedReplacement({
      accessMode: "READ_ONLY",
      canWrite: false,
      effectivePlan: subscription.plan,
      source: "NONE",
      reason: "Payment retries are exhausted",
    }, input.authorizedReplacement, input.now);
  }

  if ((subscription.status === "PENDING" || subscription.status === "PAUSED")
    && paidPeriodActive) {
    return applyAuthorizedReplacement({
      accessMode: "WARNING",
      canWrite: true,
      effectivePlan: subscription.plan,
      source: "PAYMENT_RETRY",
      reason: subscription.status === "PAUSED"
        ? "The recurring mandate is paused"
        : "Payment is being retried",
    }, input.authorizedReplacement, input.now);
  }

  if (paidPeriodActive) {
    return applyAuthorizedReplacement({
      accessMode: "FULL",
      canWrite: true,
      effectivePlan: subscription.plan,
      source: "PAID",
      reason: "Provider-confirmed paid period is active",
    }, input.authorizedReplacement, input.now);
  }

  const reason = subscription.status === "ACTIVE"
      ? "Payment confirmation is still required"
      : "The paid access period has ended";

  return applyAuthorizedReplacement({
    accessMode: "READ_ONLY",
    canWrite: false,
    effectivePlan: subscription.plan,
    source: "NONE",
    reason,
  }, input.authorizedReplacement, input.now);
}
