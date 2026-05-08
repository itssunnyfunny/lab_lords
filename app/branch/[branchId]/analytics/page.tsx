"use client";

import { KpiRow } from "@/components/snapshot/KpiRow";
import { MainChart } from "@/components/snapshot/MainChart";
import { SideStats } from "@/components/snapshot/SideStats";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable } from "@/components/tables/DataTable";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { BranchAccessGuard } from "@/components/auth/BranchAccessGuard";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { use, useEffect, useMemo, useState } from "react";
import { AnalyticsPeriod, analytics, BranchSnapshot, TrendData } from "@/lib/api/analytics";
import { branches } from "@/lib/api/branches";
import { BRANCH_PAGE_ACCESS } from "@/lib/branchPageAccess";

type ChartKey = "revenue" | "collected" | "due" | "utilization" | "students";

interface BranchAnalyticsRow {
    id: string;
    branch: string;
    students: number;
    util: string;
    revenue: number;
    collected: number;
    due: number;
}

const PERIODS: { key: AnalyticsPeriod; label: string }[] = [
    { key: "month", label: "Monthly" },
    { key: "all", label: "All time" },
];

const CHARTS: { key: ChartKey; label: string; color: string }[] = [
    { key: "revenue", label: "Revenue", color: "#8b5cf6" },
    { key: "collected", label: "Collected", color: "#10b981" },
    { key: "due", label: "Due", color: "#ef4444" },
    { key: "utilization", label: "Utilization", color: "#06b6d4" },
    { key: "students", label: "Students", color: "#6366f1" },
];

function getTrendWindow(period: AnalyticsPeriod, chart: ChartKey) {
    const to = new Date();
    const from = new Date(to);

    if (period === "month" && ["revenue", "collected", "due"].includes(chart)) {
        from.setDate(1);
        from.setHours(0, 0, 0, 0);
        return { from: from.toISOString(), to: to.toISOString() };
    }

    from.setDate(from.getDate() - 30);
    return { from: from.toISOString(), to: to.toISOString() };
}

function money(value: number) {
    return `₹${value.toLocaleString("en-IN")}`;
}

export default function AnalyticsPage({ params }: { params: Promise<{ branchId: string }> }) {
    const { branchId } = use(params);

    return (
        <BranchAccessGuard branchId={branchId} permission={BRANCH_PAGE_ACCESS.analytics}>
            <AnalyticsContent branchId={branchId} />
        </BranchAccessGuard>
    );
}

