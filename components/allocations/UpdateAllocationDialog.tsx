"use client";

import { useEffect, useState } from "react";
import { X, Loader2, ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SeatPicker, ShiftCapacity } from "./SeatPicker";
import { FORM_LIMITS, parseIntegerField } from "@/lib/formValidation";

interface UpdateAllocationDialogProps {
    isOpen: boolean;
    branchId: string;
    allocationId: string;
    allocationIds: string[];
    studentId: string;
    studentName: string;
    currentSeatId: string;
    currentFee: number | null;
    currentShiftIds?: string[];
    currentMultiShiftId?: string | null;
    onClose: () => void;
    onSuccess: () => void;
}

export function UpdateAllocationDialog({
    isOpen,
    branchId,
    allocationId,
    allocationIds,
    studentId,
    studentName,
    currentSeatId,
    currentFee,
    currentShiftIds = [],
    currentMultiShiftId = null,
    onClose,
    onSuccess,
}: UpdateAllocationDialogProps) {
    const [selectedShiftIds, setSelectedShiftIds] = useState<string[]>(currentShiftIds);
    const [selectedShiftNames, setSelectedShiftNames] = useState<string[]>([]);
    const [selectedSeatId, setSelectedSeatId] = useState<string | null>(null);
    const [selectedMultiShiftId, setSelectedMultiShiftId] = useState<string | null>(currentMultiShiftId);
    const [selectedMultiShiftName, setSelectedMultiShiftName] = useState<string | null>(null);
    const [newFee, setNewFee] = useState<string>("");
    const [linkFeeToSelection, setLinkFeeToSelection] = useState(false);

    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        setSelectedShiftIds(currentShiftIds);
        setSelectedShiftNames([]);
        setSelectedSeatId(null);
        setSelectedMultiShiftId(currentMultiShiftId);
        setSelectedMultiShiftName(null);
        setNewFee("");
        setLinkFeeToSelection(false);
        setSubmitError(null);
    }, [isOpen, currentShiftIds, currentMultiShiftId]);

    const feeLinkLabel = selectedMultiShiftId
        ? "selected multi-shift"
        : selectedShiftIds.length === 1
            ? "selected shift"
            : null;

    useEffect(() => {
        if (!feeLinkLabel) setLinkFeeToSelection(false);
    }, [feeLinkLabel]);

    const handleToggleShift = (shift: ShiftCapacity) => {
        setSelectedSeatId(null);
        setSubmitError(null);

        if (shift.type === "MULTISHIFT") {
            if (selectedMultiShiftId === shift.shiftId) {
                setSelectedMultiShiftId(null);
                setSelectedMultiShiftName(null);
                setSelectedShiftIds([]);
                setSelectedShiftNames([]);
            } else {
                setSelectedMultiShiftId(shift.shiftId);
                setSelectedMultiShiftName(shift.name);
                setSelectedShiftIds(shift.componentShiftIds ?? []);
                setSelectedShiftNames([shift.name]);
            }
        } else {
            setSelectedMultiShiftId(null);
            setSelectedMultiShiftName(null);
            setSelectedShiftIds(prev => {
                const exists = prev.includes(shift.shiftId);
                if (exists) {
                    setSelectedShiftNames(names => names.filter(n => n !== shift.name));
                    return prev.filter(id => id !== shift.shiftId);
                }

                setSelectedShiftNames(names => [...names, shift.name]);
                return [...prev, shift.shiftId];
            });
        }
    };

    const handleConfirm = async () => {
        if (!selectedSeatId || selectedShiftIds.length === 0) return;
        const newFeeResult = newFee.trim() !== ""
            ? parseIntegerField(newFee, "Monthly fee", { min: 0, max: FORM_LIMITS.moneyMax })
            : null;
        if (newFeeResult && !newFeeResult.ok) {
            setSubmitError(newFeeResult.error);
            return;
        }

        setSubmitting(true);
        setSubmitError(null);

        try {
            const res = await fetch(`/api/seat-allocations/${allocationId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    seatId: selectedSeatId,
                    studentId,
                    shiftIds: selectedShiftIds,
                    allocationIds,
                    ...(selectedMultiShiftId ? { multiShiftId: selectedMultiShiftId } : {}),
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to update allocation");
            }

            if (linkFeeToSelection || newFee.trim() !== "") {
                const feeRes = await fetch(`/api/branches/${branchId}/students`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        id: studentId,
                        ...(linkFeeToSelection && selectedMultiShiftId
                            ? {
                                feeLinkedShiftId: null,
                                feeLinkedMultiShiftId: selectedMultiShiftId,
                            }
                            : linkFeeToSelection && selectedShiftIds.length === 1
                                ? {
                                    feeLinkedShiftId: selectedShiftIds[0],
                                    feeLinkedMultiShiftId: null,
                                }
                                : {
                                    monthlyFee: newFeeResult?.ok ? newFeeResult.value : undefined,
                                    feeLinkedShiftId: null,
                                    feeLinkedMultiShiftId: null,
                                }),
                    }),
                });

                if (!feeRes.ok) {
                    const data = await feeRes.json().catch(() => ({}));
                    throw new Error(data.error || "Allocation updated, but fee update failed.");
                }
            }

            onSuccess();
            onClose();
        } catch (e: unknown) {
            setSubmitError(e instanceof Error ? e.message : "Something went wrong.");
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen) return null;

    const canConfirm = !!selectedSeatId && selectedShiftIds.length > 0;

    const confirmLabel = selectedMultiShiftName
        ? `Update (${selectedMultiShiftName})`
        : selectedShiftIds.length > 1
            ? `Update (${selectedShiftIds.length} shifts)`
            : "Update";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div
                className="w-full max-w-2xl bg-[#0a0c14] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/[0.02] flex-shrink-0">
                    <div>
                        <div className="flex items-center gap-2">
                            <ArrowRightLeft size={15} className="text-indigo-400" />
                            <h2 className="text-base font-semibold text-white">Change Seat / Shift</h2>
                        </div>
                        <p className="text-xs text-zinc-400 mt-0.5">
                            for <span className="text-white">{studentName}</span>
                            {selectedShiftNames.length > 0 && (
                                <> · <span className={selectedMultiShiftId ? "text-orange-300" : "text-indigo-300"}>{selectedShiftNames.join(", ")}</span></>
                            )}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
                        <X size={18} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1 min-h-0">
                    <SeatPicker
                        branchId={branchId}
                        studentId={studentId}
                        selectedShiftIds={selectedShiftIds}
                        selectedMultiShiftId={selectedMultiShiftId}
                        selectedSeatId={selectedSeatId}
                        onToggleShift={handleToggleShift}
                        onSelectSeat={setSelectedSeatId}
                        excludeAllocationIds={allocationIds}
                        currentSeatId={currentSeatId}
                    />

                    {feeLinkLabel && (
                        <div className="mt-5 rounded-xl border border-white/5 bg-white/[0.02] p-4 space-y-3">
                            <div className="flex items-center gap-3">
                                <span className="text-xs text-zinc-400 whitespace-nowrap">
                                    Monthly fee:{" "}
                                    <span className="text-white font-medium">
                                        {currentFee != null ? `Rs.${currentFee}` : "--"}
                                    </span>
                                </span>
                                <div className="relative flex-1">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm select-none">Rs.</span>
                                    <input
                                        type="number"
                                        min={0}
                                        max={FORM_LIMITS.moneyMax}
                                        step={1}
                                        inputMode="numeric"
                                        value={newFee}
                                        disabled={linkFeeToSelection}
                                        onChange={e => { setNewFee(e.target.value); setSubmitError(null); }}
                                        placeholder={linkFeeToSelection ? "Linked to shift price" : "Update fee (optional)"}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg py-2 pl-10 pr-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 transition-all disabled:opacity-50"
                                    />
                                </div>
                            </div>

                            <label className="flex items-center gap-3 cursor-pointer group w-max">
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
                        </div>
                    )}
                </div>

                {canConfirm && (
                    <div className="border-t border-white/5 bg-white/[0.01] flex-shrink-0 px-6 py-4 space-y-3">
                        <div className="flex items-center justify-end gap-3">
                            <Button variant="ghost" onClick={onClose} disabled={submitting} className="text-sm h-8 px-4">
                                Cancel
                            </Button>
                            <Button onClick={handleConfirm} disabled={submitting || !canConfirm} className="text-sm h-8 px-5">
                                {submitting
                                    ? <><Loader2 size={12} className="animate-spin mr-1.5" /> Updating...</>
                                    : confirmLabel
                                }
                            </Button>
                        </div>

                        {submitError && (
                            <div className="p-3 text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg">
                                {submitError}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
