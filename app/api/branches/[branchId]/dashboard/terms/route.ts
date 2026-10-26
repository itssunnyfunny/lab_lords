import { dashboardRequestBody, dashboardResponse } from "@/lib/dashboardHttp";
import { DashboardService } from "@/services/dashboard.service";
type Context = { params: Promise<{ branchId: string }> };

export async function GET(request: Request, context: Context) {
    return dashboardResponse(async actorId => {
        const { branchId } = await context.params;
        const query = new URL(request.url).searchParams;
        const history = query.get("history");
        return history ? DashboardService.termHistory(actorId, branchId, history, query.has("before") ? Number(query.get("before")) : undefined)
            : DashboardService.terms(actorId, branchId, undefined, Object.fromEntries(query));
    }); }
export async function POST(request: Request, context: Context) {
    return dashboardResponse(async actorId => DashboardService.saveTerm(actorId, (await context.params).branchId, await dashboardRequestBody(request))); }
export async function PATCH(request: Request, context: Context) {
    return dashboardResponse(async actorId => DashboardService.changeTerm(actorId, (await context.params).branchId, await dashboardRequestBody(request))); }
