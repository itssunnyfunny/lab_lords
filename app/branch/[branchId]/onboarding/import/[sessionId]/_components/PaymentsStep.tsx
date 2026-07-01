import { CheckCircle2, CreditCard } from "lucide-react";
import { AppButton, AppPanel } from "@/components/ui";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import type { ImportOptions } from "@/importing/contracts/import-session.contract";
import {
    isPaymentSkipped,
    joinImportValues,
    paymentActionChangeOptions,
    paymentCycleChangeOptions,
    paymentSkipOptions,
    splitImportValues,
} from "@/importing/utils/import-wizard-view-model";
import { pageInsetSurfaceClass, pageMutedTextClass } from "@/components/ui/pageSurface";
import { pickerGroupLabelClass, pickerSectionLabelClass } from "@/components/ui/pickerSurface";
import { importFieldClass, importOptionClass, importSelectClass, StepNotice } from "./shared";
import type { PaymentDraft } from "./types";

type PaymentsStepProps = {
    options: ImportOptions;
    detectedPaymentValues: string[];
    paymentDraft: PaymentDraft;
    saving: boolean;
    onPaymentDraftChange: (draft: PaymentDraft) => void;
    onUpdateOptions: (options: Partial<ImportOptions>) => void;
};

export function PaymentsStep({
    options,
    detectedPaymentValues,
    paymentDraft,
    saving,
    onPaymentDraftChange,
    onUpdateOptions,
}: PaymentsStepProps) {
    const skipPayments = isPaymentSkipped(options);
    const showPaymentWords = options.paymentAction === "IMPORT_PAID_UNPAID";
    const paymentWordDraftHasValues = [paymentDraft.paid, paymentDraft.unpaid, paymentDraft.waived]
        .some(value => splitImportValues(value).length > 0);
    const needsPaymentDecision = detectedPaymentValues.length > 0 && !skipPayments && !options.paymentAction;
    const updatePaymentCycle = (paymentCycle: ImportOptions["paymentCycle"] | "") => {
        onUpdateOptions(paymentCycleChangeOptions(options, paymentCycle));
    };
    const updatePaymentAction = (paymentAction: ImportOptions["paymentAction"] | "") => {
        onUpdateOptions(paymentActionChangeOptions(options, paymentAction));
    };

    return (
        <div className="space-y-5">
            <AppPanel
                title="Payments"
                description="Payment import is opt-in. Student onboarding can continue without creating or marking payments."
                action={
                    <AppButton
                        variant={skipPayments ? "secondary" : "primary"}
                        icon={CheckCircle2}
                        onClick={() => onUpdateOptions(paymentSkipOptions())}
                        disabled={skipPayments || saving}
                        isLoading={saving && !skipPayments}
                    >
                        {skipPayments ? "Payments skipped" : "Skip payments for now"}
                    </AppButton>
                }
            >
                <div className="space-y-5">
                    <StepNotice
                        tone={needsPaymentDecision ? "warning" : skipPayments ? "success" : "cyan"}
                        title={skipPayments ? "Students only for now" : needsPaymentDecision ? "Payment values detected" : "Payment plan optional"}
                        message={skipPayments
                            ? "This import will create student records and defer payments for manual handling later."
                            : "Choose a cycle and action only when the file has clear payment information."}
                    />

                    <div className="grid gap-4 lg:grid-cols-2">
                        <label className="space-y-2">
                            <span className={pickerSectionLabelClass}>Payment cycle</span>
                            <select
                                value={options.paymentCycle ?? ""}
                                onChange={event => updatePaymentCycle(event.target.value as ImportOptions["paymentCycle"] | "")}
                                className={cn("w-full", importSelectClass)}
                            >
                                <option value="" className={importOptionClass}>Choose cycle</option>
                                <option value="CURRENT_MONTH" className={importOptionClass}>Current month</option>
                                <option value="PREVIOUS_MONTH" className={importOptionClass}>Previous month</option>
                                <option value="CUSTOM_PERIOD" className={importOptionClass}>Custom period</option>
                                <option value="USE_JOINED_AT_ANNIVERSARY" className={importOptionClass}>Joined date cycle</option>
                                <option value="SKIP_PAYMENTS" className={importOptionClass}>Skip payments</option>
                            </select>
                        </label>
                        <label className="space-y-2">
                            <span className={pickerSectionLabelClass}>After student import</span>
                            <select
                                value={options.paymentAction ?? ""}
                                onChange={event => updatePaymentAction(event.target.value as ImportOptions["paymentAction"] | "")}
                                className={cn("w-full", importSelectClass)}
                            >
                                <option value="" className={importOptionClass}>Choose action</option>
                                <option value="GENERATE_DUE" className={importOptionClass}>Generate due payments</option>
                                <option value="IMPORT_PAID_UNPAID" className={importOptionClass}>Import paid/unpaid status</option>
                                <option value="SKIP_PAYMENTS" className={importOptionClass}>Skip payments</option>
                            </select>
                        </label>
                    </div>

                    {options.paymentCycle === "CUSTOM_PERIOD" && (
                        <div className="grid gap-3 sm:grid-cols-2">
                            <label className="space-y-2">
                                <span className={pickerSectionLabelClass}>Period start</span>
                                <input
                                    type="date"
                                    value={options.customPeriodStart?.slice(0, 10) ?? ""}
                                    onChange={event => onUpdateOptions({ customPeriodStart: event.target.value })}
                                    className={cn("w-full", importFieldClass)}
                                />
                            </label>
                            <label className="space-y-2">
                                <span className={pickerSectionLabelClass}>Period end</span>
                                <input
                                    type="date"
                                    value={options.customPeriodEnd?.slice(0, 10) ?? ""}
                                    onChange={event => onUpdateOptions({ customPeriodEnd: event.target.value })}
                                    className={cn("w-full", importFieldClass)}
                                />
                            </label>
                        </div>
                    )}

                    {showPaymentWords && (
                        <div className={cn("space-y-3 p-4", pageInsetSurfaceClass)}>
                            <div className="flex items-center gap-2">
                                <CreditCard className="h-4 w-4 text-cyan-300" />
                                <p className={pickerGroupLabelClass}>Paid/unpaid words</p>
                            </div>
                            <div className="grid gap-3 lg:grid-cols-3">
                                <input
                                    value={paymentDraft.paid}
                                    onChange={event => onPaymentDraftChange({ ...paymentDraft, paid: event.target.value })}
                                    className={cn("w-full", importFieldClass)}
                                    placeholder="Paid values"
                                />
                                <input
                                    value={paymentDraft.unpaid}
                                    onChange={event => onPaymentDraftChange({ ...paymentDraft, unpaid: event.target.value })}
                                    className={cn("w-full", importFieldClass)}
                                    placeholder="Unpaid values"
                                />
                                <input
                                    value={paymentDraft.waived}
                                    onChange={event => onPaymentDraftChange({ ...paymentDraft, waived: event.target.value })}
                                    className={cn("w-full", importFieldClass)}
                                    placeholder="Waived values"
                                />
                            </div>
                            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                                <label className="space-y-2">
                                    <span className={pickerSectionLabelClass}>Default paid method</span>
                                    <select
                                        value={paymentDraft.defaultMethod}
                                        onChange={event => onPaymentDraftChange({ ...paymentDraft, defaultMethod: event.target.value })}
                                        className={cn("w-full", importSelectClass)}
                                    >
                                        <option value="" className={importOptionClass}>No default method</option>
                                        <option value="CASH" className={importOptionClass}>Cash</option>
                                        <option value="UPI" className={importOptionClass}>UPI</option>
                                        <option value="BANK_TRANSFER" className={importOptionClass}>Bank transfer</option>
                                    </select>
                                </label>
                                <AppButton
                                    variant="primary"
                                    icon={CheckCircle2}
                                    disabled={!paymentWordDraftHasValues || saving}
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
                                    Confirm words
                                </AppButton>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Badge variant={options.paymentMapping?.confirmed ? "success" : "warning"}>
                                    {options.paymentMapping?.confirmed ? "Confirmed" : "Needs confirmation"}
                                </Badge>
                                {detectedPaymentValues.slice(0, 10).map(value => (
                                    <Badge key={value} variant="default">{value}</Badge>
                                ))}
                            </div>
                        </div>
                    )}

                    {!showPaymentWords && detectedPaymentValues.length > 0 && (
                        <div className={cn("p-4", pageInsetSurfaceClass)}>
                            <p className="text-sm font-semibold text-[color:var(--text-primary)]">Detected payment values</p>
                            <p className={cn("mt-1 text-xs", pageMutedTextClass)}>
                                These values will not become financial truth unless paid/unpaid import is selected and confirmed.
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2">
                                {detectedPaymentValues.slice(0, 12).map(value => (
                                    <Badge key={value} variant="warning">{value}</Badge>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </AppPanel>

            <AppPanel title="Current payment mapping" description="Saved payment word groups.">
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
