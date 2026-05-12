"use client";

import { DataTable } from "@/components/tables/DataTable";
import { ViewToggle } from "@/components/tables/ViewToggle";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { RowActionsMenu } from "@/components/ui/RowActionsMenu";
import {
    formControlClass,
    formDialogOverlayClass,
    formDialogPanelClass,
    formHelpTextClass,
    formIconClass,
    formSuccessBannerClass,
    formSurfaceClass,
    formSurfaceHoverClass,
    formWarningBannerClass,
} from "@/components/ui/formSurface";
import {
    pageCountBadgeClass,
    pageErrorIconClass,
    pageErrorStateClass,
    pageFilterShellClass,
    pageGridCardClass,
    pageGridCardHoverClass,
    pageInsetSurfaceClass,
    pageMutedTextClass,
    pageSectionDividerClass,
    pageSubtleTextClass,
} from "@/components/ui/pageSurface";
import { PaymentAuditLog } from "@/components/payments/PaymentAuditLog";
import { BranchAccessGuard } from "@/components/auth/BranchAccessGuard";
import { FileText, Loader2, AlertCircle, ArrowLeft, Check, ChevronLeft, ChevronRight, History, Ban, MoreHorizontal, Banknote, Smartphone, Building2, X } from "lucide-react";
import { useCallback, useEffect, useState, use } from "react";
import { payments } from "@/lib/api/payments";
import type { Payment } from "@/app/generated/prisma/browser";
import { format, addMonths, subMonths } from "date-fns";
import { isOverdue } from "@/lib/utils/paymentStatus";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { createPortal } from "react-dom";
import { BRANCH_PAGE_ACCESS } from "@/lib/branchPageAccess";
import { getAnyPermissionHelpText, getPermissionHelpText } from "@/lib/permissionMessages";
import { useDataViewMode } from "@/hooks/useDataViewMode";

type PaymentRow = Payment & {
    student?: {
        name?: string | null;
        phone?: string | null;
    } | null;
    paymentMethod?: "CASH" | "UPI" | "BANK_TRANSFER" | null;
};

type PaymentTab = "DUE" | "PAID" | "WAIVED";

export default function PaymentsPage({ params }: { params: Promise<{ branchId: string }> }) {
    const { branchId } = use(params);

    return (
        <BranchAccessGuard branchId={branchId} permission={BRANCH_PAGE_ACCESS.payments}>
            {access => (
                <PaymentsContent
                    branchId={branchId}
                    canGeneratePayments={access.permissions.generate_payments}
                    canMarkPaid={access.permissions.mark_payment_paid}
                    canWaivePayments={access.permissions.waive_payments}
                />
            )}
        </BranchAccessGuard>
    );
}

