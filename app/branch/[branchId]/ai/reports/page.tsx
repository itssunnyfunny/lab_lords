"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { AppPanel, PageShell } from "@/components/ui";
import { Badge } from "@/components/ui/Badge";
import { BranchAccessGuard } from "@/components/auth/BranchAccessGuard";
import { Loader2, AlertTriangle, CheckCircle } from "lucide-react";
import { BranchHealthPanel } from "@/components/ai/BranchHealthPanel";
import { AIStructuredBranchReport } from "@/ai/contracts/structuredReport.contract";
import { BRANCH_PAGE_ACCESS } from "@/lib/branchPageAccess";
import { cn } from "@/lib/utils";
import {
    pageGridCardClass,
    pageInsetSurfaceClass,
    pageLoadingStateClass,
    pageMutedTextClass,
    pageSubtleTextClass,
} from "@/components/ui/pageSurface";

interface AIResponse {
    report: AIStructuredBranchReport;
    meta: { generatedAt: string };
    hasPendingChanges?: boolean;
    nextAllowedCallAt?: string;
}

const riskAccentClass: Record<string, string> = {
    CRITICAL: "border-l-[color:var(--ui-tone-danger-progress)]",
    MODERATE: "border-l-[color:var(--ui-tone-warning-progress)]",
    LOW: "border-l-[color:var(--ui-tone-success-progress)]",
};

const riskBadgeVariant: Record<string, "danger" | "warning" | "success" | "default"> = {
    CRITICAL: "danger",
    MODERATE: "warning",
    LOW: "success",
};

export default function AIReportsPage() {
    const params = useParams();
    const branchId = params.branchId as string;

    return (
        <BranchAccessGuard branchId={branchId} permission={BRANCH_PAGE_ACCESS.aiReports}>
            <AIReportsContent branchId={branchId} />
        </BranchAccessGuard>
    );
}

function AIReportsContent({ branchId }: { branchId: string }) {
    const [data, setData] = useState<AIResponse | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/ai/branch/${branchId}`);
            if (!res.ok) throw new Error("Failed to fetch report");
            const json = await res.json();
            setData(json);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [branchId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    if (loading) {
        return (
            <div className={pageLoadingStateClass}>
                <Loader2 className="mr-2 animate-spin" size={20} /> Loading AI branch health...
            </div>
        );
    }

    const report = data?.report ?? null;

    const riskItems = report
        ? [
              { label: "Financial", riskLevel: report.financialAnalysis.riskLevel, observation: report.financialAnalysis.observation },
              { label: "Utilization", riskLevel: report.utilizationAnalysis.riskLevel, observation: report.utilizationAnalysis.observation },
              { label: "Student Activity", riskLevel: report.studentActivityAnalysis.riskLevel, observation: report.studentActivityAnalysis.observation },
          ]
        : [];

    return (
        <div className="p-4 md:p-8">
            <PageShell maxWidth="content">
                <PageHeader
                    title="AI Branch Health"
                    subtitle="Automated operational analysis and risk detection."
                />

                <BranchHealthPanel
                    report={report}
                    hasPendingChanges={data?.hasPendingChanges}
                    nextAllowedCallAt={data?.nextAllowedCallAt}
                    onRefresh={fetchData}
                />

                {report && (
                    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                        <AppPanel
                            title="Detected risks"
                            description="The three signals most likely to need attention."
                            contentClassName="space-y-3"
                        >
                            {riskItems.map((risk) => (
                                <article
                                    key={risk.label}
                                    className={cn(
                                        pageGridCardClass,
                                        "border-l-4",
                                        riskAccentClass[risk.riskLevel] ?? "border-l-[color:var(--ui-card-border)]"
                                    )}
                                >
                                    <div className="mb-3 flex items-start justify-between gap-3">
                                        <div className="flex items-center gap-2">
                                            <AlertTriangle size={15} className="text-[color:var(--ui-tone-warning-text)]" />
                                            <span className="text-sm font-semibold text-[color:var(--text-primary)]">
                                                {risk.label}
                                            </span>
                                        </div>
                                        <Badge variant={riskBadgeVariant[risk.riskLevel] ?? "default"}>
                                            {risk.riskLevel}
                                        </Badge>
                                    </div>
                                    <p className={cn("text-sm leading-6", pageMutedTextClass)}>{risk.observation}</p>
                                </article>
                            ))}
                        </AppPanel>

                        <AppPanel
                            title="Suggested actions"
                            description="Short next steps from the same report."
                            contentClassName="space-y-3"
                        >
                            {report.suggestedActions.length === 0 ? (
                                <div className={cn("p-4 text-sm", pageInsetSurfaceClass, pageSubtleTextClass)}>
                                    No actions required at this time.
                                </div>
                            ) : (
                                report.suggestedActions.map((actionItem, i) => (
                                    <article key={i} className={cn(pageGridCardClass, "border-l-4 border-l-[color:var(--ui-tone-success-progress)]")}>
                                        <div className="mb-2 flex items-center gap-2">
                                            <CheckCircle size={15} className="shrink-0 text-[color:var(--ui-tone-success-text)]" />
                                            <span className="text-sm font-semibold text-[color:var(--text-primary)]">
                                                {actionItem.action.replace(/_/g, " ")}
                                            </span>
                                        </div>
                                        <p className={cn("text-xs leading-5", pageMutedTextClass)}>{actionItem.reason}</p>
                                    </article>
                                ))
                            )}
                        </AppPanel>
                    </div>
                )}
            </PageShell>
        </div>
    );
}
