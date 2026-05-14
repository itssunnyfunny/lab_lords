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
        const detail = await ImportSessionService.updateMapping(user.id, branchId, sessionId, {
            columnMappings: Array.isArray(body.columnMappings) ? body.columnMappings : undefined,
            importOptions: body.importOptions,
        });
        return NextResponse.json(detail);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to update mapping";
        const status = message.includes("Unauthorized") ? 403 : message.includes("not found") ? 404 : 400;
        return NextResponse.json({ error: message }, { status });
    }
}
