import {describe,expect,it} from "vitest";
import {createFixture,permittedBranches,resolveBranch,switchDestination,schedulePlan,applyScheduled,writable,accountReturnDestination} from "./model";
describe("organization navigation fixture contracts",()=>{
 it("scopes independent records under one organization plan",()=>{const s=createFixture();expect(new Set(s.branches.flatMap(b=>b.students.map(x=>x.id))).size).toBe(42);expect(s.branches.map(b=>b.billed)).toEqual(["BASIC","BASIC","BASIC"]);});
 it("changes the organization plan without copying branch records",()=>{const s=createFixture(),next=schedulePlan(s,"pilot","PRO");expect(next.branches[0].access).toBe("BASIC");const applied=applyScheduled(next,"pilot");expect(applied.branches[0].access).toBe("PRO");expect(applied.branches[0].students).toBe(s.branches[0].students);expect(applied.branches[0].receipts).toBe(s.branches[0].receipts);expect(applied.branches.map(b=>b.access)).toEqual(["PRO","PRO","PRO"]);expect(applied.branches[1].students).toBe(s.branches[1].students);});
 it("rejects forbidden staff branches and plan writes",()=>{const s=createFixture("staff");expect(permittedBranches(s).map(b=>b.id)).toEqual(["pilot","central"]);expect(resolveBranch(s,"riverside")).toBeUndefined();expect(()=>schedulePlan(s,"pilot","PRO")).toThrow();});
 it.each(["expired","pending","archived"])("fails closed for %s",scenario=>{const b=createFixture("owner",scenario).branches[0];expect(b.access).toBe("NONE");expect(writable(b)).toBe(false);});
 it.each(["trial","grant"])("separates billed and effective access for %s",scenario=>{const b=createFixture("owner",scenario).branches[0];expect(b.billed).toBe("BASIC");expect(b.access).not.toBe("BASIC");expect(b.until).toBeTruthy();});
 it("maps destinations without carrying record IDs",()=>{const s=createFixture();expect(switchDestination("/branch/pilot/fees",s.branches[1],"owner")).toBe("/branch/central/fees");expect(switchDestination("/branch/central/settings",s.branches[0],"owner")).toBe("/branch/pilot/setup");expect(switchDestination("/branch/pilot/students/a",s.branches[1],"owner")).toBe("/branch/central/students");});
 it("falls back for unavailable modules",()=>{const b=createFixture().branches[0];expect(switchDestination("/branch/central/analytics",b,"owner")).toBe("/branch/pilot");expect(switchDestination("/branch/central/payments",b,"staff")).toBe("/branch/pilot");});
 it("handles single and empty organizations",()=>{expect(createFixture("owner","single").branches).toHaveLength(1);expect(createFixture("owner","empty").branches).toHaveLength(0);});
});

describe("account return context after the main navigation update", () => {
 it.each(["/branch/pilot/students", "/branch/central/fees", "/branch/riverside/seats"])("returns to the originating permitted area %s", path => {expect(accountReturnDestination(createFixture(), path)).toBe(path);});
 it.each(["https://example.com", "//example.com", "/branch/foreign/students", "/org/foreign/settings"])("rejects an external or foreign return %s", path => {expect(accountReturnDestination(createFixture(), path)).toBe("/org/org-pilot");});
 it("does not turn account navigation into a staff entitlement", () => {const state=createFixture("staff");expect(accountReturnDestination(state,"/branch/riverside/students")).toBe("/branch/pilot");expect(accountReturnDestination(state,"/branch/central/payments")).toBe("/branch/central");expect(accountReturnDestination(state,"/org/org-pilot/billing")).toBe("/branch/pilot");});
});
