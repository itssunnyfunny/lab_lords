import { NextRequest, NextResponse } from "next/server";
import { SeatAllocationService } from "@/services/seatAllocation.service";
import { getSessionUser } from "@/lib/auth";

// POST: Assign a seat across one or more shifts
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ branchId: string }> }
) {
    try {
        const user = await getSessionUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { seatId, studentId, shiftIds, shiftId } = body;

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
            resolvedShiftIds
        );

        return NextResponse.json(allocations, { status: 201 });
    } catch (error: any) {
        return NextResponse.json(
            { error: error.message || "Failed to assign seat" },
            { status: 400 }
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
        const { searchParams } = new URL(req.url);
        const studentId = searchParams.get("studentId") || undefined;
        const shiftId = searchParams.get("shiftId") || undefined;
        const activeOnly = searchParams.get("activeOnly") === "true";

        const allocations = await SeatAllocationService.listAllocations(branchId, {
            studentId,
            shiftId,
            activeOnly,
        });

        return NextResponse.json(allocations);
    } catch (error: any) {
        return NextResponse.json(
            { error: error.message || "Failed to list allocations" },
            { status: 500 }
        );
    }
}
