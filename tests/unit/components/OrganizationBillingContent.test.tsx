import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BillingPlanCard, getSubscriptionCancellationMode, hasComplimentaryReplacementAccess } from "@/components/billing/OrganizationBillingContent";
import { publicBillingPlans } from "@/lib/billingPlans";
import type { BillingOverview, OrganizationSubscriptionDto } from "@/lib/api/billing";

const standard = publicBillingPlans().find(plan => plan.id === "STANDARD")!;
const basic = publicBillingPlans().find(plan => plan.id === "BASIC")!;

const subscription = {
    id: "sub_local", organizationId: "org_test", position: "CURRENT", replacesSubscriptionId: null,
    plan: "BASIC", planName: "Lab Lords Basic", shortName: "Basic", amount: 99, amountSubunits: 9900,
    currency: "INR", period: "monthly", interval: 1, totalCount: 12, quantity: 1, unitAmount: 99,
    monthlyTotal: 99, status: "ACTIVE", razorpaySubscriptionId: "sub_test", currentStart: null,
    currentEnd: null, chargeAt: null, endedAt: null, providerStartAt: null, authorizationExpiresAt: null,
    providerPaymentMethod: "CARD", paidThrough: "2026-11-22T00:00:00Z", cancelAtCycleEnd: false,
    cancellationRequestedAt: null, cancellationScheduledAt: null, cancelledAt: null,
    createdAt: "2026-10-22T00:00:00Z", updatedAt: "2026-10-22T00:00:00Z",
} satisfies OrganizationSubscriptionDto;

const experience = {
    organizationId: "org_test", accessMode: "FULL", effectivePlan: "BASIC", selectedPostTrialPlan: null,
    providerStatus: "ACTIVE", customerState: "BASIC_ACTIVE", customerMessage: "Basic is active.",
    trialEndsAt: null, trialDaysRemaining: null, paidThrough: "2026-11-22T00:00:00Z",
    confirmedQuantity: 1, projectedQuantity: 1, currentUnitAmount: 99, currentMonthlyTotal: 99,
    projectedUnitAmount: 99, projectedMonthlyTotal: 99, authorizationStatus: "AUTHORIZED",
    planFeeDueToday: 0, nextChargeAt: null, paymentAction: "NONE", entitlements: [], latestOperation: null,
    activeOperation: null, scheduledChanges: [], branch: null, viewer: { isOwner: true, canManageBilling: true },
} satisfies BillingOverview["experience"];

function render(plan = standard, current: OrganizationSubscriptionDto = subscription, access: BillingOverview["experience"] = experience, busy = false, checkoutReady = true) {
    return renderToStaticMarkup(<BillingPlanCard plan={plan} current={current} experience={access} busyPlan={null} checkoutReady={checkoutReady} operationBusy={busy} onStart={() => {}} />);
}

describe("dedicated billing plan selection", () => {
    it("requires payment recovery before another plan change and re-enables an upgrade after recovered evidence", () => {
        const halted = render(standard, { ...subscription, status: "HALTED" }, { ...experience, accessMode: "READ_ONLY", effectivePlan: "NONE" });
        expect(halted).toContain("Resolve payment first");
        expect(halted).toMatch(/ disabled=""/);
        const recovered = render();
        expect(recovered).toContain("Upgrade to Standard");
        expect(recovered).not.toMatch(/ disabled=""/);
    });

    it("does not mark provider-authorized Standard current before authoritative access is granted", () => {
        const unconfirmed = render(standard, { ...subscription, plan: "STANDARD" }, { ...experience, effectivePlan: "NONE", accessMode: "READ_ONLY" });
        expect(unconfirmed).not.toContain("Current plan");
        const confirmed = render(standard, { ...subscription, plan: "STANDARD" }, { ...experience, effectivePlan: "STANDARD", entitlements: ["STAFF_MANAGEMENT", "ADVANCED_ANALYTICS", "AI_ACCESS"] });
        expect(confirmed).toContain("Current plan");
        expect(confirmed).toMatch(/ disabled=""/);
    });

    it("shows the actual Standard features and Basic exclusions from the canonical catalogue", () => {
        expect(render()).toContain("Staff invitations, roles and permission controls");
        expect(render()).toContain("AI reports");
        expect(render()).not.toContain("message drafting");
        expect(render()).not.toContain(" — Standard or Pro");
        expect(render(basic)).toContain(" — Standard or Pro");
    });

    it("prevents competing changes while an undo, recovery or cancellation request is in flight", () => {
        expect(render(standard, subscription, experience, true)).toMatch(/ disabled=""/);
    });

    it.each(["CARD", "UPI", "EMANDATE"] as const)("requires ready replacement checkout before changing a %s plan", providerPaymentMethod => {
        const current = { ...subscription, providerPaymentMethod };
        const loading = render(standard, current, experience, false, false);
        expect(loading).toContain("Loading checkout...");
        expect(loading).toMatch(/ disabled=""/);
        expect(render(standard, current)).not.toMatch(/ disabled=""/);
    });

    it("keeps an unknown recurring method unavailable even when checkout is ready", () => {
        const html = render(standard, { ...subscription, providerPaymentMethod: "UNKNOWN" });
        expect(html).toContain("Payment method confirmation required");
        expect(html).toMatch(/ disabled=""/);
    });

    it("keeps a selected post-trial plan distinct from current trial access", () => {
        const html = render(basic, { ...subscription, status: "AUTHENTICATED" }, { ...experience, effectivePlan: "STANDARD_TRIAL", selectedPostTrialPlan: "BASIC" });
        expect(html).toContain("Authorized for after trial");
        expect(html).not.toContain("Current plan");
    });
});

