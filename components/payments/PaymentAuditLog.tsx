"use client";
import { LocalizedError, OwnedLabel } from "@/components/settings/LocalizedText";
import { useTranslation } from "@/components/settings/LocalizedText";

import { useEffect, useState } from "react";
import { payments, AuditLogEntry } from "@/lib/api/payments";
import { ShieldCheck, AlertCircle, History } from "lucide-react";
import { AppButton, Dialog, SkeletonBlock } from "@/components/ui";
import { Badge } from "@/components/ui/Badge";
import { useUserPreferences } from "@/components/settings/UserPreferencesApplier";
import {
    formErrorBannerClass,
    formHelpTextClass,
    formIconClass,
    formSurfaceClass,
} from "@/components/ui/formSurface";
import { cn } from "@/lib/utils";

const ACTION_LABEL: Record<AuditLogEntry["action"], string> = {
    PAYMENT_MARKED_PAID: "Marked as Paid",
    PAYMENT_WAIVED: "Waived",
    FEE_COLLECTED: "Fee collected",
    FEE_COLLECTION_VOIDED: "Collection voided",
};

const ACTION_TONE: Record<AuditLogEntry["action"], "success" | "warning" | "danger"> = {
    PAYMENT_MARKED_PAID: "success",
    PAYMENT_WAIVED: "warning",
    FEE_COLLECTED: "success",
    FEE_COLLECTION_VOIDED: "danger",
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
    const t = useTranslation();
    const { formatDateTime, formatNumber } = useUserPreferences();
    const [logs, setLogs] = useState<AuditLogEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);
    useEffect(() => {
        if (!isOpen) return;
        let active = true;

        queueMicrotask(() => {
            if (!active) return;
            setLoading(true);
            setError(null);
            setLogs([]);
        });

        payments
            .getAuditLog(paymentId)
            .then(entries => { if (active) setLogs(entries); })
            .catch(() => { if (active) setError("Failed to load audit log."); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [isOpen, paymentId, refreshKey]);

    const formatCurrency = (amount: number) =>
        formatNumber(amount, {
            style: "currency",
            currency: "INR",
            maximumFractionDigits: 0,
        });

    return (
        <Dialog
            open={isOpen}
            density="compact"
            languagePlacement="header"
            onClose={onClose}
            title={t("Payment history")}
            description={studentName}
            closeLabel={t("Close payment history")}
            className="max-w-lg"
            icon={(
                <div className="rounded-full bg-[color:var(--ui-dialog-icon-info-bg)] p-2">
                    <History className="h-4 w-4 text-[color:var(--ui-dialog-icon-info-text)]" aria-hidden="true" />
                </div>
            )}
        >
                <div className="space-y-3">
                    {loading && (
                        <div role="status" aria-live="polite" className="space-y-3">
                            <span className="sr-only">{t("Loading payment history")}</span>
                            {Array.from({ length: 3 }, (_, index) => (
                                <div key={index} className={cn("flex items-start gap-3 p-3", formSurfaceClass)}>
                                    <SkeletonBlock className="h-8 w-8 rounded-full" />
                                    <div className="min-w-0 flex-1 space-y-2">
                                        <div className="flex items-center gap-2">
                                            <SkeletonBlock className="h-5 w-24 rounded-full" />
                                            <SkeletonBlock className="h-4 w-16" />
                                        </div>
                                        <SkeletonBlock className="h-3 w-4/5" />
                                        <SkeletonBlock className="h-3 w-2/5" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {error && !loading && (
                        <div role="alert" className={cn("flex flex-wrap items-center justify-center gap-2 px-3 py-6 text-sm", formErrorBannerClass)}>
                            <AlertCircle className="h-4 w-4" aria-hidden="true" />
                            <LocalizedError error={error} />
                            <AppButton variant="secondary" density="compact" onClick={() => setRefreshKey(key => key + 1)}>{t("Retry")}</AppButton>
                        </div>
                    )}

                    {!loading && !error && logs.length === 0 && (
                        <div className={cn("py-10 text-center text-sm", formHelpTextClass)}>
                            <ShieldCheck className="mx-auto mb-2 h-8 w-8 opacity-30" aria-hidden="true" />
                            {t("No recorded actions for this payment.")}</div>
                    )}

                    {!loading && !error && logs.map((log) => (
                        <div
                            key={log.id}
                            className={cn("flex items-start gap-3 p-3", formSurfaceClass)}
                        >
                            <div className="mt-0.5">
                                <ShieldCheck className={cn("h-4 w-4", formIconClass)} aria-hidden="true" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <Badge variant={ACTION_TONE[log.action]}><OwnedLabel text={ACTION_LABEL[log.action]} /></Badge>
                                    <span className={cn("text-xs", formHelpTextClass)}>
                                        {formatCurrency(log.details.amount)}
                                    </span>
                                    {log.details.method && (
                                        <span className="rounded border border-[color:var(--ui-form-input-border)] bg-[color:var(--ui-form-input-bg)] px-1.5 py-0.5 text-xs font-medium text-[color:var(--ui-form-label)]">
                                            {t.owned(log.details.method.replaceAll("_", " "))}
                                        </span>
                                    )}
                                </div>
                                <div className={cn("mt-1.5 flex items-center gap-1 text-xs", formHelpTextClass)}>
                                    <span className="truncate font-medium text-[color:var(--ui-form-label)]">
                                        {log.user.name || log.user.email}
                                    </span>
                                    <span>·</span>
                                    <span>
                                        {formatDateTime(log.createdAt)}
                                    </span>
                                </div>
                                <div className="mt-1 flex flex-col gap-0.5 text-[10px] text-[color:var(--ui-table-subtle)]">
                                    <span>{t.owned(log.details.from)} → {t.owned(log.details.to)}</span>
                                    {log.details.reason && <span>{t("Reason:")} {log.details.reason}</span>}
                                    {log.details.referenceId && (
                                        <span className={cn("font-mono", formHelpTextClass)}>
                                            {t("Ref:")} {log.details.referenceId}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
        </Dialog>
    );
}
