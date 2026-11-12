"use client";
import { useTranslation } from "@/components/settings/LocalizedText";

import { useEffect, useState } from "react";
import {
    CalendarClock,
    CircleDollarSign,
    TrendingUp,
    Users,
} from "lucide-react";
import type { AIBranchReportSnapshot, AIStructuredBranchReport } from "@/ai/contracts/structuredReport.contract";
import { Badge } from "@/components/ui/Badge";
import { AppButton, AppPanel, SkeletonBlock } from "@/components/ui";
import { useUserPreferences } from "@/components/settings/UserPreferencesApplier";
import { cn } from "@/lib/utils";
import { formWarningActionClass, formWarningBannerClass } from "@/components/ui/formSurface";
import {
    pageEmptyStateClass,
    pageInsetSurfaceClass,
} from "@/components/ui/pageSurface";

interface BranchHealthPanelProps {
    report: AIStructuredBranchReport | null;
    snapshot?: AIBranchReportSnapshot | null;
    branchName?: string;
    isLoading?: boolean;
    hasPendingChanges?: boolean;
    nextAllowedCallAt?: string;
    onRefresh?: () => void;
}



const riskBadgeVariant: Record<string, "danger" | "warning" | "success" | "default"> = {
    CRITICAL: "danger",
    MODERATE: "warning",
    LOW: "success",
};



const readableTextClass = "text-[color:var(--text-primary)]";

function getHealthBadge(score: string) {
    switch (score) {
        case "HEALTHY":
            return <Badge variant="success">Healthy</Badge>;
        case "LOW_RISK":
            return <Badge variant="warning">Low Risk</Badge>;
        case "MODERATE_RISK":
            return <Badge variant="warning">Moderate Risk</Badge>;
        case "CRITICAL_RISK":
            return <Badge variant="danger">Critical Risk</Badge>;
        default:
            return <Badge>Unknown</Badge>;
    }
}



type NumberFormatter = (value: number, options?: Intl.NumberFormatOptions) => string;

const currencyFormatOptions: Intl.NumberFormatOptions = {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
};

const percentFormatOptions: Intl.NumberFormatOptions = {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
};

const countdownFormatOptions: Intl.NumberFormatOptions = {
    minimumIntegerDigits: 2,
    useGrouping: false,
};

function formatCurrency(value: number, formatNumber: NumberFormatter) {
    return formatNumber(value, currencyFormatOptions);
}

function formatPercent(value: number, formatNumber: NumberFormatter) {
    return formatNumber(value / 100, percentFormatOptions);
}

function buildSummary(
    report: AIStructuredBranchReport,
    snapshot: AIBranchReportSnapshot | null | undefined,
    branchName: string | undefined,
    formatNumber: NumberFormatter
) {
    if (report.executiveSummary) return report.executiveSummary;
    if (!snapshot) return "This report highlights the branch's financial, seat utilization, and student activity signals.";

    return `${branchName ?? snapshot.branchName} is at ${formatPercent(snapshot.seats.utilizationPercent, formatNumber)} utilization with ${formatNumber(snapshot.students.active)} active students and ${formatNumber(snapshot.payments.overdueCount)} overdue payments.`;
}

function buildPriority(report: AIStructuredBranchReport, snapshot?: AIBranchReportSnapshot | null) {
    if (report.priorityFocus) return report.priorityFocus;
    if (!snapshot) return "Review the highest-risk signal first, then work through the suggested actions.";
    if (snapshot.payments.overdueCount > 0) return "Start with overdue payment follow-up.";
    if (snapshot.seats.utilizationPercent < 50) return "Review shift-level utilization and fill low-occupancy slots.";
    if (snapshot.students.inactive > snapshot.students.active) return "Re-engage inactive students before expanding capacity.";
    return "Keep monitoring the current operating rhythm.";
}

function buildFindings(
    report: AIStructuredBranchReport,
    snapshot: AIBranchReportSnapshot | null | undefined,
    formatNumber: NumberFormatter
) {
    const reportFindings = report.keyFindings?.filter(Boolean).slice(0, 3);
    if (reportFindings && reportFindings.length > 0) return reportFindings;
    if (!snapshot) return [buildPriority(report, snapshot)];

    return [
        `${formatNumber(snapshot.seats.occupied)}/${formatNumber(snapshot.seats.total)} shift slots are occupied.`,
        `${formatNumber(snapshot.students.active)} active students against ${formatNumber(snapshot.students.inactive)} inactive students.`,
        `${formatNumber(snapshot.payments.overdueCount)} overdue payments totaling ${formatCurrency(snapshot.payments.overdueAmount, formatNumber)}.`,
    ];
}

