"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { AlertTriangle, CheckCircle, Info, Loader2 } from "lucide-react";

interface AIResponse {
    health: { summary: string };
    risks: { items: Array<{ type: string; severity: string; explanation: string }> };
    actions: { items: Array<{ action: string; reason: string }> };
}

export default function AIInsightsPage() {
    const params = useParams();
    const branchId = params.branchId as string;

    const [data, setData] = useState<AIResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        async function fetchData() {
            try {
                const res = await fetch(`/api/ai/branch/${branchId}`);

                if (!res.ok) {
                    throw new Error("Failed to fetch insights");
                }

                const json = await res.json();
                setData(json);
            } catch {
                setError("Could not load insights. Please try again.");
            } finally {
                setLoading(false);
            }
        }
        if (branchId) {
            fetchData();
        }
    }, [branchId]);

    if (loading) {
        return (
            <div className="flex h-96 items-center justify-center">
                <Loader2 className="animate-spin text-primary" size={32} />
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-8 text-center text-red-400">
                <AlertTriangle className="mx-auto mb-2" size={32} />
                {error}
            </div>
        );
    }

    if (!data) {
        return (
            <div className="p-8 text-center text-textMuted">
                No data received from API.
            </div>
        );
    }

    return (
        <div className="p-8 space-y-8">
            <PageHeader
                title="Smart Insights"
                subtitle="AI-driven analysis of your branch health."
            />

            {/* Health Summary Section */}
            <Card className="p-6 border-l-4 border-l-primary bg-card/50">
                <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                    <Info size={20} className="text-primary" />
                    Branch Health Summary
                </h3>
                <p className="text-textSecondary leading-relaxed">
                    {data.health?.summary || "No summary available."}
                </p>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Risks Column */}
                <div className="space-y-4">
                    <h3 className="text-xl font-bold text-white mb-4">Detected Risks</h3>
                    {(!data.risks?.items || data.risks.items.length === 0) ? (
                        <div className="p-6 border border-border rounded-lg text-textMuted bg-card/30">
                            No major risks detected.
                        </div>
                    ) : (
                        data.risks.items.map((risk, i) => (
                            <Card key={i} className="p-5 border-l-4 border-l-red-500">
                                <div className="flex justify-between items-start mb-2">
                                    <span className="font-mono text-xs px-2 py-1 rounded bg-red-500/10 text-red-400">
                                        {risk.type}
                                    </span>
                                    <span className={`text-xs font-bold ${risk.severity === 'HIGH' ? 'text-red-500' : 'text-yellow-500'}`}>
                                        {risk.severity}
                                    </span>
                                </div>
                                <p className="text-textSecondary text-sm">{risk.explanation}</p>
                            </Card>
                        ))
                    )}
                </div>

                {/* Actions Column */}
                <div className="space-y-4">
                    <h3 className="text-xl font-bold text-white mb-4">Suggested Actions</h3>
                    {data.actions.items.length === 0 ? (
                        <div className="p-6 border border-border rounded-lg text-textMuted bg-card/30">
                            No actions required at this time.
                        </div>
                    ) : (
                        data.actions.items.map((action, i) => (
                            <Card key={i} className="p-5 border-l-4 border-l-green-500">
                                <div className="flex items-center gap-2 mb-2">
                                    <CheckCircle size={16} className="text-green-500" />
                                    <span className="font-semibold text-white text-sm">
                                        {action.action.replace(/_/g, " ")}
                                    </span>
                                </div>
                                <p className="text-textSecondary text-xs">{action.reason}</p>
                            </Card>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
