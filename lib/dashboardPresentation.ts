import type { BranchDashboardSources } from "@/lib/branchDashboard";
import type { TrendData } from "@/lib/api/analytics";

export type ActivityItem =
    | { type: "allocation"; seat: string; studentName: string; ts: string }
    | { type: "payment"; amount: number; studentName: string; ts: string }
    | { type: "enrollment"; studentName: string; ts: string };

/** Difference existing all-time cumulative observations; never split a total. */
export function dailyDashboardCollections(trend: TrendData | null) {
    if (!trend) return [];
    const points = trend.filter(point => point.category === "Collected")
        .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
    if (points.some(point => !Number.isFinite(Date.parse(point.date)) || !Number.isFinite(point.value))) return [];
    return points.slice(1).flatMap((point, index) => {
        const previous = points[index];
        const elapsed = Date.parse(point.date) - Date.parse(previous.date);
        // Missing/duplicate days are unavailable, never manufactured zero bars.
        if (elapsed < 23 * 3600000 || elapsed > 25 * 3600000 || point.value < previous.value) return [];
        return [{ date: point.date, amount: point.value - previous.value }];
    });
}

/** Deliberate order: confirmed overdue debt, then today's fee dates. No score. */
export function dashboardPriorities(sources: BranchDashboardSources) {
    const groups: { kind: "overdue" | "today"; count: number; amount?: number; href: string }[] = [];
    if (sources.resources.overdue === "success" && sources.overduePayments.length) {
        groups.push({ kind: "overdue", count: sources.overduePayments.length,
            amount: sources.overduePayments.reduce((sum, row) => sum + row.amount, 0), href: "/overdue" });
    }
    // Counts are branch-wide and supplied by the service, never inferred from one page.
    if (sources.resources.upcoming === "success" && sources.upcoming && sources.upcoming.counts.TODAY > 0) {
        groups.push({ kind: "today", count: sources.upcoming.counts.TODAY, href: "/renewals" });
    }
    return groups;
}

function timestamp(value: string | Date | null | undefined) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

/** Recorded timestamps only. A refresh, due balance or start date is not an event. */
export function dashboardActivity(sources: BranchDashboardSources): ActivityItem[] {
    const items: ActivityItem[] = [];
    for (const collection of sources.collections) {
        const ts = timestamp(collection.collectedAt);
        if (ts && !collection.voidedAt) items.push({ type: "payment", amount: collection.amount,
            studentName: collection.snapshot.studentName, ts });
    }
    for (const student of sources.students) {
        const ts = timestamp(student.createdAt);
        if (ts) items.push({ type: "enrollment", studentName: student.name, ts });
    }
    for (const allocation of sources.allocations) {
        const ts = timestamp(allocation.createdAt);
        if (ts && allocation.seat?.label && allocation.student?.name) items.push({ type: "allocation",
            seat: allocation.seat.label, studentName: allocation.student.name, ts });
    }
    return items.sort((a, b) => Date.parse(b.ts) - Date.parse(a.ts)).slice(0, 5);
}
