import { analytics, type AnalyticsPeriod, type BranchSnapshot, type TrendData } from "@/lib/api/analytics";
import { branches } from "@/lib/api/branches";
import type { ResourceState } from "@/types";

export type AnalyticsChartKey = "revenue" | "collected" | "due" | "utilization" | "students";

export type BranchAnalyticsPayload = {
    row: { id: string; branch: string; students: number; util: number };
    snapshot: BranchSnapshot;
    trends: TrendData;
    period: AnalyticsPeriod;
    chart: AnalyticsChartKey;
    from: string;
    to: string;
};

function trendWindow(period: AnalyticsPeriod, chart: AnalyticsChartKey) {
    const to = new Date();
    const from = new Date(to);
    if (period === "month" && ["revenue", "collected", "due"].includes(chart)) {
        from.setDate(1);
        from.setHours(0, 0, 0, 0);
    } else {
        from.setDate(from.getDate() - 30);
    }
    return { from: from.toISOString(), to: to.toISOString() };
}

export async function loadBranchAnalyticsPage(
    branchId: string,
    period: AnalyticsPeriod,
    selectedChart: AnalyticsChartKey,
    canViewFinance: boolean,
    publish: (state: ResourceState<BranchAnalyticsPayload>) => void,
    isActive: () => boolean = () => true,
) {
    // Clear an earlier financial response before either permission or data is
    // revalidated. A slow nonfinancial trend cannot prolong its display.
    publish({ status: "loading" });
    try {
        const [branchDetails, snapshot] = await Promise.all([
            branches.getDetails(branchId),
            analytics.getSnapshot(branchId, { period }),
        ]);
        if (!isActive()) return;
        const chart = canViewFinance && snapshot.financialAccess
            ? selectedChart
            : selectedChart === "students" ? "students" : "utilization";
        const { from, to } = trendWindow(period, chart);
        const trendType = chart === "utilization" ? "seat" : chart === "students" ? "students" : "payment";
        const trends = chart === "students" ? [] : await analytics.getTrends(branchId, { from, to, type: trendType, period });
        if (!isActive()) return;
        publish({
            status: "success",
            updatedAt: new Date().toISOString(),
            data: {
                row: {
                    id: branchDetails.id,
                    branch: branchDetails.name,
                    students: snapshot.totalStudents,
                    util: snapshot.occupancyRate,
                },
                snapshot,
                trends,
                period,
                chart,
                from,
                to,
            },
        });
    } catch {
        if (isActive()) publish({
            status: "error",
            message: "The requested analytics view could not be refreshed.",
            retryable: true,
        });
    }
}
