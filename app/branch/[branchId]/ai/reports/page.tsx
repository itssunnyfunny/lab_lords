"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Loader2, AlertTriangle, CheckCircle } from "lucide-react";
import { BranchHealthPanel } from "@/components/ai/BranchHealthPanel";
import { AIStructuredBranchReport } from "@/ai/contracts/structuredReport.contract";

interface AIResponse {
    report: AIStructuredBranchReport;
    meta: { generatedAt: string };
    hasPendingChanges?: boolean;
    nextAllowedCallAt?: string;
}

const RISK_COLOR: Record<string, string> = {
    CRITICAL: "border-l-red-500",
    MODERATE: "border-l-orange-500",
    LOW: "border-l-green-500",
};

const RISK_LABEL_COLOR: Record<string, string> = {
    CRITICAL: "text-red-400 bg-red-500/10",
    MODERATE: "text-orange-400 bg-orange-500/10",
    LOW: "text-green-400 bg-green-500/10",
};

export default function AIReportsPage() {
    const params = useParams();
    const branchId = params.branchId as string;

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
            <div className="flex h-96 items-center justify-center">
                <Loader2 className="animate-spin text-primary" size={32} />
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
        <div className="p-8 h-full flex flex-col space-y-10">
            <PageHeader
                title="AI Branch Health"
                subtitle="Automated operational analysis and risk detection."
            />

            {/* Branch Health Analysis */}
            <div className="max-w-5xl mx-auto w-full">
                <BranchHealthPanel
                    report={report}
                    hasPendingChanges={data?.hasPendingChanges}
                    nextAllowedCallAt={data?.nextAllowedCallAt}
                    onRefresh={fetchData}
                />
            </div>

            {report && (
                <div className="max-w-5xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Detected Risks */}
                    <div className="space-y-4">
                        <h3 className="text-xl font-bold text-white flex items-center gap-2">
                            <AlertTriangle size={18} className="text-red-400" />
                            Detected Risks
                        </h3>
                        {riskItems.map((risk, i) => (
                            <Card key={i} className={`p-5 border-l-4 ${RISK_COLOR[risk.riskLevel] ?? "border-l-gray-500"}`}>
                                <div className="flex justify-between items-start mb-2">
                                    <span className="font-mono text-xs px-2 py-1 rounded bg-white/5 text-gray-300">
                                        {risk.label}
                                    </span>
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${RISK_LABEL_COLOR[risk.riskLevel] ?? "text-gray-400 bg-gray-500/10"}`}>
                                        {risk.riskLevel}
                                    </span>
                                </div>
                                <p className="text-textSecondary text-sm">{risk.observation}</p>
                            </Card>
                        ))}
                    </div>

                    {/* Suggested Actions */}
                    <div className="space-y-4">
                        <h3 className="text-xl font-bold text-white flex items-center gap-2">
                            <CheckCircle size={18} className="text-green-400" />
                            Suggested Actions
                        </h3>
                        {report.suggestedActions.length === 0 ? (
                            <div className="p-6 border border-border rounded-lg text-textMuted bg-card/30">
                                No actions required at this time.
                            </div>
                        ) : (
                            report.suggestedActions.map((actionItem, i) => (
                                <Card key={i} className="p-5 border-l-4 border-l-green-500">
                                    <div className="flex items-center gap-2 mb-2">
                                        <CheckCircle size={14} className="text-green-500 flex-shrink-0" />
                                        <span className="font-semibold text-white text-sm">
                                            {actionItem.action.replace(/_/g, " ")}
                                        </span>
                                    </div>
                                    <p className="text-textSecondary text-xs">{actionItem.reason}</p>
                                </Card>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
