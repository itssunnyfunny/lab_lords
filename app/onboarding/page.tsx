"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AmbientBackground } from "@/components/ui/AmbientBackground";
import { GlowText } from "@/components/ui/GlowText";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
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
import { ArrowRight, Building2, MapPin, Loader2, Phone, X } from "lucide-react";
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
    } = useInlineFieldErrors<"orgName" | "ownerPhone" | "businessType" | "branchName" | "city" | "seatCount" | "shifts">();

    // Form State
    const [formData, setFormData] = useState({
        orgName: "",
        ownerPhone: "",
        businessType: "",
        branchName: "",
        city: "",
        seatCount: "",
        shifts: [
            { name: "Morning", startTime: "06:00", endTime: "12:00", price: 0 },
            { name: "Evening", startTime: "16:00", endTime: "22:00", price: 0 }
        ] as OnboardingShiftDraft[]
    });

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        setError(null);
    };

    const handleShiftChange = (index: number, field: keyof OnboardingShiftDraft, value: string | number) => {
        markTouched("shifts");
        const newShifts = [...formData.shifts];
        newShifts[index] = { ...newShifts[index], [field]: value };
        setFormData(prev => ({ ...prev, shifts: newShifts }));
    };

    const addShift = () => {
        markTouched("shifts");
        setFormData(prev => ({
            ...prev,
            shifts: [...prev.shifts, { name: "", startTime: "", endTime: "", price: 0 }]
        }));
    };

    const removeShift = (index: number) => {
        markTouched("shifts");
        setFormData(prev => ({
            ...prev,
            shifts: prev.shifts.filter((_, i) => i !== index)
        }));
    };

    const validateForm = () => {
        const errors: Partial<Record<"orgName" | "ownerPhone" | "businessType" | "branchName" | "city" | "seatCount" | "shifts", string>> = {};
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
        ) return { errors, values: null };
        return { errors, values: { orgNameResult, ownerPhoneResult, businessTypeResult, branchNameResult, cityResult, seatCountResult, shiftsResult } };
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
        if (Object.values(result.errors).some(Boolean) || !result.values) {
            return;
        }
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

            // Success -> Redirect to the new branch dashboard
            // Response structure: { org: {...}, branch: {...} }
            const branchId = res.branch.id;
            router.push(`/branch/${branchId}`);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to complete setup. Please try again.";
            console.error("Setup failed", err);
            setError(message);
            setLoading(false);
        }
    };

    return (
        <div className="relative flex min-h-[100dvh] flex-col items-center justify-start overflow-x-hidden overflow-y-auto bg-[#050508] p-4 py-8 font-sans text-white sm:justify-center sm:p-6">
            <AmbientBackground />

            <div className="relative z-10 max-w-2xl w-full">
                <div className="mb-6 text-center sm:mb-10">
                    <h2 className="mb-2 text-2xl font-bold text-white sm:text-3xl">
                        <GlowText>
                            {step === 1 ? "Create your organization" : "Setup your first branch"}
                        </GlowText>
                    </h2>
                    <p className={formHelpTextClass}>
                        {step === 1
                            ? "This represents your business identity."
                            : "Define your capacity and operations."}
                    </p>
                </div>

                <Card className="max-h-none overflow-visible border-[color:var(--ui-form-surface-border)] bg-[color:var(--ui-form-dialog-bg)] p-5 backdrop-blur-xl sm:max-h-[80vh] sm:overflow-y-auto sm:p-8">
                    {step === 1 && (
                        <div className="space-y-6">
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

                            <Button
                                onClick={handleNext}
                                className="w-full justify-center mt-4"
                            >
                                Continue <ArrowRight size={16} className="ml-2" />
                            </Button>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-6">
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
                                        City / Area <span className={formHelpTextClass}>(Opt)</span>
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
                                <div className="flex items-center justify-between">
                                    <label className={cn("block", formLabelClass)}>
                                        Shifts & Pricing
                                    </label>
                                    <button
                                        onClick={addShift}
                                        className="text-xs text-[color:var(--ui-form-accent)] hover:text-[color:var(--ui-form-accent-hover)]"
                                    >
                                        + Add Shift
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
                                                    onClick={() => removeShift(idx)}
                                                    className={cn("self-end hover:text-[color:var(--ui-form-error-text)] sm:mt-1", formHelpTextClass)}
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

                            <Button
                                onClick={handleSubmit}
                                className="w-full justify-center mt-4"
                                disabled={loading}
                                variant="cyan"
                            >
                                {loading ? <Loader2 className="animate-spin mr-2" /> : null}
                                {loading ? "Setting up..." : "Finish Setup"}
                            </Button>
                        </div>
                    )}

                    {error && (
                        <div className={cn("mt-4 p-3 text-center text-sm", formErrorBannerClass)}>
                            {error}
                        </div>
                    )}
                </Card>

                {step === 2 && (
                    <button
                        onClick={() => setStep(1)}
                        className={cn("mt-4 w-full text-center text-sm transition-colors hover:text-[color:var(--ui-form-label)]", formHelpTextClass)}
                        disabled={loading}
                    >
                        Back to Organization details
                    </button>
                )}
            </div>
        </div>
    );
}
