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
 * Delete a shift, blocked if active allocations exist.
 */
export async function DELETE(
    _request: NextRequest,
    context: { params: Promise<{ branchId: string; shiftId: string }> }
) {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { shiftId } = await context.params;

    try {
        await ShiftService.deleteShift(userId, shiftId);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        const status = error.message.includes("not found") ? 404
            : error.message.includes("Unauthorized") ? 403
                : 409; // conflict for active allocations
        return NextResponse.json({ error: error.message }, { status });
    }
}
