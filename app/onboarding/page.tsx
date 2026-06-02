"use client";

import type { ChangeEvent } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppButton } from "@/components/ui";
import {
    entryContentClass,
    entryIconFrameClass,
    entryInlineInfoClass,
    entryMutedTextClass,
    entryPanelClass,
    entryRootClass,
    entrySubtitleClass,
    entryTitleClass,
} from "@/components/ui/entrySurface";
import {
    formControlClass,
    formErrorBannerClass,
    formHelpTextClass,
    formIconClass,
    formInlineControlClass,
    formLabelClass,
    formRequiredClass,
    formSurfaceClass,
} from "@/components/ui/formSurface";
import { FieldError, fieldErrorClass, fieldErrorProps, useInlineFieldErrors } from "@/components/ui/InlineFieldError";
import { ArrowLeft, ArrowRight, Building2, CheckCircle2, MapPin, Phone, Plus, X } from "lucide-react";
import { LogoMark } from "@/components/brand/AppLogo";
import { apiClient } from "@/lib/api/core";
import {
    FORM_LIMITS,
    parseIntegerField,
    validateOptionalText,
    validateRequiredPhone,
    validateRequiredText,
    validateShiftDrafts,
} from "@/lib/formValidation";
import { cn } from "@/lib/utils";

interface OnboardingShiftDraft {
    name: string;
    startTime: string;
    endTime: string;
    price: number | string;
}

interface OnboardingResponse {
    branch: {
        id: string;
    };
}

type FieldKey = "orgName" | "ownerPhone" | "businessType" | "branchName" | "city" | "seatCount" | "shifts";

const stepItems = [
    { step: 1, label: "Organization", description: "Business identity and owner contact" },
    { step: 2, label: "First branch", description: "Seats, location, shifts, and pricing" },
] as const;

