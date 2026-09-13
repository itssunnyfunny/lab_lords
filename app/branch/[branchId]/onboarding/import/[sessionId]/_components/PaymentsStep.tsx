
import { useTranslation } from "@/components/settings/LocalizedText";import { CheckCircle2, CreditCard } from "lucide-react";
import { AppButton, AppPanel, AppSelect } from "@/components/ui";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import type { ImportOptions } from "@/importing/contracts/import-session.contract";
import {
    isPaymentSkipped,
    joinImportValues,
    paymentActionChangeOptions,
    paymentSkipOptions,
    splitImportValues,
} from "@/importing/utils/import-wizard-view-model";
import { pageInsetSurfaceClass, pageMutedTextClass } from "@/components/ui/pageSurface";
import { pickerGroupLabelClass, pickerSectionLabelClass } from "@/components/ui/pickerSurface";
import { importFieldClass, StepNotice } from "./shared";
import type { PaymentDraft } from "./types";

const paymentHistoryOptions: Array<{ value: NonNullable<ImportOptions["paymentHistoryMode"]>; label: string }> = [
    { value: "START_CURRENT_JOINED_CYCLE", label: "Start current joined cycle" },
    { value: "FROM_JOINED_MARK_PAID", label: "From joined date, mark paid" },
    { value: "FROM_JOINED_MARK_DUE", label: "From joined date, mark due" },
    { value: "FROM_JOINED_PAID_THROUGH_PREVIOUS", label: "Paid through previous cycle" },
];

type PaymentsStepProps = {
    options: ImportOptions;
    detectedPaymentValues: string[];
    paymentDraft: PaymentDraft;
    saving: boolean;
    mutationsDisabled: boolean;
    onPaymentDraftChange: (draft: PaymentDraft) => void;
    onUpdateOptions: (options: Partial<ImportOptions>) => void;
};

