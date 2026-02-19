'use client';

import React from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Separator } from '@/components/ui/Separator';
import { TrendingUp, Users, DollarSign, Activity } from 'lucide-react';
import { AIStructuredBranchReport } from '@/ai/contracts/structuredReport.contract';

interface BranchHealthPanelProps {
    report: AIStructuredBranchReport | null; // Allow null for loading/empty states handled by parent or here if preferred
    isLoading?: boolean;
    hasPendingChanges?: boolean;
    nextAllowedCallAt?: string;
    onRefresh?: () => void;
}

export function BranchHealthPanel({ report, isLoading, hasPendingChanges, nextAllowedCallAt, onRefresh }: BranchHealthPanelProps) {
    if (isLoading) {
        return (
            <Card className="w-full animate-pulse h-64">
                <div className="space-y-4">
                    <div className="h-6 w-48 bg-gray-700/50 rounded"></div>
                    <div className="h-20 bg-gray-700/50 rounded"></div>
                    <div className="h-20 bg-gray-700/50 rounded"></div>
                </div>
            </Card>
        );
    }

    if (!report) {
        return (
            <Card className="w-full border-dashed border-gray-700">
                <div className="pt-6 text-center text-muted-foreground">
                    No health report generated.
                </div>
            </Card>
        )
    }

    const getHealthBadge = (score: string) => {
        switch (score) {
            case 'HEALTHY':
                return <Badge className="bg-green-500/20 text-green-400 hover:bg-green-500/30 border-green-500/50">Healthy</Badge>;
            case 'LOW_RISK':
                return <Badge className="bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 border-yellow-500/50">Low Risk</Badge>;
            case 'MODERATE_RISK':
                return <Badge className="bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 border-orange-500/50">Moderate Risk</Badge>;
            case 'CRITICAL_RISK':
                return <Badge className="bg-red-500/20 text-red-400 hover:bg-red-500/30 border-red-500/50">Critical Risk</Badge>;
            default:
                return <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/50">Unknown</Badge>;
        }
    };

    const getRiskColor = (level: string) => {
        switch (level) {
            case 'CRITICAL': return 'text-red-400';
            case 'MODERATE': return 'text-orange-400';
            default: return 'text-muted-foreground';
        }
    }

    const [timeLeft, setTimeLeft] = React.useState<string>("");

    React.useEffect(() => {
        if (!nextAllowedCallAt) return;
        const target = new Date(nextAllowedCallAt).getTime();

        const interval = setInterval(() => {
            const now = new Date().getTime();
            const diff = target - now;
            if (diff <= 0) {
                setTimeLeft("");
            } else {
                const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((diff % (1000 * 60)) / 1000);
                setTimeLeft(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [nextAllowedCallAt]);

    return (
        <div className="space-y-4">
            {/* TRUST GAP: Pending Changes Warning */}
            {hasPendingChanges && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse" />
                        <div>
                            <p className="text-yellow-200 font-medium text-sm">New data detected</p>
                            <p className="text-yellow-500/70 text-xs">Insights are based on older data.</p>
                        </div>
                    </div>

                    {timeLeft ? (
                        <div className="text-xs font-mono bg-black/30 px-3 py-1.5 rounded text-yellow-500 border border-yellow-500/20">
                            Next refresh: {timeLeft}
                        </div>
                    ) : (
                        <button
                            onClick={onRefresh}
                            className="bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-200 text-xs px-3 py-1.5 rounded transition-colors border border-yellow-500/20"
                        >
                            Refresh Now
                        </button>
                    )}
                </div>
            )}

            <Card className="w-full border-l-4 border-l-primary/50">
                <div className="flex flex-row items-center justify-between pb-6 border-b border-white/5 mb-6">
                    <div className="text-lg font-medium flex items-center gap-2 text-white">
                        <Activity className="h-5 w-5 text-primary" />
                        Branch Health Analysis
                    </div>
                    {getHealthBadge(report.healthScore)}
                </div>

                <div className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-3">
                        {/* Financial */}
                        <div className="space-y-2 p-4 bg-black/20 rounded-lg border border-white/5 hover:border-white/10 transition-colors">
                            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                                <DollarSign className="h-4 w-4" /> Financial
                            </div>
                            <p className={`text-sm ${getRiskColor(report.financialAnalysis.riskLevel)}`}>
                                {report.financialAnalysis.observation}
                            </p>
                        </div>

                        {/* Utilization */}
                        <div className="space-y-2 p-4 bg-black/20 rounded-lg border border-white/5 hover:border-white/10 transition-colors">
                            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                                <Users className="h-4 w-4" /> Utilization
                            </div>
                            <p className={`text-sm ${getRiskColor(report.utilizationAnalysis.riskLevel)}`}>
                                {report.utilizationAnalysis.observation}
                            </p>
                        </div>

                        {/* Activity */}
                        <div className="space-y-2 p-4 bg-black/20 rounded-lg border border-white/5 hover:border-white/10 transition-colors">
                            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                                <TrendingUp className="h-4 w-4" /> Activity
                            </div>
                            <p className={`text-sm ${getRiskColor(report.studentActivityAnalysis.riskLevel)}`}>
                                {report.studentActivityAnalysis.observation}
                            </p>
                        </div>
                    </div>

                    <Separator />

                    <div className="space-y-3">
                        <h4 className="text-sm font-medium text-muted-foreground">Suggested Actions</h4>
                        <ul className="space-y-2">
                            {report.suggestedActions.map((actionItem, idx) => (
                                <li key={idx} className="flex items-start gap-2 text-sm text-gray-300">
                                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
                                    {actionItem.action === 'FOLLOW_UP_OVERDUE_PAYMENTS' ? (
                                        <a
                                            href={`overdue`}
                                            className="text-primary hover:underline cursor-pointer"
                                        >
                                            {actionItem.reason}
                                        </a>
                                    ) : (
                                        <span>{actionItem.reason}</span>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="text-xs text-muted-foreground pt-2 border-t border-white/5 mt-4">
                        Generated: {new Date(report.generatedAt).toLocaleString()}
                    </div>
                </div>
            </Card>
        </div>
    );
}
