import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { followUpSchema } from "@/lib/renewals";
import { renewalsErrorResponse } from "@/lib/renewalsHttp";
import { RenewalsService } from "@/services/renewals.service";

export async function PUT(request: Request, context: { params: Promise<{ branchId: string }> }) {
    try {
        const user = await getSessionUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const origin = request.headers.get("origin");
        if ((origin && origin !== new URL(request.url).origin) || request.headers.get("sec-fetch-site") === "cross-site") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        if (!request.headers.get("content-type")?.startsWith("application/json")) {
            return NextResponse.json({ error: "JSON required" }, { status: 415 });
        }
        const text = await request.text();
        if (text.length > 12_000) return NextResponse.json({ error: "Request too large" }, { status: 413 });
        const { branchId } = await context.params;
        const input = followUpSchema.parse(JSON.parse(text));
        return NextResponse.json(await RenewalsService.saveFollowUp(user.id, branchId, input));
    } catch (error) { return renewalsErrorResponse(error); }
}
