"use client";
import { LocalizedError } from "@/components/settings/LocalizedText";
import { useTranslation } from "@/components/settings/LocalizedText";
import { AppButton, Dialog } from "@/components/ui";
import { Banknote, Smartphone, Building2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { formControlClass, formHelpTextClass, formIconClass, formSurfaceClass, formSurfaceHoverClass } from "@/components/ui/formSurface";
export type PayMethod = "CASH" | "UPI" | "BANK_TRANSFER";

interface MarkPaidDialogProps {
    error?: string | null;
    summary?: string;
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

export function MarkPaidDialog({
    error, summary,
    isOpen, onClose, onConfirm, loading,
    method, onMethodChange,
    referenceId, onReferenceIdChange,
}: MarkPaidDialogProps) {
    const t = useTranslation();
    const needsRef = method === "UPI" || method === "BANK_TRANSFER";
    return (
        <Dialog
            open={isOpen}
            onClose={onClose}
            title={t("Mark as paid")}
            description={summary ?? "Select the payment method used."}
            icon={<span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-400/10 text-emerald-300"><Check size={18} /></span>}
            closeDisabled={loading}
            className="max-w-sm"
            footer={(
                <>
                    <AppButton variant="quiet" onClick={onClose} disabled={loading} data-dialog-initial-focus>
                        {t("Cancel")}</AppButton>
                    <AppButton variant="primary" onClick={onConfirm} isLoading={loading} icon={Check}>
                        {t("Confirm payment")}</AppButton>
                </>
            )}
        >
            <div className="space-y-5">
                {error && <p role="alert" className="text-sm text-[color:var(--ui-form-error-text)]"><LocalizedError error={error} /></p>}
                {/* Method selector */}
                <div className="space-y-2" role="radiogroup" aria-label={t("Payment method")}>
                    {METHOD_OPTIONS.map((opt) => (
                        <button
                            type="button"
                            key={opt.value}
                            onClick={() => onMethodChange(opt.value)}
                            role="radio"
                            aria-checked={method === opt.value}
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
                                <span className="block text-sm font-medium">{t.owned(opt.label)}</span>
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
                        id="payment-reference-id"
                        type="text"
                        value={referenceId}
                        onChange={(e) => onReferenceIdChange(e.target.value)}
                        placeholder={method === "UPI" ? t("UPI Transaction ID (optional)") : t("Bank Reference ID (optional)")}
                        aria-label={method === "UPI" ? t("UPI transaction ID") : t("Bank reference ID")}
                        className={cn(formControlClass, "px-3 py-2.5 text-sm focus:border-green-500/50")}
                    />
                </div>
            </div>
        </Dialog>
    );
}