export function BranchHealthPanel({
    report,
    snapshot,
    branchName,
    isLoading,
    hasPendingChanges,
    nextAllowedCallAt,
    onRefresh,
}: BranchHealthPanelProps) {
    const t = useTranslation();
    const { formatDateTime, formatNumber } = useUserPreferences();
    const [timeLeft, setTimeLeft] = useState("");

    useEffect(() => {
        if (!nextAllowedCallAt) return;
        const target = new Date(nextAllowedCallAt).getTime();

        const interval = setInterval(() => {
            const diff = target - Date.now();
            if (diff <= 0) {
                setTimeLeft("");
                return;
            }

            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);
            setTimeLeft(`${formatNumber(minutes, countdownFormatOptions)}:${formatNumber(seconds, countdownFormatOptions)}`);
        }, 1000);

        return () => clearInterval(interval);
    }, [formatNumber, nextAllowedCallAt]);

    if (isLoading) {
        return (
            <AppPanel density="compact" title={t("Executive report")}>
                <div className="grid gap-3 md:grid-cols-3">
                    {Array.from({ length: 3 }, (_, index) => (
                        <div key={index} className="space-y-3 rounded-[var(--ui-card-radius)] border border-[color:var(--ui-card-border)] bg-[color:var(--ui-card-bg)] p-4">
                            <SkeletonBlock className="h-4 w-24" />
                            <SkeletonBlock className="h-7 w-20" />
                            <SkeletonBlock className="h-2 w-full rounded-full" />
                        </div>
                    ))}
                </div>
            </AppPanel>
        );
    }

    if (!report) {
        return (
            <AppPanel density="compact" title={t("Executive report")}>
                <div className={pageEmptyStateClass}>{t("No health report generated.")}</div>
            </AppPanel>
        );
    }

    const signals = [
        {
            label: "Financial",
            icon: CircleDollarSign,
            riskLevel: report.financialAnalysis.riskLevel,
            observation: report.financialAnalysis.observation,
        },
        {
            label: "Utilization",
            icon: Users,
            riskLevel: report.utilizationAnalysis.riskLevel,
            observation: report.utilizationAnalysis.observation,
        },
        {
            label: "Student Activity",
            icon: TrendingUp,
            riskLevel: report.studentActivityAnalysis.riskLevel,
            observation: report.studentActivityAnalysis.observation,
        },
    ];

    const findings = buildFindings(report, snapshot, formatNumber);
    const generatedTag = (
        <div className="flex flex-col items-start gap-2 sm:items-end">
            <span className={cn("flex items-center gap-2 px-3 py-1.5 text-xs", pageInsetSurfaceClass, readableTextClass)}>
                <CalendarClock className="h-3.5 w-3.5 text-[color:var(--ui-tone-info-text)]" />
                {t("Generated")} {formatDateTime(report.generatedAt)}
            </span>
            {getHealthBadge(report.healthScore)}
        </div>
    );

    return (
        <div className="space-y-4">
            {hasPendingChanges && (
                <div className={cn("flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between", formWarningBannerClass)}>
                    <div className="flex items-center gap-3">
                        <span className="h-2 w-2 shrink-0 rounded-full bg-[color:var(--ui-tone-warning-progress)]" />
                        <div>
                            <p className="text-sm font-medium">{t("New data detected")}</p>
                            <p className="text-xs opacity-80">{t("Insights are based on older data.")}</p>
                        </div>
                    </div>

                    {timeLeft ? (
                        <span className={cn("w-fit px-3 py-1.5 text-xs font-mono", pageInsetSurfaceClass)}>{t("Next refresh: {timeLeft}", { timeLeft: timeLeft })}</span>
                    ) : (
                        <AppButton
                            variant="quiet"
                            density="compact"
                            onClick={onRefresh}
                            disabled={!onRefresh}
                            className={formWarningActionClass}
                        >
                            {t("Refresh now")}</AppButton>
                    )}
                </div>
            )}

            <AppPanel density="compact" title={t("Priority focus")} action={generatedTag}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <h3 className="max-w-3xl text-lg font-semibold leading-7 text-[color:var(--text-primary)]">{buildPriority(report, snapshot)}</h3>
                </div>
                <p className={cn("mt-3 text-sm leading-6", readableTextClass)}>{buildSummary(report, snapshot, branchName, formatNumber)}</p>
                <details className="ui-context-help mt-3"><summary>{t.owned("Why this matters")}</summary>
                    <ul className="mt-2 space-y-2">{findings.map((finding, index) => <li key={`${finding}-${index}`} className="text-sm leading-5">{finding}</li>)}</ul>
                    <div className="mt-3 grid gap-3 md:grid-cols-3">{signals.map(signal => <article key={signal.label} className="border-t border-[color:var(--ui-panel-border)] py-3"><div className="flex items-center justify-between gap-2"><h4 className="text-sm font-semibold">{t.owned(signal.label)}</h4><Badge variant={riskBadgeVariant[signal.riskLevel] ?? "default"}>{t.owned(signal.riskLevel)}</Badge></div><p className="mt-2 text-sm leading-6">{signal.observation}</p></article>)}</div>
                </details>
            </AppPanel>
        </div>
    );
}
