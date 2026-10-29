import { dashboardResponse } from "@/lib/dashboardHttp";
import { DashboardService } from "@/services/dashboard.service";
export async function GET(_request: Request, context: { params: Promise<{ branchId: string }> }) {
    return dashboardResponse(async actorId => DashboardService.basicOverview(actorId, (await context.params).branchId));
}
