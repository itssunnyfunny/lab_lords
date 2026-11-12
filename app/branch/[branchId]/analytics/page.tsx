"use client";
import { useTranslation } from "@/components/settings/LocalizedText";

import { KpiRow } from "@/components/snapshot/KpiRow";
import { MainChart } from "@/components/snapshot/MainChart";
import { SideStats } from "@/components/snapshot/SideStats";
import { Badge } from "@/components/ui/Badge";
import { AppButton, AppPanel, AppSelect, ErrorState, PageLoadingSkeleton, PageShell } from "@/components/ui";
import { BranchAccessGuard } from "@/components/auth/BranchAccessGuard";
import { cn } from "@/lib/utils";
import { use, useEffect, useState } from "react";
import type { AnalyticsPeriod, BranchSnapshot } from "@/lib/api/analytics";
import { loadBranchAnalyticsPage, type AnalyticsChartKey, type BranchAnalyticsPayload } from "@/lib/analyticsPageLoader";
import { BRANCH_PAGE_ACCESS } from "@/lib/branchPageAccess";
import {
    pageFilterShellClass,
    pageGridCardClass,
    pageGridCardHoverClass,
    pageInsetSurfaceClass,
    pageMutedTextClass,
    pageSectionDividerClass,
    pageSubtleTextClass,
} from "@/components/ui/pageSurface";
import { RefreshCw } from "lucide-react";
import type { BranchAccess, ResourceState } from "@/types";
import { resourceData, resourceUpdatedAt } from "@/lib/resourceState";
import { useUserPreferences } from "@/components/settings/UserPreferencesApplier";
import { withoutFinancialAnalytics } from "@/lib/analyticsFinancialAccess";

type ChartKey = AnalyticsChartKey;

type SummaryTone = "success" | "danger" | "info" | "neutral";

const PERIODS: { key: AnalyticsPeriod; label: string }[] = [
    { key: "month", label: "Monthly" },
    { key: "all", label: "All time" },
];

const CHARTS: { key: ChartKey; label: string; color: string }[] = [
    { key: "revenue", label: "Revenue", color: "var(--ui-tone-insight-progress)" },
    { key: "collected", label: "Collected", color: "var(--ui-tone-success-progress)" },
    { key: "due", label: "Due", color: "var(--ui-tone-danger-progress)" },
    { key: "utilization", label: "Utilization", color: "var(--ui-tone-info-progress)" },
    { key: "students", label: "Students", color: "var(--ui-tone-insight-progress)" },
];

export default function AnalyticsPage({ params }: { params: Promise<{ branchId: string }> }) {
    const { branchId } = use(params);

    return (
        <BranchAccessGuard branchId={branchId} permission={BRANCH_PAGE_ACCESS.analytics} feature="BRANCH_ANALYTICS">
            {access => <AnalyticsContent branchId={branchId} access={access} />}
        </BranchAccessGuard>
    );
}

