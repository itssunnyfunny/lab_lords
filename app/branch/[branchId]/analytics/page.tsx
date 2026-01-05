"use client";

import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable } from "@/components/tables/DataTable";
import { Badge } from "@/components/ui/Badge";
import { MOCK_BRANCH_ANALYTICS } from "@/lib/mock-data";

export default function AnalyticsPage() {
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
                    data={MOCK_BRANCH_ANALYTICS}
                    columns={[
                        { header: "Branch Name", accessor: "branch", className: "font-medium text-white" },
                        { header: "Total Students", accessor: "students" },
                        { header: "Seat Utilization", accessor: (item) => <Badge variant="primary">{item.util}</Badge> },
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
                />
            </div>
        </div>
    );
}
