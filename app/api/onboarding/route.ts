import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSessionUser } from "@/lib/auth";
import { OnboardingService } from "@/services/onboarding.service";
import {
    FORM_LIMITS,
    parseIntegerField,
    validateOptionalText,
    validateRequiredPhone,
    validateRequiredText,
    validateShiftDrafts,
} from "@/lib/formValidation";
import { generateSeatLabelsForSeatCount, validateSeatNumberingConfig } from "@/lib/seatNumbering";
import { isCheckoutBillingPlanId } from "@/lib/billingPlans";
import { invalidOnboardingRequest, normalizeOnboardingKey, OnboardingRequestError } from "@/lib/onboardingRequest";

function invalidResponse(error: string) {
    return NextResponse.json({ error, code: "ONBOARDING_INVALID_REQUEST" }, { status: 400 });
}

export async function POST(req: Request) {
    try {
        const { userId: clerkUserId } = await auth();
        if (!clerkUserId) {
            return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
        }
        const idempotencyKey = normalizeOnboardingKey(req.headers.get("Idempotency-Key"));
        // Keyless old clients receive a definite 400 before account preconditions
        // or body parsing. This header never grants authority.
        if (req.headers.get("X-Onboarding-Account") !== clerkUserId) {
            return NextResponse.json({ error: "Your signed-in account changed. Reopen setup for the current account.", code: "ONBOARDING_ACCOUNT_CHANGED" }, { status: 409 });
        }
        const user = await getSessionUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
        }

        const body = await req.json().catch(() => { throw invalidOnboardingRequest("Setup details must be valid JSON."); });
        if (!body || typeof body !== "object" || Array.isArray(body)) {
            return invalidResponse("Setup details must be an object.");
        }
        const { orgName, ownerPhone, businessType, branchName, city, defaultFee, seatCount, seatNumbering, shifts, multiShifts, includeFullTimeMultiShift, selectedPostTrialPlan } = body;

        if (!isCheckoutBillingPlanId(selectedPostTrialPlan)) {
            return invalidResponse("Choose Basic or Standard as the post-trial plan.");
        }

        const orgNameResult = validateRequiredText(orgName, "Organization name", 120);
        if (!orgNameResult.ok) return invalidResponse(orgNameResult.error);
        const ownerPhoneResult = validateRequiredPhone(ownerPhone, "Owner phone");
        if (!ownerPhoneResult.ok) return invalidResponse(ownerPhoneResult.error);
        const businessTypeResult = validateOptionalText(businessType, "Business type", 80);
        if (!businessTypeResult.ok) return invalidResponse(businessTypeResult.error);
        const branchNameResult = validateRequiredText(branchName, "Branch name", 120);
        if (!branchNameResult.ok) return invalidResponse(branchNameResult.error);
        const cityResult = validateOptionalText(city, "City", FORM_LIMITS.cityMax);
        if (!cityResult.ok) return invalidResponse(cityResult.error);
        const defaultFeeResult = parseIntegerField(defaultFee, "Default monthly fee", { min: 0, max: FORM_LIMITS.moneyMax });
        if (!defaultFeeResult.ok) return invalidResponse(defaultFeeResult.error);
        const seatCountResult = parseIntegerField(seatCount, "Total seats", { required: true, min: 1, max: FORM_LIMITS.seatsMax });
        if (!seatCountResult.ok) return invalidResponse(seatCountResult.error);
        const seatNumberingResult = validateSeatNumberingConfig(seatNumbering, seatCountResult.value);
        if (!seatNumberingResult.ok) return invalidResponse(seatNumberingResult.error);
        const seatLabelsResult = generateSeatLabelsForSeatCount(seatCountResult.value, seatNumberingResult.value);
        if (!seatLabelsResult.ok) return invalidResponse(seatLabelsResult.error);
        for (const [label, rows] of [["Primary shift", shifts], ["Multi-shift", multiShifts]] as const) {
            if (rows !== undefined && (!Array.isArray(rows) || rows.some(row => !row || typeof row !== "object" || Array.isArray(row)))) {
                return invalidResponse(`${label} selections are invalid.`);
            }
        }
        const shiftsResult = Array.isArray(shifts) ? validateShiftDrafts(shifts) : { ok: true as const, value: undefined };
        if (!shiftsResult.ok) return invalidResponse(shiftsResult.error);
        if (includeFullTimeMultiShift !== undefined && typeof includeFullTimeMultiShift !== "boolean") {
            return invalidResponse("Full Time multi-shift selection is invalid.");
        }

        const result = await OnboardingService.createNetwork({
            userId: user.id,
            idempotencyKey,
            selectedPostTrialPlan,
            ownerPhone: ownerPhoneResult.value,
            orgData: {
                name: orgNameResult.value,
                businessType: businessTypeResult.value,
            },
            branchData: {
                name: branchNameResult.value,
                city: cityResult.value,
                defaultFee: defaultFeeResult.value ?? 0,
            },
            seatCount: seatCountResult.value,
            seatNumbering: seatNumberingResult.value,
            shifts: shiftsResult.value,
            multiShifts,
            includeFullTimeMultiShift,
        });

        return NextResponse.json({ org: { id: result.org.id }, branch: { id: result.branch.id } }, { status: 201 });
    } catch (error: unknown) {
        if (error instanceof OnboardingRequestError) {
            return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
        }
        return NextResponse.json(
            { error: "Failed to complete setup. Retry the same setup request.", code: "ONBOARDING_FAILED" },
            { status: 500 }
        );
    }
}
