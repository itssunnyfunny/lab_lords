"use client";

import { useEffect, useState } from "react";
import { payments, AuditLogEntry } from "@/lib/api/payments";
import { format } from "date-fns";
import { ShieldCheck, X, Loader2, AlertCircle, History } from "lucide-react";
import { createPortal } from "react-dom";
import {
    formDialogHeaderClass,
    formDialogOverlayClass,
    formDialogPanelClass,
    formErrorBannerClass,
    formHelpTextClass,
    formIconClass,
    formSurfaceClass,
} from "@/components/ui/formSurface";
import { cn } from "@/lib/utils";

const ACTION_LABEL: Record<AuditLogEntry["action"], string> = {
    PAYMENT_MARKED_PAID: "Marked as Paid",
    PAYMENT_WAIVED: "Waived",
};

const ACTION_COLOR: Record<AuditLogEntry["action"], string> = {
    PAYMENT_MARKED_PAID: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    PAYMENT_WAIVED: "text-amber-400 bg-amber-500/10 border-amber-500/20",
};

interface PaymentAuditLogProps {
    paymentId: string;
    studentName: string;
    isOpen: boolean;
    onClose: () => void;
}

export function PaymentAuditLog({
    paymentId,
    studentName,
    isOpen,
    onClose,
}: PaymentAuditLogProps) {
    const [logs, setLogs] = useState<AuditLogEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    useEffect(() => {
        if (!isOpen) return;

        queueMicrotask(() => {
            setLoading(true);
            setError(null);
        });

        payments
            .getAuditLog(paymentId)
            .then(setLogs)
            .catch(() => setError("Failed to load audit log."))
            .finally(() => setLoading(false));
    }, [isOpen, paymentId]);

    if (!isOpen || typeof document === "undefined") return null;

    const formatCurrency = (amount: number) =>
        new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: "INR",
            maximumFractionDigits: 0,
        }).format(amount);

    const content = (
        <div className="fixed inset-0 z-[100] flex items-end justify-center p-3 sm:items-center sm:p-4">
            {/* Backdrop */}
            <div className={formDialogOverlayClass} onClick={onClose} />

            {/* Panel */}
            <div className={cn("relative flex max-h-[calc(100dvh-1.5rem)] w-full max-w-md flex-col animate-in fade-in zoom-in-95 duration-200", formDialogPanelClass)}>
                {/* Header */}
                <div className={cn("flex flex-shrink-0 items-start justify-between p-4 sm:p-5", formDialogHeaderClass)}>
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-violet-500/10">
                            <History className="w-4 h-4 text-violet-400" />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-[color:var(--ui-dialog-title)]">Payment History</h2>
                            <p className={cn("mt-0.5 text-xs", formHelpTextClass)}>{studentName}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className={cn("rounded-lg p-1.5 transition-colors hover:bg-[color:var(--ui-form-surface-hover-bg)] hover:text-[color:var(--ui-table-text)]", formHelpTextClass)}
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Body */}
                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 sm:p-5">
                    {loading && (
                        <div className="flex items-center justify-center gap-2 py-10 text-sm text-[color:var(--ui-form-label)]">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Loading history...
                        </div>
                    )}

                    {error && !loading && (
                        <div className={cn("flex items-center justify-center gap-2 px-3 py-6 text-sm", formErrorBannerClass)}>
                            <AlertCircle className="w-4 h-4" />
                            {error}
                        </div>
                    )}

                    {!loading && !error && logs.length === 0 && (
                        <div className={cn("py-10 text-center text-sm", formHelpTextClass)}>
                            <ShieldCheck className="w-8 h-8 mx-auto mb-2 opacity-30" />
                            No recorded actions for this payment.
                        </div>
                    )}

                    {!loading && !error && logs.map((log) => (
                        <div
                            key={log.id}
                            className={cn("flex items-start gap-3 p-3", formSurfaceClass)}
                        >
                            <div className="mt-0.5">
                                <ShieldCheck className={cn("h-4 w-4", formIconClass)} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span
                                        className={cn(
                                            "text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border",
                                            ACTION_COLOR[log.action]
                                        )}
                                    >
                                        {ACTION_LABEL[log.action]}
                                    </span>
                                    <span className={cn("text-xs", formHelpTextClass)}>
                                        {formatCurrency(log.details.amount)}
                                    </span>
                                    {log.details.method && (
                                        <span className="rounded border border-[color:var(--ui-form-input-border)] bg-[color:var(--ui-form-input-bg)] px-1.5 py-0.5 text-xs font-medium text-[color:var(--ui-form-label)]">
                                            {log.details.method}
                                        </span>
                                    )}
                                </div>
                                <div className={cn("mt-1.5 flex items-center gap-1 text-xs", formHelpTextClass)}>
                                    <span className="truncate font-medium text-[color:var(--ui-form-label)]">
                                        {log.user.name || log.user.email}
                                    </span>
                                    <span>·</span>
                                    <span>
                                        {format(new Date(log.createdAt), "dd MMM yyyy, hh:mm a")}
                                    </span>
                                </div>
                                <div className="mt-1 flex flex-col gap-0.5 text-[10px] text-[color:var(--ui-table-subtle)]">
                                    <span>{log.details.from} → {log.details.to}</span>
                                    {log.details.referenceId && (
                                        <span className={cn("font-mono", formHelpTextClass)}>
                                            Ref: {log.details.referenceId}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );

    return createPortal(content, document.body);
}
