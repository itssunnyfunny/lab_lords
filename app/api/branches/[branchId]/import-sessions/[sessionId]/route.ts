import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { ImportSessionService, type ImportSessionRowFilter } from "@/importing/services/import-session.service";

type Params = { params: Promise<{ branchId: string; sessionId: string }> };

function statusForError(message: string) {
    if (message.includes("Unauthorized")) return 403;
    if (message.includes("not found")) return 404;
    return 400;
}

function rowFilterFrom(value: string | null): ImportSessionRowFilter | undefined {
    if (value === "attention" || value === "ready" || value === "all" || value === "skipped") return value;
    return undefined;
}

function numberFrom(value: string | null) {
    if (!value) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
}

export async function GET(req: Request, { params }: Params) {
    try {
        const user = await getSessionUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { branchId, sessionId } = await params;
        const { searchParams } = new URL(req.url);
        const detail = await ImportSessionService.getSessionDetail(user.id, branchId, sessionId, {
            rowFilter: rowFilterFrom(searchParams.get("rowFilter")),
            limit: numberFrom(searchParams.get("limit")),
            cursor: numberFrom(searchParams.get("cursor")),
        });
        return NextResponse.json(detail);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to get import session";
        return NextResponse.json({ error: message }, { status: statusForError(message) });
    }
}
