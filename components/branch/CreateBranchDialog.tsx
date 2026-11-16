"use client";
import { LocalizedError } from "@/components/settings/LocalizedText";
import { useTranslation } from "@/components/settings/LocalizedText";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AppButton, AppPanel, Dialog, FormField } from "@/components/ui";
import { X, Plus, AlertCircle, AlertTriangle } from "lucide-react";
import {
    SeatNumberingBuilder,
    createSimpleSeatNumbering,
    resolveSeatNumberingForCount,
} from "@/components/seats/SeatNumberingBuilder";
import {
    formControlClass,
    formErrorBannerClass,
    formSurfaceClass,
    formWarningActionClass,
    formWarningBannerClass,
} from "@/components/ui/formSurface";
import { FieldError, fieldErrorClass, useInlineFieldErrors } from "@/components/ui/InlineFieldError";
import { parseNullableTime, timesOverlap } from "@/utils/shiftTime";
import {
    FORM_LIMITS,
    parseIntegerField,
    validateOptionalText,
    validateRequiredPhone,
    validateRequiredText,
    validateShiftDrafts,
} from "@/lib/formValidation";
import { generateSeatLabelsForSeatCount, type SeatNumberingConfig } from "@/lib/seatNumbering";
import { cn } from "@/lib/utils";
import { billing } from "@/lib/api/billing";
import {
    resolveBranchBillingAction,
    type BranchCreationResponse,
} from "@/lib/api/branches";
import {
    isRazorpayCheckoutPayload,
    isRazorpayCheckoutReady,
    openRazorpayCheckout,
    RazorpayCheckoutScript,
} from "@/components/billing/RazorpayCheckoutLauncher";

function formatMins(mins: number) {
    let raw = mins;
    if (raw < 0) raw += 1440;
    raw = raw % 1440;
    const h = Math.floor(raw / 60);
    const m = raw % 60;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}

interface ShiftDraft {
    name: string;
    startTime: string;
    endTime: string;
    price: number | string;
}

interface CreateBranchDialogProps {
    isOpen: boolean;
    onClose: () => void;
    /** The org this branch belongs to */
    organizationId: string;
    /** Called with the newly created branch after success */
    onSuccess: (branch: { id: string; name: string }) => void;
}

const DEFAULT_SHIFTS: ShiftDraft[] = [
    { name: "Morning", startTime: "06:00", endTime: "09:59", price: 0 },
    { name: "Afternoon", startTime: "10:00", endTime: "15:59", price: 0 },
    { name: "Evening", startTime: "16:00", endTime: "21:59", price: 0 },
];

const controlClassName = cn(formControlClass, "min-h-11 min-w-0 px-3 py-2 text-base sm:text-sm");