function PaymentsContent({
    branchId,
    canGeneratePayments,
    canMarkPaid,
    canWaivePayments,
}: {
    branchId: string;
    canGeneratePayments: boolean;
    canMarkPaid: boolean;
    canWaivePayments: boolean;
}) {
    const router = useRouter();
    const paymentActionHelpText = getAnyPermissionHelpText(["mark_payment_paid", "waive_payments"]);
    const paymentGenerationHelpText = getPermissionHelpText("generate_payments");

    const [currentDate, setCurrentDate] = useState(new Date());
    const [activeTab, setActiveTab] = useState<PaymentTab>("DUE");
    const [viewMode, setViewMode] = useDataViewMode();

    const [data, setData] = useState<PaymentRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [newlyGenerated, setNewlyGenerated] = useState<number | null>(null);

    const [paymentToMark, setPaymentToMark] = useState<string | null>(null);
    const [marking, setMarking] = useState(false);
    const [markMethod, setMarkMethod] = useState<"CASH" | "UPI" | "BANK_TRANSFER">("CASH");
    const [markReferenceId, setMarkReferenceId] = useState("");

    const [paymentToWaive, setPaymentToWaive] = useState<string | null>(null);
    const [waiving, setWaiving] = useState(false);

    const [auditLog, setAuditLog] = useState<{ paymentId: string; studentName: string } | null>(null);

    const loadPayments = useCallback(async () => {
        try {
            const monthStr = format(currentDate, "yyyy-MM");
            const res = await fetch(`/api/branches/${branchId}/payments?month=${monthStr}`, { cache: "no-store" });
            if (!res.ok) throw new Error("Failed to fetch");
            const list: PaymentRow[] = await res.json();
            setData(list);
            setError(null);
        } catch (error: unknown) {
            console.error("Failed to load payments", error);
            setError("Failed to load payments.");
        }
    }, [branchId, currentDate]);

    const generateAndLoad = useCallback(async () => {
        setLoading(true);
        setNewlyGenerated(null);
        try {
            if (canGeneratePayments) {
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
            }
        } catch (genErr) {
            // Log the error — generation failure shouldn't block viewing existing
            // payments, but it must NOT be silently swallowed (Bug 2 fix)
            console.error("[PAYMENT_GENERATION_FAILED]", genErr);
        } finally {
            // 2. Always fetch the current month's payments after generation
            await loadPayments();
            setLoading(false);
        }
    }, [branchId, canGeneratePayments, loadPayments]);

    useEffect(() => {
        generateAndLoad();
        // Generation is intentionally tied to branch changes, not month navigation.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [branchId]);

    // Re-fetch (without re-generating) when month changes
    useEffect(() => {
        if (!loading) {
            loadPayments();
        }
        // The loading guard intentionally prevents the initial generation pass from double-fetching.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentDate]);

    const handleMonthChange = (direction: "prev" | "next") => {
        setCurrentDate(prev => direction === "prev" ? subMonths(prev, 1) : addMonths(prev, 1));
    };

    const handleMarkPaid = (id: string) => {
        setMarkMethod("CASH");
        setMarkReferenceId("");
        setPaymentToMark(id);
    };

    const confirmMarkPaid = async () => {
        if (!paymentToMark) return;
        setMarking(true);
        try {
            await payments.markAsPaid(
                paymentToMark,
                markMethod,
                markReferenceId.trim() || undefined,
            );
            await loadPayments();
            setPaymentToMark(null);
        } catch {
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
        } catch {
            alert("Failed to waive payment");
        } finally {
            setWaiving(false);
        }
    };

    // Filter data based on active tab
    const filteredData = data.filter(item => {
        if (activeTab === "DUE") return item.status === "DUE";
        if (activeTab === "PAID") return item.status === "PAID";
        if (activeTab === "WAIVED") return item.status === "WAIVED";
        return true;
    });

    const isCurrentMonth = (date: Date) => format(date, "yyyy-MM") === format(new Date(), "yyyy-MM");

    const formatPaymentAmount = (amount: number) =>
        new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: "INR",
            maximumFractionDigits: 0,
        }).format(amount);

    const renderDueDate = (item: PaymentRow) => {
        const overdue = isOverdue(item.dueDate);

        return (
            <div className="flex flex-wrap items-center gap-2">
                <span className={cn(overdue ? "text-red-400 font-medium" : "text-textSecondary")}>
                    {format(new Date(item.dueDate), "PP")}
                </span>
                {overdue && (
                    <Badge variant="danger" className="h-5 px-1 py-0 text-[10px]">OVERDUE</Badge>
                )}
            </div>
        );
    };

    const renderPaymentStatus = (item: PaymentRow) => (
        <Badge
            variant={
                item.status === "PAID" ? "success" :
                    item.status === "DUE" ? "warning" :
                        "purple"
            }
        >
            {item.status}
        </Badge>
    );

    const renderPaymentMethod = (item: PaymentRow) => {
        const m = item.paymentMethod ?? null;
        if (!m) return <span className="text-xs text-textSecondary">-</span>;

        const map = {
            CASH: { label: "Cash", cls: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
            UPI: { label: "UPI", cls: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
            BANK_TRANSFER: { label: "Bank", cls: "text-purple-400 bg-purple-500/10 border-purple-500/20" },
        };
        const { label, cls } = map[m];

        return (
            <span className={cn("rounded border px-2 py-0.5 text-[11px] font-medium", cls)}>
                {label}
            </span>
        );
    };

    const renderPaymentActions = (item: PaymentRow) => (
        <div className="flex flex-wrap items-center justify-end gap-2">
            {(item.status === "PAID" || item.status === "WAIVED") && (
                <Button
                    variant="ghost"
                    size="sm"
                    className={cn("gap-1.5 text-xs", pageSubtleTextClass)}
                    onClick={() =>
                        setAuditLog({
                            paymentId: item.id,
                            studentName: item.student?.name || "Unknown",
                        })
                    }
                >
                    <History size={13} />
                    History
                </Button>
            )}

            {item.status === "DUE" && (canMarkPaid || canWaivePayments) && (
                <>
                    {canMarkPaid && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="gap-2 text-xs border-green-500/50 text-green-400 hover:bg-green-500/10"
                            onClick={() => handleMarkPaid(item.id)}
                        >
                            <Check size={14} /> Mark Paid
                        </Button>
                    )}

                    {canWaivePayments && (
                        <RowDropdown onWaive={() => setPaymentToWaive(item.id)} />
                    )}
                </>
            )}

            {item.status === "DUE" && !canMarkPaid && !canWaivePayments && (
                <span className={cn("max-w-[180px] text-right text-xs leading-5", pageSubtleTextClass)} title={paymentActionHelpText}>
                    {paymentActionHelpText}
                </span>
            )}
        </div>
    );

    if (error) {
        return (
            <div className={pageErrorStateClass}>
                <AlertCircle className={pageErrorIconClass} />
                <h2 className="text-xl font-semibold">Something went wrong</h2>
                <p className={pageMutedTextClass}>{error}</p>
                <Button variant="outline" onClick={() => router.push("/org")}>
                    <ArrowLeft size={16} className="mr-2" />
                    Back to Workspace
                </Button>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white">Payment History</h1>
                    <p className="text-textSecondary">Track incoming revenue and pending dues.</p>
                </div>

                {/* Month Selector */}
                <div className={cn("flex w-full items-center justify-between gap-2 p-2 sm:w-auto sm:gap-4", pageFilterShellClass)}>
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
                <div className={cn("flex items-center gap-2 px-4 py-2 text-sm", formSuccessBannerClass)}>
                    <FileText size={14} />
                    <span>{newlyGenerated} new due payment{newlyGenerated > 1 ? "s" : ""} generated for this billing cycle.</span>
                </div>
            )}

            {!canGeneratePayments && (
                <div className={cn("px-4 py-3 text-sm", formWarningBannerClass)}>
                    Automatic payment generation is disabled. {paymentGenerationHelpText}
                </div>
            )}

            {/* Tabs */}
            <div className={cn("flex flex-col gap-3 border-b pb-2 sm:flex-row sm:items-center sm:justify-between", pageSectionDividerClass)}>
                <div className="flex max-w-full items-center gap-2 overflow-x-auto">
                    <button
                        onClick={() => setActiveTab("DUE")}
                        aria-current={activeTab === "DUE" ? "page" : undefined}
                        className={cn(
                            "inline-flex items-center gap-2 rounded-t-md px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                            activeTab === "DUE"
                                ? "border-amber-500 bg-amber-500/5 text-amber-400"
                                : "border-transparent text-textSecondary hover:bg-[color:var(--ui-form-surface-hover-bg)] hover:text-white"
                        )}
                    >
                        {activeTab === "DUE" && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.65)]" />}
                        Due Payments
                        {data.filter(i => i.status === "DUE").length > 0 && (
                            <span className={pageCountBadgeClass}>
                                {data.filter(i => i.status === "DUE").length}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab("PAID")}
                        aria-current={activeTab === "PAID" ? "page" : undefined}
                        className={cn(
                            "inline-flex items-center gap-2 rounded-t-md px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                            activeTab === "PAID"
                                ? "border-green-500 bg-green-500/5 text-green-400"
                                : "border-transparent text-textSecondary hover:bg-[color:var(--ui-form-surface-hover-bg)] hover:text-white"
                        )}
                    >
                        {activeTab === "PAID" && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.65)]" />}
                        Paid History
                    </button>
                    <button
                        onClick={() => setActiveTab("WAIVED")}
                        aria-current={activeTab === "WAIVED" ? "page" : undefined}
                        className={cn(
                            "inline-flex items-center gap-2 rounded-t-md px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                            activeTab === "WAIVED"
                                ? "border-violet-500 bg-violet-500/5 text-violet-300"
                                : "border-transparent text-textSecondary hover:bg-[color:var(--ui-form-surface-hover-bg)] hover:text-white"
                        )}
                    >
                        {activeTab === "WAIVED" && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-violet-300 shadow-[0_0_8px_rgba(196,181,253,0.5)]" />}
                        Waived History
                    </button>
                </div>

                <ViewToggle value={viewMode} onChange={setViewMode} className="hidden md:inline-flex" />
            </div>

            {loading ? (
                <div className="py-20 flex items-center justify-center text-white">
                    <Loader2 className="animate-spin mr-2" /> Loading payments...
                </div>
            ) : (
                <DataTable
                    data={filteredData}
                    viewMode={viewMode}
                    emptyMessage="No payments found for this view."
                    renderGridCard={(item, actions) => (
                        <div className={cn("relative flex min-h-[245px] flex-col", pageGridCardClass, pageGridCardHoverClass)}>
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="font-mono text-xs text-textMuted">#{item.id.slice(-6)}</div>
                                    <div className="mt-1 truncate font-medium text-white">{item.student?.name || "Unknown"}</div>
                                    <div className="truncate text-xs text-textSecondary">{item.student?.phone || "No phone"}</div>
                                </div>
                                <div className="flex-shrink-0">{renderPaymentStatus(item)}</div>
                            </div>

                            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                                <div className={cn("p-3", pageInsetSurfaceClass)}>
                                    <div className="text-xs text-textMuted">Amount</div>
                                    <div className="mt-1 truncate font-bold text-white">{formatPaymentAmount(item.amount)}</div>
                                </div>
                                <div className={cn("p-3", pageInsetSurfaceClass)}>
                                    <div className="text-xs text-textMuted">Method</div>
                                    <div className="mt-1">{renderPaymentMethod(item)}</div>
                                </div>
                            </div>

                            <div className={cn("mt-3 p-3 text-sm", pageInsetSurfaceClass)}>
                                <div className="mb-1 text-xs text-textMuted">Due Date</div>
                                {renderDueDate(item)}
                            </div>

                            <div className={cn("mt-auto border-t pt-4", pageSectionDividerClass)}>
                                {actions?.(item)}
                            </div>
                        </div>
                    )}
                    columns={[
                        { header: "Transaction ID", accessor: (item) => <span className="font-mono text-xs text-textSecondary">#{item.id.slice(-6)}</span> },
                        {
                            header: "Student",
                            accessor: (item) => (
                                <div>
                                    <div className="text-white font-medium">{item.student?.name || "Unknown"}</div>
                                    <div className="text-xs text-textSecondary">{item.student?.phone}</div>
                                </div>
                            )
                        },
                        {
                            header: "Due Date",
                            accessor: renderDueDate
                        },
                        {
                            header: "Amount",
                            accessor: (item) => (
                                <span className="font-bold text-white">
                                    {formatPaymentAmount(item.amount)}
                                </span>
                            )
                        },
                        {
                            header: "Status",
                            accessor: renderPaymentStatus
                        },
                        {
                            header: "Method",
                            accessor: (item) => {
                                const m = item.paymentMethod ?? null;
                                if (!m) return <span className="text-textSecondary text-xs">—</span>;
                                const map = {
                                    CASH: { label: "Cash", cls: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
                                    UPI:  { label: "UPI",  cls: "text-blue-400  bg-blue-500/10  border-blue-500/20"  },
                                    BANK_TRANSFER: { label: "Bank", cls: "text-purple-400 bg-purple-500/10 border-purple-500/20" },
                                };
                                const { label, cls } = map[m];
                                return (
                                    <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded border", cls)}>
                                        {label}
                                    </span>
                                );
                            }
                        },
                    ]}
                    actions={renderPaymentActions}
                />
            )}

            <MarkPaidDialog
                isOpen={!!paymentToMark}
                onClose={() => setPaymentToMark(null)}
                onConfirm={confirmMarkPaid}
                loading={marking}
                method={markMethod}
                onMethodChange={setMarkMethod}
                referenceId={markReferenceId}
                onReferenceIdChange={setMarkReferenceId}
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
    return (
        <RowActionsMenu
            buttonIcon={MoreHorizontal}
            buttonClassName="hover:bg-[color:var(--ui-form-surface-hover-bg)]"
            menuWidthClassName="w-40"
            actions={[
                {
                    label: "Waive Payment",
                    icon: Ban,
                    variant: "warning",
                    onClick: onWaive,
                },
            ]}
        />
    );
}

// ─── Mark Paid Dialog ─────────────────────────────────────────────────────────

type PayMethod = "CASH" | "UPI" | "BANK_TRANSFER";

interface MarkPaidDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    loading: boolean;
    method: PayMethod;
    onMethodChange: (m: PayMethod) => void;
    referenceId: string;
    onReferenceIdChange: (v: string) => void;
}

const METHOD_OPTIONS: { value: PayMethod; label: string; sublabel: string; icon: React.ReactNode }[] = [
    { value: "CASH",          label: "Cash",          sublabel: "Physical handover",  icon: <Banknote  size={16} /> },
    { value: "UPI",           label: "UPI",           sublabel: "Add txn ID below",  icon: <Smartphone size={16} /> },
    { value: "BANK_TRANSFER", label: "Bank Transfer",  sublabel: "Add ref ID below",  icon: <Building2  size={16} /> },
];

function MarkPaidDialog({
    isOpen, onClose, onConfirm, loading,
    method, onMethodChange,
    referenceId, onReferenceIdChange,
}: MarkPaidDialogProps) {
    if (!isOpen || typeof document === "undefined") return null;

    const needsRef = method === "UPI" || method === "BANK_TRANSFER";

    const dialog = (
        <div className="fixed inset-0 z-[100] flex items-end justify-center p-3 sm:items-center sm:p-4">
            {/* Backdrop */}
            <div className={formDialogOverlayClass} onClick={!loading ? onClose : undefined} />

            {/* Panel */}
            <div className={cn("relative max-h-[calc(100dvh-1.5rem)] w-full max-w-sm space-y-5 overflow-y-auto p-4 animate-in fade-in zoom-in-95 duration-200 sm:p-6", formDialogPanelClass)}>
                {/* Header */}
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-green-500/10">
                            <Check size={18} className="text-green-400" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-[color:var(--ui-dialog-title)]">Mark as Paid</h2>
                            <p className={cn("mt-0.5 text-xs", formHelpTextClass)}>Select the payment method used</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={loading}
                        className={cn("transition-colors hover:text-[color:var(--ui-table-text)]", formHelpTextClass)}
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Method selector */}
                <div className="space-y-2">
                    {METHOD_OPTIONS.map((opt) => (
                        <button
                            key={opt.value}
                            onClick={() => onMethodChange(opt.value)}
                            className={cn(
                                "w-full flex items-center gap-3 rounded-[var(--ui-radius-control)] border px-4 py-3 text-left transition-all",
                                method === opt.value
                                    ? "border-green-500/50 bg-green-500/10 text-white"
                                    : cn("text-[color:var(--ui-form-label)]", formSurfaceClass, formSurfaceHoverClass)
                            )}
                        >
                            <span className={cn(
                                "shrink-0",
                                method === opt.value ? "text-green-400" : formIconClass
                            )}>
                                {opt.icon}
                            </span>
                            <span className="flex-1">
                                <span className="block text-sm font-medium">{opt.label}</span>
                                <span className={cn("block text-[11px]", formHelpTextClass)}>{opt.sublabel}</span>
                            </span>
                            {method === opt.value && (
                                <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
                            )}
                        </button>
                    ))}
                </div>

                {/* Reference ID input */}
                <div className={cn(
                    "overflow-hidden transition-all duration-200",
                    needsRef ? "max-h-20 opacity-100" : "max-h-0 opacity-0"
                )}>
                    <input
                        type="text"
                        value={referenceId}
                        onChange={(e) => onReferenceIdChange(e.target.value)}
                        placeholder={method === "UPI" ? "UPI Transaction ID (optional)" : "Bank Reference ID (optional)"}
                        className={cn(formControlClass, "px-3 py-2.5 text-sm focus:border-green-500/50")}
                    />
                </div>

                {/* Footer */}
                <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:justify-end">
                    <Button variant="ghost" onClick={onClose} disabled={loading}>
                        Cancel
                    </Button>
                    <Button
                        variant="cyan"
                        onClick={onConfirm}
                        isLoading={loading}
                        className="bg-green-600 hover:bg-green-500 text-white border-green-500"
                    >
                        <Check size={14} className="mr-1.5" /> Confirm Payment
                    </Button>
                </div>
            </div>
        </div>
    );

    return createPortal(dialog, document.body);
}
