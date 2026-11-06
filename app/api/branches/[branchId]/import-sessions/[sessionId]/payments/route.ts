import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { ImportPaymentChoiceService } from "@/importing/services/import-payment-choice.service";
import { parseExpectedImportRevision, readImportJson } from "@/importing/http/import-request";
import { toImportApiError } from "@/importing/http/import-api-error";
import type { GuidedPaymentResolution } from "@/importing/utils/guided-payment-choice";

type Context = { params: Promise<{ branchId: string; sessionId: string }> };
async function handle(req: Request, { params }: Context, apply: boolean) {
    try {
        const user = await getSessionUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { branchId, sessionId } = await params;
        if (!apply) return NextResponse.json(await ImportPaymentChoiceService.preview(user.id, branchId, sessionId));
        const body = await readImportJson<GuidedPaymentResolution>(req);
        return NextResponse.json(await ImportPaymentChoiceService.apply(user.id, branchId, sessionId, { ...body, expectedRevision: parseExpectedImportRevision(body.expectedRevision) }));
    } catch (error) {
        const result = toImportApiError(error, "Could not save payment choices.");
        return NextResponse.json(result.body, { status: result.status });
    }
}
export const GET = (req: Request, context: Context) => handle(req, context, false);
export const POST = (req: Request, context: Context) => handle(req, context, true);
