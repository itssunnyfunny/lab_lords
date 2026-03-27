"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/layout/PageHeader";
import {
    MoreVertical, Plus, Pencil, Trash2,
    Loader2, AlertCircle, Clock, IndianRupee,
    CheckCircle2, X, Shield, AlertTriangle,
    Users, ArrowRight, RefreshCw, Ban,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { parseNullableTime, timesOverlap } from "@/utils/shiftTime";

function formatMins(mins: number) {
    let raw = mins;
    if (raw < 0) raw += 1440;
    raw = raw % 1440;
    const h = Math.floor(raw / 60);
    const m = raw % 60;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Shift {
    id: string;
    name: string;
    startTime: string | null;
    endTime: string | null;
    isReserved: boolean;
    price: number;
}

interface ShiftAllocation {
    allocationId: string;
    studentId: string;
    studentName: string;
    seatLabel: string;
}

interface OtherShift {
    shiftId: string;
    name: string;
    totalSeats: number;
    activeAllocations: number;
    emptySeats: number;
}

interface ShiftImpactAnalysis {
    studentsInShift: number;
    allocations: ShiftAllocation[];
    otherShifts: OtherShift[];
    totalEmptyElsewhere: number;
    shiftsWithEnoughCapacity: string[];
    willOverflowBy: number;
    isLastActiveShift: boolean;
}

// ─── Add/Edit Dialog ────────────────────────────────────────────────────────────

interface ShiftDialogProps {
    isOpen: boolean;
    mode: "add" | "edit";
    initial?: Shift;
    branchId: string;
    existingShifts: Shift[];
    onClose: () => void;
    onSuccess: (shift: Shift) => void;
}

function ShiftDialog({ isOpen, mode, initial, branchId, existingShifts, onClose, onSuccess }: ShiftDialogProps) {
    const [name, setName] = useState("");
    const [startTime, setStartTime] = useState("");
    const [endTime, setEndTime] = useState("");
    const [price, setPrice] = useState("0");
    const [isReserved, setIsReserved] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            setName(initial?.name ?? "");
            setStartTime(initial?.startTime ?? "");
            setEndTime(initial?.endTime ?? "");
            setPrice(String(initial?.price ?? 0));
            setIsReserved(initial?.isReserved ?? false);
            setError(null);
        }
    }, [isOpen, initial]);

    // Check for overlap continuously
    const overlapWith = existingShifts.find(s => {
        if (s.id === initial?.id) return false;
        if (!s.startTime || !s.endTime || !startTime || !endTime) return false;
        if (s.name.toLowerCase() === "full time" || name.toLowerCase() === "full time") return false;
        const start1 = parseNullableTime(startTime);
        const end1 = parseNullableTime(endTime);
        const start2 = parseNullableTime(s.startTime);
        const end2 = parseNullableTime(s.endTime);
        return timesOverlap(start1, end1, start2, end2);
    });

    if (!isOpen) return null;

    const handleSubmit = async () => {
        if (!name.trim()) { setError("Shift name is required."); return; }
        if (overlapWith) { setError("Please resolve the shift time overlap."); return; }
        setLoading(true);
        setError(null);
        try {
            const url = mode === "edit" && initial
                ? `/api/branches/${branchId}/shifts/${initial.id}`
                : `/api/branches/${branchId}/shifts`;
            const method = mode === "edit" ? "PATCH" : "POST";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: name.trim(),
                    startTime: startTime || null,
                    endTime: endTime || null,
                    price: Number(price) || 0,
                    isReserved,
                }),
            });
            if (!res.ok) {
                const d = await res.json().catch(() => ({}));
                throw new Error(d.error || "Operation failed");
            }
            const saved = await res.json();
            onSuccess(saved);
            onClose();
        } catch (err: any) {
            setError(err.message || "Something went wrong.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-sm bg-[#0f111a] border border-white/10 rounded-2xl shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                    <div>
                        <h2 className="text-base font-bold text-white">{mode === "add" ? "Add Shift" : "Edit Shift"}</h2>
                        <p className="text-xs text-gray-500 mt-0.5">{mode === "add" ? "Create a new time window" : "Update shift details"}</p>
                    </div>
                    <button onClick={onClose} disabled={loading} className="text-gray-500 hover:text-white transition-colors">
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4">
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Shift Name *</label>
                        <input
                            type="text"
                            value={name}
                            onChange={e => { setName(e.target.value); setError(null); }}
                            placeholder="e.g. Morning, Full Time"
                            autoFocus
                            className="w-full bg-white/5 border border-white/10 rounded-lg py-2.5 px-4 text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 text-sm transition-all"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Start Time</label>
                            <input
                                type="time"
                                value={startTime}
                                onChange={e => setStartTime(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-lg py-2.5 px-3 text-white focus:outline-none focus:border-cyan-500/50 text-sm transition-all"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">End Time</label>
                            <input
                                type="time"
                                value={endTime}
                                onChange={e => setEndTime(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-lg py-2.5 px-3 text-white focus:outline-none focus:border-cyan-500/50 text-sm transition-all"
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Monthly Price (₹)</label>
                        <div className="relative">
                            <IndianRupee size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                            <input
                                type="number"
                                value={price}
                                onChange={e => setPrice(e.target.value)}
                                min="0"
                                placeholder="0"
                                className="w-full bg-white/5 border border-white/10 rounded-lg py-2.5 pl-8 pr-4 text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 text-sm transition-all"
                            />
                        </div>
                    </div>

                    {/* Reserved toggle */}
                    <div className="flex items-center justify-between py-1">
                        <div>
                            <p className="text-sm text-white font-medium">Reserved Shift</p>
                            <p className="text-xs text-gray-500">Seats in this shift require manual allocation</p>
                        </div>
                        <button
                            onClick={() => setIsReserved(v => !v)}
                            className={cn(
                                "w-10 h-5 rounded-full relative transition-colors",
                                isReserved ? "bg-cyan-500" : "bg-white/10"
                            )}
                        >
                            <div className={cn(
                                "absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform",
                                isReserved ? "translate-x-5" : "translate-x-0.5"
                            )} />
                        </button>
                    </div>

                    {error && (
                        <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                            <AlertCircle size={13} /> {error}
                        </div>
                    )}
                    
                    {overlapWith && (
                        <div className="flex flex-col gap-1.5 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs mt-2">
                            <div className="flex items-center gap-1.5 text-amber-400">
                                <AlertTriangle size={13} />
                                <span>Time overlaps with &ldquo;{overlapWith.name}&rdquo; ({overlapWith.startTime} - {overlapWith.endTime}).</span>
                            </div>
                            <div className="flex flex-col gap-1 mt-1">
                                <button onClick={() => setEndTime(formatMins(parseNullableTime(overlapWith.startTime)! - 1))} className="text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 px-2 py-1.5 rounded transition-colors border border-amber-500/20 text-left">
                                    Set End Time to {formatMins(parseNullableTime(overlapWith.startTime)! - 1)}
                                </button>
                                <button onClick={() => setStartTime(formatMins(parseNullableTime(overlapWith.endTime)! + 1))} className="text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 px-2 py-1.5 rounded transition-colors border border-amber-500/20 text-left">
                                    Set Start Time to {formatMins(parseNullableTime(overlapWith.endTime)! + 1)}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 px-6 py-4 border-t border-white/10">
                    <Button variant="ghost" onClick={onClose} disabled={loading} className="text-sm h-8 px-3">
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={loading || !name.trim() || !!overlapWith}
                        className="text-sm h-8 px-4 min-w-[100px] justify-center"
                    >
                        {loading
                            ? <><Loader2 size={12} className="animate-spin mr-1.5" /> {mode === "add" ? "Adding..." : "Saving..."}</>
                            : mode === "add" ? "Add Shift" : "Save Changes"
                        }
                    </Button>
                </div>
            </div>
        </div>
    );
}

// ─── Delete Shift Dialog ────────────────────────────────────────────────────────

type ResolutionMode = "END_ALL" | "REALLOCATE_BULK" | "REALLOCATE_MANUAL" | "RENAME";

interface DeleteShiftDialogProps {
    shift: Shift;
    branchId: string;
    onClose: () => void;
    onDeleted: (shiftId: string) => void;
    onRenamed: (shift: Shift) => void;
}

function DeleteShiftDialog({ shift, branchId, onClose, onDeleted, onRenamed }: DeleteShiftDialogProps) {
    const [step, setStep] = useState<"loading" | "blocked" | "confirm-empty" | "resolve">("loading");
    const [analysis, setAnalysis] = useState<ShiftImpactAnalysis | null>(null);
    const [analyzeError, setAnalyzeError] = useState<string | null>(null);

    // Resolution state
    const [mode, setMode] = useState<ResolutionMode>("END_ALL");
    const [bulkTargetId, setBulkTargetId] = useState("");
    const [manualAssignments, setManualAssignments] = useState<Record<string, string>>({}); // allocationId → targetShiftId

    // Rename state
    const [renameName, setRenameName] = useState(shift.name);
    const [renameStart, setRenameStart] = useState(shift.startTime ?? "");
    const [renameEnd, setRenameEnd] = useState(shift.endTime ?? "");

    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);

    // Load analysis on mount
    useEffect(() => {
        const run = async () => {
            try {
                const res = await fetch(`/api/branches/${branchId}/shifts/${shift.id}/analyze`);
                if (!res.ok) {
                    const d = await res.json().catch(() => ({}));
                    throw new Error(d.error || "Failed to analyze shift.");
                }
                const data: ShiftImpactAnalysis = await res.json();
                setAnalysis(data);

                if (data.isLastActiveShift) { setStep("blocked"); return; }
                if (data.studentsInShift === 0) { setStep("confirm-empty"); return; }
                setStep("resolve");

                // Pre-select bulk target if one shift has enough capacity
                if (data.shiftsWithEnoughCapacity.length > 0) {
                    setMode("REALLOCATE_BULK");
                    setBulkTargetId(data.shiftsWithEnoughCapacity[0]);
                } else {
                    setMode("END_ALL");
                }
            } catch (e: any) {
                setAnalyzeError(e.message || "Could not load shift analysis.");
                setStep("resolve"); // fallback to END_ALL only
            }
        };
        run();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleDelete = async () => {
        setSubmitting(true);
        setSubmitError(null);
        try {
            let resolution: any;
            if (mode === "END_ALL") {
                resolution = { type: "END_ALL" };
            } else if (mode === "REALLOCATE_BULK") {
                if (!bulkTargetId) throw new Error("Please select a target shift.");
                resolution = { type: "REALLOCATE_BULK", targetShiftId: bulkTargetId };
            } else if (mode === "REALLOCATE_MANUAL") {
                const assignments = analysis?.allocations.map(a => ({
                    allocationId: a.allocationId,
                    targetShiftId: manualAssignments[a.allocationId] ?? "",
                })) ?? [];
                if (assignments.some(a => !a.targetShiftId)) throw new Error("Assign a shift for every student.");
                resolution = { type: "REALLOCATE_MANUAL", assignments };
            }

            const res = await fetch(`/api/branches/${branchId}/shifts/${shift.id}`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ resolution }),
            });
            if (!res.ok) {
                const d = await res.json().catch(() => ({}));
                throw new Error(d.error || "Delete failed.");
            }
            onDeleted(shift.id);
            onClose();
        } catch (e: any) {
            setSubmitError(e.message || "Something went wrong.");
        } finally {
            setSubmitting(false);
        }
    };

    const handleRename = async () => {
        if (!renameName.trim()) { setSubmitError("Shift name is required."); return; }
        setSubmitting(true);
        setSubmitError(null);
        try {
            const res = await fetch(`/api/branches/${branchId}/shifts/${shift.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: renameName.trim(),
                    startTime: renameStart || null,
                    endTime: renameEnd || null,
                }),
            });
            if (!res.ok) {
                const d = await res.json().catch(() => ({}));
                throw new Error(d.error || "Update failed.");
            }
            const updated: Shift = await res.json();
            onRenamed(updated);
            onClose();
        } catch (e: any) {
            setSubmitError(e.message || "Something went wrong.");
        } finally {
            setSubmitting(false);
        }
    };

    // ── Check manual assignment validity
    const manualValid = analysis
        ? analysis.allocations.every(a => !!manualAssignments[a.allocationId])
        : false;

    // ── Per-target overflow detection for manual mode
    const manualTargetCounts = Object.values(manualAssignments).reduce<Record<string, number>>((acc, sid) => {
        acc[sid] = (acc[sid] ?? 0) + 1;
        return acc;
    }, {});
    const manualOverflow = analysis
        ? Object.entries(manualTargetCounts).some(([sid, count]) => {
            const t = analysis.otherShifts.find(s => s.shiftId === sid);
            return t ? count > t.emptySeats : false;
        })
        : false;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={submitting ? undefined : onClose} />
            <div className="relative w-full max-w-lg bg-[#0f111a] border border-white/10 rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 sticky top-0 bg-[#0f111a] z-10">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                            <Trash2 size={15} className="text-red-400" />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-white">Delete &ldquo;{shift.name}&rdquo;</h2>
                            <p className="text-xs text-gray-500">Resolve before removing this shift</p>
                        </div>
                    </div>
                    {!submitting && (
                        <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
                            <X size={18} />
                        </button>
                    )}
                </div>

                {/* ── Loading state */}
                {step === "loading" && (
                    <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
                        <Loader2 size={28} className="animate-spin text-cyan-500" />
                        <p className="text-sm">Analyzing shift impact...</p>
                    </div>
                )}

                {/* ── Blocked: last active shift */}
                {step === "blocked" && (
                    <div className="p-6 space-y-4">
                        <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                            <Ban size={18} className="text-amber-400 mt-0.5 shrink-0" />
                            <div>
                                <p className="text-sm font-semibold text-amber-300">Cannot delete this shift</p>
                                <p className="text-xs text-amber-400/80 mt-1">
                                    This is the only active shift in the branch. A branch must have at least one active shift.
                                    Add another shift first, then you can delete this one.
                                </p>
                            </div>
                        </div>
                        <div className="flex justify-end">
                            <Button onClick={onClose} variant="ghost" className="text-sm h-8 px-4">Close</Button>
                        </div>
                    </div>
                )}

                {/* ── Confirm empty shift delete */}
                {step === "confirm-empty" && (
                    <div className="p-6 space-y-4">
                        <p className="text-sm text-gray-300">
                            This shift has <span className="text-white font-semibold">no active students</span>. It will be removed permanently.
                        </p>
                        {submitError && (
                            <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                                <AlertCircle size={13} /> {submitError}
                            </div>
                        )}
                        <div className="flex justify-end gap-3">
                            <Button variant="ghost" onClick={onClose} disabled={submitting} className="text-sm h-8 px-3">Cancel</Button>
                            <Button
                                onClick={handleDelete}
                                disabled={submitting}
                                className="text-sm h-8 px-4 bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30 min-w-[100px] justify-center"
                            >
                                {submitting ? <><Loader2 size={12} className="animate-spin mr-1.5" /> Deleting...</> : "Delete Shift"}
                            </Button>
                        </div>
                    </div>
                )}

                {/* ── Resolution dialog */}
                {step === "resolve" && analysis && (
                    <div className="p-6 space-y-5">

                        {/* Impact summary */}
                        <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4 space-y-2">
                            <div className="flex items-center gap-2 text-sm">
                                <Users size={14} className="text-cyan-400" />
                                <span className="text-white font-semibold">{analysis.studentsInShift} student{analysis.studentsInShift !== 1 ? "s" : ""}</span>
                                <span className="text-gray-500">currently in this shift</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                                <ArrowRight size={12} />
                                <span>Empty seats elsewhere: <span className="text-white">{analysis.totalEmptyElsewhere}</span></span>
                                {analysis.willOverflowBy > 0 && (
                                    <span className="text-amber-400 flex items-center gap-1">
                                        <AlertTriangle size={11} /> {analysis.willOverflowBy} cannot be reallocated
                                    </span>
                                )}
                            </div>
                        </div>

                        {analyzeError && (
                            <div className="flex items-center gap-2 text-sm text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                                <AlertTriangle size={13} /> {analyzeError} — Only &ldquo;End All&rdquo; is available.
                            </div>
                        )}

                        {/* Option cards */}
                        <div className="space-y-2.5">

                            {/* Option A — End All */}
                            <OptionCard
                                selected={mode === "END_ALL"}
                                onClick={() => setMode("END_ALL")}
                                icon={<Ban size={15} className="text-red-400" />}
                                title="End All Allocations"
                                description="All students become unallocated. They remain in the system — only their seat assignment ends."
                                variant="danger"
                            >
                                {mode === "END_ALL" && (
                                    <p className="text-xs text-red-400/80 mt-2 pl-1">
                                        {analysis.studentsInShift} student{analysis.studentsInShift !== 1 ? "s" : ""} will be unallocated.
                                    </p>
                                )}
                            </OptionCard>

                            {/* Option B — Move All to One Shift (only if enough capacity exists in a single shift) */}
                            {analysis.shiftsWithEnoughCapacity.length > 0 && (
                                <OptionCard
                                    selected={mode === "REALLOCATE_BULK"}
                                    onClick={() => { setMode("REALLOCATE_BULK"); if (!bulkTargetId) setBulkTargetId(analysis.shiftsWithEnoughCapacity[0]); }}
                                    icon={<RefreshCw size={15} className="text-emerald-400" />}
                                    title="Move All to One Shift"
                                    description="All students are moved to a single shift in one step."
                                    variant="success"
                                >
                                    {mode === "REALLOCATE_BULK" && (
                                        <div className="mt-3">
                                            <label className="text-xs text-gray-500 mb-1.5 block">Select target shift</label>
                                            <select
                                                value={bulkTargetId}
                                                onChange={e => setBulkTargetId(e.target.value)}
                                                style={{ colorScheme: 'dark', backgroundColor: '#0f111a' }}
                                                className="w-full border border-white/10 rounded-lg py-2 px-3 text-white text-sm focus:outline-none focus:border-cyan-500/50"
                                            >
                                                <option value="" disabled className="bg-[#0f111a] text-white">Choose a shift…</option>
                                                {analysis.otherShifts
                                                    .filter(s => analysis.shiftsWithEnoughCapacity.includes(s.shiftId))
                                                    .map(s => (
                                                        <option key={s.shiftId} value={s.shiftId} className="bg-[#0f111a] text-white">
                                                            {s.name} — {s.emptySeats} empty seat{s.emptySeats !== 1 ? "s" : ""}
                                                        </option>
                                                    ))
                                                }
                                            </select>
                                        </div>
                                    )}
                                </OptionCard>
                            )}

                            {/* Option C — Per-student assignment */}
                            <OptionCard
                                selected={mode === "REALLOCATE_MANUAL"}
                                onClick={() => setMode("REALLOCATE_MANUAL")}
                                icon={<Users size={15} className="text-cyan-400" />}
                                title="Assign Per Student"
                                description="Choose a target shift individually for each student."
                            >
                                {mode === "REALLOCATE_MANUAL" && (
                                    <div className="mt-3 space-y-2">
                                        {analysis.allocations.map(alloc => {
                                            const chosenId = manualAssignments[alloc.allocationId] ?? "";
                                            const chosenShift = analysis.otherShifts.find(s => s.shiftId === chosenId);
                                            const wouldOverflow = chosenShift
                                                ? (manualTargetCounts[chosenId] ?? 0) > chosenShift.emptySeats
                                                : false;
                                            return (
                                                <div key={alloc.allocationId} className="flex items-center gap-2">
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs text-white font-medium truncate">{alloc.studentName}</p>
                                                        <p className="text-[10px] text-gray-600">Seat {alloc.seatLabel}</p>
                                                    </div>
                                                    <select
                                                        value={chosenId}
                                                        onChange={e => setManualAssignments(prev => ({
                                                            ...prev,
                                                            [alloc.allocationId]: e.target.value,
                                                        }))}
                                                        style={{ colorScheme: 'dark', backgroundColor: '#0f111a' }}
                                                        className={cn(
                                                            "border rounded-lg py-1.5 px-2 text-white text-xs focus:outline-none focus:border-cyan-500/50 min-w-[160px]",
                                                            wouldOverflow ? "border-red-500/50" : "border-white/10"
                                                        )}
                                                    >
                                                        <option value="" disabled className="bg-[#0f111a] text-white">Select shift…</option>
                                                        {analysis.otherShifts.map(s => (
                                                            <option key={s.shiftId} value={s.shiftId} disabled={s.emptySeats === 0} className="bg-[#0f111a] text-white">
                                                                {s.name} ({s.emptySeats} empty)
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                            );
                                        })}
                                        {manualOverflow && (
                                            <p className="text-xs text-red-400 flex items-center gap-1 mt-1">
                                                <AlertTriangle size={11} /> One or more shifts would overflow. Reassign those students.
                                            </p>
                                        )}
                                    </div>
                                )}
                            </OptionCard>

                            {/* Option D — Rename / Retime Instead */}
                            <OptionCard
                                selected={mode === "RENAME"}
                                onClick={() => setMode("RENAME")}
                                icon={<Pencil size={15} className="text-gray-400" />}
                                title="Rename / Retime Instead"
                                description="Don't delete — just change the name or time window. Students stay allocated."
                            >
                                {mode === "RENAME" && (
                                    <div className="mt-3 space-y-3">
                                        <div>
                                            <label className="text-xs text-gray-500 mb-1 block">New name</label>
                                            <input
                                                type="text"
                                                value={renameName}
                                                onChange={e => { setRenameName(e.target.value); setSubmitError(null); }}
                                                className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-white text-sm focus:outline-none focus:border-cyan-500/50"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="text-xs text-gray-500 mb-1 block">Start time</label>
                                                <input
                                                    type="time"
                                                    value={renameStart}
                                                    onChange={e => setRenameStart(e.target.value)}
                                                    className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-white text-sm focus:outline-none focus:border-cyan-500/50"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs text-gray-500 mb-1 block">End time</label>
                                                <input
                                                    type="time"
                                                    value={renameEnd}
                                                    onChange={e => setRenameEnd(e.target.value)}
                                                    className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-white text-sm focus:outline-none focus:border-cyan-500/50"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </OptionCard>
                        </div>

                        {/* Submit error */}
                        {submitError && (
                            <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                                <AlertCircle size={13} /> {submitError}
                            </div>
                        )}

                        {/* Footer actions */}
                        <div className="flex justify-end gap-3 pt-2">
                            <Button variant="ghost" onClick={onClose} disabled={submitting} className="text-sm h-8 px-3">
                                Cancel
                            </Button>
                            {mode === "RENAME" ? (
                                <Button
                                    onClick={handleRename}
                                    disabled={submitting || !renameName.trim()}
                                    className="text-sm h-8 px-4 min-w-[130px] justify-center"
                                >
                                    {submitting ? <><Loader2 size={12} className="animate-spin mr-1.5" />Saving...</> : "Save Changes"}
                                </Button>
                            ) : (
                                <Button
                                    onClick={handleDelete}
                                    disabled={
                                        submitting ||
                                        (mode === "REALLOCATE_BULK" && !bulkTargetId) ||
                                        (mode === "REALLOCATE_MANUAL" && (!manualValid || manualOverflow))
                                    }
                                    className={cn(
                                        "text-sm h-8 px-4 min-w-[130px] justify-center",
                                        "bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30"
                                    )}
                                >
                                    {submitting
                                        ? <><Loader2 size={12} className="animate-spin mr-1.5" />Processing...</>
                                        : mode === "END_ALL" ? "End All & Delete"
                                            : mode === "REALLOCATE_BULK" ? "Move All & Delete"
                                                : "Assign & Delete"
                                    }
                                </Button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Option Card helper ─────────────────────────────────────────────────────────

interface OptionCardProps {
    selected: boolean;
    onClick: () => void;
    icon: React.ReactNode;
    title: string;
    description: string;
    variant?: "danger" | "success";
    children?: React.ReactNode;
}

function OptionCard({ selected, onClick, icon, title, description, variant, children }: OptionCardProps) {
    const borderColor = selected
        ? variant === "danger" ? "border-red-500/40" : variant === "success" ? "border-emerald-500/40" : "border-cyan-500/40"
        : "border-white/8";
    const bgColor = selected
        ? variant === "danger" ? "bg-red-500/5" : variant === "success" ? "bg-emerald-500/5" : "bg-cyan-500/5"
        : "bg-white/[0.02]";

    return (
        <div
            onClick={onClick}
            className={cn(
                "border rounded-xl p-4 cursor-pointer transition-all",
                borderColor, bgColor,
                !selected && "hover:border-white/15 hover:bg-white/[0.04]"
            )}
        >
            <div className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0">{icon}</div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white">{title}</p>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{description}</p>
                    {children}
                </div>
                <div className={cn(
                    "w-4 h-4 rounded-full border shrink-0 mt-0.5 transition-all flex items-center justify-center",
                    selected ? "border-cyan-500 bg-cyan-500" : "border-white/20"
                )}>
                    {selected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
            </div>
        </div>
    );
}

// ─── Row dropdown ──────────────────────────────────────────────────────────────

interface RowAction { label: string; icon: React.ElementType; onClick: () => void; variant?: "danger" }

function RowActions({ actions }: { actions: RowAction[] }) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, [open]);

    return (
        <div ref={ref} className="relative flex justify-end">
            <button onClick={() => setOpen(v => !v)} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/10 transition-all">
                <MoreVertical size={16} />
            </button>
            {open && (
                <div className="absolute right-0 top-9 z-50 w-40 bg-[#0f111a] border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                    {actions.map((a, i) => {
                        const Icon = a.icon;
                        return (
                            <button key={i} onClick={() => { a.onClick(); setOpen(false); }}
                                className={cn("w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors",
                                    a.variant === "danger" ? "text-red-400 hover:bg-red-500/10" : "text-gray-300 hover:bg-white/5 hover:text-white"
                                )}>
                                <Icon size={14} /> {a.label}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function ShiftsPage() {
    const params = useParams();
    const branchId = params?.branchId as string;

    const [shifts, setShifts] = useState<Shift[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

    // Dialog state
    const [dialog, setDialog] = useState<{ open: boolean; mode: "add" | "edit"; shift?: Shift }>({
        open: false, mode: "add",
    });

    // Delete dialog state
    const [deleteTarget, setDeleteTarget] = useState<Shift | null>(null);

    const showToast = (msg: string, type: "success" | "error" = "success") => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3500);
    };

    const loadShifts = async () => {
        if (!branchId) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/branches/${branchId}/shifts`);
            if (!res.ok) throw new Error("Failed to load shifts");
            setShifts(await res.json());
            setError(null);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadShifts(); }, [branchId]);

    const handleDialogSuccess = (saved: Shift) => {
        setShifts(prev => {
            const idx = prev.findIndex(s => s.id === saved.id);
            if (idx >= 0) { const next = [...prev]; next[idx] = saved; return next; }
            return [...prev, saved];
        });
        showToast(dialog.mode === "add" ? `"${saved.name}" added.` : `"${saved.name}" updated.`);
    };

    const handleDeleted = (shiftId: string) => {
        const deleted = shifts.find(s => s.id === shiftId);
        setShifts(prev => prev.filter(s => s.id !== shiftId));
        showToast(`"${deleted?.name}" deleted.`);
    };

    const handleRenamed = (updated: Shift) => {
        setShifts(prev => prev.map(s => s.id === updated.id ? updated : s));
        showToast(`"${updated.name}" updated.`);
    };

    // ── Loading
    if (loading) return <div className="p-8 flex items-center justify-center text-white"><Loader2 className="animate-spin mr-2" /> Loading shifts...</div>;

    // ── Error
    if (error) return (
        <div className="p-8 flex flex-col items-center justify-center text-white h-[50vh] space-y-4">
            <AlertCircle className="w-12 h-12 text-red-400 opacity-80" />
            <p className="text-gray-400">{error}</p>
        </div>
    );

    return (
        <div className="p-8 space-y-6 relative">
            {/* Toast */}
            {toast && (
                <div className={cn(
                    "fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl border text-sm shadow-2xl animate-in fade-in slide-in-from-bottom-2",
                    toast.type === "success"
                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                        : "bg-red-500/10 border-red-500/20 text-red-400"
                )}>
                    {toast.type === "success" ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                    {toast.msg}
                </div>
            )}

            <PageHeader
                title="Shifts"
                subtitle="Manage time windows for seat allocations."
                onAdd={() => setDialog({ open: true, mode: "add" })}
                actionLabel="Add Shift"
            />

            {shifts.length === 0 ? (
                <div className="text-center py-16 border border-dashed border-white/10 rounded-xl text-gray-500">
                    <Clock size={36} className="mx-auto mb-3 opacity-30" />
                    <p>No shifts found.</p>
                    <button
                        onClick={() => setDialog({ open: true, mode: "add" })}
                        className="mt-3 text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
                    >
                        + Add your first shift
                    </button>
                </div>
            ) : (
                <Card className="overflow-visible p-0">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-b border-white/5 bg-white/[0.02] text-zinc-400">
                                <th className="px-6 py-4 font-medium">Name</th>
                                <th className="px-6 py-4 font-medium">Time Window</th>
                                <th className="px-6 py-4 font-medium">Type</th>
                                <th className="px-6 py-4 font-medium">Price</th>
                                <th className="px-6 py-4 font-medium w-14" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {shifts.map(shift => (
                                <tr key={shift.id} className="group hover:bg-white/[0.02] transition-colors">
                                    <td className="px-6 py-4 font-medium text-zinc-200">{shift.name}</td>
                                    <td className="px-6 py-4 text-zinc-400">
                                        {shift.startTime && shift.endTime ? (
                                            <span className="font-mono flex items-center gap-1.5">
                                                <Clock size={12} className="text-zinc-600" />
                                                {shift.startTime} – {shift.endTime}
                                            </span>
                                        ) : (
                                            <span className="text-zinc-500 italic text-xs">No time limit</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        {shift.isReserved
                                            ? <Badge variant="purple"><Shield size={10} className="mr-1" />Reserved</Badge>
                                            : <Badge variant="cyan">Standard</Badge>
                                        }
                                    </td>
                                    <td className="px-6 py-4 text-zinc-400">
                                        {shift.price > 0
                                            ? <span className="text-white font-medium">₹{shift.price.toLocaleString("en-IN")}</span>
                                            : <span className="text-zinc-600 italic text-xs">No price</span>
                                        }
                                    </td>
                                    <td className="px-6 py-4">
                                        <RowActions actions={[
                                            {
                                                label: "Edit",
                                                icon: Pencil,
                                                onClick: () => setDialog({ open: true, mode: "edit", shift }),
                                            },
                                            {
                                                label: "Delete",
                                                icon: Trash2,
                                                variant: "danger",
                                                onClick: () => setDeleteTarget(shift),
                                            },
                                        ]} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </Card>
            )}

            <ShiftDialog
                isOpen={dialog.open}
                mode={dialog.mode}
                initial={dialog.shift}
                branchId={branchId}
                existingShifts={shifts}
                onClose={() => setDialog({ open: false, mode: "add" })}
                onSuccess={handleDialogSuccess}
            />

            {deleteTarget && (
                <DeleteShiftDialog
                    shift={deleteTarget}
                    branchId={branchId}
                    onClose={() => setDeleteTarget(null)}
                    onDeleted={handleDeleted}
                    onRenamed={handleRenamed}
                />
            )}
        </div>
    );
}
