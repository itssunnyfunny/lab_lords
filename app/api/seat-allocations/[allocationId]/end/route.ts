import { NextRequest, NextResponse } from "next/server";
import { SeatAllocationService } from "@/services/seatAllocation.service";
import { getSessionUser } from "@/lib/auth";

export async function POST(
    req: NextRequest,
    context: { params: Promise<{ allocationId: string }> }
) {
    try {
        const user = await getSessionUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { allocationId } = await context.params;

        if (!allocationId) {
            return NextResponse.json(
                { error: "Missing allocation ID" },
                { status: 400 }
            );
        }

        const updated = await SeatAllocationService.unassignSeat(user.id, allocationId);

        return NextResponse.json(updated);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Failed to end allocation";
        const status = message.includes("Unauthorized") ? 403
            : message.includes("not found") ? 404
                : 400;
        return NextResponse.json(
            { error: message },
            { status }
        );
    }
}
