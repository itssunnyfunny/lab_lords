"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AmbientBackground } from "@/components/ui/AmbientBackground";
import { GlowText } from "@/components/ui/GlowText";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ArrowRight, Building2, MapPin, Loader2, X } from "lucide-react";
import { apiClient } from "@/lib/api/core";
import {
    FORM_LIMITS,
    parseIntegerField,
    validateOptionalText,
    validateRequiredText,
    validateShiftDrafts,
} from "@/lib/formValidation";

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

    // Form State
    const [formData, setFormData] = useState({
        orgName: "",
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
    };

    const handleShiftChange = (index: number, field: keyof OnboardingShiftDraft, value: string | number) => {
        const newShifts = [...formData.shifts];
        newShifts[index] = { ...newShifts[index], [field]: value };
        setFormData(prev => ({ ...prev, shifts: newShifts }));
    };

    const addShift = () => {
        setFormData(prev => ({
            ...prev,
            shifts: [...prev.shifts, { name: "", startTime: "", endTime: "", price: 0 }]
        }));
    };

    const removeShift = (index: number) => {
        setFormData(prev => ({
            ...prev,
            shifts: prev.shifts.filter((_, i) => i !== index)
        }));
    };

    const handleNext = () => {
        const orgNameResult = validateRequiredText(formData.orgName, "Organization name", 120);
        if (!orgNameResult.ok) {
            setError(orgNameResult.error);
            return;
        }
        const businessTypeResult = validateOptionalText(formData.businessType, "Business type", 80);
        if (!businessTypeResult.ok) {
            setError(businessTypeResult.error);
            return;
        }
        setError(null);
        setStep(2);
    };

    const handleSubmit = async () => {
        const orgNameResult = validateRequiredText(formData.orgName, "Organization name", 120);
        if (!orgNameResult.ok) {
            setError(orgNameResult.error);
            return;
        }
        const businessTypeResult = validateOptionalText(formData.businessType, "Business type", 80);
        if (!businessTypeResult.ok) {
            setError(businessTypeResult.error);
            return;
        }
        const branchNameResult = validateRequiredText(formData.branchName, "Branch name", 120);
        if (!branchNameResult.ok) {
            setError(branchNameResult.error);
            return;
        }
        const cityResult = validateOptionalText(formData.city, "City / area", FORM_LIMITS.cityMax);
        if (!cityResult.ok) {
            setError(cityResult.error);
            return;
        }
        const seatCountResult = parseIntegerField(formData.seatCount, "Total seats", {
            required: true,
            min: 1,
            max: FORM_LIMITS.seatsMax,
        });
        if (!seatCountResult.ok) {
            setError(seatCountResult.error);
            return;
        }
        const shiftsResult = validateShiftDrafts(formData.shifts);
        if (!shiftsResult.ok) {
            setError(shiftsResult.error);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const res = await apiClient.post("/onboarding", {
                orgName: orgNameResult.value,
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
                    <p className="text-gray-400">
                        {step === 1
                            ? "This represents your business identity."
                            : "Define your capacity and operations."}
                    </p>
                </div>

                <Card className="max-h-none overflow-visible border-white/10 bg-[#0f111a]/60 p-5 backdrop-blur-xl sm:max-h-[80vh] sm:overflow-y-auto sm:p-8">
                    {step === 1 && (
                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Organization Name <span className="text-red-400">*</span>
                                </label>
                                <div className="relative">
                                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                                    <input
                                        type="text"
                                        name="orgName"
                                        value={formData.orgName}
                                        onChange={handleInputChange}
                                        placeholder="e.g. Apex Study Halls"
                                        maxLength={120}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg py-3 pl-10 pr-4 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all"
                                        autoFocus
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Business Type <span className="text-gray-500">(Optional)</span>
                                </label>
                                <select
                                    name="businessType"
                                    value={formData.businessType}
                                    onChange={handleInputChange}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg py-3 px-4 text-white focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all appearance-none"
                                >
                                    <option value="" className="bg-[#0f111a] text-gray-500">Select type...</option>
                                    <option value="Study Hall" className="bg-[#0f111a]">Study Hall</option>
                                    <option value="Library" className="bg-[#0f111a]">Library</option>
                                    <option value="Coaching Center" className="bg-[#0f111a]">Coaching Center</option>
                                    <option value="Tuition" className="bg-[#0f111a]">Tuition</option>
                                    <option value="Other" className="bg-[#0f111a]">Other</option>
                                </select>
                            </div>

                            <Button
                                onClick={handleNext}
                                className="w-full justify-center mt-4"
                                disabled={!formData.orgName}
                            >
                                Continue <ArrowRight size={16} className="ml-2" />
                            </Button>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Branch Name <span className="text-red-400">*</span>
                                </label>
                                <div className="relative">
                                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                                    <input
                                        type="text"
                                        name="branchName"
                                        value={formData.branchName}
                                        onChange={handleInputChange}
                                        placeholder="e.g. Main Branch, Downtown"
                                        maxLength={120}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg py-3 pl-10 pr-4 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all"
                                        autoFocus
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        City / Area <span className="text-gray-500">(Opt)</span>
                                    </label>
                                    <input
                                        type="text"
                                        name="city"
                                        value={formData.city}
                                        onChange={handleInputChange}
                                        placeholder="e.g. New York"
                                        maxLength={FORM_LIMITS.cityMax}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg py-3 px-4 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        Total Seats <span className="text-red-400">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        name="seatCount"
                                        value={formData.seatCount}
                                        onChange={handleInputChange}
                                        placeholder="e.g. 50"
                                        min="1"
                                        max={FORM_LIMITS.seatsMax}
                                        step="1"
                                        inputMode="numeric"
                                        className="w-full bg-white/5 border border-white/10 rounded-lg py-3 px-4 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all"
                                    />
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="block text-sm font-medium text-gray-300">
                                        Shifts & Pricing
                                    </label>
                                    <button
                                        onClick={addShift}
                                        className="text-xs text-cyan-400 hover:text-cyan-300"
                                    >
                                        + Add Shift
                                    </button>
                                </div>

                                <div className="space-y-3">
                                    {formData.shifts.map((shift, idx) => (
                                        <div key={idx} className="flex flex-col gap-3 rounded-lg border border-white/5 bg-white/5 p-3 sm:flex-row sm:items-start sm:gap-2">
                                            <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-12 sm:gap-2">
                                                <div className="sm:col-span-4">
                                                    <input
                                                        type="text"
                                                        placeholder="Name"
                                                        value={shift.name}
                                                        onChange={(e) => handleShiftChange(idx, "name", e.target.value)}
                                                        className="w-full bg-transparent border-b border-white/10 py-1 text-sm text-white focus:outline-none focus:border-cyan-500"
                                                    />
                                                </div>
                                                <div className="sm:col-span-3">
                                                    <input
                                                        type="time"
                                                        value={shift.startTime || ""}
                                                        onChange={(e) => handleShiftChange(idx, "startTime", e.target.value)}
                                                        className="w-full bg-transparent border-b border-white/10 py-1 text-sm text-white focus:outline-none focus:border-cyan-500"
                                                    />
                                                </div>
                                                <div className="sm:col-span-3">
                                                    <input
                                                        type="time"
                                                        value={shift.endTime || ""}
                                                        onChange={(e) => handleShiftChange(idx, "endTime", e.target.value)}
                                                        className="w-full bg-transparent border-b border-white/10 py-1 text-sm text-white focus:outline-none focus:border-cyan-500"
                                                    />
                                                </div>
                                                <div className="relative sm:col-span-2">
                                                    <span className="absolute left-0 top-1 text-xs text-gray-500">Rs.</span>
                                                    <input
                                                        type="number"
                                                        placeholder="Price"
                                                        value={shift.price}
                                                        onChange={(e) => handleShiftChange(idx, "price", e.target.value)}
                                                        min={0}
                                                        max={FORM_LIMITS.moneyMax}
                                                        step={1}
                                                        inputMode="numeric"
                                                        className="w-full border-b border-white/10 bg-transparent py-1 pl-6 text-sm text-white focus:border-cyan-500 focus:outline-none"
                                                    />
                                                </div>
                                            </div>
                                            {formData.shifts.length > 1 && (
                                                <button
                                                    onClick={() => removeShift(idx)}
                                                    className="self-end text-gray-500 hover:text-red-400 sm:mt-1"
                                                    aria-label="Remove shift"
                                                >
                                                    <X size={14} />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <Button
                                onClick={handleSubmit}
                                className="w-full justify-center mt-4"
                                disabled={loading || !formData.branchName || !formData.seatCount}
                                variant="cyan"
                            >
                                {loading ? <Loader2 className="animate-spin mr-2" /> : null}
                                {loading ? "Setting up..." : "Finish Setup"}
                            </Button>
                        </div>
                    )}

                    {error && (
                        <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm text-center">
                            {error}
                        </div>
                    )}
                </Card>

                {step === 2 && (
                    <button
                        onClick={() => setStep(1)}
                        className="w-full text-center mt-4 text-sm text-gray-500 hover:text-gray-300 transition-colors"
                        disabled={loading}
                    >
                        Back to Organization details
                    </button>
                )}
            </div>
        </div>
    );
}
