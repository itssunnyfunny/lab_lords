import type { BranchAccess } from "@/types";

/** Synthetic paid Basic access, deliberately independent of the trial. */
export function basicImportAccess(scenario = "paid"): BranchAccess {
    return {
        branchId: "fixture-branch", branchName: "Main location", organizationId: "fixture-org", isOwner: true, role: "OWNER",
        effectivePlan: "BASIC", entitlements: [],
        permissions: { manage_org: true, manage_branch: true, students: scenario !== "denied", seat_allocation: true,
            view_payments: true, generate_payments: true, mark_payment_paid: true, waive_payments: true,
            analytics: true, view_whatsapp: true, send_whatsapp: true, manage_whatsapp: true, receive_whatsapp_reports: true, staff_management: true },
        billingExperience: {
            organizationId: "fixture-org", billingAccessSource: scenario === "expired" ? "NONE" : "PAID", providerStatus: "ACTIVE",
            effectivePlan: "BASIC", accessMode: scenario === "expired" ? "READ_ONLY" : "FULL",
            selectedPostTrialPlan: "BASIC", customerState: "BASIC_ACTIVE", customerMessage: "Basic workspace is active.",
            trialEndsAt: null, trialDaysRemaining: null, paidThrough: "2099-01-01T00:00:00.000Z", entitlements: [],
            branch: { id: "fixture-branch", name: "Main location", billingStatus: "ACTIVE" },
            viewer: { isOwner: true, canManageBilling: true },
            confirmedQuantity: 1, projectedQuantity: 1, currentUnitAmount: 99, currentMonthlyTotal: 99,
            projectedUnitAmount: 99, projectedMonthlyTotal: 99, authorizationStatus: "AUTHORIZED", planFeeDueToday: 0,
            nextChargeAt: "2099-01-01T00:00:00.000Z", paymentAction: "NONE", latestOperation: null, activeOperation: null, scheduledChanges: [],
        },
    };
}
