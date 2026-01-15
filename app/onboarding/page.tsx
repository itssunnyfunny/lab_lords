"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AmbientBackground } from "@/components/ui/AmbientBackground";
import { GlowText } from "@/components/ui/GlowText";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ArrowRight, Building2, MapPin, Loader2, X } from "lucide-react";
import { apiClient } from "@/lib/api/core";

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
        ]
    });

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleShiftChange = (index: number, field: string, value: any) => {
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
        if (!formData.orgName) {
            setError("Organization name is required.");
            return;
        }
        setError(null);
        setStep(2);
    };

    const handleSubmit = async () => {
        if (!formData.branchName) {
            setError("Branch name is required.");
            return;
        }
        if (!formData.seatCount || parseInt(formData.seatCount) <= 0) {
            setError("Please enter a valid number of seats.");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const res = await apiClient.post("/onboarding", {
                orgName: formData.orgName,
                businessType: formData.businessType,
                branchName: formData.branchName,
                city: formData.city,
                seatCount: parseInt(formData.seatCount),
                shifts: formData.shifts.map(s => ({
                    ...s,
                    price: Number(s.price) // ensure number
                }))
            });

            // Success -> Redirect to the new branch dashboard
            // Response structure: { org: {...}, branch: {...} }
            const branchId = (res as any).branch.id;
            router.push(`/branch/${branchId}`);
        } catch (err: any) {
            console.error("Setup failed", err);
            setError(err.message || "Failed to complete setup. Please try again.");
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans text-white bg-[#050508]">
            <AmbientBackground />

            <div className="relative z-10 max-w-2xl w-full">
                <div className="text-center mb-10">
                    <h2 className="text-3xl font-bold text-white mb-2">
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

                <Card className="p-8 bg-[#0f111a]/60 backdrop-blur-xl border-white/10 max-h-[80vh] overflow-y-auto">
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
                                        className="w-full bg-white/5 border border-white/10 rounded-lg py-3 pl-10 pr-4 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all"
                                        autoFocus
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
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
                                        <div key={idx} className="flex gap-2 items-start p-3 bg-white/5 rounded-lg border border-white/5">
                                            <div className="flex-1 grid grid-cols-12 gap-2">
                                                <div className="col-span-4">
                                                    <input
                                                        type="text"
                                                        placeholder="Name"
                                                        value={shift.name}
                                                        onChange={(e) => handleShiftChange(idx, "name", e.target.value)}
                                                        className="w-full bg-transparent border-b border-white/10 py-1 text-sm text-white focus:outline-none focus:border-cyan-500"
                                                    />
                                                </div>
                                                <div className="col-span-3">
                                                    <input
                                                        type="time"
                                                        value={shift.startTime || ""}
                                                        onChange={(e) => handleShiftChange(idx, "startTime", e.target.value)}
                                                        className="w-full bg-transparent border-b border-white/10 py-1 text-sm text-white focus:outline-none focus:border-cyan-500"
                                                    />
                                                </div>
                                                <div className="col-span-3">
                                                    <input
                                                        type="time"
                                                        value={shift.endTime || ""}
                                                        onChange={(e) => handleShiftChange(idx, "endTime", e.target.value)}
                                                        className="w-full bg-transparent border-b border-white/10 py-1 text-sm text-white focus:outline-none focus:border-cyan-500"
                                                    />
                                                </div>
                                                <div className="col-span-2 relative">
                                                    <span className="absolute left-0 top-1 text-gray-500 text-xs">₹</span>
                                                    <input
                                                        type="number"
                                                        placeholder="Price"
                                                        value={shift.price}
                                                        onChange={(e) => handleShiftChange(idx, "price", e.target.value)}
                                                        className="w-full bg-transparent border-b border-white/10 py-1 pl-3 text-sm text-white focus:outline-none focus:border-cyan-500"
                                                    />
                                                </div>
                                            </div>
                                            {formData.shifts.length > 1 && (
                                                <button
                                                    onClick={() => removeShift(idx)}
                                                    className="text-gray-500 hover:text-red-400 mt-1"
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
                        ← Back to Organization details
                    </button>
                )}
            </div>
        </div>
    );
}
