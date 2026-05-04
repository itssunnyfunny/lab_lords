import { NextResponse } from "next/server";
import { MultiShiftService } from "@/services/multiShift.service";
import { getSessionUser } from "@/lib/auth";
import { FORM_LIMITS, parseIntegerField, validateRequiredText } from "@/lib/formValidation";

interface Params {
    params: Promise<{ branchId: string; multiShiftId: string }>;
}

function getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : "Internal Server Error";
}

export async function PATCH(req: Request, { params }: Params) {
    try {
        const { multiShiftId } = await params;
        const user = await getSessionUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const body = await req.json();
        const nameResult = body.name !== undefined ? validateRequiredText(body.name, "Multi-shift name", 50) : null;
        if (nameResult && !nameResult.ok) return NextResponse.json({ error: nameResult.error }, { status: 400 });
        const priceResult = body.price !== undefined
            ? parseIntegerField(body.price, "Bundle monthly price", { min: 0, max: FORM_LIMITS.moneyMax })
            : null;
        if (priceResult && !priceResult.ok) return NextResponse.json({ error: priceResult.error }, { status: 400 });

        const updated = await MultiShiftService.updateMultiShift(user.id, multiShiftId, {
            ...(nameResult?.ok ? { name: nameResult.value } : {}),
            ...(priceResult?.ok ? { price: priceResult.value } : {}),
            ...(body.shiftIds !== undefined ? { shiftIds: body.shiftIds } : {}),
        });
        return NextResponse.json(updated);
    } catch (error: unknown) {
        const message = getErrorMessage(error);
        if (message.includes("Unauthorized") || message.includes("does not own"))
            return NextResponse.json({ error: message }, { status: 403 });
        if (message.includes("not found"))
            return NextResponse.json({ error: message }, { status: 404 });
        if (message.includes("already exists"))
            return NextResponse.json({ error: message }, { status: 409 });
        console.error("[multi-shifts PATCH]", error);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function DELETE(_req: Request, { params }: Params) {
    try {
        const { multiShiftId } = await params;
        const user = await getSessionUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const result = await MultiShiftService.deleteMultiShift(user.id, multiShiftId);
        return NextResponse.json(result);
    } catch (error: unknown) {
        const message = getErrorMessage(error);
        if (message.includes("Unauthorized") || message.includes("does not own"))
            return NextResponse.json({ error: message }, { status: 403 });
        if (message.includes("not found"))
            return NextResponse.json({ error: message }, { status: 404 });
        console.error("[multi-shifts DELETE]", error);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
