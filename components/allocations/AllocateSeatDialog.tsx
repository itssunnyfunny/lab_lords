"use client";

import { useEffect, useState } from "react";
import { X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SeatPicker, ShiftCapacity } from "./SeatPicker";

interface StudentOption {
    id: string;
    name: string;
    phone?: string | null;
}

interface AllocateSeatDialogProps {
    isOpen: boolean;
    branchId: string;
    preselectedStudentId?: string;
    preselectedStudentName?: string;
    onClose: () => void;
    onSuccess: () => void;
}

export function AllocateSeatDialog({
    isOpen,
    branchId,
    preselectedStudentId,
    preselectedStudentName,
    onClose,
    onSuccess,
}: AllocateSeatDialogProps) {
    // Student picking
    const [students, setStudents] = useState<StudentOption[]>([]);
    const [studentId, setStudentId] = useState(preselectedStudentId ?? "");
    const [studentName, setStudentName] = useState(preselectedStudentName ?? "");
    const [studentSearch, setStudentSearch] = useState("");

    // Shift selection state
    const [selectedShiftIds, setSelectedShiftIds] = useState<string[]>([]);
    const [selectedShiftNames, setSelectedShiftNames] = useState<string[]>([]);
    const [selectedSeatId, setSelectedSeatId] = useState<string | null>(null);
    // Multi-shift tracking
    const [selectedMultiShiftId, setSelectedMultiShiftId] = useState<string | null>(null);
    const [selectedMultiShiftName, setSelectedMultiShiftName] = useState<string | null>(null);

    // Submission
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        setSelectedShiftIds([]);
        setSelectedShiftNames([]);
        setSelectedSeatId(null);
        setSelectedMultiShiftId(null);
        setSelectedMultiShiftName(null);
        setSubmitError(null);
        setStudentId(preselectedStudentId ?? "");
        setStudentName(preselectedStudentName ?? "");
        setStudentSearch("");
    }, [isOpen, preselectedStudentId, preselectedStudentName]);

    useEffect(() => {
        if (!isOpen || preselectedStudentId) return;
        fetch(`/api/branches/${branchId}/students?status=ACTIVE`)
            .then(r => r.json())
            .then(setStudents)
            .catch(() => { /* silent */ });
    }, [isOpen, branchId, preselectedStudentId]);

    const handleToggleShift = (shift: ShiftCapacity) => {
        setSelectedSeatId(null);
        setSubmitError(null);

        if (shift.type === "MULTISHIFT") {
            if (selectedMultiShiftId === shift.shiftId) {
                // deselect
                setSelectedMultiShiftId(null);
                setSelectedMultiShiftName(null);
                setSelectedShiftIds([]);
                setSelectedShiftNames([]);
            } else {
                // select multishift — store component IDs for the submission payload
                setSelectedMultiShiftId(shift.shiftId);
                setSelectedMultiShiftName(shift.name);
                setSelectedShiftIds(shift.componentShiftIds ?? []);
                setSelectedShiftNames([shift.name]);
            }
        } else {
            // Primary shift toggle — clear any active multi-shift selection first
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
        const sid = preselectedStudentId ?? studentId;
        if (!sid) return;

        setSubmitting(true);
        setSubmitError(null);

        try {
            const res = await fetch(`/api/branches/${branchId}/seat-allocations`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    studentId: sid,
                    seatId: selectedSeatId,
                    shiftIds: selectedShiftIds,
                    ...(selectedMultiShiftId ? { multiShiftId: selectedMultiShiftId } : {}),
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to allocate seat");
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

    const effectiveStudentId = preselectedStudentId ?? studentId;
    const effectiveStudentName = preselectedStudentName ?? studentName;
    const hasStudent = !!effectiveStudentId;
    const canConfirm = hasStudent && selectedSeatId && selectedShiftIds.length > 0;

    const filteredStudents = students.filter(s =>
        s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
        (s.phone && s.phone.includes(studentSearch))
    );

    const confirmLabel = selectedMultiShiftName
        ? `Confirm (${selectedMultiShiftName})`
        : selectedShiftIds.length > 1
            ? `Confirm (${selectedShiftIds.length} shifts)`
            : "Confirm";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div
                className="w-full max-w-2xl bg-[#0a0c14] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/[0.02] flex-shrink-0">
                    <div>
                        <h2 className="text-base font-semibold text-white">Allocate Seat</h2>
                        {effectiveStudentName && (
                            <p className="text-xs text-zinc-400 mt-0.5">
                                for <span className="text-white">{effectiveStudentName}</span>
                                {selectedShiftNames.length > 0 && (
                                    <> · <span className={selectedMultiShiftId ? "text-orange-300" : "text-indigo-300"}>{selectedShiftNames.join(", ")}</span></>
                                )}
                            </p>
                        )}
                    </div>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
                        <X size={18} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1 min-h-0">
                    {/* Student picker (only when not preselected) */}
                    {!hasStudent && (
                        <div className="space-y-3 mb-6">
                            <p className="text-sm text-zinc-400">Select an active student:</p>
                            <input
                                type="text"
                                placeholder="Search by name or phone..."
                                value={studentSearch}
                                onChange={e => setStudentSearch(e.target.value)}
                                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                            />
                            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-2">
                                {filteredStudents.map(s => (
                                    <button
                                        key={s.id}
                                        onClick={() => { setStudentId(s.id); setStudentName(s.name); }}
                                        className="w-full text-left px-3 py-2.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.07] border border-white/5 hover:border-white/10 transition-all"
                                    >
                                        <p className="text-sm text-white font-medium">{s.name}</p>
                                        {s.phone && <p className="text-xs text-zinc-500">{s.phone}</p>}
                                    </button>
                                ))}
                                {filteredStudents.length === 0 && (
                                    <p className="text-sm text-zinc-500 text-center py-4">No active students found.</p>
                                )}
                            </div>
                        </div>
                    )}

                    {hasStudent && (
                        <div className="space-y-4">
                            <SeatPicker
                                branchId={branchId}
                                studentId={effectiveStudentId}
                                selectedShiftIds={selectedShiftIds}
                                selectedMultiShiftId={selectedMultiShiftId}
                                selectedSeatId={selectedSeatId}
                                onToggleShift={handleToggleShift}
                                onSelectSeat={setSelectedSeatId}
                            />

                            {submitError && (
                                <div className="p-3 text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg">
                                    {submitError}
                                </div>
                            )}
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
                                ? <><Loader2 size={12} className="animate-spin mr-1.5" /> Allocating...</>
                                : confirmLabel
                            }
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
