import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { ImportWiringService } from "@/importing/services/import-wiring.service";

type Params = { params: Promise<{ branchId: string; sessionId: string }> };

export async function POST(req: Request, { params }: Params) {
    try {
        const user = await getSessionUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { branchId, sessionId } = await params;
        const body = await req.json();
        if (typeof body.rowId !== "string" || !body.normalizedData || typeof body.normalizedData !== "object") {
            return NextResponse.json({ error: "rowId and normalizedData are required." }, { status: 400 });
        }

        const preview = await ImportWiringService.previewRowDraft(user.id, branchId, sessionId, {
            rowId: body.rowId,
            normalizedData: body.normalizedData,
        });
        return NextResponse.json(preview);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to preview import row";
        const status = message.includes("Unauthorized") ? 403 : message.includes("not found") ? 404 : 400;
        return NextResponse.json({ error: message }, { status });
    }
}
