import { describe, expect, it } from "vitest";
import { BILLING_PLAN_IDS, billingPlanRank, getActiveBillingPlan, getBillingPlan, isCheckoutBillingPlanId, publicBillingPlans } from "@/lib/billingPlans";
import { deriveWorkspaceBillingState } from "@/lib/billingState";

describe("three-plan billing catalogue", () => {
  it("publishes exact immutable monthly INR terms with no added branch limits", () => {
    expect(publicBillingPlans().map(p => [p.id, p.shortName, p.amount, p.currency, p.period, p.interval, p.limits.maxBranches])).toEqual([
      ["BASIC", "Basic", 99, "INR", "monthly", 1, null],
      ["STANDARD", "Standard", 299, "INR", "monthly", 1, null],
      ["PRO", "Pro", 499, "INR", "monthly", 1, null],
    ]);
  });
  it.each(["AGENT_CONTROL", "CUSTOM", "standard", ""])("rejects obsolete or invalid identity %s", id => {
    expect(getBillingPlan(id)).toBeNull();
    expect(isCheckoutBillingPlanId(id)).toBe(false);
    expect(() => getActiveBillingPlan(id)).toThrow("Unknown subscription plan");
  });
  it("separates core, operational premium and WhatsApp capabilities", () => {
    const [basic, standard, pro] = publicBillingPlans();
    expect(basic.entitlements).toEqual([]);
    expect(standard.entitlements).toEqual(["STAFF_MANAGEMENT", "ADVANCED_ANALYTICS", "AI_ACCESS"]);
    expect(pro.entitlements).toEqual([...standard.entitlements, "WHATSAPP_AUTOMATION"]);
    expect(basic.capabilities.filter(c => c.included).map(c => c.id)).toEqual(["STUDENT_RECORDS", "SEATS_SHIFTS_ALLOCATIONS", "PAYMENTS_DUES_AUDIT", "RECEIPTS_HISTORY", "DISPLAY_LANGUAGES", "MULTIPLE_BRANCHES"]);
    expect(standard.capabilities.filter(c => c.included)).toHaveLength(12);
    expect(pro.capabilities.filter(c => c.included)).toHaveLength(13);
    expect(pro.availabilityNote).toContain("integration setup and rollout availability");
    expect(pro.availabilityNote).toContain("unlimited messages are not included");
  });
  it.each(BILLING_PLAN_IDS)("selected or authorized %s does not fabricate paid access", plan => {
    for (const status of ["CREATED", "AUTHENTICATED", "ACTIVE"]) {
      expect(deriveWorkspaceBillingState({ now: new Date(), subscription: { plan, status, paidThrough: null } }))
        .toMatchObject({ accessMode: "READ_ONLY", canWrite: false, source: "NONE" });
    }
  });
  it.each(BILLING_PLAN_IDS)("keeps Standard trial explicit with a %s quantity grant", plan => {
    const now = new Date("2026-10-23T00:00:00Z");
    const state = deriveWorkspaceBillingState({ now,
      trial: { status: "ACTIVE", endsAt: new Date("2026-10-30T00:00:00Z") },
      authorizedReplacement: { plan, accessGrantedAt: now, accessRevokedAt: null, graceEndsAt: null },
    });
    expect(state).toMatchObject({ source: "TRIAL", effectivePlan: plan === "PRO" ? "PRO" : "STANDARD" });
  });
  it("preserves independently confirmed paid Pro while a Standard trial is still dated active", () => {
    const now = new Date("2026-10-23T00:00:00Z");
    expect(deriveWorkspaceBillingState({ now, trial: { status: "ACTIVE", endsAt: new Date("2026-10-30T00:00:00Z") },
      subscription: { plan: "PRO", status: "ACTIVE", paidThrough: new Date("2026-11-23T00:00:00Z") } })).toMatchObject({ effectivePlan: "PRO", source: "PAID" });
  });
  it("keeps retired AI message drafting out of every selectable plan", () => {
    for (const plan of publicBillingPlans()) {
      expect(plan.capabilities.find(capability => capability.id === "AI_ASSISTANCE")?.label).toBe("AI reports");
      expect(JSON.stringify(plan)).not.toContain("message drafting");
    }
  });
  it("orders all six directions consistently", () => {
    expect(BILLING_PLAN_IDS.map(billingPlanRank)).toEqual([1, 2, 3]);
  });
});
