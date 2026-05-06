import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { ShiftService } from "@/services/shift.service";
import { FORM_LIMITS, parseIntegerField, validateOptionalTime, validateRequiredText } from "@/lib/formValidation";

// Helper to get user ID
async function getUserId() {
    const user = await getSessionUser();
    if (!user?.id) return null;
    return user.id;
}

function getErrorMessage(error: unknown, fallback: string) {
    return error instanceof Error ? error.message : fallback;
}

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ branchId: string }> }
) {
    const userId = await getUserId();
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { branchId } = await context.params;

    try {
        const shifts = await ShiftService.listShifts(userId, branchId);
        return NextResponse.json(shifts);
    } catch (error: unknown) {
        const message = getErrorMessage(error, "Failed to fetch shifts");
        const status = message.includes("Unauthorized") ? 403
            : message.includes("not found") ? 404
                : 500;
        return NextResponse.json(
            { error: message },
            { status }
        );
    }
}

export async function POST(
    request: NextRequest,
    context: { params: Promise<{ branchId: string }> }
) {
    const userId = await getUserId();
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { branchId } = await context.params;

    try {
        const body = await request.json();
        const nameResult = validateRequiredText(body.name, "Shift name", 50);
        if (!nameResult.ok) return NextResponse.json({ error: nameResult.error }, { status: 400 });
        const startResult = validateOptionalTime(body.startTime, "Start time");
        if (!startResult.ok) return NextResponse.json({ error: startResult.error }, { status: 400 });
        const endResult = validateOptionalTime(body.endTime, "End time");
        if (!endResult.ok) return NextResponse.json({ error: endResult.error }, { status: 400 });
        if ((startResult.value && !endResult.value) || (!startResult.value && endResult.value)) {
            return NextResponse.json({ error: "Shift must have both start and end time, or neither." }, { status: 400 });
        }
        const priceResult = parseIntegerField(body.price, "Monthly price", { min: 0, max: FORM_LIMITS.moneyMax });
        if (!priceResult.ok) return NextResponse.json({ error: priceResult.error }, { status: 400 });

        const shift = await ShiftService.createShift(userId, branchId, {
            name: nameResult.value,
            startTime: startResult.value ?? undefined,
            endTime: endResult.value ?? undefined,
            price: priceResult.value,
            isReserved: body.isReserved,
        });
        return NextResponse.json(shift);
    } catch (error: unknown) {
        const message = getErrorMessage(error, "Failed to create shift");
        const status = message.includes("Unauthorized") ? 403
            : message.includes("not found") ? 404
                : 400;
        return NextResponse.json(
            { error: message },
            { status }
        );
    }
}
