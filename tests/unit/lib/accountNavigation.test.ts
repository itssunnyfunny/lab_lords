import { describe, expect, it } from "vitest";
import { accountHref, accountBillingHref, accountBillingDestination, accountBillingProcessingHref } from "@/lib/accountNavigation";
describe("Account navigation", () => {
  it("keeps workspace and branch context on the canonical billing route", () => {
    const url = new URL(accountBillingHref("org_1", "branch_1", "/branch/branch_1/settings"), "https://example.invalid");
    expect(url.pathname).toBe("/account/billing");
    expect(Object.fromEntries(url.searchParams)).toEqual({organizationId:"org_1",branchId:"branch_1",returnTo:"/branch/branch_1/settings"});
    expect(accountHref("/branch/branch_1")).toBe("/account?returnTo=%2Fbranch%2Fbranch_1");
  });
  it("returns to the organization instead of looping through a legacy billing redirect", () => {
    expect(accountHref("/org/one/billing")).toBe("/account?returnTo=%2Forg%2Fone");
    expect(accountHref("/org/one/billing/processing/change")).toBe("/account?returnTo=%2Forg%2Fone");
  });
  it.each(["https://other.invalid", "//other.invalid", "/account", "/branch/one/../../admin", "/org/one?redirect=elsewhere"])("drops unsafe return hint %s", hint => {
    expect(accountHref(hint)).toBe("/account");
    expect(accountBillingHref("org_1", null, hint)).not.toContain("returnTo");
  });
  it("preserves old provider URLs, plan requests and anchors", () => {
    const url = new URL(accountBillingDestination("/org/owner/billing?billingPlan=PRO&organizationId=foreign#invoices"), "https://example.invalid");
    expect(url.pathname).toBe("/account/billing");
    expect(url.searchParams.get("organizationId")).toBe("owner");
    expect(url.searchParams.get("billingPlan")).toBe("PRO");
    expect(url.hash).toBe("#invoices");
    expect(accountBillingDestination("/org/owner/billing/processing/change?mode=test")).toBe("/account/billing/owner/processing/change?mode=test");
    expect(accountBillingDestination("/branch/one/settings")).toBe("/branch/one/settings");
    expect(accountBillingProcessingHref("org/a", "change/b")).toBe("/account/billing/org%2Fa/processing/change%2Fb");
  });
});
