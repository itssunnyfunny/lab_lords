import { dashboardRequestBody, dashboardResponse } from "@/lib/dashboardHttp";
import { DashboardService } from "@/services/dashboard.service";
type Context = { params: Promise<{ branchId: string }> };

export async function GET(request: Request, context: Context) {
    return dashboardResponse(async actorId => DashboardService.terms(actorId, (await context.params).branchId, undefined,
        Object.fromEntries(new URL(request.url).searchParams))); }
export async function POST(request: Request, context: Context) {
    return dashboardResponse(async actorId => DashboardService.saveTerm(actorId, (await context.params).branchId, await dashboardRequestBody(request))); }
