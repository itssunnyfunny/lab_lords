import {describe,it,expect} from "vitest";
import {authorizedWorkspaceReturn,branchSwitchDestination} from "@/lib/basicNavigation";
import type {WorkspaceDirectory,WorkspaceDirectoryBranch} from "@/types";
const directory={organizations:[{id:"org-a",href:"/org/org-a",branches:[{id:"branch-a",href:"/branch/branch-a"}]}],staffBranches:[{id:"branch-b",href:"/branch/branch-b"}]} as WorkspaceDirectory;
describe("Basic scoped navigation",()=>{
 it.each(["/branch/branch-a/students/student-a","/branch/branch-b/fees","/org/org-a/billing"])("returns to an authorized workspace: %s",path=>expect(authorizedWorkspaceReturn(path,directory)).toBe(path));
 it.each([null,"https://example.com","//example.com","/branch/foreign","/org/foreign","/branch/branch-a/../foreign","/branch/branch-a/%2e%2e/foreign","/branch/branch-a?return=https://example.com"])("rejects an unsafe or foreign return: %s",path=>expect(authorizedWorkspaceReturn(path,directory)).toBe("/org/org-a"));
 it("preserves common areas without carrying object identities or search state",()=>{
  expect(branchSwitchDestination("/branch/old/students/private-id","/branch/new")).toBe("/branch/new/students");
  expect(branchSwitchDestination("/branch/old/fees","/branch/new")).toBe("/branch/new/payments");
  expect(branchSwitchDestination("/branch/old/analytics","/branch/new")).toBe("/branch/new");
 });
 it("falls back when target permissions do not support the area",()=>{
  expect(branchSwitchDestination("/branch/old/students","/branch/new",{students:false} as WorkspaceDirectoryBranch["permissions"])).toBe("/branch/new");
 });
});
