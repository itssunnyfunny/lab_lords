import { createHash } from "node:crypto";
import type { CheckoutBillingPlanId } from "@/lib/billingPlans";
import type { NormalizedMultiShiftDraft, NormalizedShiftDraft } from "@/lib/formValidation";

type OnboardingErrorCode = "ONBOARDING_INVALID_KEY" | "ONBOARDING_INVALID_REQUEST"
    | "ONBOARDING_KEY_CONFLICT" | "ONBOARDING_RESULT_NOT_FOUND" | "ONBOARDING_UNAVAILABLE";

export class OnboardingRequestError extends Error {
    constructor(readonly code: OnboardingErrorCode, message: string, readonly status: 400 | 404 | 409 | 503) {
        super(message);
        this.name = "OnboardingRequestError";
    }
}

export function invalidOnboardingRequest(message: string) {
    return new OnboardingRequestError("ONBOARDING_INVALID_REQUEST", message, 400);
}

export function normalizeOnboardingKey(value: unknown): string {
    if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
        throw new OnboardingRequestError("ONBOARDING_INVALID_KEY", "A valid setup request key is required.", 400);
    }
    return value.toLowerCase();
}

type CanonicalOnboardingRequest = {
    selectedPostTrialPlan: CheckoutBillingPlanId;
    ownerPhone: string;
    orgName: string;
    businessType?: string;
    branchName: string;
    city?: string;
    defaultFee?: number;
    seatLabels: readonly string[];
    shifts?: readonly NormalizedShiftDraft[];
    multiShifts?: readonly NormalizedMultiShiftDraft[];
    includeFullTimeMultiShift?: boolean;
};

/** V1 hashes validated command inputs, never mutable result records. Keep this
 * normalization for retained receipts; future changes require a new version.
 * Null shifts means the default-shift intent, not today's mutable default values.
 * Null bundles permits the default bundle; [] explicitly opts out of it. */
export function hashOnboardingRequest(input: CanonicalOnboardingRequest): string {
    const canonical = {
        selectedPostTrialPlan: input.selectedPostTrialPlan,
        ownerPhone: input.ownerPhone,
        orgName: input.orgName,
        businessType: input.businessType ?? null,
        branchName: input.branchName,
        city: input.city ?? null,
        defaultFee: input.defaultFee ?? 0,
        seatLabels: [...input.seatLabels],
        shifts: input.shifts?.length ? input.shifts.map(shift => ({
            name: shift.name, startTime: shift.startTime, endTime: shift.endTime, price: shift.price,
        })) : null,
        multiShifts: input.multiShifts?.map(bundle => ({
            name: bundle.name, price: bundle.price, componentShiftNames: [...bundle.componentShiftNames],
        })) ?? null,
        includeFullTimeMultiShift: input.includeFullTimeMultiShift !== false,
    };
    return `v1:${createHash("sha256").update(JSON.stringify(canonical)).digest("hex")}`;
}
