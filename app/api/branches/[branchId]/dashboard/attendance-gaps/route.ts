import { dashboardResponse } from "@/lib/dashboardHttp";
import { DashboardService } from "@/services/dashboard.service";

export async function GET(request: Request, context: { params: Promise<{ branchId: string }> }) {
    return dashboardResponse(async actorId => DashboardService.attendanceGaps(actorId, (await context.params).branchId,
        Object.fromEntries(new URL(request.url).searchParams)));
}