export function CreateBranchDialog({
    isOpen,
    onClose,
    organizationId,
    onSuccess,
}: CreateBranchDialogProps) {
    const t = useTranslation();
    const router = useRouter();
    const [formData, setFormData] = useState({
        name: "",
        contactPhone: "",
        city: "",
        seatCount: "",
        seatNumbering: createSimpleSeatNumbering(),
        defaultFee: "",
    });
    const [shifts, setShifts] = useState<ShiftDraft[]>(DEFAULT_SHIFTS);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [checkoutScriptReady, setCheckoutScriptReady] = useState(
        () => isRazorpayCheckoutReady()
    );
    const submitIdempotencyKeyRef = useRef<string | null>(null);
    const {
        markTouched,
        markSubmitted,
        resetFieldErrors,
        visibleError,
    } = useInlineFieldErrors<"name" | "contactPhone" | "city" | "seatCount" | "seatNumbering" | "defaultFee" | "shifts">();

    // Compute overlaps continuously
    const overlaps = (() => {
        const issues = new Map<number, { targetShiftIdx: number; text: string; fix1: { idx: number; field: "startTime" | "endTime"; val: string; label: string }; fix2: { idx: number; field: "startTime" | "endTime"; val: string; label: string } }>();
        for (let i = 0; i < shifts.length; i++) {
            for (let j = i + 1; j < shifts.length; j++) {
                const s1 = shifts[i];
                const s2 = shifts[j];
                if (!s1.startTime || !s1.endTime || !s2.startTime || !s2.endTime) continue;

                const start1 = parseNullableTime(s1.startTime);
                const end1 = parseNullableTime(s1.endTime);
                const start2 = parseNullableTime(s2.startTime);
                const end2 = parseNullableTime(s2.endTime);

                if (timesOverlap(start1, end1, start2, end2)) {
                    issues.set(j, { // Display on the later shift
                        targetShiftIdx: i,
                        text: `Overlaps with "${s1.name || 'another shift'}"`,
                        fix1: { idx: i, field: "endTime", val: formatMins(start2! - 1), label: `End ${s1.name || '1st'} at ${formatMins(start2! - 1)}` },
                        fix2: { idx: j, field: "startTime", val: formatMins(end1! + 1), label: `Start ${s2.name || '2nd'} at ${formatMins(end1! + 1)}` }
                    });
                }
            }
        }
        return issues;
    })();

    if (!isOpen) return null;

    const validateForm = () => {
        const errors: Partial<Record<"name" | "contactPhone" | "city" | "seatCount" | "seatNumbering" | "defaultFee" | "shifts", string>> = {};
        const nameResult = validateRequiredText(formData.name, "Branch name", 120);
        const contactPhoneResult = validateRequiredPhone(formData.contactPhone, "Contact phone");
        const cityResult = validateOptionalText(formData.city, "City / area", FORM_LIMITS.cityMax);
        const seatCountResult = parseIntegerField(formData.seatCount, "Total seats", {
            required: true,
            min: 1,
            max: FORM_LIMITS.seatsMax,
        });
        const defaultFeeResult = parseIntegerField(formData.defaultFee, "Default monthly fee", {
            min: 0,
            max: FORM_LIMITS.moneyMax,
        });
        const shiftsResult = validateShiftDrafts(shifts);
        const seatNumberingConfig = seatCountResult.ok
            ? resolveSeatNumberingForCount(formData.seatNumbering as SeatNumberingConfig, seatCountResult.value ?? 0)
            : formData.seatNumbering as SeatNumberingConfig;
        const seatNumberingResult = seatCountResult.ok
            ? generateSeatLabelsForSeatCount(seatCountResult.value, seatNumberingConfig)
            : { ok: true as const, value: [] };

        if (!nameResult.ok) errors.name = nameResult.error;
        if (!contactPhoneResult.ok) errors.contactPhone = contactPhoneResult.error;
        if (!cityResult.ok) errors.city = cityResult.error;
        if (!seatCountResult.ok) errors.seatCount = seatCountResult.error;
        if (!seatNumberingResult.ok) errors.seatNumbering = seatNumberingResult.error;
        if (!defaultFeeResult.ok) errors.defaultFee = defaultFeeResult.error;
        if (!shiftsResult.ok) errors.shifts = shiftsResult.error;
        if (overlaps.size > 0) errors.shifts = "Resolve all shift time overlaps before continuing.";

        if (
            !nameResult.ok ||
            !contactPhoneResult.ok ||
            !cityResult.ok ||
            !seatCountResult.ok ||
            !seatNumberingResult.ok ||
            !defaultFeeResult.ok ||
            !shiftsResult.ok ||
            overlaps.size > 0
        ) return { errors, values: null };
        return { errors, values: { nameResult, contactPhoneResult, cityResult, seatCountResult, seatNumberingConfig, defaultFeeResult, shiftsResult } };
    };

    const validation = validateForm();
    const seatCountPreviewResult = parseIntegerField(formData.seatCount, "Total seats", {
        required: true,
        min: 1,
        max: FORM_LIMITS.seatsMax,
    });
    const seatCountPreview = seatCountPreviewResult.ok ? seatCountPreviewResult.value : undefined;
    const nameError = visibleError("name", validation.errors);
    const contactPhoneError = visibleError("contactPhone", validation.errors);
    const cityError = visibleError("city", validation.errors);
    const seatCountError = visibleError("seatCount", validation.errors);
    const seatNumberingError = visibleError("seatNumbering", validation.errors);
    const defaultFeeError = visibleError("defaultFee", validation.errors);
    const shiftsError = visibleError("shifts", validation.errors);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleShiftChange = (idx: number, field: keyof ShiftDraft, value: string | number) => {
        markTouched("shifts");
        setShifts(prev => {
            const next = [...prev];
            next[idx] = { ...next[idx], [field]: value };
            return next;
        });
    };

    const addShift = () => {
        markTouched("shifts");
        setShifts(prev => [...prev, { name: "", startTime: "", endTime: "", price: 0 }]);
    };

    const removeShift = (idx: number) => {
        markTouched("shifts");
        setShifts(prev => prev.filter((_, i) => i !== idx));
    };

    const handleSubmit = async () => {
        markSubmitted();
        setError(null);
        const result = validateForm();
        if (Object.values(result.errors).some(Boolean) || !result.values) {
            return;
        }
        const { nameResult, contactPhoneResult, cityResult, seatCountResult, seatNumberingConfig, defaultFeeResult, shiftsResult } = result.values;

        setLoading(true);
        try {
            const idempotencyKey = submitIdempotencyKeyRef.current ?? crypto.randomUUID();
            submitIdempotencyKeyRef.current = idempotencyKey;
            const res = await fetch("/api/branches", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Idempotency-Key": idempotencyKey,
                },
                body: JSON.stringify({
                    organizationId,
                    name: nameResult.value,
                    contactPhone: contactPhoneResult.value,
                    city: cityResult.value,
                    seatCount: seatCountResult.value,
                    seatNumbering: seatNumberingConfig,
                    defaultFee: defaultFeeResult.value ?? 0,
                    shifts: shiftsResult.value,
                }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || "Failed to create branch");
            }

            const branch = await res.json() as BranchCreationResponse;
            const billingAction = resolveBranchBillingAction(branch);
            if (billingAction === "CHECKOUT_REQUIRED") {
                if (branch.checkout && isRazorpayCheckoutPayload(branch.checkout) && (checkoutScriptReady || isRazorpayCheckoutReady())) {
                    const checkout = branch.checkout;
                    openRazorpayCheckout({
                        payload: checkout,
                        mode: "AUTHORIZATION",
                        verify: response => billing.verifySubscription(organizationId, {
                            changeId: checkout.changeId,
                            razorpay_subscription_id: response.razorpay_subscription_id ?? checkout.subscriptionId,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature,
                        }),
                        recordEvent: async result => {
                            await billing.recordCheckoutEvent(
                                organizationId,
                                checkout.changeId,
                                result.event,
                                result.failure
                            );
                        },
                        navigate: processingUrl => router.push(processingUrl),
                    });
                } else if (branch.processingUrl) {
                    router.push(branch.processingUrl);
                } else {
                    throw new Error("The branch was created, but payment-method authorization could not be opened. Retry activation from the branch page.");
                }
            } else if (billingAction === "PROCESSING" && branch.processingUrl) {
                router.push(branch.processingUrl);
            }
            // Reset form
            setFormData({ name: "", contactPhone: "", city: "", seatCount: "", seatNumbering: createSimpleSeatNumbering(), defaultFee: "" });
            setShifts(DEFAULT_SHIFTS);
            submitIdempotencyKeyRef.current = null;
            resetFieldErrors();
            onSuccess(branch);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Something went wrong.");
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        if (loading) return;
        setFormData({ name: "", contactPhone: "", city: "", seatCount: "", seatNumbering: createSimpleSeatNumbering(), defaultFee: "" });
        setShifts(DEFAULT_SHIFTS);
        setError(null);
        submitIdempotencyKeyRef.current = null;
        resetFieldErrors();
        onClose();
    };

    return (
        <>
            <RazorpayCheckoutScript
                onReady={() => setCheckoutScriptReady(true)}
                onError={() => setCheckoutScriptReady(false)}
            />
            <Dialog
                open={isOpen}
                onClose={handleClose}
                title={t("Create new branch")}
                description={t("Set up a new location under this organization.")}
                closeLabel={t("Close create branch dialog")}
                closeDisabled={loading}
                density="compact"
                className="flex max-w-3xl flex-col overflow-hidden"
                contentClassName="min-h-0 overflow-y-auto"
                footer={(
                    <>
                        <AppButton density="compact" variant="quiet" onClick={handleClose} disabled={loading}>
                            {t("Cancel")}
                        </AppButton>
                        <AppButton
                            density="compact"
                            variant="primary"
                            type="submit"
                            form="create-branch-form"
                            disabled={loading}
                            isLoading={loading}
                        >
                            {loading ? t("Creating...") : t("Create Branch")}
                        </AppButton>
                    </>
                )}
            >
                <form
                    id="create-branch-form"
                    noValidate
                    className="space-y-4"
                    aria-describedby={error ? "create-branch-submit-error" : undefined}
                    onSubmit={(event) => {
                        event.preventDefault();
                        if (!loading) void handleSubmit();
                    }}
                >
                    <AppPanel density="compact" title={t("Branch details")} contentClassName="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <FormField label={t("Branch Name")} required error={nameError} className="min-w-0 sm:col-span-2">
                            <input
                                id="create-branch-name"
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                onBlur={() => markTouched("name")}
                                placeholder={t("e.g. Main Branch, Downtown")}
                                data-dialog-initial-focus
                                maxLength={120}
                                disabled={loading}
                                className={cn(controlClassName, fieldErrorClass(nameError))}
                            />
                        </FormField>
                        <FormField label={t("Contact Phone")} required error={contactPhoneError} className="min-w-0">
                            <input
                                id="create-branch-contact-phone"
                                type="tel"
                                name="contactPhone"
                                value={formData.contactPhone}
                                onChange={handleChange}
                                onBlur={() => markTouched("contactPhone")}
                                placeholder="+91 98765 43210"
                                disabled={loading}
                                className={cn(controlClassName, fieldErrorClass(contactPhoneError))}
                            />
                        </FormField>
                        <FormField label={t("City / Area")} description={t("(Optional)")} error={cityError} className="min-w-0">
                            <input
                                id="create-branch-city"
                                type="text"
                                name="city"
                                value={formData.city}
                                onChange={handleChange}
                                onBlur={() => markTouched("city")}
                                placeholder={t("e.g. Mumbai")}
                                maxLength={FORM_LIMITS.cityMax}
                                disabled={loading}
                                className={cn(controlClassName, fieldErrorClass(cityError))}
                            />
                        </FormField>
                    </AppPanel>

                    <AppPanel density="compact" title={t("Seats")} contentClassName="space-y-4">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <FormField label={t("Total Seats")} required error={seatCountError} className="min-w-0">
                                <input
                                    id="create-branch-seat-count"
                                    type="number"
                                    name="seatCount"
                                    value={formData.seatCount}
                                    onChange={handleChange}
                                    onBlur={() => markTouched("seatCount")}
                                    placeholder="e.g. 50"
                                    min="1"
                                    max={FORM_LIMITS.seatsMax}
                                    step="1"
                                    inputMode="numeric"
                                    disabled={loading}
                                    className={cn(controlClassName, fieldErrorClass(seatCountError))}
                                />
                            </FormField>
                            <FormField label={`${t("Default Monthly Fee")} (₹)`} description={t("(Optional)")} error={defaultFeeError} className="min-w-0">
                                <input
                                    id="create-branch-default-fee"
                                    type="number"
                                    name="defaultFee"
                                    value={formData.defaultFee}
                                    onChange={handleChange}
                                    onBlur={() => markTouched("defaultFee")}
                                    placeholder="₹ 1500"
                                    min="0"
                                    max={FORM_LIMITS.moneyMax}
                                    step="1"
                                    inputMode="numeric"
                                    disabled={loading}
                                    className={cn(controlClassName, fieldErrorClass(defaultFeeError))}
                                />
                            </FormField>
                        </div>
                        <fieldset className="min-w-0 space-y-3" aria-describedby={seatNumberingError ? "create-branch-seat-numbering-error" : undefined}>
                            <legend className="text-sm font-medium text-[color:var(--ui-form-label)]">{t("Seat numbering")}</legend>
                            <SeatNumberingBuilder
                                value={formData.seatNumbering as SeatNumberingConfig}
                                expectedCount={seatCountPreview}
                                onChange={(seatNumbering) => {
                                    markTouched("seatNumbering");
                                    setFormData(prev => ({ ...prev, seatNumbering }));
                                }}
                                disabled={loading}
                            />
                            <FieldError id="create-branch-seat-numbering-error" error={seatNumberingError} />
                        </fieldset>
                    </AppPanel>

                    <AppPanel
                        density="compact"
                        title={t("Shifts & Pricing")}
                        action={(
                            <AppButton type="button" density="compact" variant="secondary" icon={Plus} onClick={addShift} disabled={loading}>
                                {t("Add Shift")}
                            </AppButton>
                        )}
                        contentClassName="space-y-3"
                        aria-describedby={shiftsError ? "create-branch-shifts-error" : undefined}
                    >
                        {shifts.map((shift, idx) => (
                            <div key={idx} className={cn("space-y-3 p-3", formSurfaceClass)}>
                                <div className="flex items-center justify-between gap-3">
                                    <h3 className="text-sm font-medium text-[color:var(--ui-form-label)]">{t("Shift {number}", { number: idx + 1 })}</h3>
                                    {shifts.length > 1 && (
                                        <AppButton
                                            type="button"
                                            density="compact"
                                            variant="quiet"
                                            icon={X}
                                            onClick={() => removeShift(idx)}
                                            disabled={loading}
                                            aria-label={t("Remove shift {name}", { name: shift.name || idx + 1 })}
                                        >
                                            {t("Remove shift")}
                                        </AppButton>
                                    )}
                                </div>
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    <FormField label={t("Name")} className="min-w-0">
                                        <input
                                            id={`create-branch-shift-${idx}-name`}
                                            type="text"
                                            aria-label={t("Shift {number} name", { number: idx + 1 })}
                                            placeholder={t("Name")}
                                            value={shift.name}
                                            onChange={(event) => handleShiftChange(idx, "name", event.target.value)}
                                            disabled={loading}
                                            className={controlClassName}
                                        />
                                    </FormField>
                                    <FormField label={`${t("Monthly price")} (₹)`} className="min-w-0">
                                        <input
                                            id={`create-branch-shift-${idx}-price`}
                                            type="number"
                                            aria-label={t("Shift {number} monthly price", { number: idx + 1 })}
                                            placeholder="₹ 0"
                                            value={shift.price}
                                            onChange={(event) => handleShiftChange(idx, "price", event.target.value)}
                                            min={0}
                                            max={FORM_LIMITS.moneyMax}
                                            step={1}
                                            inputMode="numeric"
                                            disabled={loading}
                                            className={controlClassName}
                                        />
                                    </FormField>
                                    <FormField label={t("Start time")} className="min-w-0">
                                        <input
                                            id={`create-branch-shift-${idx}-start`}
                                            type="time"
                                            aria-label={t("Shift {number} start time", { number: idx + 1 })}
                                            value={shift.startTime}
                                            onChange={(event) => handleShiftChange(idx, "startTime", event.target.value)}
                                            disabled={loading}
                                            className={controlClassName}
                                        />
                                    </FormField>
                                    <FormField label={t("End time")} className="min-w-0">
                                        <input
                                            id={`create-branch-shift-${idx}-end`}
                                            type="time"
                                            aria-label={t("Shift {number} end time", { number: idx + 1 })}
                                            value={shift.endTime}
                                            onChange={(event) => handleShiftChange(idx, "endTime", event.target.value)}
                                            disabled={loading}
                                            className={controlClassName}
                                        />
                                    </FormField>
                                </div>
                                {overlaps.has(idx) && (
                                    <div className={cn("flex flex-col gap-2 px-3 py-2 text-sm", formWarningBannerClass)}>
                                        <div className="flex items-center gap-2">
                                            <AlertTriangle size={16} className="shrink-0" aria-hidden="true" />
                                            <span>{overlaps.get(idx)!.text}</span>
                                        </div>
                                        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                                            <button type="button" disabled={loading} onClick={() => handleShiftChange(overlaps.get(idx)!.fix1.idx, overlaps.get(idx)!.fix1.field, overlaps.get(idx)!.fix1.val)} className={cn("min-h-11 px-3 py-2", formWarningActionClass)}>
                                                {overlaps.get(idx)!.fix1.label}
                                            </button>
                                            <button type="button" disabled={loading} onClick={() => handleShiftChange(overlaps.get(idx)!.fix2.idx, overlaps.get(idx)!.fix2.field, overlaps.get(idx)!.fix2.val)} className={cn("min-h-11 px-3 py-2", formWarningActionClass)}>
                                                {overlaps.get(idx)!.fix2.label}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                        <FieldError id="create-branch-shifts-error" error={shiftsError} />
                    </AppPanel>

                    {error && (
                        <div id="create-branch-submit-error" role="alert" className={cn("flex items-center gap-2 px-3 py-2 text-sm", formErrorBannerClass)}>
                            <AlertCircle size={14} aria-hidden="true" />
                            <LocalizedError error={error} />
                        </div>
                    )}
                </form>
            </Dialog>
        </>
    );
}
