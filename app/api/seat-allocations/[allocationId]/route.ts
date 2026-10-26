import { NextRequest, NextResponse } from "next/server";
import { SeatAllocationService } from "@/services/seatAllocation.service";
import { getSessionUser } from "@/lib/auth";
import { AllocationMoveError } from "@/lib/allocationMove";

// PUT: Release a seat (Unassign)
export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ allocationId: string }> }
) {
    try {
        const user = await getSessionUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { allocationId } = await params;

        // We can accept a body if we want future extensibility, but for now just accessing the route is enough action.
        // However, to be RESTful and explicit, let's enforce a simple body check or just proceed.
        // The user requirement said: Body: { action: "RELEASE" } (or just simple PUT).
        // Let's support simple PUT for ease of use, but we can check the body if present.

        const releasedAllocation = await SeatAllocationService.unassignSeat(user.id, allocationId);

        return NextResponse.json(releasedAllocation);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Failed to release seat";
        const status = message.includes("Unauthorized") ? 403
            : message.includes("not found") ? 404
                : 400;
        return NextResponse.json(
            { error: message },
            { status }
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
        if (!body || typeof body !== "object" || Array.isArray(body)) throw new AllocationMoveError("Invalid allocation change.", 400);
        const { branchId, seatId, studentId, shiftIds, allocationIds, multiShiftId } = body;

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
        if (!ids.includes(allocationId)) return NextResponse.json({ error: "Invalid source allocations" }, { status: 400 });
        const result = await SeatAllocationService.moveAllocation(user.id, req.headers.get("Idempotency-Key"), {
            branchId, allocationIds: ids, seatId, studentId, shiftIds,
            ...(typeof multiShiftId === "string" ? { multiShiftId } : {}),
        });

        return NextResponse.json(result);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Failed to update allocation";
        if (error instanceof AllocationMoveError) return NextResponse.json({ error: message }, { status: error.status });
        if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid allocation change." }, { status: 400 });
        if (/^Allocation not found\.?$/.test(message)) return NextResponse.json({ error: "Allocation not found" }, { status: 404 });
        if (/Unauthorized|permission|read.only|writ|archived|entitlement|subscription|activation/i.test(message))
            return NextResponse.json({ error: "This action is unavailable with your current access or branch status." }, { status: 403 });
        return NextResponse.json({ error: "Unable to confirm this allocation change. Retry the saved change." }, { status: 500 });
    }
}

