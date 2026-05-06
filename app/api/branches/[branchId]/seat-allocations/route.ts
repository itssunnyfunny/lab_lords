import { NextRequest, NextResponse } from "next/server";
import { SeatAllocationService } from "@/services/seatAllocation.service";
import { getSessionUser } from "@/lib/auth";

// POST: Assign a seat across one or more shifts
export async function POST(
    req: NextRequest
) {
    try {
        const user = await getSessionUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { seatId, studentId, shiftIds, shiftId, multiShiftId } = body;

        // Accept shiftIds[] or backward-compat shiftId (singular)
        const resolvedShiftIds: string[] =
            Array.isArray(shiftIds) && shiftIds.length > 0
                ? shiftIds
                : shiftId
                    ? [shiftId]
                    : [];

        if (!seatId || !studentId || resolvedShiftIds.length === 0) {
            return NextResponse.json(
                { error: "Missing required fields: seatId, studentId, and at least one shiftId" },
                { status: 400 }
            );
        }

        const allocations = await SeatAllocationService.assignSeatToShifts(
            user.id,
            seatId,
            studentId,
            resolvedShiftIds,
            typeof multiShiftId === "string" ? multiShiftId : undefined
        );

        return NextResponse.json(allocations, { status: 201 });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Failed to assign seat";
        const status = message.includes("Unauthorized") ? 403
            : message.includes("not found") ? 404
                : 400;
        return NextResponse.json(
            { error: message },
            { status }
        );
    }
}



// GET: List allocations
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ branchId: string }> }
) {
    try {
        const { branchId } = await params;
        const user = await getSessionUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const studentId = searchParams.get("studentId") || undefined;
        const shiftId = searchParams.get("shiftId") || undefined;
        const activeOnly = searchParams.get("activeOnly") === "true";

        const allocations = await SeatAllocationService.listAllocations(user.id, branchId, {
            studentId,
            shiftId,
            activeOnly,
        });

        return NextResponse.json(allocations);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Failed to list allocations";
        const status = message.includes("Unauthorized") ? 403
            : message.includes("not found") ? 404
                : 500;
        return NextResponse.json(
            { error: message },
            { status }
        );
    }
}
