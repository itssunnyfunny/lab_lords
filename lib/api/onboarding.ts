import type { CheckoutBillingPlanId } from "@/lib/billingPlans";
import type { NormalizedMultiShiftDraft, NormalizedShiftDraft } from "@/lib/formValidation";
import type { SeatNumberingConfig } from "@/lib/seatNumbering";

export interface OnboardingPayload {
    orgName: string;
    ownerPhone: string;
    businessType?: string;
    branchName: string;
    city?: string;
    seatCount: number;
    seatNumbering: SeatNumberingConfig;
    shifts: NormalizedShiftDraft[];
    multiShifts: NormalizedMultiShiftDraft[];
    selectedPostTrialPlan: CheckoutBillingPlanId;
}

export interface OnboardingResult {
    org: { id: string };
    branch: { id: string };
}

export function isOnboardingResult(value: unknown): value is OnboardingResult {
    if (!value || typeof value !== "object") return false;
    const result = value as Partial<OnboardingResult>;
    return typeof result.org?.id === "string" && result.org.id.length > 0 && result.org.id.length <= 255
        && typeof result.branch?.id === "string" && result.branch.id.length > 0 && result.branch.id.length <= 255;
}

const errorMessages: Record<string, string> = {
    UNAUTHORIZED: "Sign in to the same account to recover your saved setup.",
    ONBOARDING_ACCOUNT_CHANGED: "Your account changed. Sign in to the original account to recover this setup.",
    ONBOARDING_INVALID_KEY: "The saved setup could not be accepted. Contact support before starting another setup.",
    ONBOARDING_INVALID_REQUEST: "The saved setup details could not be accepted. Contact support before starting another setup.",
    ONBOARDING_KEY_CONFLICT: "This saved setup needs review. Contact support before starting another setup.",
    ONBOARDING_RESULT_NOT_FOUND: "The saved workspace is not available to this account. Contact support before starting another setup.",
    ONBOARDING_UNAVAILABLE: "Setup is temporarily unavailable. Retry this saved setup later.",
};

export class OnboardingRequestError extends Error {
    constructor(public readonly status: number, public readonly code: string) {
        super(errorMessages[code] ?? "Setup could not be confirmed. Retry the saved setup to recover its result.");
        this.name = "OnboardingRequestError";
    }
}

// The body is already durably frozen. Do not reconstruct it or allocate a key
// here: even an aborted request may have committed on the server.
export async function submitOnboarding(accountId: string, commandId: string, body: string): Promise<OnboardingResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
        const response = await fetch("/api/onboarding", {
            method: "POST",
            credentials: "same-origin",
            headers: {
                "Content-Type": "application/json",
                "Idempotency-Key": commandId,
                "X-Onboarding-Account": accountId,
            },
            body,
            signal: controller.signal,
        });
        const data: unknown = await response.json();
        if (!response.ok) {
            const code = data && typeof data === "object" && "code" in data && typeof data.code === "string"
                ? data.code : "ONBOARDING_FAILED";
            throw new OnboardingRequestError(response.status, code);
        }
        if (!isOnboardingResult(data)) throw new OnboardingRequestError(response.status, "ONBOARDING_FAILED");
        return { org: { id: data.org.id }, branch: { id: data.branch.id } };
    } catch (error) {
        if (error instanceof OnboardingRequestError) throw error;
        throw new OnboardingRequestError(0, "ONBOARDING_UNCONFIRMED");
    } finally {
        clearTimeout(timeout);
    }
}
