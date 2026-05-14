import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { ImportSessionService } from "@/importing/services/import-session.service";

type Params = { params: Promise<{ branchId: string; sessionId: string }> };

export async function PATCH(req: Request, { params }: Params) {
    try {
        const user = await getSessionUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { branchId, sessionId } = await params;
        const body = await req.json();
        const detail = await ImportSessionService.updateRows(user.id, branchId, sessionId, {
            edits: Array.isArray(body.edits) ? body.edits : undefined,
            skipRowIds: Array.isArray(body.skipRowIds) ? body.skipRowIds : undefined,
            unskipRowIds: Array.isArray(body.unskipRowIds) ? body.unskipRowIds : undefined,
        });
        return NextResponse.json(detail);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to update rows";
        const status = message.includes("Unauthorized") ? 403 : message.includes("not found") ? 404 : 400;
        return NextResponse.json({ error: message }, { status });
    }
}
