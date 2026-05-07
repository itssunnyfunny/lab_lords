"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { X, Loader2, AlertCircle, User, Phone, IndianRupee } from "lucide-react";
import type { Student } from "@/app/generated/prisma/browser";
import { FORM_LIMITS, parseIntegerField, validatePhone, validateRequiredText } from "@/lib/formValidation";

interface EditStudentDialogProps {
    isOpen: boolean;
    student: Student | null;
    branchId: string;
    onClose: () => void;
    onSuccess: (updated: Student) => void;
}

export function EditStudentDialog({
    isOpen,
    student,
    branchId,
    onClose,
    onSuccess,
}: EditStudentDialogProps) {
    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [monthlyFee, setMonthlyFee] = useState<string>("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Sync form when student changes
    useEffect(() => {
        if (student) {
            setName(student.name ?? "");
            setPhone(student.phone ?? "");
            setMonthlyFee(student.monthlyFee != null ? String(student.monthlyFee) : "");
            setError(null);
        }
    }, [student]);

    if (!isOpen || !student) return null;

    const currentFeeStr = student.monthlyFee != null ? String(student.monthlyFee) : "";
    const linkedFeeSource = student.feeLinkedMultiShiftId
        ? "multi-shift price"
        : student.feeLinkedShiftId
            ? "shift price"
            : null;
    const hasChanges =
        name.trim() !== (student.name ?? "") ||
        phone.trim() !== (student.phone ?? "") ||
        monthlyFee !== currentFeeStr;

    const handleSave = async () => {
        const nameResult = validateRequiredText(name, "Student name");
        if (!nameResult.ok) {
            setError(nameResult.error);
            return;
        }
        const phoneResult = validatePhone(phone);
        if (!phoneResult.ok) {
            setError(phoneResult.error);
            return;
        }
        const monthlyFeeResult = monthlyFee !== currentFeeStr && monthlyFee.trim() !== ""
            ? parseIntegerField(monthlyFee, "Monthly fee", { min: 0, max: FORM_LIMITS.moneyMax })
            : null;
        if (monthlyFeeResult && !monthlyFeeResult.ok) {
            setError(monthlyFeeResult.error);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/branches/${branchId}/students`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: student.id,
                    name: nameResult.value,
                    phone: phoneResult.value ?? null,
                    ...(monthlyFeeResult?.ok && monthlyFeeResult.value !== undefined ? { monthlyFee: monthlyFeeResult.value } : {}),
                }),
            });
            if (!res.ok) {
                const d = await res.json().catch(() => ({}));
                throw new Error(d.error || "Failed to update");
            }
            const updated = await res.json();
            onSuccess(updated);
            onClose();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Something went wrong.");
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        if (loading) return;
        setError(null);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />

            <div className="relative w-full max-w-sm bg-[#0f111a] border border-white/10 rounded-2xl shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                    <div>
                        <h2 className="text-base font-bold text-white">Edit Student</h2>
                        <p className="text-xs text-gray-500 mt-0.5">Update profile details</p>
                    </div>
                    <button onClick={handleClose} disabled={loading} className="text-gray-500 hover:text-white transition-colors">
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4">
                    {/* Name */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Full Name *</label>
                        <div className="relative">
                            <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                            <input
                                type="text"
                                value={name}
                                onChange={e => { setName(e.target.value); setError(null); }}
                                placeholder="Student's full name"
                                autoFocus
                                maxLength={FORM_LIMITS.nameMax}
                                className="w-full bg-white/5 border border-white/10 rounded-lg py-2.5 pl-9 pr-4 text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 text-sm transition-all"
                            />
                        </div>
                    </div>

                    {/* Phone */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Phone Number</label>
                        <div className="relative">
                            <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                            <input
                                type="tel"
                                value={phone}
                                onChange={e => { setPhone(e.target.value); setError(null); }}
                                placeholder="e.g. 9876543210"
                                inputMode="tel"
                                maxLength={24}
                                className="w-full bg-white/5 border border-white/10 rounded-lg py-2.5 pl-9 pr-4 text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 text-sm transition-all"
                            />
                        </div>
                    </div>

                    {/* Monthly Fee */}
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-3">
                            <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Monthly Fee</label>
                            {linkedFeeSource && (
                                <span className="text-[10px] font-medium uppercase tracking-wider text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 rounded-full px-2 py-0.5">
                                    Linked
                                </span>
                            )}
                        </div>
                        <div className="relative">
                            <IndianRupee size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                            <input
                                type="number"
                                min={0}
                                max={FORM_LIMITS.moneyMax}
                                step={1}
                                inputMode="numeric"
                                value={monthlyFee}
                                onChange={e => { setMonthlyFee(e.target.value); setError(null); }}
                                placeholder="e.g. 1500"
                                className="w-full bg-white/5 border border-white/10 rounded-lg py-2.5 pl-9 pr-4 text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 text-sm transition-all"
                            />
                        </div>
                        {linkedFeeSource && (
                            <p className="text-[11px] text-zinc-500 leading-relaxed">
                                Currently linked to {linkedFeeSource}. Editing this amount will switch the student to a manual fee.
                            </p>
                        )}
                    </div>

                    {error && (
                        <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                            <AlertCircle size={13} /> {error}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 px-6 py-4 border-t border-white/10">
                    <Button variant="ghost" onClick={handleClose} disabled={loading} className="text-sm h-8 px-3">
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={loading || !hasChanges || !name.trim()}
                        className="text-sm h-8 px-4 min-w-[90px] justify-center"
                    >
                        {loading
                            ? <><Loader2 size={12} className="animate-spin mr-1.5" /> Saving...</>
                            : "Save Changes"
                        }
                    </Button>
                </div>
            </div>
        </div>
    );
}
