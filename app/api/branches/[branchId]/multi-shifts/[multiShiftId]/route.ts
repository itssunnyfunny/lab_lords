import { NextResponse } from "next/server";
import { MultiShiftService } from "@/services/multiShift.service";
import { getSessionUser } from "@/lib/auth";

interface Params {
    params: Promise<{ branchId: string; multiShiftId: string }>;
}

export async function PATCH(req: Request, { params }: Params) {
    try {
        const { multiShiftId } = await params;
        const user = await getSessionUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const body = await req.json();
        const updated = await MultiShiftService.updateMultiShift(user.id, multiShiftId, body);
        return NextResponse.json(updated);
    } catch (error: any) {
        if (error.message?.includes("Unauthorized") || error.message?.includes("does not own"))
            return NextResponse.json({ error: error.message }, { status: 403 });
        if (error.message?.includes("not found"))
            return NextResponse.json({ error: error.message }, { status: 404 });
        if (error.message?.includes("already exists"))
            return NextResponse.json({ error: error.message }, { status: 409 });
        console.error("[multi-shifts PATCH]", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}

export async function DELETE(_req: Request, { params }: Params) {
    try {
        const { multiShiftId } = await params;
        const user = await getSessionUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const result = await MultiShiftService.deleteMultiShift(user.id, multiShiftId);
        return NextResponse.json(result);
    } catch (error: any) {
        if (error.message?.includes("Unauthorized") || error.message?.includes("does not own"))
            return NextResponse.json({ error: error.message }, { status: 403 });
        if (error.message?.includes("not found"))
            return NextResponse.json({ error: error.message }, { status: 404 });
        console.error("[multi-shifts DELETE]", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
