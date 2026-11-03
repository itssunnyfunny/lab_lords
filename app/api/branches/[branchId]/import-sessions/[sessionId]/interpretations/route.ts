import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { ImportSessionService } from "@/importing/services/import-session.service";
import { readImportJson, parseExpectedImportRevision, ImportRequestError } from "@/importing/http/import-request";
import { toImportApiError } from "@/importing/http/import-api-error";

export async function POST(req: Request, { params }: { params: Promise<{ branchId: string; sessionId: string }> }) {
    try {
        const user = await getSessionUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { branchId, sessionId } = await params;
        const body = await readImportJson<{ expectedRevision?: unknown; source?: unknown; targetId?: unknown }>(req);
        if (typeof body.source !== "string" || typeof body.targetId !== "string") throw new ImportRequestError("Choose a shift interpretation.", { code: "INVALID_INTERPRETATION" });
        return NextResponse.json(await ImportSessionService.confirmShiftInterpretation(user.id, branchId, sessionId, {
            expectedRevision: parseExpectedImportRevision(body.expectedRevision), source: body.source, targetId: body.targetId,
        }));
    } catch (error) {
        const result = toImportApiError(error, "Could not apply the interpretation.");
        return NextResponse.json(result.body, { status: result.status });
    }
}
