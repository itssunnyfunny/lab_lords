import { NextResponse } from "next/server";
import { SeatService } from "@/services/seat.service";
import { getSessionUser } from "@/lib/auth";

interface Params {
    params: Promise<{ branchId: string }>;
}

/**
 * GET /api/branches/[branchId]/shifts/capacity
 *
 * Returns all active shifts with current occupancy counts.
 * Accepts optional ?studentId=... to mark shifts where student is already allocated.
 *
 * Used by: AllocateSeatDialog (Step 1 — shift selection cards)
 */
export async function GET(req: Request, { params }: Params) {
    try {
        const { branchId } = await params;
        const user = await getSessionUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const studentId = searchParams.get("studentId") ?? undefined;

        const capacity = await SeatService.getShiftsCapacity(user.id, branchId, studentId);
        return NextResponse.json(capacity);
    } catch (error: any) {
        if (error.message?.includes("Unauthorized") || error.message?.includes("does not own")) {
            return NextResponse.json({ error: error.message }, { status: 403 });
        }
        if (error.message?.includes("not found")) {
            return NextResponse.json({ error: error.message }, { status: 404 });
        }
        console.error("[shifts/capacity] Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