function replacementOverview(): BillingOverview {
    return {
        current: subscription,
        pendingReplacement: { ...subscription, id: "candidate", position: "PENDING_REPLACEMENT", plan: "STANDARD", status: "AUTHENTICATED" },
        entitlements: { canWrite: true, effectivePlan: "STANDARD" },
        scheduledChanges: [{ id: "upgrade", type: "PLAN_UPGRADE", status: "SCHEDULED",
            organizationSubscriptionId: subscription.id, replacementSubscriptionId: "candidate", failureCategory: null,
            effectiveAt: "2026-11-22T00:00:00Z", undoCutoffAt: null, toPlan: "STANDARD", toQuantity: 1, lastError: null,
            accessGrantedAt: "2026-10-22T00:00:00Z", accessRevokedAt: null, accessGraceEndsAt: null }],
    } as BillingOverview;
}

describe("complimentary replacement access notice", () => {
    const now = Date.parse("2026-10-23T00:00:00Z");
    it("shows only a matching recorded grant with current server entitlement", () => {
        expect(hasComplimentaryReplacementAccess(replacementOverview(), now)).toBe(true);
    });
    it.each([
        { accessGrantedAt: null }, { accessRevokedAt: "2026-10-23T00:00:00Z" },
        { failureCategory: "MANUAL_REVIEW_REQUIRED" }, { status: "FAILED" },
        { replacementSubscriptionId: "other-candidate" }, { organizationSubscriptionId: "other-source" },
    ])("hides ungranted, revoked, quarantined and unrelated replacements", patch => {
        const overview = replacementOverview();
        Object.assign(overview.scheduledChanges[0], patch);
        expect(hasComplimentaryReplacementAccess(overview, now)).toBe(false);
    });
    it("does not infer paid access from an authorized higher-plan candidate", () => {
        const overview = replacementOverview();
        overview.entitlements.effectivePlan = "BASIC";
        expect(hasComplimentaryReplacementAccess(overview, now)).toBe(false);
        overview.entitlements.effectivePlan = "STANDARD";
        overview.entitlements.canWrite = false;
        expect(hasComplimentaryReplacementAccess(overview, now)).toBe(false);
    });
    it("expires a pending eMandate grant at the server grace boundary", () => {
        const overview = replacementOverview();
        Object.assign(overview.pendingReplacement!, { status: "PENDING", providerPaymentMethod: "EMANDATE" });
        Object.assign(overview.scheduledChanges[0], { effectiveAt: "2026-10-22T00:00:00Z", accessGraceEndsAt: "2026-10-23T00:00:00Z" });
        expect(hasComplimentaryReplacementAccess(overview, now - 1)).toBe(true);
        expect(hasComplimentaryReplacementAccess(overview, now)).toBe(false);
    });
});


it("offers authenticated trial cancellation only with the existing active future trial boundary", () => {
    const now = Date.parse("2026-10-23T00:00:00Z");
    const overview = { current: { ...subscription, status: "AUTHENTICATED", paidThrough: null, providerStartAt: "2026-11-22T00:00:00Z" }, billingModelVersion: "WORKSPACE_V2", trial: { status: "ACTIVE", endsAt: "2026-11-22T00:00:00Z" } } as BillingOverview;
    expect(getSubscriptionCancellationMode(overview, now)).toBe("TRIAL");
    overview.trial!.endsAt = new Date(now).toISOString();
    expect(getSubscriptionCancellationMode(overview, now)).toBeNull();
    overview.trial = null;
    expect(getSubscriptionCancellationMode(overview, now)).toBeNull();
    overview.current!.status = "CREATED";
    expect(getSubscriptionCancellationMode(overview, now)).toBeNull();
    overview.current!.status = "ACTIVE";
    expect(getSubscriptionCancellationMode(overview, now)).toBe("PAID");
});
