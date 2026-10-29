import { describe, expect, it } from "vitest";
import { workspacePresentation, workspaceDowngradeNotice } from "@/lib/workspacePresentation";
import { deriveWorkspaceBillingState, type BillingState } from "@/lib/billingState";
import type { BranchAccess } from "@/types";
const now = new Date("2026-10-28T00:00:00Z"), later = new Date("2026-11-28T00:00:00Z");
function view(state: BillingState, selected = "BASIC") {
    return { effectivePlan: "BASIC", billingExperience: {effectivePlan:state.effectivePlan ?? "NONE",accessMode:state.accessMode,selectedPostTrialPlan:selected} } as BranchAccess;
}
describe("workspace presentation consumes authoritative billing access",()=>{
    it.each([["BASIC","STANDARD"],["BASIC","PRO"],["STANDARD","BASIC"],["STANDARD","PRO"],["PRO","BASIC"],["PRO","STANDARD"]] as const)("%s to %s waits for effective access and can return",(from,to)=>{
        const previous=deriveWorkspaceBillingState({now,subscription:{plan:from,status:"ACTIVE",paidThrough:later}});
        expect(workspacePresentation(view(previous,to))).toBe(from === "BASIC" ? "simple":"full");
        const confirmed=deriveWorkspaceBillingState({now,subscription:{plan:to,status:"ACTIVE",paidThrough:later}});
        expect(workspacePresentation(view(confirmed))).toBe(to === "BASIC" ? "simple":"full");
        expect(workspacePresentation(view(previous))).toBe(from === "BASIC" ? "simple":"full");
    });
    it("keeps a Standard trial full when Basic is selected, then stays read-only at expiry",()=>{
        const trial={status:"ACTIVE" as const,endsAt:later};
        expect(workspacePresentation(view(deriveWorkspaceBillingState({now,trial})))).toBe("full");
        const ended=deriveWorkspaceBillingState({now:later,trial});
        expect(ended.canWrite).toBe(false);expect(workspacePresentation(view(ended))).toBe("simple");
    });
    it("follows temporary upgrade grants, revocation and grace expiry without changing billed plan",()=>{
        const subscription={plan:"BASIC" as const,status:"ACTIVE",paidThrough:later};
        const grant={plan:"PRO" as const,accessGrantedAt:now,accessRevokedAt:null,graceEndsAt:later};
        expect(workspacePresentation(view(deriveWorkspaceBillingState({now,subscription,authorizedReplacement:grant})))).toBe("full");
        expect(subscription.plan).toBe("BASIC");
        expect(workspacePresentation(view(deriveWorkspaceBillingState({now,subscription,authorizedReplacement:{...grant,accessRevokedAt:now}})))).toBe("simple");
        const expired=deriveWorkspaceBillingState({now:later,subscription,authorizedReplacement:grant});
        expect(expired.canWrite).toBe(false);
    });
    it.each(["CREATED","AUTHENTICATED","PENDING","CANCELLED","HALTED"])("%s without paid evidence never creates writable Basic",status=>{
        const state=deriveWorkspaceBillingState({now,subscription:{plan:"BASIC",status,paidThrough:null}});
        expect(state.canWrite).toBe(false);expect(workspacePresentation(view(state))).toBe("simple");
    });
    it("does not pick a default interface while access is missing or invalid",()=>{
        expect(workspacePresentation(null)).toBeNull();
        expect(workspacePresentation({effectivePlan:"UNKNOWN"} as unknown as BranchAccess)).toBeNull();
    });
    it("describes only the capabilities lost on the chosen downgrade",()=>{
        expect(workspaceDowngradeNotice("PRO","BASIC")).toContain("WhatsApp");
        expect(workspaceDowngradeNotice("STANDARD","BASIC")).not.toContain("WhatsApp");
        expect(workspaceDowngradeNotice("PRO","STANDARD")).toContain("full workspace");
        expect(workspaceDowngradeNotice("BASIC","PRO")).toBeNull();
    });
});