function AnalyticsContent({ branchId, access }: { branchId: string; access: BranchAccess }) {
    const t = useTranslation();
    const [period, setPeriod] = useState<AnalyticsPeriod>("month");
    const [activeChart, setActiveChart] = useState<ChartKey>("revenue");
    const [resource, setResource] = useState<ResourceState<BranchAnalyticsPayload>>({ status: "loading" });
    const [refreshKey, setRefreshKey] = useState(0);
    const canViewFinance = access.permissions.view_payments;
    const { formatDateTime, formatNumber } = useUserPreferences();
    const formatMoney = (value: number) => formatNumber(value, {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
    });
    const formatPercent = (value: number, maximumFractionDigits = 0) => formatNumber(value / 100, {
        style: "percent",
        maximumFractionDigits,
    });

    useEffect(() => {
        let active = true;
        void loadBranchAnalyticsPage(branchId, period, activeChart, canViewFinance, setResource, () => active);
        return () => { active = false; };
    }, [activeChart, branchId, canViewFinance, period, refreshKey]);

    const payload = resourceData(resource);
    const displayedPeriod = payload?.period ?? period;
    const snapshot = payload?.snapshot && (canViewFinance ? payload.snapshot : withoutFinancialAnalytics(payload.snapshot));
    const financialAccess = snapshot?.financialAccess === true;
    const displayedChart = financialAccess
        ? payload?.chart ?? activeChart
        : payload?.chart === "students" ? "students" : "utilization";
    const visibleSelection = financialAccess
        ? activeChart
        : activeChart === "students" ? "students" : "utilization";
    const trends = payload?.chart === displayedChart ? payload.trends : [];
    const updatedAt = resourceUpdatedAt(resource);

    const chartConfig = CHARTS.find(chart => chart.key === displayedChart) ?? CHARTS[3];

    const chartData = (() => {
        if (displayedChart === "students") {
            if (!snapshot) return [];
            return [
                { date: "Active", value: snapshot.activeStudents, category: t("Active") },
                { date: "Inactive", value: Math.max(0, snapshot.totalStudents - snapshot.activeStudents), category: t("Inactive") },
            ];
        }

        if (displayedChart === "utilization") {
            return trends;
        }

        const category = displayedChart === "revenue"
            ? "Revenue"
            : displayedChart === "collected"
                ? "Collected"
                : "Pending";

        return trends.filter(item => item.category === category);
    })();

    const valueFormatter = displayedChart === "utilization"
        ? (value: number) => formatPercent(value)
        : displayedChart === "students"
            ? (value: number) => formatNumber(value)
            : formatMoney;
    const chartContext = displayedChart === "students"
        ? "Current active and inactive student counts"
        : displayedPeriod === "month" && ["revenue", "collected", "due"].includes(displayedChart)
            ? t("{label} trend for the current month", { label: t.owned(chartConfig.label) })
            : t("{label} trend for the last 30 days", { label: t.owned(chartConfig.label) });

    if (resource.status === "loading" && !payload) {
        return <PageLoadingSkeleton label={t("Loading branch analytics")} variant="analytics" />;
    }

    if (resource.status === "error") {
        return (
            <ErrorState
                title={t("Branch analytics unavailable")}
                description={resource.message}
                onRetry={resource.retryable ? () => setRefreshKey(key => key + 1) : undefined}
            />
        );
    }

    if (!payload || !snapshot) {
        return <ErrorState title={t("Branch analytics unavailable")} description={t("No verified analytics snapshot was returned.")} />;
    }

    return (
        <PageShell className="ui-record-page ui-analytics-page">
            <header className="ui-record-header">
                <div className="min-w-0">
                    <h1>{t("Analytics & Trends")}</h1>

                </div>
                <div className="ui-record-actions items-center">
                    <span className={cn("text-xs", pageMutedTextClass)}>{t("Updated")} {updatedAt ? formatDateTime(updatedAt) : t("recently")}</span>
                <AppButton
                    variant="quiet"
                    density="compact"
                    icon={RefreshCw}
                    isLoading={resource.status === "loading"}
                    onClick={() => setRefreshKey(key => key + 1)}
                >
                    {t("Refresh")}</AppButton>
                </div>
            </header>

            <KpiRow snapshot={snapshot} branchId={branchId} period={displayedPeriod} />

            <div className="ui-analytics-composition grid min-w-0 items-start gap-3">
                <section className="min-w-0 space-y-2" aria-label={t("Analytics & Trends")}>
                    <div className="ui-analytics-mobile-controls grid grid-cols-2 gap-2">
                        {financialAccess && <AppSelect label={t("Analytics period")} labelClassName="text-xs" value={period} onValueChange={value => setPeriod(value as AnalyticsPeriod)} options={PERIODS.map(item => ({ value: item.key, label: t.owned(item.label) }))} />}
                        <AppSelect label={t("Chart metric")} labelClassName="text-xs" containerClassName={financialAccess ? "min-w-0" : "col-span-2"} value={visibleSelection} onValueChange={value => setActiveChart(value as ChartKey)} options={CHARTS.filter(item => financialAccess || item.key === "utilization" || item.key === "students").map(item => ({ value: item.key, label: t.owned(item.label) }))} />
                    </div>
            <div className="ui-analytics-controls flex flex-wrap items-center justify-between gap-2">
                {financialAccess && <div role="group" aria-label={t("Analytics period")} className={cn("inline-flex w-fit flex-wrap p-1", pageFilterShellClass)}>
                    {PERIODS.map(item => (
                        <button
                            key={item.key}
                            type="button"
                            aria-pressed={period === item.key}
                            onClick={() => setPeriod(item.key)}
                            className={cn(
                                "min-h-11 rounded-[var(--ui-radius-control)] px-3 py-2 text-xs font-medium transition-colors",
                                period === item.key
                                    ? "bg-[color:var(--ui-form-input-bg)] text-[color:var(--text-primary)] shadow-[var(--ui-panel-compact-shadow)]"
                                    : "text-[color:var(--text-secondary)] hover:bg-[color:var(--ui-form-surface-hover-bg)] hover:text-[color:var(--text-primary)]"
                            )}
                        >
                            {t.owned(item.label)}
                        </button>
                    ))}
                </div>}

                <div role="group" aria-label={t("Chart metric")} className="inline-flex flex-wrap gap-1">
                    {CHARTS.filter(item => financialAccess || item.key === "utilization" || item.key === "students").map(item => (
                        <button
                            key={item.key}
                            type="button"
                            aria-pressed={visibleSelection === item.key}
                            onClick={() => setActiveChart(item.key)}
                            className={cn(
                                "min-h-11 rounded-[var(--ui-radius-control)] border px-3 py-2 text-xs font-semibold transition-colors",
                                visibleSelection === item.key
                                    ? "border-[color:var(--ui-form-input-focus-border)] bg-[color:var(--ui-form-input-bg)] text-[color:var(--text-primary)]"
                                    : "border-[color:var(--ui-form-surface-border)] text-[color:var(--text-secondary)] hover:border-[color:var(--ui-form-input-border)] hover:text-[color:var(--text-primary)]"
                            )}
                        >
                            {t.owned(item.label)}
                        </button>
                    ))}
                </div>
            </div>

                    <MainChart
                        data={chartData}
                        title={t(displayedChart === "students" ? "{label} Snapshot" : "{label} Trend", { label: t.owned(chartConfig.label) })}
                        variant={displayedChart === "students" ? "bar" : "area"}
                        color={chartConfig.color}
                        valueFormatter={valueFormatter}
                        emptyLabel="No data available for this selection."
                        contextLabel={chartContext}
                        dataLabel={displayedChart === "students" ? "Student status" : "Date"}
                    />
                    {displayedChart !== "students" && <p className="px-1 text-xs leading-5 text-[color:var(--text-muted)]">{t("History uses current records, student status and shift capacity.")}</p>}
                </section>
                <aside className="min-w-0 space-y-3" aria-label={t("Branch Summary")}>
                    <AppPanel density="compact" title={t("Branch Summary")} description={payload.row.branch} contentClassName="divide-y divide-[color:var(--ui-form-section-divider)]">
                        <BranchSummaryCard label={t("Students")} value={formatNumber(payload.row.students)} detail={t("Current student count")} tone="info" />
                        <BranchSummaryCard label={t("Seat utilization")} value={formatPercent(payload.row.util, 2)} detail={t("Current occupancy")} tone="neutral" />
                    </AppPanel>
                    {financialAccess && <SideStats snapshot={snapshot} period={displayedPeriod} />}
                </aside>
            </div>

            {snapshot?.seatDetails && (
                <AppPanel
                    density="compact"
                    title={t("Shift Breakdown")}
                    description={t("Capacity and utilization by shift.")}
                    contentClassName="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
                >
                        {snapshot.seatDetails.shifts.map((shift) => (
                            <ShiftBreakdownCard key={shift.shiftId} shift={shift} />
                        ))}
                </AppPanel>
            )}
        </PageShell>
    );
}

