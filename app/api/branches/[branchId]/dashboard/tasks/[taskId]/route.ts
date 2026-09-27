import { dashboardRequestBody, dashboardResponse } from "@/lib/dashboardHttp";
import { DashboardService } from "@/services/dashboard.service";
export async function PATCH(request: Request, context: { params: Promise<{ branchId: string; taskId: string }> }) {
    return dashboardResponse(async actorId => { const { branchId, taskId } = await context.params;
        return DashboardService.updateTask(actorId, branchId, taskId, await dashboardRequestBody(request)); }); }
