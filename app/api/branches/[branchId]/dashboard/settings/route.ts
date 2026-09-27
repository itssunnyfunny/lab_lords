import { dashboardRequestBody, dashboardResponse } from "@/lib/dashboardHttp";
import { DashboardService } from "@/services/dashboard.service";
type Context = { params: Promise<{ branchId: string }> };

export async function GET(_request: Request, context: Context) {
    return dashboardResponse(async actorId => DashboardService.settings(actorId, (await context.params).branchId)); }
export async function POST(request: Request, context: Context) {
    return dashboardResponse(async actorId => DashboardService.saveSettings(actorId, (await context.params).branchId, await dashboardRequestBody(request))); }
