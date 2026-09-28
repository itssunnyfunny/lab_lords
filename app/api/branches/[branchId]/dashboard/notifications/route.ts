import { dashboardRequestBody, dashboardResponse } from "@/lib/dashboardHttp";
import { DashboardService } from "@/services/dashboard.service";
type Context = { params: Promise<{ branchId: string }> };

export async function GET(_request: Request, context: Context) {
    return dashboardResponse(async actorId => DashboardService.notifications(actorId, (await context.params).branchId)); }
export async function PATCH(request: Request, context: Context) {
    return dashboardResponse(async actorId => DashboardService.updateNotification(actorId, (await context.params).branchId, await dashboardRequestBody(request))); }