function AnalyticsContent({ branchId }: { branchId: string }) {
    const [data, setData] = useState<BranchAnalyticsRow[]>([]);
    const [snapshot, setSnapshot] = useState<BranchSnapshot | null>(null);
    const [trends, setTrends] = useState<TrendData>([]);
    const [period, setPeriod] = useState<AnalyticsPeriod>("month");
    const [activeChart, setActiveChart] = useState<ChartKey>("revenue");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadAnalytics = async () => {
            setLoading(true);
            setError(null);
            try {
                const { from, to } = getTrendWindow(period, activeChart);
                const trendType = activeChart === "utilization" ? "seat" : activeChart === "students" ? "students" : "payment";

                const [branchDetails, snap, trendData] = await Promise.all([
                    branches.getDetails(branchId),
                    analytics.getSnapshot(branchId, { period }),
                    activeChart === "students"
                        ? Promise.resolve([])
                        : analytics.getTrends(branchId, { from, to, type: trendType, period }),
                ]);

                setData([{
                    id: branchDetails.id,
                    branch: branchDetails.name,
                    students: snap.totalStudents,
                    util: `${snap.occupancyRate.toFixed(2)}%`,
                    revenue: snap.monthlyRevenue,
                    collected: snap.paidAmount,
                    due: snap.dueAmount,
                }]);
                setSnapshot(snap);
                setTrends(trendData);
            } catch (loadError) {
                console.error("Failed to load analytics", loadError);
                setError("Failed to load analytics.");
            } finally {
                setLoading(false);
            }
        };
        loadAnalytics();
    }, [branchId, period, activeChart]);

    const chartConfig = CHARTS.find(chart => chart.key === activeChart) ?? CHARTS[0];

    const chartData = useMemo(() => {
        if (activeChart === "students") {
            if (!snapshot) return [];
            return [
                { date: "Active", value: snapshot.activeStudents, category: "Active" },
                { date: "Inactive", value: Math.max(0, snapshot.totalStudents - snapshot.activeStudents), category: "Inactive" },
            ];
        }

        if (activeChart === "utilization") {
            return trends;
        }

        const category = activeChart === "revenue"
            ? "Revenue"
            : activeChart === "collected"
                ? "Collected"
                : "Pending";

        return trends.filter(item => item.category === category);
    }, [activeChart, snapshot, trends]);

    const valueFormatter = activeChart === "utilization"
        ? (value: number) => `${value.toFixed(0)}%`
        : activeChart === "students"
            ? (value: number) => value.toLocaleString("en-IN")
            : money;

    if (loading && !snapshot) {
        return (
            <div className="p-4 md:p-8 flex items-center justify-center text-white">
                <Loader2 className="animate-spin mr-2" /> Loading analytics...
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8 space-y-8 text-white">
            <PageHeader
                title="Analytics & Trends"
                subtitle="Branch performance with corrected revenue, collections, dues, and utilization."
            />

            {error && (
                <div className="px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm">
                    {error}
                </div>
            )}

            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="inline-flex w-fit rounded-xl border border-white/10 bg-white/[0.03] p-1">
                    {PERIODS.map(item => (
                        <button
                            key={item.key}
                            type="button"
                            onClick={() => setPeriod(item.key)}
                            className={cn(
                                "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                                period === item.key
                                    ? "bg-white/10 text-white"
                                    : "text-textSecondary hover:text-white"
                            )}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>

                <div className="inline-flex flex-wrap gap-2">
                    {CHARTS.map(item => (
                        <button
                            key={item.key}
                            type="button"
                            onClick={() => setActiveChart(item.key)}
                            className={cn(
                                "px-3 py-2 rounded-lg text-xs font-semibold border transition-colors",
                                activeChart === item.key
                                    ? "bg-white/10 border-white/20 text-white"
                                    : "border-white/10 text-textSecondary hover:text-white hover:border-white/20"
                            )}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>
            </div>

            <KpiRow snapshot={snapshot ?? undefined} branchId={branchId} period={period} />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <MainChart
                    data={chartData}
                    title={`${chartConfig.label} ${activeChart === "students" ? "Snapshot" : "Trend"}`}
                    variant={activeChart === "students" ? "bar" : "area"}
                    color={chartConfig.color}
                    valueFormatter={valueFormatter}
                    emptyLabel="No data available for this selection."
                />
                <SideStats snapshot={snapshot ?? undefined} period={period} />
            </div>

            <div>
                <h2 className="text-lg font-semibold text-white mb-4">Branch Summary</h2>
                <DataTable
                    data={data}
                    columns={[
                        { header: "Branch Name", accessor: "branch", className: "font-medium text-white" },
                        { header: "Total Students", accessor: "students" },
                        { header: "Seat Utilization", accessor: (item) => <Badge variant="default">{item.util}</Badge> },
                        { header: "Revenue", accessor: (item) => money(item.revenue) },
                        { header: "Collected", accessor: (item) => <span className="text-emerald-400 font-semibold">{money(item.collected)}</span> },
                        { header: "All Due", accessor: (item) => <span className="text-rose-400 font-semibold">{money(item.due)}</span> },
                    ]}
                    actions={() => null}
                />
            </div>

            {snapshot?.seatDetails && (
                <div>
                    <h2 className="text-lg font-semibold text-white mb-4">Shift Breakdown</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {snapshot.seatDetails.shifts.map((shift) => (
                            <Card key={shift.shiftId} className="p-6 border-white/5 bg-white/[0.02]">
                                <h3 className="text-sm font-medium text-textSecondary mb-2">{shift.shiftName}</h3>
                                <div className="flex items-end justify-between">
                                    <span className="text-2xl font-bold text-white">
                                        {shift.used} / {shift.capacity}
                                    </span>
                                    <span className="text-sm text-emerald-400">
                                        {shift.occupancyPercent.toFixed(2)}%
                                    </span>
                                </div>
                                <div className="w-full bg-white/5 h-1.5 mt-4 rounded-full overflow-hidden">
                                    <div
                                        className="bg-emerald-500 h-full rounded-full"
                                        style={{ width: `${Math.min(shift.occupancyPercent, 100)}%` }}
                                    />
                                </div>
                            </Card>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