function toneValueClass(tone: SummaryTone) {
    if (tone === "success") return "text-[color:var(--ui-tone-success-text)]";
    if (tone === "danger") return "text-[color:var(--ui-tone-danger-text)]";
    if (tone === "info") return "text-[color:var(--ui-tone-info-text)]";
    return "text-[color:var(--text-primary)]";
}

function BranchSummaryCard({
    label,
    value,
    detail,
    tone,
}: {
    label: string;
    value: string;
    detail: string;
    tone: SummaryTone;
}) {
    return (
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2 first:pt-0 last:pb-0">
            <div className="min-w-0"><p className={cn("text-sm font-medium", pageSubtleTextClass)}>{label}</p><p className={cn("mt-1 text-xs", pageMutedTextClass)}>{detail}</p></div>
            <p className={cn("break-words text-xl font-semibold tabular-nums", toneValueClass(tone))}>{value}</p>
        </div>
    );
}

function ShiftBreakdownCard({
    shift,
}: {
    shift: NonNullable<BranchSnapshot["seatDetails"]>["shifts"][number];
}) {
    const t = useTranslation();
    const { formatNumber } = useUserPreferences();
    const percent = Math.min(Math.max(shift.occupancyPercent, 0), 100);
    const available = Math.max(shift.capacity - shift.used, 0);
    const formattedPercent = formatNumber(shift.occupancyPercent / 100, {
        style: "percent",
        maximumFractionDigits: 0,
    });
    const tone = percent >= 90 ? "danger" : percent >= 70 ? "warning" : "success";
    const barClass = tone === "danger"
        ? "bg-[color:var(--ui-tone-danger-progress)]"
        : tone === "warning"
            ? "bg-[color:var(--ui-tone-warning-progress)]"
            : "bg-[color:var(--ui-tone-success-progress)]";

    return (
        <div className={cn(pageGridCardClass, pageGridCardHoverClass)}>
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <h3 className="break-words text-sm font-semibold text-[color:var(--text-primary)]">{shift.shiftName}</h3>
                    <p className={cn("mt-1 text-xs", pageSubtleTextClass)}>{t("{formatNumber} available of {formatNumber2}", { formatNumber: formatNumber(available), formatNumber2: formatNumber(shift.capacity) })}</p>
                </div>
                <Badge variant={tone === "danger" ? "danger" : tone === "warning" ? "warning" : "success"}>
                    {formattedPercent}
                </Badge>
            </div>

            <div className="mt-5 flex items-end justify-between gap-4">
                <div>
                    <p className="text-2xl font-semibold tracking-tight text-[color:var(--text-primary)]">
                        {formatNumber(shift.used)}
                        <span className={cn("text-sm font-medium", pageMutedTextClass)}> / {formatNumber(shift.capacity)}</span>
                    </p>
                    <p className={cn("mt-1 text-xs", pageMutedTextClass)}>{t("Seats used")}</p>
                </div>
                <div className={cn("rounded-[var(--ui-radius-control)] px-2.5 py-1 text-xs", pageInsetSurfaceClass)}>
                    {t("Capacity")}</div>
            </div>

            <div className={cn("mt-4 h-2 overflow-hidden rounded-full border", pageSectionDividerClass)}>
                <div className={cn("h-full rounded-full", barClass)} style={{ width: `${percent}%` }} />
            </div>
        </div>
    );
}
