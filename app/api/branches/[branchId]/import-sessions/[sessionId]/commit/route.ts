import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { ImportCommitService } from "@/importing/services/import-commit.service";
import type { CommitMode } from "@/importing/contracts/import-session.contract";

type Params = { params: Promise<{ branchId: string; sessionId: string }> };

export async function POST(req: Request, { params }: Params) {
    try {
        const user = await getSessionUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { branchId, sessionId } = await params;
        const body = await req.json().catch(() => ({}));
        if (body.confirm !== true) {
            return NextResponse.json({ error: "Final confirmation is required." }, { status: 400 });
        }
        const result = await ImportCommitService.commitSession(
            user.id,
            branchId,
            sessionId,
            (body.mode || "SAFE_PARTIAL") as CommitMode
        );
        return NextResponse.json(result);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to commit import";
        const status = message.includes("Unauthorized") ? 403 : message.includes("not found") ? 404 : 400;
        return NextResponse.json({ error: message }, { status });
    }
}