export function PaymentsStep({
    options,
    detectedPaymentValues,
    paymentDraft,
    saving,
    mutationsDisabled,
    onPaymentDraftChange,
    onUpdateOptions,
}: PaymentsStepProps) {
    const t = useTranslation();
    const skipPayments = isPaymentSkipped(options);
    const showPaymentWords = options.paymentAction === "IMPORT_PAID_UNPAID";
    const paymentWordDraftHasValues = [paymentDraft.paid, paymentDraft.unpaid, paymentDraft.waived]
        .some(value => splitImportValues(value).length > 0);
    const needsPaymentDecision = detectedPaymentValues.length > 0 && !skipPayments && !options.paymentAction;
    const updatePaymentAction = (paymentAction: ImportOptions["paymentAction"] | "") => {
        onUpdateOptions(paymentActionChangeOptions(options, paymentAction));
    };
    const updatePaymentHistory = (paymentHistoryMode: ImportOptions["paymentHistoryMode"]) => {
        onUpdateOptions({
            paymentHistoryMode,
            paymentCycle: "USE_JOINED_AT_ANNIVERSARY",
            ...(!options.paymentAction || options.paymentAction === "SKIP_PAYMENTS" ? { paymentAction: "GENERATE_DUE" as const } : {}),
        });
    };

    return (
        <div className="space-y-5">
            <AppPanel
                title={t("Payments")}
                description={t("Payment import is opt-in. Student onboarding can continue without creating or marking payments.")}
                action={
                    <AppButton
                        variant={skipPayments ? "secondary" : "primary"}
                        icon={CheckCircle2}
                        onClick={() => onUpdateOptions(paymentSkipOptions())}
                        disabled={mutationsDisabled || skipPayments || saving}
                        aria-describedby={mutationsDisabled ? "import-session-mutation-blocker" : undefined}
                        isLoading={saving && !skipPayments}
                    >
                        {skipPayments ? t("Payments skipped") : t("Skip payments for now")}
                    </AppButton>
                }
            >
                <div className="space-y-5">
                    <StepNotice
                        tone={needsPaymentDecision ? "warning" : skipPayments ? "success" : "cyan"}
                        title={skipPayments ? t("Students only for now") : needsPaymentDecision ? t("Payment values detected") : t("Payment plan optional")}
                        message={skipPayments
                            ? "This import will create student records and defer payments for manual handling later."
                            : "Choose a cycle and action only when the file has clear payment information."}
                    />

                    <div className="grid gap-4 lg:grid-cols-2">
                        <label className="space-y-2">
                            <span className={pickerSectionLabelClass}>{t("Payment history")}</span>
                            <AppSelect
                                value={options.paymentHistoryMode ?? "START_CURRENT_JOINED_CYCLE"}
                                onValueChange={value => updatePaymentHistory(value as ImportOptions["paymentHistoryMode"])}
                                options={paymentHistoryOptions}
                                disabled={mutationsDisabled || skipPayments}
                                aria-describedby={mutationsDisabled ? "import-session-mutation-blocker" : undefined}
                            />
                        </label>
                        <label className="space-y-2">
                            <span className={pickerSectionLabelClass}>{t("After student import")}</span>
                            <AppSelect
                                value={options.paymentAction ?? ""}
                                onValueChange={value => updatePaymentAction(value as ImportOptions["paymentAction"] | "")}
                                options={[
                                    { value: "", label: t("Choose action") },
                                    { value: "GENERATE_DUE", label: t("Generate due payments") },
                                    { value: "IMPORT_PAID_UNPAID", label: t("Import paid/unpaid status") },
                                    { value: "SKIP_PAYMENTS", label: t("Skip payments") },
                                ]}
                                placeholder={t("Choose action")}
                                disabled={mutationsDisabled}
                                aria-describedby={mutationsDisabled ? "import-session-mutation-blocker" : undefined}
                            />
                        </label>
                    </div>

                    {!skipPayments && (
                        <div className={cn("p-4", pageInsetSurfaceClass)}>
                            <p className="text-sm font-semibold text-[color:var(--text-primary)]">{t("Joined-date billing cycle")}</p>
                            <p className={cn("mt-1 text-xs leading-5", pageMutedTextClass)}>
                                {t("Payments use each student's joined date as the monthly due day. Future due dates are not created during import.")}</p>
                        </div>
                    )}

                    {showPaymentWords && (
                        <div className={cn("space-y-3 p-4", pageInsetSurfaceClass)}>
                            <div className="flex items-center gap-2">
                                <CreditCard className="h-4 w-4 text-cyan-300" />
                                <p className={pickerGroupLabelClass}>{t("Paid/unpaid words")}</p>
                            </div>
                            <div className="grid gap-3 lg:grid-cols-3">
                                <label className="space-y-2">
                                    <span className={pickerSectionLabelClass}>{t("Paid values")}</span>
                                    <input value={paymentDraft.paid} onChange={event => onPaymentDraftChange({ ...paymentDraft, paid: event.target.value })} className={cn("w-full", importFieldClass)} placeholder="paid, received" />
                                </label>
                                <label className="space-y-2">
                                    <span className={pickerSectionLabelClass}>{t("Unpaid values")}</span>
                                    <input value={paymentDraft.unpaid} onChange={event => onPaymentDraftChange({ ...paymentDraft, unpaid: event.target.value })} className={cn("w-full", importFieldClass)} placeholder="unpaid, pending" />
                                </label>
                                <label className="space-y-2">
                                    <span className={pickerSectionLabelClass}>{t("Waived values")}</span>
                                    <input value={paymentDraft.waived} onChange={event => onPaymentDraftChange({ ...paymentDraft, waived: event.target.value })} className={cn("w-full", importFieldClass)} placeholder="waived, forgiven" />
                                </label>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                                <label className="space-y-2">
                                    <span className={pickerSectionLabelClass}>{t("Default paid method")}</span>
                                    <AppSelect
                                        value={paymentDraft.defaultMethod}
                                        onValueChange={value => onPaymentDraftChange({ ...paymentDraft, defaultMethod: value })}
                                        options={[
                                            { value: "", label: t("No default method") },
                                            { value: "CASH", label: t("Cash") },
                                            { value: "UPI", label: "UPI" },
                                            { value: "BANK_TRANSFER", label: t("Bank transfer") },
                                        ]}
                                    />
                                </label>
                                <AppButton
                                    variant="primary"
                                    icon={CheckCircle2}
                                    disabled={mutationsDisabled || !paymentWordDraftHasValues || saving}
                                    aria-describedby={mutationsDisabled ? "import-session-mutation-blocker" : undefined}
                                    onClick={() => onUpdateOptions({
                                        paymentMapping: {
                                            paidValues: splitImportValues(paymentDraft.paid),
                                            unpaidValues: splitImportValues(paymentDraft.unpaid),
                                            waivedValues: splitImportValues(paymentDraft.waived),
                                            unclearValues: detectedPaymentValues,
                                            confirmed: true,
                                            ...(paymentDraft.defaultMethod ? { defaultMethod: paymentDraft.defaultMethod as NonNullable<ImportOptions["paymentMapping"]>["defaultMethod"] } : {}),
                                        },
                                    })}
                                    isLoading={saving}
                                >
                                    {t("Confirm words")}</AppButton>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Badge variant={options.paymentMapping?.confirmed ? "success" : "warning"}>
                                    {options.paymentMapping?.confirmed ? t("Confirmed") : t("Needs confirmation")}
                                </Badge>
                                {detectedPaymentValues.slice(0, 10).map(value => (
                                    <Badge key={value} variant="default">{value}</Badge>
                                ))}
                            </div>
                        </div>
                    )}

                    {!showPaymentWords && detectedPaymentValues.length > 0 && (
                        <div className={cn("p-4", pageInsetSurfaceClass)}>
                            <p className="text-sm font-semibold text-[color:var(--text-primary)]">{t("Detected payment values")}</p>
                            <p className={cn("mt-1 text-xs", pageMutedTextClass)}>
                                {t("These values will not become financial truth unless paid/unpaid import is selected and confirmed.")}</p>
                            <div className="mt-3 flex flex-wrap gap-2">
                                {detectedPaymentValues.slice(0, 12).map(value => (
                                    <Badge key={value} variant="warning">{value}</Badge>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </AppPanel>

            <AppPanel title={t("Current payment mapping")} description={t("Saved payment word groups.")}>
                <div className="grid gap-3 md:grid-cols-3">
                    {[
                        ["Paid", joinImportValues(options.paymentMapping?.paidValues)],
                        ["Unpaid", joinImportValues(options.paymentMapping?.unpaidValues)],
                        ["Waived", joinImportValues(options.paymentMapping?.waivedValues)],
                    ].map(([label, value]) => (
                        <div key={label} className={cn("p-3", pageInsetSurfaceClass)}>
                            <p className={cn("text-xs", pageMutedTextClass)}>{label}</p>
                            <p className="mt-1 truncate text-sm font-semibold text-[color:var(--text-primary)]">{value || "-"}</p>
                        </div>
                    ))}
                </div>
            </AppPanel>
        </div>
    );
}
