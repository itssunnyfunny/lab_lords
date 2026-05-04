import { NextRequest, NextResponse } from "next/server";
import { SeatAllocationService } from "@/services/seatAllocation.service";
import { getSessionUser } from "@/lib/auth";

// PUT: Release a seat (Unassign)
export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ allocationId: string }> }
) {
    try {
        const { allocationId } = await params;

        // We can accept a body if we want future extensibility, but for now just accessing the route is enough action.
        // However, to be RESTful and explicit, let's enforce a simple body check or just proceed.
        // The user requirement said: Body: { action: "RELEASE" } (or just simple PUT).
        // Let's support simple PUT for ease of use, but we can check the body if present.

        const releasedAllocation = await SeatAllocationService.unassignSeat(allocationId);

        return NextResponse.json(releasedAllocation);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Failed to release seat";
        return NextResponse.json(
            { error: message },
            { status: 400 }
        );
    }
}

// PATCH: Change seat and/or shift for an active allocation
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ allocationId: string }> }
) {
    try {
        const user = await getSessionUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { allocationId } = await params;
        const body = await req.json();
        const { seatId, studentId, shiftIds, allocationIds, multiShiftId } = body;

        if (!seatId || !studentId || !Array.isArray(shiftIds) || shiftIds.length === 0) {
            return NextResponse.json(
                { error: "Missing required fields: seatId, studentId, shiftIds" },
                { status: 400 }
            );
        }

        // allocationIds can include sibling records (multi-shift group);
        // fallback to just the route param for single allocations.
        const ids: string[] = Array.isArray(allocationIds) && allocationIds.length > 0
            ? allocationIds
            : [allocationId];

        const result = await SeatAllocationService.updateAllocation(
            user.id,
            ids,
            seatId,
            studentId,
            shiftIds,
            typeof multiShiftId === "string" ? multiShiftId : undefined
        );

        return NextResponse.json(result);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Failed to update allocation";
        return NextResponse.json(
            { error: message },
            { status: 400 }
        );
    }
}

