import { NextResponse } from "next/server";
import { SeatService } from "@/services/seat.service";
import { getSessionUser } from "@/lib/auth";

interface Params {
    params: Promise<{ branchId: string; shiftId: string }>;
}

export async function GET(_req: Request, { params }: Params) {
    try {
        const { branchId, shiftId } = await params;
        const user = await getSessionUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const seatMap = await SeatService.getSeatMap(user.id, branchId, shiftId);
        return NextResponse.json(seatMap);
    } catch (error: any) {
        if (error.message?.includes("Unauthorized") || error.message?.includes("does not own")) {
            return NextResponse.json({ error: error.message }, { status: 403 });
        }
        if (error.message?.includes("not found")) {
            return NextResponse.json({ error: error.message }, { status: 404 });
        }
        console.error("[seat-map] Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
