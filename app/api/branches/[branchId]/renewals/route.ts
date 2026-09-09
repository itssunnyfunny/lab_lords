import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { renewalQuerySchema } from "@/lib/renewals";
import { renewalsErrorResponse } from "@/lib/renewalsHttp";
import { RenewalsService } from "@/services/renewals.service";

export async function GET(request: Request, context: { params: Promise<{ branchId: string }> }) {
    try {
        const user = await getSessionUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { branchId } = await context.params;
        const query = renewalQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
        return NextResponse.json(await RenewalsService.list(user.id, branchId, query), {
            headers: { "Cache-Control": "private, no-store" },
        });
    } catch (error) { return renewalsErrorResponse(error); }
}
