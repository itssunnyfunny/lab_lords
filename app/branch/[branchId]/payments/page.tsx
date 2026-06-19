"use client";

import { DataTable } from "@/components/tables/DataTable";
import { ViewToggle } from "@/components/tables/ViewToggle";
import { Badge } from "@/components/ui/Badge";
import { AppButton, LoadingTableSkeleton, PageShell } from "@/components/ui";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { RowActionsMenu } from "@/components/ui/RowActionsMenu";
import {
    formControlClass,
    formDialogOverlayClass,
    formDialogPanelClass,
    formHelpTextClass,
    formIconClass,
    formSurfaceClass,
    formSurfaceHoverClass,
} from "@/components/ui/formSurface";
import {
    pageCountBadgeClass,
    pageDescriptionClass,
    pageEyebrowClass,
    pageErrorIconClass,
    pageErrorStateClass,
    pageFilterShellClass,
    pageGridCardClass,
    pageGridCardHoverClass,
    pageInsetMetricClass,
    pageInsetSurfaceClass,
    pageMutedTextClass,
    pageSectionDividerClass,
    pageSubtleTextClass,
    pageTitleClass,
} from "@/components/ui/pageSurface";
import { PaymentAuditLog } from "@/components/payments/PaymentAuditLog";
import { BranchAccessGuard } from "@/components/auth/BranchAccessGuard";
import { AlertCircle, ArrowLeft, Check, ChevronLeft, ChevronRight, History, Ban, MoreHorizontal, Banknote, Smartphone, Building2, X } from "lucide-react";
import { useCallback, useEffect, useState, use } from "react";
import { payments } from "@/lib/api/payments";
import type { Payment } from "@/app/generated/prisma/browser";
import { format, addMonths, subMonths } from "date-fns";
import { isOverdue } from "@/lib/utils/paymentStatus";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { createPortal } from "react-dom";
import { BRANCH_PAGE_ACCESS } from "@/lib/branchPageAccess";
import { getAnyPermissionHelpText } from "@/lib/permissionMessages";
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
                    canMarkPaid={access.permissions.mark_payment_paid}
                    canWaivePayments={access.permissions.waive_payments}
                />
            )}
        </BranchAccessGuard>
    );
}

