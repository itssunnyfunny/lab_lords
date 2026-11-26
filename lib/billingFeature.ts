import {
  SUPPORTED_RECURRING_PAYMENT_METHODS,
  type SupportedRecurringPaymentMethod,
} from "@/lib/billingPaymentMethods";

export const RAZORPAY_BILLING_WRITES_FLAG = "RAZORPAY_BILLING_WRITES_ENABLED" as const;
export const RAZORPAY_MULTI_METHOD_SUBSCRIPTIONS_FLAG = "RAZORPAY_MULTI_METHOD_SUBSCRIPTIONS_ENABLED" as const;

export class BillingWritesDisabledError extends Error {
  readonly code = "BILLING_WRITES_DISABLED";

  constructor() {
    super("Subscription billing changes are temporarily unavailable while payment setup is being verified");
    this.name = "BillingWritesDisabledError";
  }
}

export function areRazorpayMultiMethodSubscriptionsEnabled() {
  return process.env[RAZORPAY_MULTI_METHOD_SUBSCRIPTIONS_FLAG]?.trim().toLowerCase() === "true";
}

export type RazorpayCheckoutMethodAvailability = {
  mode: "CARD_ONLY" | "PROVIDER_MANAGED";
  potentialMethods: SupportedRecurringPaymentMethod[];
  providerControlsVisibility: boolean;
};

export function getRazorpayCheckoutMethodAvailability(): RazorpayCheckoutMethodAvailability {
  if (!areRazorpayMultiMethodSubscriptionsEnabled()) {
    return {
      mode: "CARD_ONLY",
      potentialMethods: ["CARD"],
      providerControlsVisibility: false,
    };
  }

  return {
    mode: "PROVIDER_MANAGED",
    potentialMethods: [...SUPPORTED_RECURRING_PAYMENT_METHODS],
    providerControlsVisibility: true,
  };
}

/** Installation-wide emergency control. Provider clients validate credentials and mode. */
export function areRazorpayBillingWritesEnabled() {
  const configured = process.env[RAZORPAY_BILLING_WRITES_FLAG]?.trim().toLowerCase();
  return configured === undefined || configured === "true";
}

export function assertRazorpayBillingWritesEnabled() {
  if (!areRazorpayBillingWritesEnabled()) throw new BillingWritesDisabledError();
}
