"use client";

import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable } from "@/components/tables/DataTable";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { PaymentAuditLog } from "@/components/payments/PaymentAuditLog";
import { FileText, Loader2, AlertCircle, ArrowLeft, Check, ChevronLeft, ChevronRight, History, Ban, MoreHorizontal } from "lucide-react";
import { useEffect, useState, use, useRef } from "react";
import { payments } from "@/lib/api/payments";
import { Payment } from "@prisma/client";
import { format, addMonths, subMonths } from "date-fns";
import { isOverdue } from "@/lib/utils/paymentStatus";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export default function PaymentsPage({ params }: { params: Promise<{ branchId: string }> }) {
    const { branchId } = use(params);
    const router = useRouter();

    const [currentDate, setCurrentDate] = useState(new Date());
    const [activeTab, setActiveTab] = useState<"DUE" | "PAID">("DUE");

    const [data, setData] = useState<Payment[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [newlyGenerated, setNewlyGenerated] = useState<number | null>(null);

    const [paymentToMark, setPaymentToMark] = useState<string | null>(null);
    const [marking, setMarking] = useState(false);

    const [paymentToWaive, setPaymentToWaive] = useState<string | null>(null);
    const [waiving, setWaiving] = useState(false);

    const [auditLog, setAuditLog] = useState<{ paymentId: string; studentName: string } | null>(null);

    const loadPayments = async () => {
        try {
            const monthStr = format(currentDate, "yyyy-MM");
            const res = await fetch(`/api/branches/${branchId}/payments?month=${monthStr}`, { cache: "no-store" });
            if (!res.ok) throw new Error("Failed to fetch");
            const list = await res.json();
            setData(list);
            setError(null);
        } catch (error: any) {
            console.error("Failed to load payments", error);
            setError("Failed to load payments.");
        }
    };

    const generateAndLoad = async () => {
        setLoading(true);
        setNewlyGenerated(null);
        try {
            // 1. Auto-generate all missed due payments (anchor-based, idempotent)
            const genRes = await fetch(`/api/branches/${branchId}/payments/generate`, {
                method: "POST",
                cache: "no-store",
            });
            if (genRes.ok) {
                const genData = await genRes.json();
                if (genData.generatedCount > 0) {
                    setNewlyGenerated(genData.generatedCount);
                }
            }
        } catch {
            // Silent — generation failure shouldn't block viewing existing payments
        } finally {
            // 2. Always fetch the current month's payments after generation
            await loadPayments();
            setLoading(false);
        }
    };

    useEffect(() => {
        generateAndLoad();
    }, [branchId]);

    // Re-fetch (without re-generating) when month changes
    useEffect(() => {
        if (!loading) {
            loadPayments();
        }
    }, [currentDate]);

    const handleMonthChange = (direction: "prev" | "next") => {
        setCurrentDate(prev => direction === "prev" ? subMonths(prev, 1) : addMonths(prev, 1));
    };

    const handleMarkPaid = (id: string) => {
        setPaymentToMark(id);
    };

    const confirmMarkPaid = async () => {
        if (!paymentToMark) return;
        setMarking(true);
        try {
            await payments.markAsPaid(paymentToMark);
            await loadPayments();
            setPaymentToMark(null);
        } catch (err) {
            alert("Failed to mark as paid");
        } finally {
            setMarking(false);
        }
    };

    const confirmWaive = async () => {
        if (!paymentToWaive) return;
        setWaiving(true);
        try {
            await payments.markAsWaived(paymentToWaive);
            await loadPayments();
            setPaymentToWaive(null);
        } catch (err) {
            alert("Failed to waive payment");
        } finally {
            setWaiving(false);
        }
    };

    // Filter data based on active tab
    const filteredData = data.filter(item => {
        if (activeTab === "DUE") return item.status === "DUE";
        if (activeTab === "PAID") return item.status === "PAID";
        return true;
    });

    const isCurrentMonth = (date: Date) => format(date, "yyyy-MM") === format(new Date(), "yyyy-MM");

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
        <div className="p-8 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white">Payment History</h1>
                    <p className="text-textSecondary">Track incoming revenue and pending dues.</p>
                </div>

                {/* Month Selector */}
                <div className="flex items-center gap-4 bg-surfaceHighlight/50 p-2 rounded-lg border border-white/5">
                    <Button variant="ghost" size="icon" onClick={() => handleMonthChange("prev")}>
                        <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <div className="text-center min-w-[120px]">
                        <div className="font-semibold text-white">{format(currentDate, "MMMM yyyy")}</div>
                        {isCurrentMonth(currentDate) && (
                            <div className="text-xs text-brand-400 font-medium">Current Month</div>
                        )}
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => handleMonthChange("next")}>
                        <ChevronRight className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            {/* Auto-generation banner */}
            {newlyGenerated !== null && newlyGenerated > 0 && (
                <div className="flex items-center gap-2 px-4 py-2 bg-brand-500/10 border border-brand-500/30 rounded-lg text-sm text-brand-400">
                    <FileText size={14} />
                    <span>{newlyGenerated} new due payment{newlyGenerated > 1 ? "s" : ""} generated for this billing cycle.</span>
                </div>
            )}

            {/* Tabs */}
            <div className="flex items-center gap-2 border-b border-white/10">
                <button
                    onClick={() => setActiveTab("DUE")}
                    className={cn(
                        "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
                        activeTab === "DUE"
                            ? "border-brand-500 text-brand-400"
                            : "border-transparent text-textSecondary hover:text-white"
                    )}
                >
                    Due Payments
                    {data.filter(i => i.status === "DUE").length > 0 && (
                        <span className="ml-2 bg-white/10 text-white px-2 py-0.5 rounded-full text-xs">
                            {data.filter(i => i.status === "DUE").length}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => setActiveTab("PAID")}
                    className={cn(
                        "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
                        activeTab === "PAID"
                            ? "border-green-500 text-green-400"
                            : "border-transparent text-textSecondary hover:text-white"
                    )}
                >
                    Paid History
                </button>
            </div>

            {loading ? (
                <div className="py-20 flex items-center justify-center text-white">
                    <Loader2 className="animate-spin mr-2" /> Loading payments...
                </div>
            ) : (
                <DataTable
                    data={filteredData}
                    columns={[
                        { header: "Transaction ID", accessor: (item) => <span className="font-mono text-xs text-textSecondary">#{item.id.slice(-6)}</span> },
                        {
                            header: "Student",
                            accessor: (item) => (
                                <div>
                                    <div className="text-white font-medium">{(item as any).student?.name || "Unknown"}</div>
                                    <div className="text-xs text-textSecondary">{(item as any).student?.phone}</div>
                                </div>
                            )
                        },
                        {
                            header: "Due Date",
                            accessor: (item) => {
                                const overdue = isOverdue(item.dueDate);
                                return (
                                    <div className="flex items-center gap-2">
                                        <span className={cn(overdue ? "text-red-400 font-medium" : "text-textSecondary")}>
                                            {format(new Date(item.dueDate), "PP")}
                                        </span>
                                        {overdue && (
                                            <Badge variant="danger" className="text-[10px] px-1 py-0 h-5">OVERDUE</Badge>
                                        )}
                                    </div>
                                );
                            }
                        },
                        {
                            header: "Amount",
                            accessor: (item) => (
                                <span className="font-bold text-white">
                                    {new Intl.NumberFormat('en-IN', {
                                        style: 'currency',
                                        currency: 'INR',
                                        maximumFractionDigits: 0
                                    }).format(item.amount)}
                                </span>
                            )
                        },
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
                        <div className="flex justify-end gap-2 items-center">
                            {item.status === "PAID" && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="gap-1.5 text-xs text-gray-500 hover:text-white"
                                    onClick={() =>
                                        setAuditLog({
                                            paymentId: item.id,
                                            studentName: (item as any).student?.name || "Unknown",
                                        })
                                    }
                                >
                                    <History size={13} />
                                    History
                                </Button>
                            )}

                            {item.status === "DUE" && (
                                <>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="gap-2 text-xs border-green-500/50 text-green-400 hover:bg-green-500/10"
                                        onClick={() => handleMarkPaid(item.id)}
                                    >
                                        <Check size={14} /> Mark Paid
                                    </Button>

                                    <RowDropdown onWaive={() => setPaymentToWaive(item.id)} />
                                </>
                            )}
                        </div>
                    )}
                />
            )}

            {!loading && filteredData.length === 0 && (
                <div className="text-center py-12 border border-dashed border-white/10 rounded-lg">
                    <p className="text-textSecondary">No payments found for this view.</p>
                </div>
            )}

            <ConfirmDialog
                isOpen={!!paymentToMark}
                onClose={() => setPaymentToMark(null)}
                onConfirm={confirmMarkPaid}
                title="Mark as Paid"
                description="Are you sure you want to mark this payment as PAID? This action will record the payment and update the analytics."
                confirmText="Yes, Mark Paid"
                loading={marking}
            />

            <ConfirmDialog
                isOpen={!!paymentToWaive}
                onClose={() => setPaymentToWaive(null)}
                onConfirm={confirmWaive}
                title="Waive Payment"
                description="This will mark the payment as WAIVED. The debt will be written off and excluded from analytics. This cannot be undone."
                confirmText="Yes, Waive"
                loading={waiving}
                variant="warning"
            />

            <PaymentAuditLog
                isOpen={!!auditLog}
                onClose={() => setAuditLog(null)}
                paymentId={auditLog?.paymentId ?? ""}
                studentName={auditLog?.studentName ?? ""}
            />
        </div>
    );
}

function RowDropdown({ onWaive }: { onWaive: () => void }) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={ref}>
            <Button
                variant="ghost"
                size="icon"
                onClick={() => setOpen(!open)}
                className={cn(
                    "w-8 h-8 text-gray-500 hover:text-white hover:bg-white/5 transition-colors",
                    open && "bg-white/5 text-white"
                )}
            >
                <MoreHorizontal size={16} />
            </Button>
            {open && (
                <div className="absolute right-0 mt-1 w-36 bg-[#1a1d27] border border-white/10 rounded-lg shadow-xl z-50 py-1 animate-in fade-in zoom-in-95 duration-100">
                    <button
                        onClick={() => {
                            setOpen(false);
                            onWaive();
                        }}
                        className="w-full text-left px-3 py-2 text-xs text-amber-400 hover:bg-white/5 flex items-center gap-2 transition-colors"
                    >
                        <Ban size={13} /> Waive Payment
                    </button>
                </div>
            )}
        </div>
    );
}

