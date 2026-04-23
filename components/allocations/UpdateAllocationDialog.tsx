"use client";

import { useEffect, useState } from "react";
import { X, Loader2, ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SeatPicker, ShiftCapacity } from "./SeatPicker";

interface UpdateAllocationDialogProps {
    isOpen: boolean;
    branchId: string;
    allocationId: string;
    allocationIds: string[];
    studentId: string;
    studentName: string;
    currentSeatId: string;
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
    onClose,
    onSuccess,
}: UpdateAllocationDialogProps) {
    const [selectedShiftIds, setSelectedShiftIds] = useState<string[]>([]);
    const [selectedShiftNames, setSelectedShiftNames] = useState<string[]>([]);
    const [selectedSeatId, setSelectedSeatId] = useState<string | null>(null);
    const [selectedMultiShiftId, setSelectedMultiShiftId] = useState<string | null>(null);
    const [selectedMultiShiftName, setSelectedMultiShiftName] = useState<string | null>(null);

    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);

    // Reset state whenever dialog opens
    useEffect(() => {
        if (!isOpen) return;
        setSelectedShiftIds([]);
        setSelectedShiftNames([]);
        setSelectedSeatId(null);
        setSelectedMultiShiftId(null);
        setSelectedMultiShiftName(null);
        setSubmitError(null);
    }, [isOpen]);

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
                } else {
                    setSelectedShiftNames(names => [...names, shift.name]);
                    return [...prev, shift.shiftId];
                }
            });
        }
    };

    const handleConfirm = async () => {
        if (!selectedSeatId || selectedShiftIds.length === 0) return;

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

            onSuccess();
            onClose();
        } catch (e: any) {
            setSubmitError(e.message);
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
                {/* Header */}
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

                <div className="p-6 overflow-y-auto flex-1">
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

                    {submitError && (
                        <div className="mt-4 p-3 text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg">
                            {submitError}
                        </div>
                    )}
                </div>

                {/* Footer */}
                {canConfirm && (
                    <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/5 bg-white/[0.01] flex-shrink-0">
                        <Button variant="ghost" onClick={onClose} disabled={submitting} className="text-sm h-8 px-4">
                            Cancel
                        </Button>
                        <Button onClick={handleConfirm} disabled={submitting} className="text-sm h-8 px-5">
                            {submitting
                                ? <><Loader2 size={12} className="animate-spin mr-1.5" /> Updating...</>
                                : confirmLabel
                            }
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
