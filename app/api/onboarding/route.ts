import { NextResponse } from "next/server";
import { OnboardingService } from "@/services/onboarding.service";
import {
    FORM_LIMITS,
    parseIntegerField,
    validateOptionalText,
    validateRequiredText,
    validateShiftDrafts,
} from "@/lib/formValidation";

function getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : "Failed to complete setup";
}

export async function POST(req: Request) {
    try {
        // TEMP AUTH: Get user from header
        const userId = req.headers.get("x-user-id");
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { orgName, businessType, branchName, city, defaultFee, seatCount, shifts } = body;

        const orgNameResult = validateRequiredText(orgName, "Organization name", 120);
        if (!orgNameResult.ok) return NextResponse.json({ error: orgNameResult.error }, { status: 400 });
        const businessTypeResult = validateOptionalText(businessType, "Business type", 80);
        if (!businessTypeResult.ok) return NextResponse.json({ error: businessTypeResult.error }, { status: 400 });
        const branchNameResult = validateRequiredText(branchName, "Branch name", 120);
        if (!branchNameResult.ok) return NextResponse.json({ error: branchNameResult.error }, { status: 400 });
        const cityResult = validateOptionalText(city, "City", FORM_LIMITS.cityMax);
        if (!cityResult.ok) return NextResponse.json({ error: cityResult.error }, { status: 400 });
        const defaultFeeResult = parseIntegerField(defaultFee, "Default monthly fee", { min: 0, max: FORM_LIMITS.moneyMax });
        if (!defaultFeeResult.ok) return NextResponse.json({ error: defaultFeeResult.error }, { status: 400 });
        const seatCountResult = parseIntegerField(seatCount, "Total seats", { required: true, min: 1, max: FORM_LIMITS.seatsMax });
        if (!seatCountResult.ok) return NextResponse.json({ error: seatCountResult.error }, { status: 400 });
        const shiftsResult = Array.isArray(shifts) ? validateShiftDrafts(shifts) : { ok: true as const, value: undefined };
        if (!shiftsResult.ok) return NextResponse.json({ error: shiftsResult.error }, { status: 400 });

        const result = await OnboardingService.createNetwork({
            userId,
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
            shifts: shiftsResult.value,
        });

        return NextResponse.json(result, { status: 201 });
    } catch (error: unknown) {
        console.error("Onboarding Error:", error);
        return NextResponse.json(
            { error: getErrorMessage(error) },
            { status: 400 }
        );
    }
}
