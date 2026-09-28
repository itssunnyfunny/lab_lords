import { dashboardQuerySchema } from "@/lib/dashboardContracts";
import { z } from "zod";
import { dashboardRequestBody, dashboardResponse } from "@/lib/dashboardHttp";
import { DashboardService } from "@/services/dashboard.service";
type Context = { params: Promise<{ branchId: string }> };

export async function GET(request: Request, context: Context) {
    return dashboardResponse(async actorId => { const { branchId } = await context.params;
        const query = dashboardQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
        return DashboardService.overview(actorId, branchId, query.month); });
}
export async function POST(request: Request, context: Context) {
    return dashboardResponse(async actorId => { const { branchId } = await context.params;
        z.object({ kind: z.literal("CAPTURE_OCCUPANCY") }).strict().parse(await dashboardRequestBody(request));
        return DashboardService.captureOccupancy(actorId, branchId); });
}
