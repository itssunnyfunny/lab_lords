import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { ImportSetupService } from "@/importing/services/import-setup.service";
import { parseExpectedImportRevision, readImportJson } from "@/importing/http/import-request";
import { toImportApiError } from "@/importing/http/import-api-error";
import type { SetupResolution } from "@/importing/utils/guided-setup";

export async function POST(req: Request, { params }: { params: Promise<{ branchId: string; sessionId: string }> }) {
    try {
        const user = await getSessionUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { branchId, sessionId } = await params;
        const body = await readImportJson<SetupResolution>(req);
        return NextResponse.json(await ImportSetupService.resolve(user.id, branchId, sessionId, { ...body, expectedRevision: parseExpectedImportRevision(body.expectedRevision) }));
    } catch (error) {
        const result = toImportApiError(error, "Could not prepare assignments.");
        return NextResponse.json(result.body, { status: result.status });
    }
}
