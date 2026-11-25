import {describe,it,expect} from "vitest";
import {authorizedWorkspaceReturn,branchSwitchDestination,branchSwitchTarget} from "@/lib/basicNavigation";
import type {WorkspaceDirectory,WorkspaceDirectoryBranch} from "@/types";
const directory={organizations:[{id:"org-a",href:"/org/org-a",branches:[{id:"branch-a",href:"/branch/branch-a"}]}],staffBranches:[{id:"branch-b",href:"/branch/branch-b"}]} as WorkspaceDirectory;
describe("Basic scoped navigation",()=>{
 it.each(["/branch/branch-a/students/student-a","/branch/branch-b/fees","/org/org-a/settings"])("returns to an authorized workspace: %s",path=>expect(authorizedWorkspaceReturn(path,directory)).toBe(path));
 it.each([null,"https://example.com","//example.com","/branch/foreign","/org/foreign","/branch/branch-a/../foreign","/branch/branch-a/%2e%2e/foreign","/branch/branch-a?return=https://example.com"])("rejects an unsafe or foreign return: %s",path=>expect(authorizedWorkspaceReturn(path,directory)).toBe("/org/org-a"));
 it("returns to the organization from a legacy billing link",()=>expect(authorizedWorkspaceReturn("/org/org-a/billing",directory)).toBe("/org/org-a"));
 it("preserves common areas without carrying object identities or search state",()=>{
  expect(branchSwitchDestination("/branch/old/students/private-id","/branch/new")).toBe("/branch/new/students");
  expect(branchSwitchDestination("/branch/old/fees","/branch/new")).toBe("/branch/new/payments");
  expect(branchSwitchDestination("/branch/old/analytics","/branch/new")).toBe("/branch/new");
 });
 it("falls back when target permissions do not support the area",()=>{
  expect(branchSwitchDestination("/branch/old/students","/branch/new",{students:false} as WorkspaceDirectoryBranch["permissions"])).toBe("/branch/new");
 });
});

describe("switching between independently billed branches", () => {
 const branch = (plan: "BASIC" | "STANDARD" | "PRO"): WorkspaceDirectoryBranch => ({
  id: plan, name: plan, href: `/branch/${plan}`, organizationId: "org", organizationName: "Org",
  role: "OWNER", permissions: {}, entitlements: plan === "BASIC" ? [] : ["ADVANCED_ANALYTICS"],
  billing: { independent: true, effectivePlan: plan, accessMode: "FULL", customerState: plan + "_ACTIVE", billingStatus: "ACTIVE" },
 });
 it.each(["BASIC", "STANDARD", "PRO"] as const)("preserves core work and sheds private identifiers for %s", plan => {
  const target = branch(plan);
  expect(branchSwitchTarget("/branch/old/students/private-student", target)).toBe(target.href + "/students");
  expect(branchSwitchTarget("/branch/old/onboarding/import/private-session", target)).toBe(target.href + "/onboarding/import");
  expect(branchSwitchTarget("/branch/old/fees/private-collection", target)).toBe(target.href + "/payments");
 });
 it("opens an explained fallback for excluded features or missing role permission", () => {
  expect(branchSwitchTarget("/branch/pro/analytics", branch("BASIC"))).toBe("/branch/BASIC?workspaceNotice=area-unavailable");
  expect(branchSwitchTarget("/branch/pro/analytics", branch("STANDARD"))).toBe("/branch/STANDARD/analytics");
  const denied = { ...branch("PRO"), role: "MANAGER" as const, permissions: { analytics: false } };
  expect(branchSwitchTarget("/branch/old/analytics", denied)).toBe("/branch/PRO?workspaceNotice=area-unavailable");
  expect(branchSwitchTarget("/branch/old/tasks", denied)).toBe("/branch/PRO?workspaceNotice=area-unavailable");
  expect(branchSwitchTarget("/branch/pro/settings#whatsapp", branch("STANDARD"))).toBe("/branch/STANDARD?workspaceNotice=area-unavailable");
  expect(branchSwitchTarget("/branch/pro/settings#whatsapp", { ...branch("PRO"), entitlements:["WHATSAPP_AUTOMATION"] })).toBe("/branch/PRO/settings#whatsapp");
 });
});
