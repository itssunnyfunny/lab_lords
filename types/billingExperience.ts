import type { BillingEntitlement } from "@/lib/billingPlans";

export type BillingExperiencePlan = "BASIC" | "STANDARD" | "PRO" | "STANDARD_TRIAL" | "NONE";
export type SelectedPostTrialPlan = "BASIC" | "STANDARD" | "PRO" | null;
export type BillingExperienceAccessMode = "FULL" | "WARNING" | "READ_ONLY";

// Neutral UI names temporarily alias the legacy wire values. The values can
// move with backend emitters and exhaustive consumers in a later migration.
export const BILLING_PAYMENT_ACTION = {
  UPDATE_PAYMENT_METHOD: "UPDATE_CARD",
  AUTHORIZE_PAYMENT_METHOD: "AUTHORIZE_CARD",
} as const;

export type BillingPaymentAction =
  | "NONE"
  | "CHOOSE_PLAN"
  | "CONTINUE_CHECKOUT"
  | "RESUME_PAYMENT_RECOVERY"
  | "CHECK_PAYMENT_STATUS"
  | "WAIT_FOR_CONFIRMATION"
  | "RETRY_AUTHORIZATION"
  | "RETRY_BILLING_CHANGE"
  | "RECONCILE_SOURCE_CANCELLATION"
  | "UPDATE_CARD"
  | "AUTHORIZE_CARD";

export type BillingAuthorizationStatus =
  | "NOT_AUTHORIZED"
  | "VERIFYING"
  | "AUTHORIZED";

export type BillingCustomerState =
  | "TRIAL_ACTIVE"
  | "BASIC_ACTIVE"
  | "STANDARD_ACTIVE"
  | "PRO_ACTIVE"
  | "PAYMENT_RETRYING"
  | "PAYMENT_HALTED"
  | "CONFIRMING"
  | "PAYMENT_NOT_COMPLETED"
  | "PAYMENT_DECLINED"
  | "PAYMENT_FAILED"
  | "ACCESS_ENDED"
  | "AUTHORIZATION_REQUIRED";

export type BillingExperienceOperation = {
  id: string;
  type: string;
  status: string;
  returnPath: string | null;
  confirmationDeadlineAt: string | null;
  effectiveAt: string | null;
  undoCutoffAt?: string | null;
  canUndo?: boolean;
  failureCategory: string | null;
  failureCode: string | null;
  providerPaymentId: string | null;
  branchId: string | null;
  toPlan: "BASIC" | "STANDARD" | "PRO" | null;
  toQuantity: number | null;
  lastError: string | null;
};

export type BillingExperience = {
  legacyCoverageEndsAt?: string | null;
  independentBilling?: boolean;
  planChangeEffectiveAt?: string | null;
  planChangeUndoCutoffAt?: string | null;
  planChangePriorBoundary?: { at: string; firstCharge: boolean } | null;
  accessGrantEndsAt?: string | null;
  monthlyCommitmentSubunits?: number | null;
  nextChargeAmountSubunits?: number | null;
  organizationId: string;
  accessMode: BillingExperienceAccessMode;
  billingAccessSource?: "TRIAL" | "PAID" | "PAYMENT_RETRY" | "NONE";
  effectivePlan: BillingExperiencePlan;
  selectedPostTrialPlan: SelectedPostTrialPlan;
  providerStatus: string | null;
  customerState: BillingCustomerState;
  customerMessage: string;
  trialEndsAt: string | null;
  trialPlan?: "BASIC" | "STANDARD" | "PRO" | null;
  trialDaysRemaining: number | null;
  paidThrough: string | null;
  confirmedQuantity: number;
  projectedQuantity: number;
  currentUnitAmount: number;
  currentMonthlyTotal: number;
  projectedUnitAmount: number;
  projectedMonthlyTotal: number;
  authorizationStatus: BillingAuthorizationStatus;
  planFeeDueToday: number;
  nextChargeAt: string | null;
  paymentAction: BillingPaymentAction;
  entitlements: BillingEntitlement[];
  latestOperation: BillingExperienceOperation | null;
  activeOperation: BillingExperienceOperation | null;
  scheduledChanges: BillingExperienceOperation[];
  branch: {
    id: string;
    name: string;
    billingStatus: "ACTIVE" | "PENDING_ACTIVATION" | "REMOVAL_SCHEDULED" | "ARCHIVED";
  } | null;
  viewer: {
    isOwner: boolean;
    canManageBilling: boolean;
  };
  hasActiveOperation?: boolean;
};

export type BranchBillingExperience = Pick<
  BillingExperience,
  | "accessGrantEndsAt"
  | "independentBilling"
  | "organizationId"
  | "accessMode"
  | "effectivePlan"
  | "customerState"
  | "customerMessage"
  | "trialEndsAt"
  | "trialPlan"
  | "entitlements"
> & {
  hasActiveOperation: boolean;
  branch: Pick<NonNullable<BillingExperience["branch"]>, "id" | "billingStatus"> | null;
  viewer: {
    isOwner: false;
    canManageBilling: false;
  };
};

export type BillingExperienceView = BillingExperience | BranchBillingExperience;
