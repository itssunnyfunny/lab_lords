import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { ShiftService } from "@/services/shift.service";

async function getUserId() {
    const user = await getSessionUser();
    return user?.id ?? null;
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
        const updated = await ShiftService.updateShift(userId, shiftId, {
            name: body.name,
            startTime: body.startTime,
            endTime: body.endTime,
            price: body.price !== undefined ? Number(body.price) : undefined,
            isReserved: body.isReserved,
        });
        return NextResponse.json(updated);
    } catch (error: any) {
        const status = error.message.includes("not found") ? 404
            : error.message.includes("Unauthorized") ? 403
                : 400;
        return NextResponse.json({ error: error.message }, { status });
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
    } catch (error: any) {
        const status = error.message.includes("not found") ? 404
            : error.message.includes("Unauthorized") ? 403
                : error.message.includes("last active") ? 422
                    : 409;
        return NextResponse.json({ error: error.message }, { status });
    }
}
