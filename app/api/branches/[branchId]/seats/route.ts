import { NextResponse } from "next/server";
import { SeatService } from "@/services/seat.service";
import { getSessionUser } from "@/lib/auth";

interface Params {
    params: Promise<{
        branchId: string;
    }>;
}

export async function GET(req: Request, { params }: Params) {
    try {
        const { branchId } = await params;
        const user = await getSessionUser();

        if (!user) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const { searchParams } = new URL(req.url);
        const shiftId = searchParams.get("shiftId") || undefined;

        const seats = await SeatService.listSeats(user.id, branchId, shiftId);
        return NextResponse.json(seats);
    } catch (error: any) {
        console.error("Error fetching seats:", error);
        if (error.message.includes("Unauthorized") || error.message.includes("does not own")) {
            return NextResponse.json({ error: error.message }, { status: 403 });
        }
        if (error.message.includes("Branch not found")) {
            return NextResponse.json({ error: error.message }, { status: 404 });
        }
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}

export async function POST(req: Request, { params }: Params) {
    try {
        const { branchId } = await params;
        const user = await getSessionUser();

        if (!user) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const body = await req.json();

        if (!body.label) {
            return NextResponse.json(
                { error: "Label is required" },
                { status: 400 }
            );
        }

        const seat = await SeatService.createSeat(user.id, branchId, body.label);

        return NextResponse.json(seat, { status: 201 });
    } catch (error: any) {
        console.error("Error creating seat:", error);
        if (error.message.includes("Unauthorized") || error.message.includes("does not own")) {
            return NextResponse.json({ error: error.message }, { status: 403 });
        }
        if (error.message.includes("already exists")) {
            return NextResponse.json({ error: error.message }, { status: 409 });
        }
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
