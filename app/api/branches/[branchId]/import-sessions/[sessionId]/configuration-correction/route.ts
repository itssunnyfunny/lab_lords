import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { ImportConfigurationCorrectionService } from "@/importing/services/import-configuration-correction.service";
import { parseExpectedImportRevision, readImportJson } from "@/importing/http/import-request";
import { toImportApiError } from "@/importing/http/import-api-error";
import type { ImportConfigurationCorrection } from "@/importing/contracts/import-correction.contract";

export async function POST(req: Request, { params }: { params: Promise<{ branchId: string; sessionId: string }> }) {
    try {
        const user = await getSessionUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { branchId, sessionId } = await params;
        const body = await readImportJson<{ correction: ImportConfigurationCorrection; hash?: string; expectedRevision?: number }>(req);
        const result = body.hash === undefined
            ? await ImportConfigurationCorrectionService.preview(user.id, branchId, sessionId, body.correction)
            : await ImportConfigurationCorrectionService.apply(user.id, branchId, sessionId, body.correction, body.hash, parseExpectedImportRevision(body.expectedRevision));
        return NextResponse.json(result);
    } catch (error) {
        const result = toImportApiError(error, "Could not correct branch configuration.");
        return NextResponse.json(result.body, { status: result.status });
    }
}
