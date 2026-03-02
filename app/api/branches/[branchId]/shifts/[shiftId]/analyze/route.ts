import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { ShiftService } from "@/services/shift.service";

async function getUserId() {
    const user = await getSessionUser();
    return user?.id ?? null;
}

/**
 * GET /api/branches/[branchId]/shifts/[shiftId]/analyze
 * Returns the pre-delete impact analysis for a shift. Read-only.
 */
export async function GET(
    _request: NextRequest,
    context: { params: Promise<{ branchId: string; shiftId: string }> }
) {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { shiftId } = await context.params;

    try {
        const analysis = await ShiftService.analyzeShiftDeletion(userId, shiftId);
        return NextResponse.json(analysis);
    } catch (error: any) {
        const status = error.message.includes("not found") ? 404
            : error.message.includes("Unauthorized") ? 403
                : 500;
        return NextResponse.json({ error: error.message }, { status });
    }
}
