import { describe, expect, it } from "vitest";
import {
  getBillingOnboardingPath,
  getBillingSignUpPath,
  getOrganizationBillingPath,
} from "@/lib/billingFlow";
import { getSafeRedirectPath } from "@/lib/safeRedirect";

describe("subscription purchase routing", () => {
  it("preserves a signed-out customer's selected plan through Clerk sign-up", () => {
    const signUpPath = getBillingSignUpPath("PRO");
    const redirectUrl = new URL(signUpPath, "https://lablords.in").searchParams.get("redirect_url");

    expect(signUpPath).toBe("/sign-up?redirect_url=%2Fonboarding%3FbillingPlan%3DPRO");
    expect(getSafeRedirectPath(redirectUrl, "/app")).toBe("/onboarding?billingPlan=PRO");
  });

  it("routes an onboarded organization into the selected plan checkout", () => {
    expect(getBillingOnboardingPath("BASIC")).toBe("/onboarding?billingPlan=BASIC");
    expect(getOrganizationBillingPath("org/review", "BASIC")).toBe(
      "/account/billing?organizationId=org%2Freview&billingPlan=BASIC#billing"
    );
  });

  it("preserves a local return destination and drops protocol-relative or backslash destinations", () => {
    const path = new URL(getOrganizationBillingPath("org_1", "PRO", "/branch/one/staff"), "https://lablords.in");
    expect(path.pathname).toBe("/account/billing");
    expect(path.searchParams.get("organizationId")).toBe("org_1");
    expect(path.searchParams.get("branchId")).toBe("one");
    expect(path.searchParams.get("returnTo")).toBe("/branch/one/staff");
    expect(getOrganizationBillingPath("org_1", "PRO", "//elsewhere.test")).not.toContain("returnTo");
    expect(getOrganizationBillingPath("org_1", "PRO", "/\\elsewhere.test")).not.toContain("returnTo");
  });
});
