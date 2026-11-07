import { accountBillingHref } from "@/lib/accountNavigation";
import type { CheckoutBillingPlanId } from "@/lib/billingPlans";

export function getBillingOnboardingPath(planId: CheckoutBillingPlanId) {
  return `/onboarding?billingPlan=${planId}`;
}

export function getBillingSignUpPath(planId: CheckoutBillingPlanId) {
  return `/sign-up?redirect_url=${encodeURIComponent(getBillingOnboardingPath(planId))}`;
}

export function getOrganizationBillingPath(
  organizationId: string,
  planId: CheckoutBillingPlanId,
  returnPath?: string
) {
  const branchId = returnPath?.match(/^\/branch\/([^/]+)/)?.[1];
  const query = new URLSearchParams(accountBillingHref(organizationId, branchId).split("?")[1]);
  query.set("billingPlan", planId);
  if (returnPath?.startsWith("/") && !returnPath.startsWith("//") && !returnPath.includes("\\")) query.set("returnTo", returnPath);
  return `/account/billing?${query.toString()}#billing`;
}
