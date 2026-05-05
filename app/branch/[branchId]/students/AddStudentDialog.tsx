"use client";

import { useEffect, useState } from "react";
import { X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { students } from "@/lib/api/students";
import { CreateStudentDto } from "@/types";
import { SeatPicker } from "@/components/allocations/SeatPicker";
import { FORM_LIMITS, parseIntegerField, validatePhone, validateRequiredText } from "@/lib/formValidation";

interface AddStudentDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (student: unknown) => void;
    branchId: string;
}

export function AddStudentDialog({ isOpen, onClose, onSuccess, branchId }: AddStudentDialogProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [formData, setFormData] = useState<CreateStudentDto>({
        name: "",
        phone: "",
        monthlyFee: undefined,
        admissionFee: undefined,
    });

    // Integrated allocation state
    const [wantsAllocation, setWantsAllocation] = useState(false);
    const [selectedShiftIds, setSelectedShiftIds] = useState<string[]>([]);   // always primary shift IDs
    const [selectedMultiShiftId, setSelectedMultiShiftId] = useState<string | null>(null);
    const [selectedSeatId, setSelectedSeatId] = useState<string | null>(null);
    const [createdStudentId, setCreatedStudentId] = useState<string | null>(null);
    const [linkFeeToSelection, setLinkFeeToSelection] = useState(false);

    useEffect(() => {
        if (!isOpen) {
            setError(null);
            setFormData({ name: "", phone: "", monthlyFee: undefined, admissionFee: undefined });
            setWantsAllocation(false);
            setSelectedShiftIds([]);
            setSelectedMultiShiftId(null);
            setSelectedSeatId(null);
            setCreatedStudentId(null);
            setLinkFeeToSelection(false);
        }
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        async function loadBranchDefaults() {
            try {
                const res = await fetch(`/api/branches/${branchId}`);
                if (!res.ok) return;
                const branch = await res.json();
                setFormData(prev => ({
                    ...prev,
                    admissionFee: prev.admissionFee ?? branch.defaultAdmissionFee ?? undefined,
                }));
            } catch (err) {
                console.error(err);
            }
        }
        loadBranchDefaults();
    }, [branchId, isOpen]);

    const feeLinkLabel = selectedMultiShiftId
        ? "selected multi-shift"
        : selectedShiftIds.length === 1
            ? "selected shift"
            : null;

    useEffect(() => {
        if (!feeLinkLabel) setLinkFeeToSelection(false);
    }, [feeLinkLabel]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        let payload: CreateStudentDto | null = null;

        if (!createdStudentId) {
            const nameResult = validateRequiredText(formData.name, "Student name");
            if (!nameResult.ok) {
                setError(nameResult.error);
                return;
            }
            const phoneResult = validatePhone(formData.phone);
            if (!phoneResult.ok) {
                setError(phoneResult.error);
                return;
            }
            const monthlyFeeResult = parseIntegerField(formData.monthlyFee, "Monthly fee", {
                min: 0,
                max: FORM_LIMITS.moneyMax,
            });
            if (!monthlyFeeResult.ok) {
                setError(monthlyFeeResult.error);
                return;
            }
            const admissionFeeResult = parseIntegerField(formData.admissionFee, "Admission fee", {
                min: 0,
                max: FORM_LIMITS.moneyMax,
            });
            if (!admissionFeeResult.ok) {
                setError(admissionFeeResult.error);
                return;
            }

            payload = {
                name: nameResult.value,
                ...(phoneResult.value ? { phone: phoneResult.value } : {}),
                ...(monthlyFeeResult.value !== undefined ? { monthlyFee: monthlyFeeResult.value } : {}),
                ...(admissionFeeResult.value !== undefined ? { admissionFee: admissionFeeResult.value } : {}),
            };
        }

        if (wantsAllocation && (selectedShiftIds.length === 0 || !selectedSeatId)) {
            setError("Please select at least one shift and a seat, or uncheck allocation.");
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            // 1. Create student if not already created (handles race-condition retries cleanly)
            let studentToAllocateTo = createdStudentId;
            let finalStudentObj;

            if (!studentToAllocateTo) {
                if (!payload) throw new Error("Student details are required.");
                const studentPayload: CreateStudentDto = {
                    ...payload,
                    ...(linkFeeToSelection && selectedMultiShiftId
                        ? {
                            monthlyFee: undefined,
                            feeLinkedShiftId: null,
                            feeLinkedMultiShiftId: selectedMultiShiftId,
                        }
                        : linkFeeToSelection && selectedShiftIds.length === 1
                            ? {
                                monthlyFee: undefined,
                                feeLinkedShiftId: selectedShiftIds[0],
                                feeLinkedMultiShiftId: null,
                            }
                            : {
                                feeLinkedShiftId: null,
                                feeLinkedMultiShiftId: null,
                            }),
                };

                finalStudentObj = await students.create(branchId, studentPayload);
                studentToAllocateTo = finalStudentObj.id;
                setCreatedStudentId(studentToAllocateTo);
            }

            // 2. Allocate seat if toggled
            if (wantsAllocation && selectedShiftIds.length > 0 && selectedSeatId && studentToAllocateTo) {
                const res = await fetch(`/api/branches/${branchId}/seat-allocations`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        studentId: studentToAllocateTo,
                        seatId: selectedSeatId,
                        shiftIds: selectedShiftIds,   // always primary shift IDs
                        ...(selectedMultiShiftId ? { multiShiftId: selectedMultiShiftId } : {}),
                    }),
                });

                if (!res.ok) {
                    const data = await res.json();
                    throw new Error(data.error || "Student created, but seat allocation failed. Please select another seat and try again.");
                }
            }

            // Success completely
            onSuccess(finalStudentObj || { id: studentToAllocateTo, name: payload?.name ?? formData.name.trim() });
            onClose();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Something went wrong.";
            setError(message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                className="w-full max-w-2xl bg-[#0a0c14] border border-white/10 rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/[0.02] flex-shrink-0">
                    <h2 className="text-lg font-semibold text-white">Add New Student</h2>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto custom-scrollbar">
                    <form id="add-student-form" onSubmit={handleSubmit} noValidate className="space-y-6">
                        {error && (
                            <div className="p-3 text-sm text-red-200 bg-red-900/30 border border-red-900/50 rounded-md">
                                {error}
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label htmlFor="name" className="text-sm font-medium text-zinc-400">
                                    Full Name <span className="text-red-400">*</span>
                                </label>
                                <input
                                    id="name"
                                    type="text"
                                    disabled={!!createdStudentId || isLoading}
                                    value={formData.name}
                                    onChange={(e) => { setFormData({ ...formData, name: e.target.value }); setError(null); }}
                                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-white placeholder:text-zinc-600 disabled:opacity-50"
                                    placeholder="e.g. John Doe"
                                    autoFocus
                                    maxLength={FORM_LIMITS.nameMax}
                                />
                            </div>

                            <div className="space-y-2">
                                <label htmlFor="phone" className="text-sm font-medium text-zinc-400">
                                    Phone Number
                                </label>
                                <input
                                    id="phone"
                                    type="tel"
                                    disabled={!!createdStudentId || isLoading}
                                    value={formData.phone || ""}
                                    onChange={(e) => { setFormData({ ...formData, phone: e.target.value }); setError(null); }}
                                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-white placeholder:text-zinc-600 disabled:opacity-50"
                                    placeholder="e.g. +91 98765 43210"
                                    inputMode="tel"
                                    maxLength={24}
                                />
                            </div>

                            <div className="space-y-2">
                                <label htmlFor="monthlyFee" className="text-sm font-medium text-zinc-400">
                                    Monthly Fee
                                </label>
                                <input
                                    id="monthlyFee"
                                    type="number"
                                    disabled={!!createdStudentId || isLoading || linkFeeToSelection}
                                    value={formData.monthlyFee ?? ""}
                                    onChange={(e) => {
                                        setFormData({
                                            ...formData,
                                            monthlyFee: e.target.value ? Number(e.target.value) : undefined,
                                        });
                                        setError(null);
                                    }}
                                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-white placeholder:text-zinc-600 disabled:opacity-50"
                                    placeholder={linkFeeToSelection ? "Linked to shift price" : "Branch default"}
                                    min={0}
                                    max={FORM_LIMITS.moneyMax}
                                    step={1}
                                    inputMode="numeric"
                                />
                            </div>

                            <div className="space-y-2">
                                <label htmlFor="admissionFee" className="text-sm font-medium text-zinc-400">
                                    Admission Fee
                                </label>
                                <input
                                    id="admissionFee"
                                    type="number"
                                    disabled={!!createdStudentId || isLoading}
                                    value={formData.admissionFee ?? ""}
                                    onChange={(e) => {
                                        setFormData({
                                            ...formData,
                                            admissionFee: e.target.value ? Number(e.target.value) : undefined,
                                        });
                                        setError(null);
                                    }}
                                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-white placeholder:text-zinc-600 disabled:opacity-50"
                                    placeholder="One-time"
                                    min={0}
                                    max={FORM_LIMITS.moneyMax}
                                    step={1}
                                    inputMode="numeric"
                                />
                            </div>
                        </div>

                        {createdStudentId && (
                            <div className="p-3 text-sm text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                                Student profile saved. Pick a different seat and try allocating again.
                            </div>
                        )}

                        <hr className="border-white/5" />

                        <div className="space-y-4">
                            <label className="flex items-center gap-3 cursor-pointer group w-max">
                                <input
                                    type="checkbox"
                                    checked={wantsAllocation}
                                    onChange={(e) => setWantsAllocation(e.target.checked)}
                                    className="w-4 h-4 rounded border-white/20 bg-white/5 accent-indigo-500 focus:ring-indigo-500/50"
                                />
                                <span className="text-sm font-medium text-white group-hover:text-indigo-200 transition-colors">
                                    Allocate seat now (Optional)
                                </span>
                            </label>

                            {wantsAllocation && (
                                <div className="mt-4 p-5 rounded-xl border border-white/5 bg-white/[0.01]">
                                    <SeatPicker
                                        branchId={branchId}
                                        selectedShiftIds={selectedShiftIds}
                                        selectedSeatId={selectedSeatId}
                                        onToggleShift={(s) => {
                                            setSelectedSeatId(null);
                                            if (s.type === "MULTISHIFT") {
                                                // Toggle multi-shift: expand to component primary shift IDs
                                                if (selectedMultiShiftId === s.shiftId) {
                                                    setSelectedMultiShiftId(null);
                                                    setSelectedShiftIds([]);
                                                } else {
                                                    setSelectedMultiShiftId(s.shiftId);
                                                    setSelectedShiftIds(s.componentShiftIds ?? []);
                                                }
                                            } else {
                                                // Primary shift toggle — clear any active multi-shift
                                                setSelectedMultiShiftId(null);
                                                setSelectedShiftIds(prev =>
                                                    prev.includes(s.shiftId)
                                                        ? prev.filter(id => id !== s.shiftId)
                                                        : [...prev, s.shiftId]
                                                );
                                            }
                                        }}
                                        onSelectSeat={setSelectedSeatId}
                                    />

                                    {feeLinkLabel && (
                                        <label className="mt-4 flex items-center gap-3 cursor-pointer group w-max">
                                            <input
                                                type="checkbox"
                                                checked={linkFeeToSelection}
                                                onChange={(e) => setLinkFeeToSelection(e.target.checked)}
                                                className="w-4 h-4 rounded border-white/20 bg-white/5 accent-indigo-500 focus:ring-indigo-500/50"
                                            />
                                            <span className="text-sm font-medium text-white group-hover:text-indigo-200 transition-colors">
                                                Link monthly fee to {feeLinkLabel} price
                                            </span>
                                        </label>
                                    )}
                                </div>
                            )}
                        </div>
                    </form>
                </div>

                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/5 bg-white/[0.01] flex-shrink-0">
                    <Button type="button" variant="ghost" onClick={onClose} disabled={isLoading}>
                        Cancel
                    </Button>
                    <Button type="submit" form="add-student-form" disabled={isLoading || (wantsAllocation && (selectedShiftIds.length === 0 || !selectedSeatId))} className="min-w-[140px]">
                        {isLoading ? (
                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
                        ) : wantsAllocation ? (
                            "Save & Allocate"
                        ) : (
                            "Add Student"
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}
