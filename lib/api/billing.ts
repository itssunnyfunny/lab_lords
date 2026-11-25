import { apiClient } from "./core";
import type {
  BillingEntitlement,
  PublicBillingCapability,
  BillingPlanId,
  CheckoutBillingPlanId,
} from "@/lib/billingPlans";
import type { BillingExperience } from "@/types/billingExperience";
import type {
  ProviderPaymentMethodValue,
  SupportedRecurringPaymentMethod,
} from "@/lib/billingPaymentMethods";

export type BillingPlanDto = {
  id: CheckoutBillingPlanId;
  name: string;
  shortName: string;
  amount: number | null;
  currency: "INR";
  period: "monthly";
  interval: 1;
  active: boolean;
  featured: boolean;
  comingSoon: boolean;
  custom: boolean;
  description: string;
  availabilityNote?: string | null;
  capabilities: PublicBillingCapability[];
  entitlements: BillingEntitlement[];
  limits: { maxBranches: number | null };
};

export type OrganizationSubscriptionDto = {
  id: string;
  organizationId: string;
  position: "CURRENT" | "PENDING_REPLACEMENT" | "ARCHIVED";
  replacesSubscriptionId: string | null;
  plan: BillingPlanId;
  planName: string;
  shortName: string;
  amount: number;
  amountSubunits: number;
  currency: string;
  period: string;
  interval: number;
  totalCount: number;
  quantity: number;
  unitAmount: number;
  monthlyTotal: number;
  status: string;
  razorpaySubscriptionId: string;
  currentStart: string | null;
  currentEnd: string | null;
  chargeAt: string | null;
  endedAt: string | null;
  providerStartAt: string | null;
  authorizationExpiresAt: string | null;
  providerPaymentMethod: ProviderPaymentMethodValue;
  paidThrough: string | null;
  cancelAtCycleEnd: boolean;
  cancellationRequestedAt: string | null;
  cancellationScheduledAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OrganizationSubscriptionHistoryDto = {
  id: string;
  razorpaySubscriptionId: string;
  razorpayPaymentId: string | null;
  plan: BillingPlanId;
  fromStatus: string | null;
  toStatus: string;
  source: string;
  event: string | null;
  amountSubunits: number;
  currency: string;
  createdAt: string;
};

export type OrganizationEntitlementProfileDto = {
  organizationId: string;
  plan: BillingPlanId | null;
  effectivePlan: BillingPlanId;
  subscriptionStatus: string | null;
  fallbackAccess: boolean;
  entitlements: BillingEntitlement[];
  limits: { maxBranches: number | null };
  usage: { branches: number };
  accessMode: "FULL" | "WARNING" | "READ_ONLY";
  canWrite: boolean;
  accessReason: string;
  trial: { status: string; endsAt: string | null } | null;
};

export type BillingOverview = {
  experience: BillingExperience;
  razorpayTestMode: boolean;
  multiMethodSubscriptionsEnabled?: boolean;
  checkoutMethodAvailability?: {
    mode: "CARD_ONLY" | "PROVIDER_MANAGED";
    potentialMethods: SupportedRecurringPaymentMethod[];
    providerControlsVisibility: boolean;
  };
  plans: BillingPlanDto[];
  current: OrganizationSubscriptionDto | null;
  pendingReplacement: OrganizationSubscriptionDto | null;
  history: OrganizationSubscriptionHistoryDto[];
  entitlements: OrganizationEntitlementProfileDto;
  billingModelVersion: "LEGACY" | "WORKSPACE_V2" | "BRANCH_V3";
  trial: {
    status: string;
    source: string;
    organizationId: string | null;
    startedAt: string | null;
    endsAt: string | null;
  } | null;
  ownerTrialEligibility: {
    status: string;
    claimable: boolean;
    boundOrganizationId: string | null;
  } | null;
  paymentMethod: ProviderPaymentMethodValue | null;
  invoices: Array<{
    id: string;
    status: string;
    amountSubunits: number;
    currency: string;
    paidAt: string | null;
  }>;
  scheduledChanges: Array<{
    id: string;
    type: string;
    status: string;
    effectiveAt: string | null;
    undoCutoffAt: string | null;
    toPlan: BillingPlanId | null;
    toQuantity: number | null;
    lastError: string | null;
    organizationSubscriptionId?: string | null;
    failureCategory?: string | null;
    replacementSubscriptionId?: string | null;
    accessGrantedAt?: string | null;
    accessRevokedAt?: string | null;
    accessGraceEndsAt?: string | null;
  }>;
};

export type BillingInvoiceDto = BillingOverview["invoices"][number] & {
  createdAt: string;
  providerMode: "TEST" | "LIVE" | null;
};

export type BillingInvoicePage = { items: BillingInvoiceDto[]; nextCursor: string | null };

export type BillingOperationDto = {
  id: string;
  organizationId: string;
  type: string;
  queueStatus: string;
  operationStatus: "CHECKOUT_OPEN" | "VERIFYING" | "AWAITING_PROVIDER_CONFIRMATION" | "APPLIED" | "DECLINED" | "ABANDONED" | "FAILED" | "SCHEDULED";
  returnPath: string | null;
  confirmationDeadlineAt: string | null;
  failureCategory: string | null;
  failureCode: string | null;
  providerPaymentId: string | null;
  message: string | null;
  effectiveAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RazorpayCheckoutConfig = {
  display: {
    blocks: {
      cards: {
        name: string;
        instruments: Array<{ method: "card" }>;
      };
    };
    sequence: ["block.cards"];
    preferences: { show_default_blocks: false };
  };
};

/** @deprecated Use RazorpayCheckoutConfig. Kept while older callers migrate. */
export type RazorpayCardOnlyConfig = RazorpayCheckoutConfig;

export type BillingCheckoutPurpose = "INITIAL" | "REPLACEMENT";

export type BillingCheckoutPayload = {
  purpose: BillingCheckoutPurpose;
  changeId: string;
  processingUrl: string;
  keyId: string;
  testMode: boolean;
  type: "subscription";
  subscriptionId: string;
  subscription_card_change?: true;
  amount: number;
  currency: string;
  name: string;
  description: string;
  config?: RazorpayCheckoutConfig;
  plan: Pick<BillingPlanDto, "id" | "name" | "shortName" | "amount" | "currency" | "period">;
  prefill: {
    name?: string;
    email?: string;
    contact?: string;
  };
  notes: Record<string, string>;
  summary: {
    plan: CheckoutBillingPlanId;
    unitAmount: number;
    quantity: number;
    estimatedMonthlyTotal: number;
    planFeeDueToday: number;
    trialEndsAt: string | null;
    firstChargeAt: string | null;
  };
  subscription: OrganizationSubscriptionDto;
  operation: BillingOperationDto;
};

export type BillingVerificationResult = {
  verified: boolean;
  pending?: true;
  operation: BillingOperationDto;
  processingUrl: string;
  subscription: OrganizationSubscriptionDto;
};

export type BillingCancellationResult = {
  cancelled: boolean;
  scheduled: boolean;
  subscription: OrganizationSubscriptionDto;
};

export type BillingPlanChangeProcessingResult = {
  unchanged?: true;
  subscription?: OrganizationSubscriptionDto;
  operation?: BillingOperationDto;
  processingUrl?: string;
};

export type BillingPlanChangeResult = BillingCheckoutPayload | BillingPlanChangeProcessingResult;

export type BillingRecoveryPayload = {
  purpose: "RECOVERY";
  keyId: string;
  testMode: boolean;
  subscriptionId: string;
  subscription_card_change?: true;
  hostedRecoveryUrl?: string;
  config?: RazorpayCheckoutConfig;
  changeId: string;
  processingUrl: string;
  operation: BillingOperationDto;
  subscription: OrganizationSubscriptionDto;
  name: string;
  description: string;
  prefill: BillingCheckoutPayload["prefill"];
  notes: Record<string, string>;
  summary: BillingCheckoutPayload["summary"];
};

export type BillingOperationResponse = {
  operation: BillingOperationDto;
  processingUrl?: string;
  checkout?: BillingCheckoutPayload;
};

export type BillingRetryResult = BillingCheckoutPayload | BillingRecoveryPayload | BillingOperationResponse;

export function billingRequestPath(path: string, branchId?: string) {
  if (!branchId) return path;
  const separator = path.includes("?") ? "&" : "?";
  return path + separator + new URLSearchParams({ branchId }).toString();
}

export function billingForBranch(branchId?: string) {
  const scope = (path: string) => billingRequestPath(path, branchId);
  async function submitIntent<T>(orgId: string, intent: string, submit: (key: string) => Promise<T>) {
    if (!branchId) return submit(crypto.randomUUID());
    const storageKey = `branch-billing-intent:${orgId}:${branchId}:${intent}`;
    const key = sessionStorage.getItem(storageKey) ?? crypto.randomUUID();
    sessionStorage.setItem(storageKey, key);
    const result = await submit(key);
    sessionStorage.removeItem(storageKey);
    return result;
  }
  return {
    getOverview(orgId: string): Promise<BillingOverview> {
      return apiClient.get(scope(`/organizations/${orgId}/billing`));
    },

    getInvoices(orgId: string, cursor?: string): Promise<BillingInvoicePage> {
      const query = cursor ? `?${new URLSearchParams({ cursor }).toString()}` : "";
      return apiClient.get(scope(`/organizations/${encodeURIComponent(orgId)}/billing/invoices${query}`));
    },

    createSubscription(orgId: string, plan: CheckoutBillingPlanId, returnPath?: string): Promise<BillingCheckoutPayload> {
      return apiClient.post(scope(`/organizations/${orgId}/billing/subscription`), { plan, returnPath });
    },

    verifySubscription(
      orgId: string,
      payload: {
        razorpay_subscription_id: string;
        razorpay_payment_id: string;
        razorpay_signature: string;
        changeId: string;
      }
    ): Promise<BillingVerificationResult> {
      return apiClient.post(scope(`/organizations/${orgId}/billing/subscription/verify`), payload);
    },

    cancelSubscription(orgId: string): Promise<BillingCancellationResult> {
      return submitIntent(orgId, "cancel", key => apiClient.post(scope(`/organizations/${orgId}/billing/subscription/cancel`), null, {
        headers: { "Idempotency-Key": key },
      }));
    },

    undoCancellation(orgId: string): Promise<{ undone: true }> {
      return apiClient.delete(scope(`/organizations/${orgId}/billing/subscription/cancel`));
    },

    claimTrial(orgId: string) {
      return apiClient.post(scope(`/organizations/${orgId}/billing/trial/claim`));
    },

    changePlan(
      orgId: string,
      plan: CheckoutBillingPlanId,
      returnPath?: string
    ): Promise<BillingPlanChangeResult> {
      return submitIntent(orgId, "plan-" + plan, key => apiClient.patch(scope(`/organizations/${orgId}/billing/subscription`), { plan, returnPath }, {
        headers: { "Idempotency-Key": key },
      }));
    },

    changePaymentMethod(orgId: string, returnPath?: string): Promise<BillingPlanChangeResult> {
      return submitIntent(orgId, "payment-method", key => apiClient.post(scope(`/organizations/${orgId}/billing/subscription/payment-method`), { returnPath }, {
        headers: { "Idempotency-Key": key },
      }));
    },

    undoChange(orgId: string, changeId: string) {
      return apiClient.delete(scope(`/organizations/${orgId}/billing/mutations/${changeId}`));
    },

    getOperation(orgId: string, changeId: string): Promise<BillingOperationResponse & { processingUrl: string }> {
      return apiClient.get(scope(`/organizations/${orgId}/billing/mutations/${changeId}`));
    },

    reconcileOperation(orgId: string, changeId: string, paymentId?: string) {
      return apiClient.post(scope(`/organizations/${orgId}/billing/mutations/${changeId}`), { paymentId });
    },

    retryOperation(orgId: string, changeId: string): Promise<BillingRetryResult> {
      return apiClient.post(scope(`/organizations/${orgId}/billing/mutations/${changeId}/retry`));
    },

    recordCheckoutEvent(
      orgId: string,
      changeId: string,
      event: "ABANDONED" | "DECLINED" | "FAILED" | "AWAITING_PROVIDER_CONFIRMATION",
      details?: {
        failureCategory?: string;
        failureCode?: string;
        reason?: string;
        source?: string;
        step?: string;
        paymentId?: string;
      }
    ) {
      return apiClient.post(scope(`/organizations/${orgId}/billing/mutations/${changeId}/checkout-event`), { event, ...details });
    },

    createRecovery(
      orgId: string,
      returnPath?: string
    ): Promise<BillingRecoveryPayload | BillingCheckoutPayload> {
      return apiClient.post(scope(`/organizations/${orgId}/billing/subscription/recovery`), { returnPath });
    },
  };
}

export const billing = billingForBranch();
