"use client";

import { KpiRow } from "@/components/snapshot/KpiRow";
import { MainChart } from "@/components/snapshot/MainChart";
import { SideStats } from "@/components/snapshot/SideStats";
import { SnapshotFooter } from "@/components/snapshot/SnapshotFooter";
import { Button } from "@/components/ui/Button";
import { Calendar, Download, Filter, Loader2 } from "lucide-react";
import { useEffect, useState, use } from "react";
import { analytics, BranchSnapshot, TrendData } from "@/lib/api/analytics";

export default function BranchSnapshotPage({ params }: { params: Promise<{ branchId: string }> }) {
    const { branchId } = use(params);
    const [snapshot, setSnapshot] = useState<BranchSnapshot | undefined>(undefined);
    const [trends, setTrends] = useState<TrendData | undefined>(undefined);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadDashboard = async () => {
            try {
                // Determine date range for trends (e.g. last 30 days)
                const to = new Date().toISOString();
                const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

                const [snapData, trendData] = await Promise.all([
                    analytics.getSnapshot(branchId),
                    analytics.getTrends(branchId, { from, to, type: "health" })
                ]);

                setSnapshot(snapData);
                setTrends(trendData);
            } catch (error) {
                console.error("Failed to load dashboard data", error);
            } finally {
                setLoading(false);
            }
        };

        loadDashboard();
    }, [branchId]);

    if (loading) {
        return <div className="p-8 flex items-center justify-center text-white"><Loader2 className="animate-spin mr-2" /> Loading dashboard...</div>;
    }

    return (
        <div className="p-8 space-y-8 fade-in text-white">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">Snapshot Dashboard</h1>
                    <p className="text-textSecondary mt-1">Real-time overview of branch performance</p>
                </div>

                <div className="flex items-center gap-3">
                    <Button variant="outline" size="sm" className="gap-2">
                        <Calendar size={16} />
                        <span>this Month</span>
                    </Button>
                    <Button variant="outline" size="icon">
                        <Filter size={18} />
                    </Button>
                    <Button variant="outline" size="icon">
                        <Download size={18} />
                    </Button>
                    <div className="w-10 h-10 rounded-full bg-indigo-500/20 border border-indigo-500/50 flex items-center justify-center">
                        <img src="https://ui-avatars.com/api/?name=Admin+User&background=random" className="rounded-full w-8 h-8" alt="User" />
                    </div>
                </div>
            </div>

            {/* KPI Cards */}
            <KpiRow snapshot={snapshot} branchId={branchId} />

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <MainChart data={trends} />
                <SideStats snapshot={snapshot} />
            </div>

            {/* Bottom Section */}
            <SnapshotFooter snapshot={snapshot} branchId={branchId} />
        </div>
    );
}

