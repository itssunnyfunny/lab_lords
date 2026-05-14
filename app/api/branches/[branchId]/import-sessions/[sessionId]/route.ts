import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { ImportSessionService } from "@/importing/services/import-session.service";

type Params = { params: Promise<{ branchId: string; sessionId: string }> };

function statusForError(message: string) {
    if (message.includes("Unauthorized")) return 403;
    if (message.includes("not found")) return 404;
    return 400;
}

export async function GET(_req: Request, { params }: Params) {
    try {
        const user = await getSessionUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { branchId, sessionId } = await params;
        const detail = await ImportSessionService.getSessionDetail(user.id, branchId, sessionId);
        return NextResponse.json(detail);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to get import session";
        return NextResponse.json({ error: message }, { status: statusForError(message) });
    }
}
