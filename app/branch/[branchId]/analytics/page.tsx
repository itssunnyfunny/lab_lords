"use client";

import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable } from "@/components/tables/DataTable";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Loader2 } from "lucide-react";
import { useEffect, useState, use } from "react";
import { analytics, BranchSnapshot } from "@/lib/api/analytics";
import { branches } from "@/lib/api/branches";

// Extended type for table display
interface BranchAnalyticsRow {
    id: string;
    branch: string;
    students: number;
    util: string;
    revenue: number;
    expenses: number; // Not in snapshot, placeholder
}

export default function AnalyticsPage({ params }: { params: Promise<{ branchId: string }> }) {
    const { branchId } = use(params);
    const [data, setData] = useState<BranchAnalyticsRow[]>([]);
    const [snapshot, setSnapshot] = useState<BranchSnapshot | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadAnalytics = async () => {
            try {
                // Fetch snapshot for current branch
                const [branchDetails, snap] = await Promise.all([
                    branches.getDetails(branchId),
                    analytics.getSnapshot(branchId)
                ]);

                // Transform to table row format
                // In a real comparison, we might fetch all branches of the org.
                const row: BranchAnalyticsRow = {
                    id: branchDetails.id,
                    branch: branchDetails.name,
                    students: snap.totalStudents,
                    util: `${snap.occupancyRate.toFixed(1)}%`,
                    revenue: snap.monthlyRevenue,
                    expenses: 0 // Placeholder
                };

                setData([row]);
                setSnapshot(snap);
            } catch (error) {
                console.error("Failed to load analytics", error);
            } finally {
                setLoading(false);
            }
        };
        loadAnalytics();
    }, [branchId]);

    if (loading) {
        return <div className="p-8 flex items-center justify-center text-white"><Loader2 className="animate-spin mr-2" /> Loading analytics...</div>;
    }

    return (
        <div className="p-8">
            <PageHeader
                title="Analytics & Trends"
                subtitle="Compare performance across time and branches."
                onExport={() => { }}
            />

            {/* Trends Table */}
            <div className="mb-8">
                <h2 className="text-lg font-semibold text-white mb-4">Branch Summary Trends</h2>
                <DataTable
                    data={data}
                    columns={[
                        { header: "Branch Name", accessor: "branch", className: "font-medium text-white" },
                        { header: "Total Students", accessor: "students" },
                        { header: "Seat Utilization", accessor: (item) => <Badge variant="default">{item.util}</Badge> },
                        { header: "Revenue", accessor: (item) => `₹${item.revenue.toLocaleString()}` },
                        { header: "Expenses", accessor: (item) => `₹${item.expenses.toLocaleString()}` },
                        {
                            header: "Net Profit",
                            accessor: (item) => (
                                <span className="text-emerald-400 font-bold">
                                    ₹{(item.revenue - item.expenses).toLocaleString()}
                                </span>
                            )
                        },
                    ]}
                    actions={() => null}
                />
            </div>

            {/* Shift Breakdown */}
            {snapshot?.seatDetails && (
                <div className="mb-8">
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
                                        {shift.occupancyPercent.toFixed(1)}%
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

