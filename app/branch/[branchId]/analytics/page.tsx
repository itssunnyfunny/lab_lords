"use client";

import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable } from "@/components/tables/DataTable";
import { Badge } from "@/components/ui/Badge";
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
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadAnalytics = async () => {
            try {
                // Fetch snapshot for current branch
                const [branchDetails, snapshot] = await Promise.all([
                    branches.getDetails(branchId),
                    analytics.getSnapshot(branchId)
                ]);

                // Transform to table row format
                // In a real comparison, we might fetch all branches of the org.
                const row: BranchAnalyticsRow = {
                    id: branchDetails.id,
                    branch: branchDetails.name,
                    students: snapshot.totalStudents,
                    util: `${snapshot.occupancyRate.toFixed(1)}%`,
                    revenue: snapshot.monthlyRevenue,
                    expenses: 0 // Placeholder
                };

                setData([row]);
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
                        { header: "Revenue", accessor: (item) => `$${item.revenue.toLocaleString()}` },
                        { header: "Expenses", accessor: (item) => `$${item.expenses.toLocaleString()}` },
                        {
                            header: "Net Profit",
                            accessor: (item) => (
                                <span className="text-emerald-400 font-bold">
                                    ${(item.revenue - item.expenses).toLocaleString()}
                                </span>
                            )
                        },
                    ]}
                    actions={() => null}
                />
            </div>
        </div>
    );
}

