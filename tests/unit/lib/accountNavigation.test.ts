import { describe, expect, it } from "vitest";
import { accountHref, accountBillingHref, accountBillingDestination, accountBillingProcessingHref, accountWorkspaceDestination, accountBillingOperationReturn, accountBillingProcessingDestination } from "@/lib/accountNavigation";
import type { WorkspaceDirectory } from "@/types";
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

describe.each([1, 2])("billing returns for an owner with %i organization(s)", count => {
  const organizations = ["first", "historical"].slice(0, count).map(id => ({ id, href: `/org/${id}`, branches: [{ id: `${id}-branch`, href: `/branch/${id}-branch` }] }));
  const directory = { organizations, staffBranches: [] } as unknown as WorkspaceDirectory;
  const selected = organizations.at(-1)!;
  const branch = `${selected.id}-branch`;
  const query = new URLSearchParams({ organizationId: selected.id, branchId: branch, returnTo: `/branch/${branch}/students` });
  it("retains the selected organization and deep branch destination", () => {
    expect(accountWorkspaceDestination("/account/billing", query, "/branch/first-branch", directory)).toBe(`/branch/${branch}/students`);
    const billing = accountBillingHref(selected.id, branch, `/branch/${branch}/students`) + "#invoices";
    const processing = accountBillingProcessingDestination(`/org/${selected.id}/billing/processing/change`, billing);
    expect(accountWorkspaceDestination(new URL(processing, "https://test.invalid").pathname, new URL(processing, "https://test.invalid").searchParams, null, directory)).toBe(`/branch/${branch}/students`);
    expect(accountBillingOperationReturn(selected.id, billing)).toBe(billing);
  });
  it("binds a historical bare billing return to the operation organization", () => {
    expect(accountBillingOperationReturn(selected.id, "/account/billing#invoices")).toBe(`/account/billing?organizationId=${selected.id}#invoices`);
    expect(accountBillingOperationReturn(selected.id, `/org/${selected.id}/settings#billing`)).toBe(`/account/billing?organizationId=${selected.id}#billing`);
  });
  it("uses the selected scope instead of foreign or stale workspace hints", () => {
    const switched = new URLSearchParams({ organizationId: selected.id, returnTo: "/branch/foreign" });
    expect(accountWorkspaceDestination("/account/billing", switched, "/branch/first-branch", directory)).toBe(`/org/${selected.id}`);
    switched.set("branchId", branch);
    expect(accountWorkspaceDestination("/account/billing", switched, null, directory)).toBe(`/branch/${branch}`);
  });
  it("keeps the ordinary default organization and ignores conflicting processing hints", () => {
    expect(accountWorkspaceDestination("/account/billing", new URLSearchParams(), `/branch/${branch}`, directory)).toMatch(/^\/(?:org\/first|branch\/first-branch)$/);
    expect(accountWorkspaceDestination(`/account/billing/${selected.id}/processing/change`, new URLSearchParams({organizationId:"foreign"}), null, directory)).toBe(`/org/${selected.id}`);
  });
});
