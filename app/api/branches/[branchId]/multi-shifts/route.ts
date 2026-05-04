import { NextResponse } from "next/server";
import { MultiShiftService } from "@/services/multiShift.service";
import { getSessionUser } from "@/lib/auth";

interface Params {
    params: Promise<{ branchId: string }>;
}

function getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : "Internal Server Error";
}

export async function GET(_req: Request, { params }: Params) {
    try {
        const { branchId } = await params;
        const user = await getSessionUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const list = await MultiShiftService.listMultiShifts(user.id, branchId);
        return NextResponse.json(list);
    } catch (error: unknown) {
        const message = getErrorMessage(error);
        if (message.includes("Unauthorized") || message.includes("does not own"))
            return NextResponse.json({ error: message }, { status: 403 });
        if (message.includes("not found"))
            return NextResponse.json({ error: message }, { status: 404 });
        console.error("[multi-shifts GET]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function POST(req: Request, { params }: Params) {
    try {
        const { branchId } = await params;
        const user = await getSessionUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const body = await req.json();
        const { name, price, shiftIds } = body;

        if (!name || typeof name !== "string")
            return NextResponse.json({ error: "Name is required" }, { status: 400 });
        if (!Array.isArray(shiftIds) || shiftIds.length < 2)
            return NextResponse.json({ error: "At least 2 primary shifts are required" }, { status: 400 });

        const created = await MultiShiftService.createMultiShift(user.id, branchId, {
            name,
            price: typeof price === "number" ? price : 0,
            shiftIds,
        });
        return NextResponse.json(created, { status: 201 });
    } catch (error: unknown) {
        const message = getErrorMessage(error);
        if (message.includes("Unauthorized") || message.includes("does not own"))
            return NextResponse.json({ error: message }, { status: 403 });
        if (message.includes("already exists"))
            return NextResponse.json({ error: message }, { status: 409 });
        console.error("[multi-shifts POST]", error);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
