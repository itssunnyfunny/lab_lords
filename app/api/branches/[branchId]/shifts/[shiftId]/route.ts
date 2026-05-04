import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { ShiftService } from "@/services/shift.service";
import { FORM_LIMITS, parseIntegerField, validateOptionalTime, validateRequiredText } from "@/lib/formValidation";

async function getUserId() {
    const user = await getSessionUser();
    return user?.id ?? null;
}

function getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : "Internal Server Error";
}

/**
 * PATCH /api/branches/[branchId]/shifts/[shiftId]
 * Update a shift's name, times, price, or reserved flag.
 */
export async function PATCH(
    request: NextRequest,
    context: { params: Promise<{ branchId: string; shiftId: string }> }
) {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { shiftId } = await context.params;

    try {
        const body = await request.json();
        const nameResult = body.name !== undefined ? validateRequiredText(body.name, "Shift name", 50) : null;
        if (nameResult && !nameResult.ok) return NextResponse.json({ error: nameResult.error }, { status: 400 });
        const startResult = body.startTime !== undefined ? validateOptionalTime(body.startTime, "Start time") : null;
        if (startResult && !startResult.ok) return NextResponse.json({ error: startResult.error }, { status: 400 });
        const endResult = body.endTime !== undefined ? validateOptionalTime(body.endTime, "End time") : null;
        if (endResult && !endResult.ok) return NextResponse.json({ error: endResult.error }, { status: 400 });
        const priceResult = body.price !== undefined
            ? parseIntegerField(body.price, "Monthly price", { min: 0, max: FORM_LIMITS.moneyMax })
            : null;
        if (priceResult && !priceResult.ok) return NextResponse.json({ error: priceResult.error }, { status: 400 });

        const updated = await ShiftService.updateShift(userId, shiftId, {
            ...(nameResult?.ok ? { name: nameResult.value } : {}),
            ...(startResult?.ok ? { startTime: startResult.value } : {}),
            ...(endResult?.ok ? { endTime: endResult.value } : {}),
            ...(priceResult?.ok ? { price: priceResult.value } : {}),
            isReserved: body.isReserved,
        });
        return NextResponse.json(updated);
    } catch (error: unknown) {
        const message = getErrorMessage(error);
        const status = message.includes("not found") ? 404
            : message.includes("Unauthorized") ? 403
                : 400;
        return NextResponse.json({ error: message }, { status });
    }
}

/**
 * DELETE /api/branches/[branchId]/shifts/[shiftId]
 * Requires a JSON body with a resolution plan:
 *   { "resolution": { "type": "END_ALL" } }
 *   { "resolution": { "type": "REALLOCATE_BULK", "targetShiftId": "..." } }
 *   { "resolution": { "type": "REALLOCATE_MANUAL", "assignments": [...] } }
 */
export async function DELETE(
    request: NextRequest,
    context: { params: Promise<{ branchId: string; shiftId: string }> }
) {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { shiftId } = await context.params;

    let resolution;
    try {
        const body = await request.json();
        resolution = body?.resolution;
    } catch {
        return NextResponse.json({ error: "Request body is required." }, { status: 400 });
    }

    if (!resolution?.type) {
        return NextResponse.json({ error: "A resolution plan is required to delete a shift." }, { status: 400 });
    }

    try {
        await ShiftService.deleteShift(userId, shiftId, resolution);
        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        const message = getErrorMessage(error);
        const status = message.includes("not found") ? 404
            : message.includes("Unauthorized") ? 403
                : message.includes("last active") ? 422
                    : 409;
        return NextResponse.json({ error: message }, { status });
    }
}
