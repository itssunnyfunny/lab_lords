import { billingHistoryResponse } from "@/lib/billingHistoryHttp";

export async function GET(request: Request, context: { params: Promise<{ orgId: string }> }) {
    return billingHistoryResponse(request, (await context.params).orgId, "history");
}