function PaymentsContent({
    branchId,
    canMarkPaid,
    canWaivePayments,
}: {
    branchId: string;
    canMarkPaid: boolean;
    canWaivePayments: boolean;
}) {
    const router = useRouter();
    const paymentActionHelpText = getAnyPermissionHelpText(["mark_payment_paid", "waive_payments"]);

    const [currentDate, setCurrentDate] = useState(new Date());
    const [activeTab, setActiveTab] = useState<PaymentTab>("DUE");
    const [viewMode, setViewMode] = useDataViewMode();

    const [data, setData] = useState<PaymentRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

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

    const loadPagePayments = useCallback(async () => {
        setLoading(true);
        await loadPayments();
        setLoading(false);
    }, [loadPayments]);

    useEffect(() => {
        loadPagePayments();
    }, [loadPagePayments]);

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
    const dueCount = data.filter(i => i.status === "DUE").length;
    const paidCount = data.filter(i => i.status === "PAID").length;
    const waivedCount = data.filter(i => i.status === "WAIVED").length;

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
                <AppButton
                    variant="quiet"
                    size="sm"
                    icon={History}
                    className={cn("text-xs", pageSubtleTextClass)}
                    onClick={() =>
                        setAuditLog({
                            paymentId: item.id,
                            studentName: item.student?.name || "Unknown",
                        })
                    }
                >
                    History
                </AppButton>
            )}

            {item.status === "DUE" && (canMarkPaid || canWaivePayments) && (
                <>
                    {canMarkPaid && (
                        <AppButton
                            variant="secondary"
                            size="sm"
                            icon={Check}
                            className="text-xs"
                            onClick={() => handleMarkPaid(item.id)}
                        >
                            Mark paid
                        </AppButton>
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
                <AppButton variant="secondary" icon={ArrowLeft} onClick={() => router.push("/org")}>
                    Back to workspace
                </AppButton>
            </div>
        );
    }

    return (
        <PageShell>
            <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="min-w-0">
                    <p className={pageEyebrowClass}>Branch payments</p>
                    <h1 className={cn(pageTitleClass, "mt-2")}>Payment history</h1>
                    <p className={pageDescriptionClass}>
                        Review dues, record collections, and keep waived payments separate from active follow-up.
                    </p>
                </div>

                <div className={cn("flex w-full items-center justify-between gap-2 p-2 sm:w-auto sm:gap-4", pageFilterShellClass)}>
                    <AppButton variant="quiet" size="icon" onClick={() => handleMonthChange("prev")} aria-label="Previous month">
                        <ChevronLeft className="h-4 w-4" />
                    </AppButton>
                    <div className="min-w-[132px] text-center">
                        <div className="font-semibold text-[color:var(--text-primary)]">{format(currentDate, "MMMM yyyy")}</div>
                        {isCurrentMonth(currentDate) && (
                            <div className="text-xs font-medium text-[color:var(--ui-form-accent)]">Current month</div>
                        )}
                    </div>
                    <AppButton variant="quiet" size="icon" onClick={() => handleMonthChange("next")} aria-label="Next month">
                        <ChevronRight className="h-4 w-4" />
                    </AppButton>
                </div>
            </header>

            <div className={cn("flex flex-col gap-3 border-b pb-2 sm:flex-row sm:items-center sm:justify-between", pageSectionDividerClass)}>
                <div className="flex max-w-full items-center gap-2 overflow-x-auto">
                    <PaymentTabButton
                        label="Due"
                        count={dueCount}
                        active={activeTab === "DUE"}
                        tone="warning"
                        onClick={() => setActiveTab("DUE")}
                    />
                    <PaymentTabButton
                        label="Paid"
                        count={paidCount}
                        active={activeTab === "PAID"}
                        tone="success"
                        onClick={() => setActiveTab("PAID")}
                    />
                    <PaymentTabButton
                        label="Waived"
                        count={waivedCount}
                        active={activeTab === "WAIVED"}
                        tone="neutral"
                        onClick={() => setActiveTab("WAIVED")}
                    />
                </div>

                <ViewToggle value={viewMode} onChange={setViewMode} className="hidden md:inline-flex" />
            </div>

            {loading ? (
                <LoadingTableSkeleton rows={7} />
            ) : (
                <DataTable
                    data={filteredData}
                    viewMode={viewMode}
                    emptyMessage="No payments found for this view."
                    renderGridCard={(item, actions) => (
                        <div className={cn("relative flex min-h-[245px] flex-col", pageGridCardClass, pageGridCardHoverClass)}>
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className={cn("font-mono text-xs", pageSubtleTextClass)}>#{item.id.slice(-6)}</div>
                                    <div className="mt-1 truncate font-medium text-[color:var(--text-primary)]">{item.student?.name || "Unknown"}</div>
                                    <div className={cn("truncate text-xs", pageMutedTextClass)}>{item.student?.phone || "No phone"}</div>
                                </div>
                                <div className="flex-shrink-0">{renderPaymentStatus(item)}</div>
                            </div>

                            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                                <div className={pageInsetMetricClass}>
                                    <div className={cn("text-xs", pageSubtleTextClass)}>Amount</div>
                                    <div className="mt-1 truncate font-semibold text-[color:var(--text-primary)]">{formatPaymentAmount(item.amount)}</div>
                                </div>
                                <div className={pageInsetMetricClass}>
                                    <div className={cn("text-xs", pageSubtleTextClass)}>Method</div>
                                    <div className="mt-1">{renderPaymentMethod(item)}</div>
                                </div>
                            </div>

                            <div className={cn("mt-3 p-3 text-sm", pageInsetSurfaceClass)}>
                                <div className={cn("mb-1 text-xs", pageSubtleTextClass)}>Due date</div>
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
                                    <div className="font-medium text-[color:var(--text-primary)]">{item.student?.name || "Unknown"}</div>
                                    <div className={cn("text-xs", pageMutedTextClass)}>{item.student?.phone}</div>
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
                                <span className="font-semibold text-[color:var(--text-primary)]">
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
                                if (!m) return <span className={cn("text-xs", pageMutedTextClass)}>-</span>;
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
        </PageShell>
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

function PaymentTabButton({
    label,
    count,
    active,
    tone,
    onClick,
}: {
    label: string;
    count: number;
    active: boolean;
    tone: "warning" | "success" | "neutral";
    onClick: () => void;
}) {
    const activeClass = {
        warning: "border-[color:var(--ui-badge-warning-border)] bg-[color:var(--ui-badge-warning-bg)] text-[color:var(--ui-badge-warning-text)]",
        success: "border-[color:var(--ui-badge-success-border)] bg-[color:var(--ui-badge-success-bg)] text-[color:var(--ui-badge-success-text)]",
        neutral: "border-[color:var(--ui-badge-purple-border)] bg-[color:var(--ui-badge-purple-bg)] text-[color:var(--ui-badge-purple-text)]",
    }[tone];

    const dotClass = {
        warning: "bg-[color:var(--ui-tone-warning-progress)]",
        success: "bg-[color:var(--ui-tone-success-progress)]",
        neutral: "bg-[color:var(--ui-badge-purple-text)]",
    }[tone];

    return (
        <button
            type="button"
            onClick={onClick}
            aria-current={active ? "page" : undefined}
            className={cn(
                "inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-[var(--ui-radius-control)] border px-3 py-2 text-sm font-medium transition-colors",
                active
                    ? activeClass
                    : "border-transparent text-[color:var(--text-secondary)] hover:border-[color:var(--ui-form-surface-border)] hover:bg-[color:var(--ui-form-surface-hover-bg)] hover:text-[color:var(--text-primary)]"
            )}
        >
            {active && <span aria-hidden="true" className={cn("h-1.5 w-1.5 rounded-full", dotClass)} />}
            {label}
            {count > 0 && <span className={pageCountBadgeClass}>{count}</span>}
        </button>
    );
}

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
                                "flex w-full cursor-pointer items-center gap-3 rounded-[var(--ui-radius-control)] border px-4 py-3 text-left transition-all",
                                method === opt.value
                                    ? "border-[color:var(--ui-badge-success-border)] bg-[color:var(--ui-badge-success-bg)] text-[color:var(--text-primary)]"
                                    : cn("text-[color:var(--ui-form-label)]", formSurfaceClass, formSurfaceHoverClass)
                            )}
                        >
                            <span className={cn(
                                "shrink-0",
                                method === opt.value ? "text-[color:var(--ui-tone-success-text)]" : formIconClass
                            )}>
                                {opt.icon}
                            </span>
                            <span className="flex-1">
                                <span className="block text-sm font-medium">{opt.label}</span>
                                <span className={cn("block text-[11px]", formHelpTextClass)}>{opt.sublabel}</span>
                            </span>
                            {method === opt.value && (
                                <span className="h-2 w-2 shrink-0 rounded-full bg-[color:var(--ui-tone-success-progress)]" />
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
                    <AppButton variant="quiet" onClick={onClose} disabled={loading}>
                        Cancel
                    </AppButton>
                    <AppButton
                        variant="primary"
                        onClick={onConfirm}
                        isLoading={loading}
                        icon={Check}
                    >
                        Confirm payment
                    </AppButton>
                </div>
            </div>
        </div>
    );

    return createPortal(dialog, document.body);
}
