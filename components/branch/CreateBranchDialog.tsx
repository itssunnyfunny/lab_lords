"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { X, MapPin, Loader2, Plus, AlertCircle, AlertTriangle } from "lucide-react";
import { parseNullableTime, timesOverlap } from "@/utils/shiftTime";

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
    price: number;
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
    { name: "Morning", startTime: "06:00", endTime: "11:59", price: 0 },
    { name: "Afternoon", startTime: "12:00", endTime: "16:59", price: 0 },
    { name: "Evening", startTime: "17:00", endTime: "22:00", price: 0 },
    { name: "Full Time", startTime: "06:00", endTime: "22:00", price: 0 },
];


export function CreateBranchDialog({
    isOpen,
    onClose,
    organizationId,
    onSuccess,
}: CreateBranchDialogProps) {
    const [formData, setFormData] = useState({
        name: "",
        city: "",
        seatCount: "",
        defaultFee: "",
    });
    const [shifts, setShifts] = useState<ShiftDraft[]>(DEFAULT_SHIFTS);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Compute overlaps continuously
    const overlaps = (() => {
        const issues = new Map<number, { targetShiftIdx: number; text: string; fix1: { idx: number; field: "startTime" | "endTime"; val: string; label: string }; fix2: { idx: number; field: "startTime" | "endTime"; val: string; label: string } }>();
        for (let i = 0; i < shifts.length; i++) {
            for (let j = i + 1; j < shifts.length; j++) {
                const s1 = shifts[i];
                const s2 = shifts[j];
                if (!s1.startTime || !s1.endTime || !s2.startTime || !s2.endTime) continue;
                if (s1.name.toLowerCase() === "full time" || s2.name.toLowerCase() === "full time") continue;

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

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleShiftChange = (idx: number, field: keyof ShiftDraft, value: string | number) => {
        setShifts(prev => {
            const next = [...prev];
            next[idx] = { ...next[idx], [field]: value };
            return next;
        });
    };

    const addShift = () =>
        setShifts(prev => [...prev, { name: "", startTime: "", endTime: "", price: 0 }]);

    const removeShift = (idx: number) =>
        setShifts(prev => prev.filter((_, i) => i !== idx));

    const handleSubmit = async () => {
        setError(null);
        if (!formData.name.trim()) {
            setError("Branch name is required.");
            return;
        }
        if (!formData.seatCount || parseInt(formData.seatCount) <= 0) {
            setError("Please enter a valid number of seats.");
            return;
        }
        if (overlaps.size > 0) {
            setError("Please resolve all shift time overlaps before continuing.");
            return;
        }

        setLoading(true);
        try {
            const res = await fetch("/api/branches", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    organizationId,
                    name: formData.name.trim(),
                    city: formData.city.trim() || undefined,
                    seatCount: parseInt(formData.seatCount),
                    defaultFee: formData.defaultFee ? parseInt(formData.defaultFee) : 0,
                    shifts: shifts
                        .filter(s => s.name.trim())
                        .map(s => ({
                            ...s,
                            price: Number(s.price),
                            startTime: s.startTime || null,
                            endTime: s.endTime || null,
                        })),
                }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || "Failed to create branch");
            }

            const branch = await res.json();
            // Reset form
            setFormData({ name: "", city: "", seatCount: "", defaultFee: "" });
            setShifts(DEFAULT_SHIFTS);
            onSuccess(branch);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Something went wrong.");
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        if (loading) return;
        setFormData({ name: "", city: "", seatCount: "", defaultFee: "" });
        setShifts(DEFAULT_SHIFTS);
        setError(null);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={handleClose}
            />

            {/* Dialog */}
            <div className="relative w-full max-w-lg bg-[#0f111a] border border-white/10 rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/10">
                    <div>
                        <h2 className="text-lg font-bold text-white">Create New Branch</h2>
                        <p className="text-sm text-gray-400 mt-0.5">Set up a new location under this organization.</p>
                    </div>
                    <button
                        onClick={handleClose}
                        disabled={loading}
                        className="text-gray-500 hover:text-white transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-5">
                    {/* Branch Name */}
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-300">
                            Branch Name <span className="text-red-400">*</span>
                        </label>
                        <div className="relative">
                            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                            <input
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                placeholder="e.g. Main Branch, Downtown"
                                autoFocus
                                className="w-full bg-white/5 border border-white/10 rounded-lg py-2.5 pl-9 pr-4 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 transition-all text-sm"
                            />
                        </div>
                    </div>

                    {/* City + Seats */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-300">
                                City / Area <span className="text-gray-500">(Optional)</span>
                            </label>
                            <input
                                type="text"
                                name="city"
                                value={formData.city}
                                onChange={handleChange}
                                placeholder="e.g. Mumbai"
                                className="w-full bg-white/5 border border-white/10 rounded-lg py-2.5 px-4 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 transition-all text-sm"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-300">
                                Total Seats <span className="text-red-400">*</span>
                            </label>
                            <input
                                type="number"
                                name="seatCount"
                                value={formData.seatCount}
                                onChange={handleChange}
                                placeholder="e.g. 50"
                                min="1"
                                className="w-full bg-white/5 border border-white/10 rounded-lg py-2.5 px-4 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 transition-all text-sm"
                            />
                        </div>
                    </div>

                    {/* Default Monthly Fee */}
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-300">
                            Default Monthly Fee <span className="text-gray-500">(Optional)</span>
                        </label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">₹</span>
                            <input
                                type="number"
                                name="defaultFee"
                                value={formData.defaultFee}
                                onChange={handleChange}
                                placeholder="e.g. 1500"
                                min="0"
                                className="w-full bg-white/5 border border-white/10 rounded-lg py-2.5 pl-7 pr-4 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 transition-all text-sm"
                            />
                        </div>
                    </div>

                    {/* Shifts */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-medium text-gray-300">Shifts & Pricing</label>
                            <button
                                onClick={addShift}
                                className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                            >
                                <Plus size={12} /> Add Shift
                            </button>
                        </div>

                        <div className="space-y-3">
                            {shifts.map((shift, idx) => (
                                <div key={idx} className="flex flex-col gap-1">
                                <div className="flex gap-2 items-center p-3 bg-white/5 rounded-lg border border-white/5">
                                    <div className="flex-1 grid grid-cols-12 gap-2 items-center">
                                        <div className="col-span-4">
                                            <input
                                                type="text"
                                                placeholder="Name"
                                                value={shift.name}
                                                onChange={(e) => handleShiftChange(idx, "name", e.target.value)}
                                                className="w-full bg-transparent border-b border-white/10 py-1 text-xs text-white focus:outline-none focus:border-cyan-500"
                                            />
                                        </div>
                                        <div className="col-span-3">
                                            <input
                                                type="time"
                                                value={shift.startTime}
                                                onChange={(e) => handleShiftChange(idx, "startTime", e.target.value)}
                                                className="w-full bg-transparent border-b border-white/10 py-1 text-xs text-white focus:outline-none focus:border-cyan-500"
                                            />
                                        </div>
                                        <div className="col-span-3">
                                            <input
                                                type="time"
                                                value={shift.endTime}
                                                onChange={(e) => handleShiftChange(idx, "endTime", e.target.value)}
                                                className="w-full bg-transparent border-b border-white/10 py-1 text-xs text-white focus:outline-none focus:border-cyan-500"
                                            />
                                        </div>
                                        <div className="col-span-2 relative">
                                            <span className="absolute left-0 top-1 text-gray-500 text-xs">₹</span>
                                            <input
                                                type="number"
                                                placeholder="0"
                                                value={shift.price}
                                                onChange={(e) => handleShiftChange(idx, "price", e.target.value)}
                                                className="w-full bg-transparent border-b border-white/10 py-1 pl-3 text-xs text-white focus:outline-none focus:border-cyan-500"
                                            />
                                        </div>
                                    </div>
                                    {shifts.length > 1 && (
                                        <button
                                            onClick={() => removeShift(idx)}
                                            className="text-gray-500 hover:text-red-400 transition-colors ml-1 flex-shrink-0"
                                        >
                                            <X size={14} />
                                        </button>
                                    )}
                                </div>
                                {overlaps.has(idx) && (
                                    <div className="flex flex-col gap-1.5 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs mt-1">
                                        <div className="flex items-center gap-1.5 text-amber-400">
                                            <AlertTriangle size={12} />
                                            <span>{overlaps.get(idx)!.text}</span>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => handleShiftChange(overlaps.get(idx)!.fix1.idx, overlaps.get(idx)!.fix1.field, overlaps.get(idx)!.fix1.val)} className="text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 px-2 py-1 rounded transition-colors border border-amber-500/20">
                                                {overlaps.get(idx)!.fix1.label}
                                            </button>
                                            <button onClick={() => handleShiftChange(overlaps.get(idx)!.fix2.idx, overlaps.get(idx)!.fix2.field, overlaps.get(idx)!.fix2.val)} className="text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 px-2 py-1 rounded transition-colors border border-amber-500/20">
                                                {overlaps.get(idx)!.fix2.label}
                                            </button>
                                        </div>
                                    </div>
                                )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                            <AlertCircle size={14} />
                            {error}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 p-6 border-t border-white/10">
                    <Button variant="ghost" onClick={handleClose} disabled={loading}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={loading || !formData.name.trim() || !formData.seatCount || overlaps.size > 0}
                        className="min-w-[130px] justify-center"
                    >
                        {loading ? (
                            <><Loader2 size={14} className="animate-spin mr-2" /> Creating...</>
                        ) : (
                            "Create Branch"
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}
