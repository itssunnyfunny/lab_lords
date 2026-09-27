import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getSessionUser } from "@/lib/auth";
import { reportCsv, reportQuerySchema } from "@/lib/branchReports";
import { BranchAccessNotFoundError } from "@/services/accessPolicy.service";
import { BranchReportService, ReportLimitError } from "@/services/branchReport.service";

export async function GET(request: Request, context: { params: Promise<{ branchId: string }> }) {
    try {
        const user = await getSessionUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { branchId } = await context.params;
        const query = reportQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
        const result = await BranchReportService.read(user.id, branchId, query);
        const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
        if (query.format === "json") return NextResponse.json(result, { headers });
        return new Response(reportCsv(result), { headers: { ...headers, "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="lab-lords-${query.kind}-${query.from}-${query.through}.csv"` } });
    } catch (error) {
        if (error instanceof ZodError || error instanceof ReportLimitError) return NextResponse.json({ error: error instanceof ReportLimitError ? error.message : "Invalid report filters. Choose a date range of 93 days or less." }, { status: 400 });
        if (error instanceof BranchAccessNotFoundError) return NextResponse.json({ error: "Not found" }, { status: 404 });
        if (error instanceof Error && /Unauthorized|permission|entitlement|subscription/i.test(error.message)) return NextResponse.json({ error: "This report is unavailable with your current access." }, { status: 403 });
        return NextResponse.json({ error: "Unable to load this report. Please try again." }, { status: 500 });
    }
}
