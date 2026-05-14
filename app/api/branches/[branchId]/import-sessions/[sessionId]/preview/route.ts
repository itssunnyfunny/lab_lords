import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { ImportPreviewService } from "@/importing/services/import-preview.service";
import type { CommitMode } from "@/importing/contracts/import-session.contract";

type Params = { params: Promise<{ branchId: string; sessionId: string }> };

export async function GET(req: Request, { params }: Params) {
    try {
        const user = await getSessionUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { branchId, sessionId } = await params;
        const { searchParams } = new URL(req.url);
        const mode = (searchParams.get("mode") || "SAFE_PARTIAL") as CommitMode;
        const preview = await ImportPreviewService.getPreview(user.id, branchId, sessionId, mode);
        return NextResponse.json(preview);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to build import preview";
        const status = message.includes("Unauthorized") ? 403 : message.includes("not found") ? 404 : 400;
        return NextResponse.json({ error: message }, { status });
    }
}
