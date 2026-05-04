import { NextResponse } from "next/server";
import { SeatService } from "@/services/seat.service";
import { getSessionUser } from "@/lib/auth";

interface Params {
    params: Promise<{ branchId: string; shiftId: string }>;
}

export async function GET(req: Request, { params }: Params) {
    try {
        const { branchId, shiftId } = await params;
        const user = await getSessionUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const multiShiftId = searchParams.get("multiShiftId") ?? undefined;
        const excludeRaw = searchParams.get("excludeAllocationIds");
        const excludeAllocationIds = excludeRaw ? excludeRaw.split(",").filter(Boolean) : undefined;

        const seatMap = await SeatService.getSeatMap(user.id, branchId, shiftId, multiShiftId, excludeAllocationIds);
        return NextResponse.json(seatMap);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Internal Server Error";
        if (message.includes("Unauthorized") || message.includes("does not own")) {
            return NextResponse.json({ error: message }, { status: 403 });
        }
        if (message.includes("not found")) {
            return NextResponse.json({ error: message }, { status: 404 });
        }
        console.error("[seat-map] Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
