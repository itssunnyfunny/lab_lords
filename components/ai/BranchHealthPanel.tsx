"use client";

import { useEffect, useState } from "react";
import { Activity, DollarSign, TrendingUp, Users } from "lucide-react";
import { AIStructuredBranchReport } from "@/ai/contracts/structuredReport.contract";
import { Badge } from "@/components/ui/Badge";
import { AppButton, AppPanel, SkeletonBlock } from "@/components/ui";
import { cn } from "@/lib/utils";
import { formWarningActionClass, formWarningBannerClass } from "@/components/ui/formSurface";
import {
    pageEmptyStateClass,
    pageGridCardClass,
    pageInsetSurfaceClass,
    pageSubtleTextClass,
} from "@/components/ui/pageSurface";

interface BranchHealthPanelProps {
    report: AIStructuredBranchReport | null;
    isLoading?: boolean;
    hasPendingChanges?: boolean;
    nextAllowedCallAt?: string;
    onRefresh?: () => void;
}

const riskTextClass: Record<string, string> = {
    CRITICAL: "text-[color:var(--ui-tone-danger-text)]",
    MODERATE: "text-[color:var(--ui-tone-warning-text)]",
    LOW: "text-[color:var(--ui-tone-success-text)]",
};

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

export function BranchHealthPanel({
    report,
    isLoading,
    hasPendingChanges,
    nextAllowedCallAt,
    onRefresh,
}: BranchHealthPanelProps) {
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
            setTimeLeft(`${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`);
        }, 1000);

        return () => clearInterval(interval);
    }, [nextAllowedCallAt]);

    if (isLoading) {
        return (
            <AppPanel title="Branch health analysis">
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
            <AppPanel title="Branch health analysis">
                <div className={pageEmptyStateClass}>No health report generated.</div>
            </AppPanel>
        );
    }

    const signals = [
        {
            label: "Financial",
            icon: DollarSign,
            riskLevel: report.financialAnalysis.riskLevel,
        },
        {
            label: "Utilization",
            icon: Users,
            riskLevel: report.utilizationAnalysis.riskLevel,
        },
        {
            label: "Activity",
            icon: TrendingUp,
            riskLevel: report.studentActivityAnalysis.riskLevel,
        },
    ];

    return (
        <div className="space-y-4">
            {hasPendingChanges && (
                <div className={cn("flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between", formWarningBannerClass)}>
                    <div className="flex items-center gap-3">
                        <span className="h-2 w-2 shrink-0 rounded-full bg-[color:var(--ui-tone-warning-progress)]" />
                        <div>
                            <p className="text-sm font-medium">New data detected</p>
                            <p className="text-xs opacity-80">Insights are based on older data.</p>
                        </div>
                    </div>

                    {timeLeft ? (
                        <span className={cn("w-fit px-3 py-1.5 text-xs font-mono", pageInsetSurfaceClass)}>
                            Next refresh: {timeLeft}
                        </span>
                    ) : (
                        <AppButton
                            variant="quiet"
                            size="sm"
                            onClick={onRefresh}
                            disabled={!onRefresh}
                            className={formWarningActionClass}
                        >
                            Refresh now
                        </AppButton>
                    )}
                </div>
            )}

            <AppPanel
                title="Branch health analysis"
                description="A compact read of financial health, seat usage, and student activity."
                action={getHealthBadge(report.healthScore)}
            >
                <div className="grid gap-3 md:grid-cols-3">
                    {signals.map((signal) => {
                        const Icon = signal.icon;

                        return (
                            <article key={signal.label} className={cn(pageGridCardClass, "flex items-center justify-between gap-3")}>
                                <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-[color:var(--text-primary)]">
                                    <Icon className="h-4 w-4 shrink-0 text-[color:var(--ui-tone-info-text)]" />
                                    <span className="truncate">{signal.label}</span>
                                </div>
                                <span className={cn("shrink-0 text-xs font-semibold", riskTextClass[signal.riskLevel] ?? pageSubtleTextClass)}>
                                    {signal.riskLevel}
                                </span>
                            </article>
                        );
                    })}
                </div>

                <div className={cn("mt-4 px-3 py-2 text-xs", pageInsetSurfaceClass, pageSubtleTextClass)}>
                    <Activity className="mr-2 inline h-3.5 w-3.5" />
                    Generated: {new Date(report.generatedAt).toLocaleString()}
                </div>
            </AppPanel>
        </div>
    );
}
