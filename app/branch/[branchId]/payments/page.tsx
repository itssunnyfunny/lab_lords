"use client";

import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable } from "@/components/tables/DataTable";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { MOCK_PAYMENTS } from "@/lib/mock-data";
import { Eye, FileText, MoreHorizontal } from "lucide-react";

export default function PaymentsPage() {
    return (
        <div className="p-8">
            <PageHeader
                title="Payment History"
                subtitle="Track incoming revenue and pending dues."
                onSearch={() => { }}
                onFilter={() => { }}
                onExport={() => { }}
                onAdd={() => { }}
                actionLabel="Record Payment"
            />

            <DataTable
                data={MOCK_PAYMENTS}
                columns={[
                    { header: "Transaction ID", accessor: (item) => <span className="font-mono text-xs text-textSecondary">#{item.id}</span> },
                    { header: "Student", accessor: "student" },
                    { header: "Date", accessor: "date" },
                    { header: "Amount", accessor: (item) => <span className="font-bold text-white">${item.amount}</span> },
                    { header: "Method", accessor: "method" },
                    {
                        header: "Status",
                        accessor: (item) => (
                            <Badge
                                variant={
                                    item.status === "Paid" ? "success" :
                                        item.status === "Pending" ? "warning" :
                                            "danger"
                                }
                            >
                                {item.status}
                            </Badge>
                        )
                    },
                ]}
                actions={() => (
                    <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" className="gap-2 text-xs">
                            <FileText size={14} /> Invoice
                        </Button>
                    </div>
                )}
            />
        </div>
    );
}
