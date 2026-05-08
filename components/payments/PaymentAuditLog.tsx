"use client";

import { useEffect, useState } from "react";
import { payments, AuditLogEntry } from "@/lib/api/payments";
import { format } from "date-fns";
import { ShieldCheck, X, Loader2, AlertCircle, History } from "lucide-react";
import { createPortal } from "react-dom";
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
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Panel */}
            <div className="relative flex max-h-[calc(100dvh-1.5rem)] w-full max-w-md flex-col overflow-hidden bg-[#0f111a] border border-white/10 rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex flex-shrink-0 items-start justify-between p-4 border-b border-white/10 sm:p-5">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-violet-500/10">
                            <History className="w-4 h-4 text-violet-400" />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-white">Payment History</h2>
                            <p className="text-xs text-gray-500 mt-0.5">{studentName}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-white/5 text-gray-500 hover:text-white transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Body */}
                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 sm:p-5">
                    {loading && (
                        <div className="flex items-center justify-center py-10 gap-2 text-gray-400 text-sm">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Loading history...
                        </div>
                    )}

                    {error && !loading && (
                        <div className="flex items-center gap-2 text-rose-400 text-sm py-6 justify-center">
                            <AlertCircle className="w-4 h-4" />
                            {error}
                        </div>
                    )}

                    {!loading && !error && logs.length === 0 && (
                        <div className="text-center py-10 text-gray-500 text-sm">
                            <ShieldCheck className="w-8 h-8 mx-auto mb-2 opacity-30" />
                            No recorded actions for this payment.
                        </div>
                    )}

                    {!loading && !error && logs.map((log) => (
                        <div
                            key={log.id}
                            className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5"
                        >
                            <div className="mt-0.5">
                                <ShieldCheck className="w-4 h-4 text-gray-500" />
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
                                    <span className="text-xs text-gray-500">
                                        {formatCurrency(log.details.amount)}
                                    </span>
                                    {log.details.method && (
                                        <span className="text-xs font-medium text-gray-400 bg-white/5 px-1.5 py-0.5 rounded border border-white/10">
                                            {log.details.method}
                                        </span>
                                    )}
                                </div>
                                <div className="mt-1.5 flex items-center gap-1 text-xs text-gray-500">
                                    <span className="text-gray-400 font-medium truncate">
                                        {log.user.name || log.user.email}
                                    </span>
                                    <span>·</span>
                                    <span>
                                        {format(new Date(log.createdAt), "dd MMM yyyy, hh:mm a")}
                                    </span>
                                </div>
                                <div className="mt-1 text-[10px] text-gray-600 flex flex-col gap-0.5">
                                    <span>{log.details.from} → {log.details.to}</span>
                                    {log.details.referenceId && (
                                        <span className="text-gray-500 font-mono">
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
