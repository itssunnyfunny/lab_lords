"use client";

import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable } from "@/components/tables/DataTable";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FileText, Loader2, AlertCircle, ArrowLeft, Check } from "lucide-react";
import { useEffect, useState, use } from "react";
import { payments } from "@/lib/api/payments";
import { Payment } from "@prisma/client";
import { format } from "date-fns";
import { useRouter } from "next/navigation";

export default function PaymentsPage({ params }: { params: Promise<{ branchId: string }> }) {
    const { branchId } = use(params);
    const router = useRouter();
    const [data, setData] = useState<Payment[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadPayments = async () => {
            try {
                const list = await payments.list(branchId);
                setData(list);
            } catch (error: any) {
                console.error("Failed to load payments", error);
                if (error.message?.includes("Branch not found") || error.response?.status === 404) {
                    setError("Branch not found.");
                } else {
                    setError("Failed to load payments.");
                }
            } finally {
                setLoading(false);
            }
        };
        loadPayments();
    }, [branchId]);

    if (loading) {
        return <div className="p-8 flex items-center justify-center text-white"><Loader2 className="animate-spin mr-2" /> Loading payments...</div>;
    }

    if (error) {
        return (
            <div className="p-8 flex flex-col items-center justify-center text-white h-[50vh] space-y-4">
                <AlertCircle className="w-12 h-12 text-red-400 opacity-80" />
                <h2 className="text-xl font-semibold">Something went wrong</h2>
                <p className="text-gray-400">{error}</p>
                <Button variant="outline" onClick={() => router.push("/org")}>
                    <ArrowLeft size={16} className="mr-2" />
                    Back to Workspace
                </Button>
            </div>
        );
    }

    return (
        <div className="p-8">
            <PageHeader
                title="Payment History"
                subtitle="Track incoming revenue and pending dues."
                onSearch={() => { }}
                onFilter={() => { }}
                onExport={() => { }}
            />

            <DataTable
                data={data}
                columns={[
                    { header: "Transaction ID", accessor: (item) => <span className="font-mono text-xs text-textSecondary">#{item.id.slice(-6)}</span> },
                    { header: "Student", accessor: (item) => (item as any).student?.name || "Unknown" }, // Assuming API expands student
                    { header: "Due Date", accessor: (item) => format(new Date(item.dueDate), "PP") },
                    { header: "Amount", accessor: (item) => <span className="font-bold text-white">${item.amount}</span> },
                    { header: "Method", accessor: () => "Manual" }, // Mocking method as schema doesn't have it yet (only status)
                    {
                        header: "Status",
                        accessor: (item) => (
                            <Badge
                                variant={
                                    item.status === "PAID" ? "success" :
                                        item.status === "DUE" ? "warning" :
                                            "danger"
                                }
                            >
                                {item.status}
                            </Badge>
                        )
                    },
                ]}
                actions={(item) => (
                    <div className="flex justify-end gap-2">
                        {item.status === "DUE" && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-2 text-xs border-green-500/50 text-green-400 hover:bg-green-500/10"
                                onClick={async () => {
                                    if (confirm("Are you sure you want to mark this as PAID?")) {
                                        try {
                                            await payments.markAsPaid(item.id);
                                            // Refresh data
                                            const list = await payments.list(branchId);
                                            setData(list);
                                        } catch (err) {
                                            alert("Failed to mark as paid");
                                        }
                                    }
                                }}
                            >
                                <Check size={14} /> Mark Paid
                            </Button>
                        )}
                        <Button variant="ghost" size="sm" className="gap-2 text-xs">
                            <FileText size={14} /> Invoice
                        </Button>
                    </div>
                )}
            />
        </div>
    );
}

