import { BILLING_PLAN_IDS } from "@/lib/billingPlans";

export const branchBillingIntentActions = ["cancel", "payment-method", ...BILLING_PLAN_IDS.map(plan => "plan-" + plan)];
export const billingIntentHeader = "X-Billing-Intent-Keys";

export type BranchBillingIntentReceipt = { key: string; resolved: boolean };

export function isBrowserBillingIntentKey(key: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key);
}
