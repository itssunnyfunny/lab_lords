import { billingPlanName, isBillingPlanId } from "@/lib/billingPlans";

export function branchPlanLabel(plan: string) {
    if (isBillingPlanId(plan)) return billingPlanName(plan);
    return plan === "STANDARD_TRIAL" ? "Standard" : "No active plan";
}

const accessLabels: Record<string, string> = {
    TRIAL_ACTIVE: "Trial active",
    BASIC_ACTIVE: "Basic active",
    STANDARD_ACTIVE: "Standard active",
    PRO_ACTIVE: "Pro active",
    PAYMENT_RETRYING: "Payment retry in progress",
    PAYMENT_HALTED: "Payment method needs attention",
    CONFIRMING: "Confirming with Razorpay",
    PAYMENT_NOT_COMPLETED: "Payment not completed",
    PAYMENT_DECLINED: "Payment authorization declined",
    PAYMENT_FAILED: "Billing update failed",
    ACCESS_ENDED: "Paid access ended",
    AUTHORIZATION_REQUIRED: "Payment-method authorization required",
    PENDING_ACTIVATION: "Branch activation is pending",
    ARCHIVED: "This branch is archived",
    REMOVAL_SCHEDULED: "Branch removal scheduled.",
    READ_ONLY: "Read-only",
    FULL: "Active",
    WARNING: "Payment needs attention",
};

export function branchAccessLabel(state: string) {
    return accessLabels[state] ?? state;
}
