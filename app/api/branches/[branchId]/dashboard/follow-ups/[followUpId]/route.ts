import { dashboardRequestBody, dashboardResponse } from "@/lib/dashboardHttp";
import { DashboardService } from "@/services/dashboard.service";
export async function PATCH(request: Request, context: { params: Promise<{ branchId: string; followUpId: string }> }) {
    return dashboardResponse(async actorId => { const { branchId, followUpId } = await context.params;
        return DashboardService.updateFollowUp(actorId, branchId, followUpId, await dashboardRequestBody(request)); }); }