export default function OnboardingPage() {
    const router = useRouter();
    const [step, setStep] = useState<1 | 2>(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const {
        markTouched,
        markSubmitted,
        resetFieldErrors,
        visibleError,
    } = useInlineFieldErrors<FieldKey>();

    const [formData, setFormData] = useState({
        orgName: "",
        ownerPhone: "",
        businessType: "",
        branchName: "",
        city: "",
        seatCount: "",
        shifts: [
            { name: "Morning", startTime: "06:00", endTime: "09:59", price: 0 },
            { name: "Afternoon", startTime: "10:00", endTime: "15:59", price: 0 },
            { name: "Evening", startTime: "16:00", endTime: "21:59", price: 0 },
        ] as OnboardingShiftDraft[],
    });

    const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        setError(null);
    };

    const handleShiftChange = (index: number, field: keyof OnboardingShiftDraft, value: string | number) => {
        markTouched("shifts");
        const newShifts = [...formData.shifts];
        newShifts[index] = { ...newShifts[index], [field]: value };
        setFormData(prev => ({ ...prev, shifts: newShifts }));
        setError(null);
    };

    const addShift = () => {
        markTouched("shifts");
        setFormData(prev => ({
            ...prev,
            shifts: [...prev.shifts, { name: "", startTime: "", endTime: "", price: 0 }],
        }));
    };

    const removeShift = (index: number) => {
        markTouched("shifts");
        setFormData(prev => ({
            ...prev,
            shifts: prev.shifts.filter((_, i) => i !== index),
        }));
    };

    const validateForm = () => {
        const errors: Partial<Record<FieldKey, string>> = {};
        const orgNameResult = validateRequiredText(formData.orgName, "Organization name", 120);
        const ownerPhoneResult = validateRequiredPhone(formData.ownerPhone, "Owner phone");
        const businessTypeResult = validateOptionalText(formData.businessType, "Business type", 80);
        const branchNameResult = validateRequiredText(formData.branchName, "Branch name", 120);
        const cityResult = validateOptionalText(formData.city, "City / area", FORM_LIMITS.cityMax);
        const seatCountResult = parseIntegerField(formData.seatCount, "Total seats", {
            required: true,
            min: 1,
            max: FORM_LIMITS.seatsMax,
        });
        const shiftsResult = validateShiftDrafts(formData.shifts);

        if (!orgNameResult.ok) errors.orgName = orgNameResult.error;
        if (!ownerPhoneResult.ok) errors.ownerPhone = ownerPhoneResult.error;
        if (!businessTypeResult.ok) errors.businessType = businessTypeResult.error;
        if (!branchNameResult.ok) errors.branchName = branchNameResult.error;
        if (!cityResult.ok) errors.city = cityResult.error;
        if (!seatCountResult.ok) errors.seatCount = seatCountResult.error;
        if (!shiftsResult.ok) errors.shifts = shiftsResult.error;

        if (
            !orgNameResult.ok ||
            !ownerPhoneResult.ok ||
            !businessTypeResult.ok ||
            !branchNameResult.ok ||
            !cityResult.ok ||
            !seatCountResult.ok ||
            !shiftsResult.ok
        ) {
            return { errors, values: null };
        }

        return {
            errors,
            values: { orgNameResult, ownerPhoneResult, businessTypeResult, branchNameResult, cityResult, seatCountResult, shiftsResult },
        };
    };

    const validation = validateForm();
    const orgNameError = visibleError("orgName", validation.errors);
    const ownerPhoneError = visibleError("ownerPhone", validation.errors);
    const businessTypeError = visibleError("businessType", validation.errors);
    const branchNameError = visibleError("branchName", validation.errors);
    const cityError = visibleError("city", validation.errors);
    const seatCountError = visibleError("seatCount", validation.errors);
    const shiftsError = visibleError("shifts", validation.errors);

    const handleNext = () => {
        markSubmitted();
        setError(null);
        const result = validateForm();
        if (result.errors.orgName || result.errors.ownerPhone || result.errors.businessType) return;
        resetFieldErrors();
        setStep(2);
    };

    const handleSubmit = async () => {
        markSubmitted();
        setError(null);
        const result = validateForm();
        if (Object.values(result.errors).some(Boolean) || !result.values) return;

        const { orgNameResult, ownerPhoneResult, businessTypeResult, branchNameResult, cityResult, seatCountResult, shiftsResult } = result.values;
        setLoading(true);

        try {
            const res = await apiClient.post("/onboarding", {
                orgName: orgNameResult.value,
                ownerPhone: ownerPhoneResult.value,
                businessType: businessTypeResult.value,
                branchName: branchNameResult.value,
                city: cityResult.value,
                seatCount: seatCountResult.value,
                shifts: shiftsResult.value,
            }) as OnboardingResponse;

            router.push(`/branch/${res.branch.id}`);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to complete setup. Please try again.";
            console.error("Setup failed", err);
            setError(message);
            setLoading(false);
        }
    };

    return (
        <div className={cn(entryRootClass, "items-start py-8 sm:items-center")}>
            <div className={cn(entryContentClass, "max-w-5xl")}>
                <div className={cn(entryPanelClass, "grid overflow-hidden lg:grid-cols-[320px_minmax(0,1fr)]")}>
                    <aside className="border-b border-[color:var(--ui-form-section-divider)] bg-[color:var(--ui-form-muted-surface-bg)] p-5 lg:border-b-0 lg:border-r lg:p-6">
                        <div className={cn(entryIconFrameClass, "h-11 w-11")}>
                            <LogoMark className="h-9 w-9" title="Lab Lords logo" />
                        </div>
                        <h1 className={cn(entryTitleClass, "mt-5")}>Set up Lab Lords</h1>
                        <p className={cn(entrySubtitleClass, "mt-3")}>
                            Create the organization and first branch so the dashboard opens with real operational structure.
                        </p>

                        <div className="mt-8 space-y-3">
                            {stepItems.map(item => {
                                const active = step === item.step;
                                const done = step > item.step;
                                return (
                                    <div key={item.step} className={cn("flex gap-3 p-3", entryInlineInfoClass, active && "border-[color:var(--ui-badge-cyan-border)] bg-[color:var(--ui-badge-cyan-bg)]")}>
                                        <div className={cn(
                                            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                                            done
                                                ? "border-[color:var(--ui-badge-success-border)] bg-[color:var(--ui-badge-success-bg)] text-[color:var(--ui-badge-success-text)]"
                                                : active
                                                    ? "border-[color:var(--ui-badge-cyan-border)] text-[color:var(--ui-badge-cyan-text)]"
                                                    : "border-[color:var(--ui-form-surface-border)] text-[color:var(--text-muted)]"
                                        )}>
                                            {done ? <CheckCircle2 size={14} /> : item.step}
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-[color:var(--text-primary)]">{item.label}</p>
                                            <p className={cn("mt-1 text-xs leading-5", entryMutedTextClass)}>{item.description}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </aside>

                    <main className="p-5 sm:p-6 lg:p-8">
                        <div className="mb-6">
                            <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--ui-form-accent)]">
                                Step {step} of 2
                            </p>
                            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[color:var(--text-primary)]">
                                {step === 1 ? "Organization details" : "First branch details"}
                            </h2>
                            <p className={cn("mt-2 text-sm leading-6", entryMutedTextClass)}>
                                {step === 1
                                    ? "Name the business and add the owner contact used for operations."
                                    : "Define a usable branch with seats and shifts before entering the dashboard."}
                            </p>
                        </div>

                        {step === 1 && (
                            <div className="space-y-5">
                                <div>
                                    <label className={cn("mb-2 block", formLabelClass)}>
                                        Organization Name <span className={formRequiredClass}>*</span>
                                    </label>
                                    <div className="relative">
                                        <Building2 className={cn("absolute left-3 top-1/2 -translate-y-1/2", formIconClass)} size={18} />
                                        <input
                                            type="text"
                                            name="orgName"
                                            value={formData.orgName}
                                            onChange={handleInputChange}
                                            onBlur={() => markTouched("orgName")}
                                            placeholder="e.g. Apex Study Halls"
                                            maxLength={120}
                                            className={cn(formControlClass, "py-3 pl-10 pr-4", fieldErrorClass(orgNameError))}
                                            autoFocus
                                            {...fieldErrorProps("onboarding-org-name-error", orgNameError)}
                                        />
                                    </div>
                                    <FieldError id="onboarding-org-name-error" error={orgNameError} />
                                </div>

                                <div>
                                    <label className={cn("mb-2 block", formLabelClass)}>
                                        Owner Phone <span className={formRequiredClass}>*</span>
                                    </label>
                                    <div className="relative">
                                        <Phone className={cn("absolute left-3 top-1/2 -translate-y-1/2", formIconClass)} size={18} />
                                        <input
                                            type="tel"
                                            name="ownerPhone"
                                            value={formData.ownerPhone}
                                            onChange={handleInputChange}
                                            onBlur={() => markTouched("ownerPhone")}
                                            placeholder="+91 98765 43210"
                                            className={cn(formControlClass, "py-3 pl-10 pr-4", fieldErrorClass(ownerPhoneError))}
                                            {...fieldErrorProps("onboarding-owner-phone-error", ownerPhoneError)}
                                        />
                                    </div>
                                    <FieldError id="onboarding-owner-phone-error" error={ownerPhoneError} />
                                </div>

                                <div>
                                    <label className={cn("mb-2 block", formLabelClass)}>
                                        Business Type <span className={formHelpTextClass}>(Optional)</span>
                                    </label>
                                    <select
                                        name="businessType"
                                        value={formData.businessType}
                                        onChange={handleInputChange}
                                        onBlur={() => markTouched("businessType")}
                                        className={cn(formControlClass, "appearance-none px-4 py-3", fieldErrorClass(businessTypeError))}
                                        {...fieldErrorProps("onboarding-business-type-error", businessTypeError)}
                                    >
                                        <option value="" className="bg-[color:var(--ui-form-input-select-bg)] text-[color:var(--ui-form-help)]">Select type...</option>
                                        <option value="Study Hall" className="bg-[color:var(--ui-form-input-select-bg)]">Study Hall</option>
                                        <option value="Library" className="bg-[color:var(--ui-form-input-select-bg)]">Library</option>
                                        <option value="Coaching Center" className="bg-[color:var(--ui-form-input-select-bg)]">Coaching Center</option>
                                        <option value="Tuition" className="bg-[color:var(--ui-form-input-select-bg)]">Tuition</option>
                                        <option value="Other" className="bg-[color:var(--ui-form-input-select-bg)]">Other</option>
                                    </select>
                                    <FieldError id="onboarding-business-type-error" error={businessTypeError} />
                                </div>

                                <AppButton onClick={handleNext} rightIcon={ArrowRight} className="mt-2 w-full justify-center">
                                    Continue
                                </AppButton>
                            </div>
                        )}

                        {step === 2 && (
                            <div className="space-y-5">
                                <div>
                                    <label className={cn("mb-2 block", formLabelClass)}>
                                        Branch Name <span className={formRequiredClass}>*</span>
                                    </label>
                                    <div className="relative">
                                        <MapPin className={cn("absolute left-3 top-1/2 -translate-y-1/2", formIconClass)} size={18} />
                                        <input
                                            type="text"
                                            name="branchName"
                                            value={formData.branchName}
                                            onChange={handleInputChange}
                                            onBlur={() => markTouched("branchName")}
                                            placeholder="e.g. Main Branch, Downtown"
                                            maxLength={120}
                                            className={cn(formControlClass, "py-3 pl-10 pr-4", fieldErrorClass(branchNameError))}
                                            autoFocus
                                            {...fieldErrorProps("onboarding-branch-name-error", branchNameError)}
                                        />
                                    </div>
                                    <FieldError id="onboarding-branch-name-error" error={branchNameError} />
                                </div>

                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <div>
                                        <label className={cn("mb-2 block", formLabelClass)}>
                                            City / Area <span className={formHelpTextClass}>(Optional)</span>
                                        </label>
                                        <input
                                            type="text"
                                            name="city"
                                            value={formData.city}
                                            onChange={handleInputChange}
                                            onBlur={() => markTouched("city")}
                                            placeholder="e.g. New York"
                                            maxLength={FORM_LIMITS.cityMax}
                                            className={cn(formControlClass, "px-4 py-3", fieldErrorClass(cityError))}
                                            {...fieldErrorProps("onboarding-city-error", cityError)}
                                        />
                                        <FieldError id="onboarding-city-error" error={cityError} />
                                    </div>
                                    <div>
                                        <label className={cn("mb-2 block", formLabelClass)}>
                                            Total Seats <span className={formRequiredClass}>*</span>
                                        </label>
                                        <input
                                            type="number"
                                            name="seatCount"
                                            value={formData.seatCount}
                                            onChange={handleInputChange}
                                            onBlur={() => markTouched("seatCount")}
                                            placeholder="e.g. 50"
                                            min="1"
                                            max={FORM_LIMITS.seatsMax}
                                            step="1"
                                            inputMode="numeric"
                                            className={cn(formControlClass, "px-4 py-3", fieldErrorClass(seatCountError))}
                                            {...fieldErrorProps("onboarding-seat-count-error", seatCountError)}
                                        />
                                        <FieldError id="onboarding-seat-count-error" error={seatCountError} />
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <label className={formLabelClass}>Shifts and pricing</label>
                                        <button
                                            type="button"
                                            onClick={addShift}
                                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[color:var(--ui-form-accent)] transition-colors hover:text-[color:var(--ui-form-accent-hover)]"
                                        >
                                            <Plus size={13} />
                                            Add shift
                                        </button>
                                    </div>

                                    <div className="space-y-3">
                                        {formData.shifts.map((shift, idx) => (
                                            <div key={idx} className={cn("flex flex-col gap-3 p-3 sm:flex-row sm:items-start sm:gap-2", formSurfaceClass)}>
                                                <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-12 sm:gap-2">
                                                    <div className="sm:col-span-4">
                                                        <input
                                                            type="text"
                                                            placeholder="Name"
                                                            value={shift.name}
                                                            onChange={(e) => handleShiftChange(idx, "name", e.target.value)}
                                                            className={cn(formInlineControlClass, "py-1 text-sm")}
                                                        />
                                                    </div>
                                                    <div className="sm:col-span-3">
                                                        <input
                                                            type="time"
                                                            value={shift.startTime || ""}
                                                            onChange={(e) => handleShiftChange(idx, "startTime", e.target.value)}
                                                            className={cn(formInlineControlClass, "py-1 text-sm")}
                                                        />
                                                    </div>
                                                    <div className="sm:col-span-3">
                                                        <input
                                                            type="time"
                                                            value={shift.endTime || ""}
                                                            onChange={(e) => handleShiftChange(idx, "endTime", e.target.value)}
                                                            className={cn(formInlineControlClass, "py-1 text-sm")}
                                                        />
                                                    </div>
                                                    <div className="relative sm:col-span-2">
                                                        <span className={cn("absolute left-0 top-1 text-xs", formIconClass)}>Rs.</span>
                                                        <input
                                                            type="number"
                                                            placeholder="Price"
                                                            value={shift.price}
                                                            onChange={(e) => handleShiftChange(idx, "price", e.target.value)}
                                                            min={0}
                                                            max={FORM_LIMITS.moneyMax}
                                                            step={1}
                                                            inputMode="numeric"
                                                            className={cn(formInlineControlClass, "py-1 pl-6 text-sm")}
                                                        />
                                                    </div>
                                                </div>
                                                {formData.shifts.length > 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => removeShift(idx)}
                                                        className={cn("self-end transition-colors hover:text-[color:var(--ui-form-error-text)] sm:mt-1", formHelpTextClass)}
                                                        aria-label="Remove shift"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    <FieldError id="onboarding-shifts-error" error={shiftsError} />
                                </div>

                                <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
                                    <AppButton
                                        variant="quiet"
                                        icon={ArrowLeft}
                                        onClick={() => {
                                            resetFieldErrors();
                                            setStep(1);
                                        }}
                                        disabled={loading}
                                    >
                                        Back
                                    </AppButton>
                                    <AppButton
                                        onClick={handleSubmit}
                                        disabled={loading}
                                        isLoading={loading}
                                        rightIcon={loading ? undefined : ArrowRight}
                                        className="sm:min-w-40"
                                    >
                                        {loading ? "Setting up..." : "Finish setup"}
                                    </AppButton>
                                </div>
                            </div>
                        )}

                        {error && (
                            <div className={cn("mt-5 p-3 text-sm", formErrorBannerClass)}>
                                {error}
                            </div>
                        )}
                    </main>
                </div>
            </div>
        </div>
    );
}
