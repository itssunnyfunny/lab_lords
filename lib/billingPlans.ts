import { BillingValidationError } from "@/lib/billingErrors";

export const BILLING_CATALOG_VERSION = 2;
export const BILLING_PLAN_IDS = ["BASIC", "STANDARD", "PRO"] as const;
export type BillingPlanId = typeof BILLING_PLAN_IDS[number];
export type CheckoutBillingPlanId = BillingPlanId;

export function billingPlanRank(planId: string | null | undefined) {
  return BILLING_PLAN_IDS.indexOf(planId as BillingPlanId) + 1;
}

export function billingPlanName(planId: string | null | undefined) {
  return getBillingPlan(planId ?? "")?.shortName ?? "No active plan";
}

export const WHATSAPP_PLAN_AVAILABILITY = "WhatsApp requires integration setup and rollout availability. Messaging charges and usage terms apply; unlimited messages are not included.";

export const BILLING_ENTITLEMENTS = [
  "STAFF_MANAGEMENT",
  "ADVANCED_ANALYTICS",
  "AI_ACCESS",
  "WHATSAPP_AUTOMATION",
] as const;

export type BillingEntitlement = typeof BILLING_ENTITLEMENTS[number];

export const BILLING_CAPABILITIES = [
  { id: "STUDENT_RECORDS_IMPORT", label: "Student records and spreadsheet import", standardOnly: false },
  { id: "SEATS_SHIFTS_ALLOCATIONS", label: "Seats, shifts and allocations", standardOnly: false },
  { id: "PAYMENTS_DUES_AUDIT", label: "Payments, dues and audit history", standardOnly: false },
  { id: "RECEIPTS_HISTORY", label: "Full or partial payments and receipts", standardOnly: false },
  { id: "RENEWALS_FOLLOW_UPS", label: "Upcoming fees and follow-up notes", standardOnly: false },
  { id: "ATTENDANCE", label: "Attendance and staff-assisted QR", standardOnly: false },
  { id: "DISPLAY_LANGUAGES", label: "English, Hindi and Hinglish preferences", standardOnly: false },
  { id: "MULTIPLE_BRANCHES", label: "Multiple branches, each billed separately", standardOnly: false },
  { id: "STAFF_CONTROLS", label: "Staff invitations, roles and permission controls", standardOnly: true },
  { id: "ADVANCED_ANALYTICS", label: "Branch and cross-branch advanced analytics", standardOnly: true },
  { id: "AI_ASSISTANCE", label: "AI reports", standardOnly: true },
  { id: "WHATSAPP_INTEGRATION", label: "WhatsApp integration and automation", standardOnly: false, proOnly: true },
] as const;

export type BillingCapabilityId = typeof BILLING_CAPABILITIES[number]["id"];

export type PublicBillingCapability = {
  id: BillingCapabilityId;
  label: string;
  included: boolean;
};

export type BillingPlanLimits = {
  maxBranches: number | null;
};

export type BillingPlan = {
  id: BillingPlanId;
  name: string;
  shortName: string;
  amount: number | null;
  currency: "INR";
  period: "monthly";
  interval: 1;
  active: boolean;
  visible: boolean;
  featured?: boolean;
  comingSoon?: boolean;
  custom?: boolean;
  description: string;
  features: string[];
  entitlements: BillingEntitlement[];
  limits: BillingPlanLimits;
};

export const BILLING_PLANS: BillingPlan[] = [
  {
    id: "BASIC",
    name: "Lab Lords Basic",
    shortName: "Basic",
    amount: 99,
    currency: "INR",
    period: "monthly",
    interval: 1,
    active: true,
    visible: true,
    description: "Core operations billed per active branch.",
    features: [
      "Student records and spreadsheet import",
      "Seats, shifts and allocations",
      "Payments, dues and audit history",
      "Multiple branches, each billed separately",
    ],
    entitlements: [],
    limits: { maxBranches: null },
  },
  {
    id: "STANDARD",
    name: "Lab Lords Standard",
    shortName: "Standard",
    amount: 299,
    currency: "INR",
    period: "monthly",
    interval: 1,
    active: true,
    visible: true,
    featured: true,
    description: "For growing teams that need staff controls, analytics, and AI assistance.",
    features: [
      "Student records and spreadsheet import",
      "Seats, shifts and allocations",
      "Payments, dues and audit history",
      "Multiple branches, each billed separately",
      "Staff invitations, roles and permission controls",
      "Branch and cross-branch advanced analytics",
      "AI reports",
    ],
    entitlements: ["STAFF_MANAGEMENT", "ADVANCED_ANALYTICS", "AI_ACCESS"],
    limits: { maxBranches: null },
  },
  {
    id: "PRO",
    name: "Lab Lords Pro",
    shortName: "Pro",
    amount: 499,
    currency: "INR",
    period: "monthly",
    interval: 1,
    active: true,
    visible: true,
    description: "Everything in Standard, plus WhatsApp integration and automation.",
    features: [
      "Everything in Standard",
      "WhatsApp integration and automation",
    ],
    entitlements: ["STAFF_MANAGEMENT", "ADVANCED_ANALYTICS", "AI_ACCESS", "WHATSAPP_AUTOMATION"],
    limits: { maxBranches: null },
  },
];

export function getBillingPlan(planId: string): BillingPlan | null {
  return BILLING_PLANS.find(plan => plan.id === planId) ?? null;
}

export function isBillingPlanId(planId: string | null | undefined): planId is BillingPlanId {
  return typeof planId === "string" && BILLING_PLANS.some(plan => plan.id === planId);
}

export function isCheckoutBillingPlanId(
  planId: string | null | undefined
): planId is CheckoutBillingPlanId {
  const plan = typeof planId === "string" ? getBillingPlan(planId) : null;
  return Boolean(plan?.visible && plan.active && plan.amount != null);
}

export function getActiveBillingPlan(planId: string): BillingPlan {
  const plan = getBillingPlan(planId);
  if (!plan) throw new BillingValidationError("Unknown subscription plan");
  if (!plan.visible || !plan.active || plan.amount == null) {
    throw new BillingValidationError(`${plan.shortName} is not available for checkout yet`);
  }
  return plan;
}

export function publicBillingPlans() {
  return BILLING_PLANS.filter(
    (plan): plan is BillingPlan & { id: CheckoutBillingPlanId } => plan.visible
  ).map(plan => ({
    id: plan.id,
    name: plan.name,
    shortName: plan.shortName,
    amount: plan.amount,
    currency: plan.currency,
    period: plan.period,
    interval: plan.interval,
    active: plan.active,
    featured: Boolean(plan.featured),
    comingSoon: Boolean(plan.comingSoon),
    custom: Boolean(plan.custom),
    description: plan.description,
    capabilities: BILLING_CAPABILITIES.map(capability => ({
      id: capability.id,
      label: capability.label,
      included: "proOnly" in capability ? plan.id === "PRO"
        : !capability.standardOnly || billingPlanRank(plan.id) >= billingPlanRank("STANDARD"),
    } satisfies PublicBillingCapability)),
    entitlements: [...plan.entitlements],
    availabilityNote: plan.id === "PRO" ? WHATSAPP_PLAN_AVAILABILITY : null,
    limits: plan.limits,
  }));
}
