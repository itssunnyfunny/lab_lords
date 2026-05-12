"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { RowActionsMenu, type RowActionsMenuItem } from "@/components/ui/RowActionsMenu";
import {
    formCompactLabelClass,
    formControlClass,
    formDialogFooterClass,
    formDialogHeaderClass,
    formDialogOverlayClass,
    formDialogPanelClass,
    formErrorBannerClass,
    formHelpTextClass,
    formIconClass,
    formSurfaceClass,
    formWarningActionClass,
    formWarningBannerClass,
} from "@/components/ui/formSurface";
import {
    pageEmptyStateClass,
    pageErrorIconClass,
    pageErrorStateClass,
    pageGridCardClass,
    pageGridCardHoverClass,
    pageInsetHoverClass,
    pageInsetSurfaceClass,
    pageLoadingStateClass,
    pageMutedTextClass,
    pageSubtleTextClass,
} from "@/components/ui/pageSurface";
import { FieldError, fieldErrorClass, fieldErrorProps, useInlineFieldErrors } from "@/components/ui/InlineFieldError";
import { PageHeader } from "@/components/layout/PageHeader";
import { BranchAccessGuard } from "@/components/auth/BranchAccessGuard";
import {
    Pencil, Trash2,
    Loader2, AlertCircle, Clock, IndianRupee,
    CheckCircle2, X, AlertTriangle,
    Users, ArrowRight, RefreshCw, Ban, Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { parseNullableTime, timesOverlap } from "@/utils/shiftTime";
import {
    FORM_LIMITS,
    parseIntegerField,
    validateOptionalTime,
    validateRequiredText,
} from "@/lib/formValidation";
import { BRANCH_PAGE_ACCESS } from "@/lib/branchPageAccess";
import { getPermissionHelpText } from "@/lib/permissionMessages";

function formatMins(mins: number) {
    let raw = mins;
    if (raw < 0) raw += 1440;
    raw = raw % 1440;
    const h = Math.floor(raw / 60);
    const m = raw % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
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

interface MultiShift {
    id: string;
    name: string;
    price: number;
    components: {
        shiftId: string;
        shiftName: string;
        startTime: string | null;
        endTime: string | null;
        order: number;
    }[];
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

type DeleteResolution =
    | { type: "END_ALL" }
    | { type: "REALLOCATE_BULK"; targetShiftId: string }
    | { type: "REALLOCATE_MANUAL"; assignments: { allocationId: string; targetShiftId: string }[] };

function getErrorMessage(err: unknown, fallback = "Something went wrong.") {
    return err instanceof Error ? err.message : fallback;
}

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
    // Only activate the overlap guard when the user has actually touched a time
    // field in this session (or when adding a brand-new shift).
    const [timesTouched, setTimesTouched] = useState(false);
    const {
        markTouched,
        markSubmitted,
        resetFieldErrors,
        visibleError,
    } = useInlineFieldErrors<"name" | "startTime" | "endTime" | "timePair" | "price" | "overlap">();

    useEffect(() => {
        if (isOpen) {
            setName(initial?.name ?? "");
            setStartTime(initial?.startTime ?? "");
            setEndTime(initial?.endTime ?? "");
            setPrice(String(initial?.price ?? 0));
            setIsReserved(initial?.isReserved ?? false);
            setError(null);
            setTimesTouched(false); // reset every time the dialog opens
            resetFieldErrors();
        }
    }, [isOpen, initial, resetFieldErrors]);

    // In "add" mode we always check (no saved times to defer from).
    // In "edit" mode we only check after the user touches a time input.
    const shouldCheckOverlap = mode === "add" || timesTouched;

    const overlapWith = shouldCheckOverlap
        ? existingShifts.find(s => {
            if (s.id === initial?.id) return false;
            if (!s.startTime || !s.endTime || !startTime || !endTime) return false;
            if (s.name.toLowerCase() === "full time" || name.toLowerCase() === "full time") return false;
            const start1 = parseNullableTime(startTime);
            const end1 = parseNullableTime(endTime);
            const start2 = parseNullableTime(s.startTime);
            const end2 = parseNullableTime(s.endTime);
            return timesOverlap(start1, end1, start2, end2);
        })
        : null;

    if (!isOpen) return null;

    const validateForm = () => {
        const errors: Partial<Record<"name" | "startTime" | "endTime" | "timePair" | "price" | "overlap", string>> = {};
        const nameResult = validateRequiredText(name, "Shift name", 50);
        const startResult = validateOptionalTime(startTime, "Start time");
        const endResult = validateOptionalTime(endTime, "End time");
        const priceResult = parseIntegerField(price, "Monthly price", { min: 0, max: FORM_LIMITS.moneyMax });
        if (!nameResult.ok) errors.name = nameResult.error;
        if (!startResult.ok) errors.startTime = startResult.error;
        if (!endResult.ok) errors.endTime = endResult.error;
        const startValue = startResult.ok ? startResult.value : null;
        const endValue = endResult.ok ? endResult.value : null;
        if ((startValue && !endValue) || (!startValue && endValue)) {
            errors.timePair = "Shift must have both start and end time, or neither.";
        }
        if (!priceResult.ok) errors.price = priceResult.error;
        if (overlapWith) errors.overlap = "Resolve the shift time overlap.";
        if (!nameResult.ok || !startResult.ok || !endResult.ok || !!errors.timePair || !priceResult.ok || !!overlapWith) {
            return { errors, values: null };
        }
        return { errors, values: { nameResult, startResult, endResult, priceResult } };
    };

    const validation = validateForm();
    const nameError = visibleError("name", validation.errors);
    const startTimeError = visibleError("startTime", validation.errors);
    const endTimeError = visibleError("endTime", validation.errors);
    const timePairError = visibleError("timePair", validation.errors);
    const priceError = visibleError("price", validation.errors);
    const overlapError = visibleError("overlap", validation.errors);
    const timeGroupError = startTimeError || endTimeError || timePairError || overlapError;

    const handleSubmit = async () => {
        markSubmitted();
        setError(null);
        const result = validateForm();
        if (Object.values(result.errors).some(Boolean) || !result.values) return;
        const { nameResult, startResult, endResult, priceResult } = result.values;
        setLoading(true);
        try {
            const url = mode === "edit" && initial
                ? `/api/branches/${branchId}/shifts/${initial.id}`
                : `/api/branches/${branchId}/shifts`;
            const method = mode === "edit" ? "PATCH" : "POST";
            const payload: {
                name: string;
                price: number;
                isReserved: boolean;
                startTime?: string | null;
                endTime?: string | null;
            } = {
                name: nameResult.value,
                price: priceResult.value ?? 0,
                isReserved,
            };

            if (mode === "add" || timesTouched) {
                payload.startTime = startResult.value;
                payload.endTime = endResult.value;
            }

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (!res.ok) {
                const d = await res.json().catch(() => ({}));
                throw new Error(d.error || "Operation failed");
            }
            const saved = await res.json();
            onSuccess(saved);
            onClose();
        } catch (err: unknown) {
            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center sm:p-4">
            <div className={cn("cursor-pointer", formDialogOverlayClass)} onClick={onClose} />
            <div className={cn("relative flex max-h-[calc(100dvh-1.5rem)] w-full max-w-sm flex-col", formDialogPanelClass)}>
                {/* Header */}
                <div className={cn("flex flex-shrink-0 items-center justify-between px-4 py-4 sm:px-6", formDialogHeaderClass)}>
                    <div>
                        <h2 className="text-base font-bold text-[color:var(--ui-dialog-title)]">{mode === "add" ? "Add Shift" : "Edit Shift"}</h2>
                        <p className={cn("mt-0.5 text-xs", formHelpTextClass)}>{mode === "add" ? "Create a new time window" : "Update shift details"}</p>
                    </div>
                    <button onClick={onClose} disabled={loading} className={cn("transition-colors hover:text-[color:var(--ui-table-text)]", formHelpTextClass)}>
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
                    <div className="space-y-1.5">
                        <label className={formCompactLabelClass}>Shift Name *</label>
                        <input
                                type="text"
                                value={name}
                                onChange={e => { setName(e.target.value); setError(null); }}
                                onBlur={() => markTouched("name")}
                                placeholder="e.g. Morning, Full Time"
                                autoFocus
                            className={cn(formControlClass, "px-4 py-2.5 text-sm", fieldErrorClass(nameError))}
                                {...fieldErrorProps("shift-name-error", nameError)}
                        />
                        <FieldError id="shift-name-error" error={nameError} />
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <label className={formCompactLabelClass}>Start Time</label>
                            <input
                                type="time"
                                value={startTime}
                                onChange={e => { setStartTime(e.target.value); setTimesTouched(true); setError(null); markTouched("timePair"); markTouched("overlap"); }}
                                onBlur={() => markTouched("startTime")}
                                className={cn(formControlClass, "px-3 py-2.5 text-sm", fieldErrorClass(startTimeError || timePairError || overlapError))}
                                {...fieldErrorProps("shift-time-error", timeGroupError)}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className={formCompactLabelClass}>End Time</label>
                            <input
                                type="time"
                                value={endTime}
                                onChange={e => { setEndTime(e.target.value); setTimesTouched(true); setError(null); markTouched("timePair"); markTouched("overlap"); }}
                                onBlur={() => markTouched("endTime")}
                                className={cn(formControlClass, "px-3 py-2.5 text-sm", fieldErrorClass(endTimeError || timePairError || overlapError))}
                                {...fieldErrorProps("shift-time-error", timeGroupError)}
                            />
                        </div>
                    </div>
                    <FieldError id="shift-time-error" error={timeGroupError} />

                    <div className="space-y-1.5">
                        <label className={formCompactLabelClass}>Monthly Price (₹)</label>
                        <div className="relative">
                            <IndianRupee size={13} className={cn("absolute left-3 top-1/2 -translate-y-1/2", formIconClass)} />
                            <input
                                type="number"
                                value={price}
                                onChange={e => { setPrice(e.target.value); setError(null); }}
                                onBlur={() => markTouched("price")}
                                min="0"
                                max={FORM_LIMITS.moneyMax}
                                step="1"
                                inputMode="numeric"
                                placeholder="0"
                                className={cn(formControlClass, "py-2.5 pl-8 pr-4 text-sm", fieldErrorClass(priceError))}
                                {...fieldErrorProps("shift-price-error", priceError)}
                            />
                        </div>
                        <FieldError id="shift-price-error" error={priceError} />
                    </div>

                    {/* Reserved toggle */}
                    <div className="flex items-center justify-between py-1">
                        <div>
                            <p className="text-sm text-white font-medium">Reserved Shift</p>
                            <p className={cn("text-xs", formHelpTextClass)}>Seats in this shift require manual allocation</p>
                        </div>
                        <button
                            onClick={() => setIsReserved(v => !v)}
                            className={cn(
                                "w-10 h-5 rounded-full relative transition-colors",
                                isReserved ? "bg-[color:var(--ui-form-toggle-checked-bg)]" : "bg-[color:var(--ui-form-toggle-bg)]"
                            )}
                        >
                            <div className={cn(
                                "absolute top-0.5 h-4 w-4 rounded-full bg-[color:var(--ui-form-toggle-thumb)] shadow-sm transition-transform",
                                isReserved ? "translate-x-5" : "translate-x-0.5"
                            )} />
                        </button>
                    </div>

                    {error && (
                        <div className={cn("flex items-center gap-2 px-3 py-2 text-sm", formErrorBannerClass)}>
                            <AlertCircle size={13} /> {error}
                        </div>
                    )}

                    {overlapWith && (
                        <div className={cn("mt-2 flex flex-col gap-1.5 px-3 py-2 text-xs", formWarningBannerClass)}>
                            <div className="flex items-center gap-1.5">
                                <AlertTriangle size={13} />
                                <span>Time overlaps with &ldquo;{overlapWith.name}&rdquo; ({overlapWith.startTime} - {overlapWith.endTime}).</span>
                            </div>
                            <div className="flex flex-col gap-1 mt-1">
                                <button onClick={() => setEndTime(formatMins(parseNullableTime(overlapWith.startTime)! - 1))} className={cn("px-2 py-1.5 text-left", formWarningActionClass)}>
                                    Set End Time to {formatMins(parseNullableTime(overlapWith.startTime)! - 1)}
                                </button>
                                <button onClick={() => setStartTime(formatMins(parseNullableTime(overlapWith.endTime)! + 1))} className={cn("px-2 py-1.5 text-left", formWarningActionClass)}>
                                    Set Start Time to {formatMins(parseNullableTime(overlapWith.endTime)! + 1)}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className={cn("flex flex-shrink-0 flex-col-reverse gap-3 px-4 py-4 sm:flex-row sm:justify-end sm:px-6", formDialogFooterClass)}>
                    <Button variant="ghost" onClick={onClose} disabled={loading} className="text-sm h-8 px-3">
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={loading}
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
    existingShifts: Shift[];
    onClose: () => void;
    onDeleted: (shiftId: string) => void;
    onRenamed: (shift: Shift) => void;
}

function DeleteShiftDialog({ shift, branchId, existingShifts, onClose, onDeleted, onRenamed }: DeleteShiftDialogProps) {
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
    const {
        markTouched,
        markSubmitted,
        resetFieldErrors,
        visibleError,
    } = useInlineFieldErrors<"renameName" | "renameStart" | "renameEnd" | "renameTimePair" | "renameOverlap">();

    // Load analysis on mount
    useEffect(() => {
        resetFieldErrors();
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
            } catch (e: unknown) {
                setAnalyzeError(getErrorMessage(e, "Could not load shift analysis."));
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
            let resolution: DeleteResolution | undefined;
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
        } catch (e: unknown) {
            setSubmitError(getErrorMessage(e));
        } finally {
            setSubmitting(false);
        }
    };

    const getRenameOverlap = () => existingShifts.find(s => {
        if (s.id === shift.id) return false;
        if (!s.startTime || !s.endTime || !renameStart || !renameEnd) return false;
        if (s.name.toLowerCase() === "full time" || renameName.trim().toLowerCase() === "full time") return false;
        return timesOverlap(
            parseNullableTime(renameStart),
            parseNullableTime(renameEnd),
            parseNullableTime(s.startTime),
            parseNullableTime(s.endTime)
        );
    });

    const validateRenameForm = () => {
        const errors: Partial<Record<"renameName" | "renameStart" | "renameEnd" | "renameTimePair" | "renameOverlap", string>> = {};
        const nameResult = validateRequiredText(renameName, "Shift name", 50);
        const startResult = validateOptionalTime(renameStart, "Start time");
        const endResult = validateOptionalTime(renameEnd, "End time");
        const startValue = startResult.ok ? startResult.value : null;
        const endValue = endResult.ok ? endResult.value : null;
        const renameOverlapWith = getRenameOverlap();

        if (!nameResult.ok) errors.renameName = nameResult.error;
        if (!startResult.ok) errors.renameStart = startResult.error;
        if (!endResult.ok) errors.renameEnd = endResult.error;
        if ((startValue && !endValue) || (!startValue && endValue)) {
            errors.renameTimePair = "Shift must have both start and end time, or neither.";
        }
        if (renameOverlapWith) errors.renameOverlap = `Time overlaps with "${renameOverlapWith.name}".`;

        if (!nameResult.ok || !startResult.ok || !endResult.ok || !!errors.renameTimePair || !!renameOverlapWith) {
            return { errors, values: null };
        }
        return { errors, values: { nameResult, startResult, endResult } };
    };

    const renameValidation = validateRenameForm();
    const renameNameError = visibleError("renameName", renameValidation.errors);
    const renameStartError = visibleError("renameStart", renameValidation.errors);
    const renameEndError = visibleError("renameEnd", renameValidation.errors);
    const renameTimePairError = visibleError("renameTimePair", renameValidation.errors);
    const renameOverlapError = visibleError("renameOverlap", renameValidation.errors);
    const renameTimeGroupError = renameStartError || renameEndError || renameTimePairError || renameOverlapError;

    const handleRename = async () => {
        markSubmitted();
        setSubmitError(null);
        const result = validateRenameForm();
        if (Object.values(result.errors).some(Boolean) || !result.values) return;
        const { nameResult, startResult, endResult } = result.values;
        setSubmitting(true);
        try {
            const res = await fetch(`/api/branches/${branchId}/shifts/${shift.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: nameResult.value,
                    startTime: startResult.value,
                    endTime: endResult.value,
                }),
            });
            if (!res.ok) {
                const d = await res.json().catch(() => ({}));
                throw new Error(d.error || "Update failed.");
            }
            const updated: Shift = await res.json();
            onRenamed(updated);
            onClose();
        } catch (e: unknown) {
            setSubmitError(getErrorMessage(e));
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
        <div className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center sm:p-4">
            <div className={cn(submitting ? "cursor-not-allowed" : "cursor-pointer", formDialogOverlayClass)} onClick={submitting ? undefined : onClose} />
            <div className={cn("relative max-h-[calc(100dvh-1.5rem)] w-full max-w-lg overflow-y-auto sm:max-h-[90vh]", formDialogPanelClass)}>

                {/* Header */}
                <div className={cn("sticky top-0 z-10 flex items-center justify-between px-4 py-4 sm:px-6", formDialogHeaderClass)}>
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                            <Trash2 size={15} className="text-red-400" />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-[color:var(--ui-dialog-title)]">Delete &ldquo;{shift.name}&rdquo;</h2>
                            <p className={cn("text-xs", formHelpTextClass)}>Resolve before removing this shift</p>
                        </div>
                    </div>
                    {!submitting && (
                        <button onClick={onClose} className={cn("transition-colors hover:text-[color:var(--ui-table-text)]", formHelpTextClass)}>
                            <X size={18} />
                        </button>
                    )}
                </div>

                {/* ── Loading state */}
                {step === "loading" && (
                    <div className="flex flex-col items-center justify-center gap-3 py-16 text-[color:var(--ui-form-label)]">
                        <Loader2 size={28} className="animate-spin text-cyan-500" />
                        <p className="text-sm">Analyzing shift impact...</p>
                    </div>
                )}

                {/* ── Blocked: last active shift */}
                {step === "blocked" && (
                    <div className="p-4 space-y-4 sm:p-6">
                        <div className={cn("flex items-start gap-3 p-4", formWarningBannerClass)}>
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
                    <div className="p-4 space-y-4 sm:p-6">
                        <p className="text-sm text-[color:var(--ui-form-label)]">
                            This shift has <span className="text-white font-semibold">no active students</span>. It will be removed permanently.
                        </p>
                        {submitError && (
                            <div className={cn("flex items-center gap-2 px-3 py-2 text-sm", formErrorBannerClass)}>
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
                    <div className="p-4 space-y-5 sm:p-6">

                        {/* Impact summary */}
                        <div className={cn("space-y-2 p-4", formSurfaceClass)}>
                            <div className="flex items-center gap-2 text-sm">
                                <Users size={14} className="text-cyan-400" />
                                <span className="text-white font-semibold">{analysis.studentsInShift} student{analysis.studentsInShift !== 1 ? "s" : ""}</span>
                                <span className={formHelpTextClass}>currently in this shift</span>
                            </div>
                            <div className={cn("flex items-center gap-2 text-xs", formHelpTextClass)}>
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
                            <div className={cn("flex items-center gap-2 px-3 py-2 text-sm", formWarningBannerClass)}>
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
                                            <label className={cn("mb-1.5 block text-xs", formHelpTextClass)}>Select target shift</label>
                                            <select
                                                value={bulkTargetId}
                                                onChange={e => setBulkTargetId(e.target.value)}
                                                style={{ colorScheme: 'dark' }}
                                                className={cn(formControlClass, "px-3 py-2 text-sm")}
                                            >
                                                <option value="" disabled className="bg-[color:var(--ui-form-input-select-bg)] text-white">Choose a shift…</option>
                                                {analysis.otherShifts
                                                    .filter(s => analysis.shiftsWithEnoughCapacity.includes(s.shiftId))
                                                    .map(s => (
                                                        <option key={s.shiftId} value={s.shiftId} className="bg-[color:var(--ui-form-input-select-bg)] text-white">
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
                                                <div key={alloc.allocationId} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs text-white font-medium truncate">{alloc.studentName}</p>
                                                        <p className="text-[10px] text-[color:var(--ui-table-subtle)]">Seat {alloc.seatLabel}</p>
                                                    </div>
                                                    <select
                                                        value={chosenId}
                                                        onChange={e => setManualAssignments(prev => ({
                                                            ...prev,
                                                            [alloc.allocationId]: e.target.value,
                                                        }))}
                                                        style={{ colorScheme: 'dark' }}
                                                        className={cn(
                                                            formControlClass,
                                                            "px-2 py-1.5 text-xs sm:min-w-[160px]",
                                                            wouldOverflow && "border-[color:var(--ui-form-error-border)] focus:border-[color:var(--ui-form-error-focus-border)]"
                                                        )}
                                                    >
                                                        <option value="" disabled className="bg-[color:var(--ui-form-input-select-bg)] text-white">Select shift…</option>
                                                        {analysis.otherShifts.map(s => (
                                                            <option key={s.shiftId} value={s.shiftId} disabled={s.emptySeats === 0} className="bg-[color:var(--ui-form-input-select-bg)] text-white">
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
                                icon={<Pencil size={15} className={pageMutedTextClass} />}
                                title="Rename / Retime Instead"
                                description="Don't delete — just change the name or time window. Students stay allocated."
                            >
                                {mode === "RENAME" && (() => {
                                    const renameOverlapWith = getRenameOverlap();
                                    return (
                                        <div className="mt-3 space-y-3">
                                            <div>
                                                <label className={cn("mb-1 block text-xs", formHelpTextClass)}>New name</label>
                                                <input
                                                    type="text"
                                                    value={renameName}
                                                    onChange={e => { setRenameName(e.target.value); setSubmitError(null); }}
                                                    onBlur={() => markTouched("renameName")}
                                                    className={cn(formControlClass, "px-3 py-2 text-sm", fieldErrorClass(renameNameError))}
                                                    {...fieldErrorProps("rename-shift-name-error", renameNameError)}
                                                />
                                                <FieldError id="rename-shift-name-error" error={renameNameError} />
                                            </div>
                                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                                <div>
                                                    <label className={cn("mb-1 block text-xs", formHelpTextClass)}>Start time</label>
                                                    <input
                                                        type="time"
                                                        value={renameStart}
                                                        onChange={e => { setRenameStart(e.target.value); markTouched("renameTimePair"); markTouched("renameOverlap"); }}
                                                        onBlur={() => markTouched("renameStart")}
                                                        className={cn(formControlClass, "px-3 py-2 text-sm", fieldErrorClass(renameStartError || renameTimePairError || renameOverlapError))}
                                                        {...fieldErrorProps("rename-shift-time-error", renameTimeGroupError)}
                                                    />
                                                </div>
                                                <div>
                                                    <label className={cn("mb-1 block text-xs", formHelpTextClass)}>End time</label>
                                                    <input
                                                        type="time"
                                                        value={renameEnd}
                                                        onChange={e => { setRenameEnd(e.target.value); markTouched("renameTimePair"); markTouched("renameOverlap"); }}
                                                        onBlur={() => markTouched("renameEnd")}
                                                        className={cn(formControlClass, "px-3 py-2 text-sm", fieldErrorClass(renameEndError || renameTimePairError || renameOverlapError))}
                                                        {...fieldErrorProps("rename-shift-time-error", renameTimeGroupError)}
                                                    />
                                                </div>
                                            </div>
                                            <FieldError id="rename-shift-time-error" error={renameTimeGroupError} />
                                            {renameOverlapWith && (
                                                <div className={cn("flex items-center gap-2 px-3 py-2 text-xs", formWarningBannerClass)}>
                                                    <AlertTriangle size={13} />
                                                    <span>Time overlaps with &ldquo;{renameOverlapWith.name}&rdquo; ({renameOverlapWith.startTime}&nbsp;–&nbsp;{renameOverlapWith.endTime}). Adjust the times before saving.</span>
                                                </div>
                                            )}
                                            {/* Expose overlap state to the footer via a data attribute trick:
                                                We rely on the parent computing this via a sibling IIFE — see footer button below. */}
                                        </div>
                                    );
                                })()}
                            </OptionCard>
                        </div>

                        {/* Submit error */}
                        {submitError && (
                            <div className={cn("flex items-center gap-2 px-3 py-2 text-sm", formErrorBannerClass)}>
                                <AlertCircle size={13} /> {submitError}
                            </div>
                        )}

                        {/* Footer actions */}
                        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
                            <Button variant="ghost" onClick={onClose} disabled={submitting} className="text-sm h-8 px-3">
                                Cancel
                            </Button>
                            {mode === "RENAME" ? (
                                <Button
                                    onClick={handleRename}
                                    disabled={submitting}
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
    const selectedSurface = variant === "danger"
        ? "border-red-500/40 bg-red-500/5"
        : variant === "success"
            ? "border-emerald-500/40 bg-emerald-500/5"
            : "border-cyan-500/40 bg-cyan-500/5";

    return (
        <div
            onClick={onClick}
            className={cn(
                "cursor-pointer p-4 transition-all",
                selected ? cn("rounded-xl border", selectedSurface) : cn(pageInsetSurfaceClass, pageInsetHoverClass)
            )}
        >
            <div className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0">{icon}</div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white">{title}</p>
                    <p className={cn("mt-0.5 text-xs leading-relaxed", pageSubtleTextClass)}>{description}</p>
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

type RowAction = RowActionsMenuItem;

function RowActions({ actions }: { actions: RowAction[] }) {
    return <RowActionsMenu actions={actions} menuWidthClassName="w-40" />;
}

// ─── Type Picker Dialog ────────────────────────────────────────────────────────

interface TypePickerDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (type: "primary" | "multi") => void;
}

function TypePickerDialog({ isOpen, onClose, onSelect }: TypePickerDialogProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center sm:p-4">
            <div className={cn("cursor-pointer", formDialogOverlayClass)} onClick={onClose} />
            <div className={cn("relative w-full max-w-md animate-in zoom-in-95 duration-200", formDialogPanelClass)}>
                <div className={cn("flex items-center justify-between px-4 py-4 sm:px-6", formDialogHeaderClass)}>
                    <div>
                        <h2 className="text-base font-bold text-[color:var(--ui-dialog-title)]">What type of shift?</h2>
                        <p className={cn("mt-0.5 text-xs", formHelpTextClass)}>Select the type of window to create</p>
                    </div>
                    <button onClick={onClose} className={cn("transition-colors hover:text-[color:var(--ui-table-text)]", formHelpTextClass)}>
                        <X size={18} />
                    </button>
                </div>

                <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 sm:gap-4 sm:p-6">
                    <button
                        onClick={() => onSelect("primary")}
                        className="flex flex-col items-center gap-3 p-6 rounded-xl border border-yellow-500/20 bg-yellow-500/5 hover:bg-yellow-500/10 hover:border-yellow-500/40 transition-all group"
                    >
                        <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-400 group-hover:scale-110 transition-transform">
                            <Clock size={24} />
                        </div>
                        <div className="text-center">
                            <p className="text-sm font-bold text-white">Primary</p>
                            <p className={cn("mt-1 text-[10px] font-semibold uppercase tracking-wider", formHelpTextClass)}>Single Time Slot</p>
                        </div>
                    </button>

                    <button
                        onClick={() => onSelect("multi")}
                        className="flex flex-col items-center gap-3 p-6 rounded-xl border border-orange-500/20 bg-orange-500/5 hover:bg-orange-500/10 hover:border-orange-500/40 transition-all group"
                    >
                        <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center text-orange-400 group-hover:scale-110 transition-transform">
                            <Layers size={24} />
                        </div>
                        <div className="text-center">
                            <p className="text-sm font-bold text-white">Multi-Shift</p>
                            <p className={cn("mt-1 text-[10px] font-semibold uppercase tracking-wider", formHelpTextClass)}>Bundle of 2+ Primary</p>
                        </div>
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Multi-Shift Dialog ─────────────────────────────────────────────────────────

interface MultiShiftDialogProps {
    isOpen: boolean;
    mode: "add" | "edit";
    initial?: MultiShift;
    branchId: string;
    primaryShifts: Shift[];
    existingMultiShifts: MultiShift[];
    onClose: () => void;
    onSuccess: (ms: MultiShift) => void;
}

function MultiShiftDialog({ isOpen, mode, initial, branchId, primaryShifts, existingMultiShifts, onClose, onSuccess }: MultiShiftDialogProps) {
    const [name, setName] = useState("");
    const [price, setPrice] = useState("0");
    const [selectedShiftIds, setSelectedShiftIds] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const {
        markTouched,
        markSubmitted,
        resetFieldErrors,
        visibleError,
    } = useInlineFieldErrors<"name" | "price" | "components">();

    useEffect(() => {
        if (isOpen) {
            setName(initial?.name ?? "");
            setPrice(String(initial?.price ?? 0));
            setSelectedShiftIds(initial?.components.map(c => c.shiftId) ?? []);
            setError(null);
            resetFieldErrors();
        }
    }, [isOpen, initial, resetFieldErrors]);

    // Validation
    const selectedSorted = [...selectedShiftIds].sort().join(",");
    const duplicateCombo = existingMultiShifts.find(ms => {
        if (ms.id === initial?.id) return false;
        return [...ms.components].map(c => c.shiftId).sort().join(",") === selectedSorted;
    });

    const duplicateName = existingMultiShifts.find(ms => {
        if (ms.id === initial?.id) return false;
        return ms.name.toLowerCase() === name.trim().toLowerCase();
    });

    if (!isOpen) return null;

    const validateForm = () => {
        const errors: Partial<Record<"name" | "price" | "components", string>> = {};
        const nameResult = validateRequiredText(name, "Multi-shift name", 50);
        const priceResult = parseIntegerField(price, "Bundle monthly price", { min: 0, max: FORM_LIMITS.moneyMax });
        if (!nameResult.ok) errors.name = nameResult.error;
        if (!priceResult.ok) errors.price = priceResult.error;
        if (selectedShiftIds.length < 2) errors.components = "Select at least 2 primary shifts.";
        if (duplicateCombo) errors.components = `A multi-shift with this exact combination already exists: "${duplicateCombo.name}".`;
        if (duplicateName) errors.name = `A multi-shift named "${name.trim()}" already exists.`;
        if (!nameResult.ok || !priceResult.ok || selectedShiftIds.length < 2 || !!duplicateCombo || !!duplicateName) {
            return { errors, values: null };
        }
        return { errors, values: { nameResult, priceResult } };
    };

    const validation = validateForm();
    const nameError = visibleError("name", validation.errors);
    const priceError = visibleError("price", validation.errors);
    const componentsError = visibleError("components", validation.errors);

    const handleSubmit = async () => {
        markSubmitted();
        setError(null);
        const result = validateForm();
        if (Object.values(result.errors).some(Boolean) || !result.values) return;
        const { nameResult, priceResult } = result.values;

        setLoading(true);
        try {
            const url = mode === "edit" && initial
                ? `/api/branches/${branchId}/multi-shifts/${initial.id}`
                : `/api/branches/${branchId}/multi-shifts`;
            const method = mode === "edit" ? "PATCH" : "POST";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: nameResult.value,
                    price: priceResult.value ?? 0,
                    shiftIds: selectedShiftIds,
                }),
            });
            if (!res.ok) {
                const d = await res.json().catch(() => ({}));
                throw new Error(d.error || "Operation failed");
            }
            const saved = await res.json();
            onSuccess(saved);
        } catch (err: unknown) {
            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    const toggleShift = (id: string) => {
        markTouched("components");
        setSelectedShiftIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
        setError(null);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center sm:p-4">
            <div className={cn("cursor-pointer", formDialogOverlayClass)} onClick={onClose} />
            <div className={cn("relative flex max-h-[calc(100dvh-1.5rem)] w-full max-w-md flex-col", formDialogPanelClass)}>
                <div className={cn("flex flex-shrink-0 items-center justify-between px-4 py-4 sm:px-6", formDialogHeaderClass)}>
                    <div>
                        <h2 className="text-base font-bold text-[color:var(--ui-dialog-title)]">{mode === "add" ? "Add Multi-Shift" : "Edit Multi-Shift"}</h2>
                        <p className={cn("mt-0.5 text-xs", formHelpTextClass)}>Bundle of primary shifts</p>
                    </div>
                    <button onClick={onClose} className={cn("transition-colors hover:text-[color:var(--ui-table-text)]", formHelpTextClass)}>
                        <X size={18} />
                    </button>
                </div>

                <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
                    <div className="space-y-1.5">
                        <label className={formCompactLabelClass}>Bundle Name *</label>
                        <input
                            type="text"
                            value={name}
                            onChange={e => { setName(e.target.value); setError(null); }}
                            onBlur={() => markTouched("name")}
                            placeholder="e.g. Full Time"
                            className={cn(formControlClass, "px-4 py-2.5 text-sm focus:border-orange-500/50", fieldErrorClass(nameError))}
                            {...fieldErrorProps("multi-shift-name-error", nameError)}
                        />
                        <FieldError id="multi-shift-name-error" error={nameError} />
                    </div>

                    <div className="space-y-1.5">
                        <label className={formCompactLabelClass}>Bundle Monthly Price (₹)</label>
                        <div className="relative">
                            <IndianRupee size={13} className={cn("absolute left-3 top-1/2 -translate-y-1/2", formIconClass)} />
                            <input
                                type="number"
                                value={price}
                                onChange={e => { setPrice(e.target.value); setError(null); }}
                                onBlur={() => markTouched("price")}
                                min="0"
                                max={FORM_LIMITS.moneyMax}
                                step="1"
                                inputMode="numeric"
                                className={cn(formControlClass, "py-2.5 pl-8 pr-4 text-sm focus:border-orange-500/50", fieldErrorClass(priceError))}
                                {...fieldErrorProps("multi-shift-price-error", priceError)}
                            />
                        </div>
                        <FieldError id="multi-shift-price-error" error={priceError} />
                    </div>

                    <div className="space-y-2.5">
                        <label className={cn("block", formCompactLabelClass)}>Component Shifts *</label>
                        <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1">
                            {primaryShifts.map(s => (
                                <button
                                    key={s.id}
                                    onClick={() => toggleShift(s.id)}
                                    className={cn(
                                        "flex items-center justify-between px-3 py-2 rounded-lg border text-left transition-all",
                                        selectedShiftIds.includes(s.id)
                                            ? "bg-orange-500/10 border-orange-500/30 text-orange-200"
                                            : "border-[color:var(--ui-form-surface-border)] bg-[color:var(--ui-form-surface-bg)] text-[color:var(--ui-form-label)] hover:border-[color:var(--ui-form-input-border)]"
                                    )}
                                >
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium">{s.name}</span>
                                        <span className="text-[10px] opacity-60 font-mono">{s.startTime} - {s.endTime}</span>
                                    </div>
                                    <div className={cn(
                                        "w-4 h-4 rounded border flex items-center justify-center transition-all",
                                        selectedShiftIds.includes(s.id) ? "bg-orange-500 border-orange-500" : "border-white/20"
                                    )}>
                                        {selectedShiftIds.includes(s.id) && <CheckCircle2 size={10} className="text-white" />}
                                    </div>
                                </button>
                            ))}
                        </div>
                        <FieldError id="multi-shift-components-error" error={componentsError} />
                    </div>

                    {error && (
                        <div className={cn("flex items-center gap-2 px-3 py-2 text-sm", formErrorBannerClass)}>
                            <AlertCircle size={13} /> {error}
                        </div>
                    )}
                </div>

                <div className={cn("flex flex-shrink-0 flex-col-reverse gap-3 px-4 py-4 sm:flex-row sm:justify-end sm:px-6", formDialogFooterClass)}>
                    <Button variant="ghost" onClick={onClose} disabled={loading} className="text-sm h-8 px-3">Cancel</Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="text-sm h-8 px-4 bg-orange-500/20 border border-orange-500/30 text-orange-300 hover:bg-orange-500/30 min-w-[100px] justify-center"
                    >
                        {loading ? <Loader2 size={14} className="animate-spin" /> : mode === "add" ? "Create Bundle" : "Save Changes"}
                    </Button>
                </div>
            </div>
        </div>
    );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function ShiftsPage() {
    const params = useParams();
    const branchId = params?.branchId as string;

    return (
        <BranchAccessGuard branchId={branchId} permission={BRANCH_PAGE_ACCESS.shifts}>
            {access => (
                <ShiftsContent
                    branchId={branchId}
                    canManageBranch={access.permissions.manage_branch}
                />
            )}
        </BranchAccessGuard>
    );
}

function ShiftsContent({
    branchId,
    canManageBranch,
}: {
    branchId: string;
    canManageBranch: boolean;
}) {
    const shiftManageHelpText = getPermissionHelpText("manage_branch");
    const [shifts, setShifts] = useState<Shift[]>([]);
    const [multiShifts, setMultiShifts] = useState<MultiShift[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

    // Dialog state
    const [dialog, setDialog] = useState<{
        open: boolean;
        mode: "type-picker" | "add-primary" | "add-multi" | "edit-primary" | "edit-multi";
        shift?: Shift;
        multiShift?: MultiShift;
    }>({
        open: false, mode: "add-primary",
    });

    // Delete dialog state
    const [deleteTarget, setDeleteTarget] = useState<Shift | null>(null);

    const showToast = (msg: string, type: "success" | "error" = "success") => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3500);
    };

    const loadShifts = useCallback(async () => {
        if (!branchId) return;
        setLoading(true);
        try {
            const [shiftsRes, multiRes] = await Promise.all([
                fetch(`/api/branches/${branchId}/shifts`),
                fetch(`/api/branches/${branchId}/multi-shifts`)
            ]);
            
            if (!shiftsRes.ok || !multiRes.ok) throw new Error("Failed to load shifts");
            
            const [shiftsData, multiData] = await Promise.all([
                shiftsRes.json(),
                multiRes.json()
            ]);
            
            setShifts(shiftsData);
            setMultiShifts(multiData);
            setError(null);
        } catch (err: unknown) {
            setError(getErrorMessage(err, "Failed to load shifts"));
        } finally {
            setLoading(false);
        }
    }, [branchId]);

    useEffect(() => { loadShifts(); }, [loadShifts]);

    const handleDialogSuccess = (saved: Shift) => {
        setShifts(prev => {
            const idx = prev.findIndex(s => s.id === saved.id);
            if (idx >= 0) { const next = [...prev]; next[idx] = saved; return next; }
            return [...prev, saved];
        });
        showToast(dialog.mode === "add-primary" ? `"${saved.name}" added.` : `"${saved.name}" updated.`);
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
    if (loading) return <div className={pageLoadingStateClass}><Loader2 className="animate-spin mr-2" /> Loading shifts...</div>;

    // ── Error
    if (error) return (
        <div className={pageErrorStateClass}>
            <AlertCircle className={pageErrorIconClass} />
            <p className={pageMutedTextClass}>{error}</p>
        </div>
    );

    const handleDeleteMultiShift = (ms: MultiShift) => {
        if (confirm("Delete this multi-shift bundle? Student allocations will remain but grouping will be lost.")) {
            fetch(`/api/branches/${branchId}/multi-shifts/${ms.id}`, { method: "DELETE" })
                .then(() => {
                    setMultiShifts(prev => prev.filter(x => x.id !== ms.id));
                    showToast(`"${ms.name}" deleted.`);
                });
        }
    };

    const primaryShiftActions = (shift: Shift): RowAction[] => [
        {
            label: "Edit",
            icon: Pencil,
            onClick: () => setDialog({ open: true, mode: "edit-primary", shift }),
        },
        {
            label: "Delete",
            icon: Trash2,
            variant: "danger",
            onClick: () => setDeleteTarget(shift),
        },
    ];

    const multiShiftActions = (ms: MultiShift): RowAction[] => [
        {
            label: "Edit",
            icon: Pencil,
            onClick: () => setDialog({ open: true, mode: "edit-multi", multiShift: ms }),
        },
        {
            label: "Delete",
            icon: Trash2,
            variant: "danger",
            onClick: () => handleDeleteMultiShift(ms),
        },
    ];

    const shiftCards = (
        <div className="grid gap-4">
            {shifts.map(shift => (
                <div key={shift.id} className={cn(pageGridCardClass, pageGridCardHoverClass)}>
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <p className="truncate font-medium text-white">{shift.name}</p>
                            <div className="mt-2">
                                <Badge variant="warning" className="bg-yellow-500/10 text-yellow-300 border-yellow-500/20 font-bold tracking-wider text-[10px]">
                                    PRIMARY
                                </Badge>
                            </div>
                        </div>
                        {canManageBranch ? (
                            <RowActions actions={primaryShiftActions(shift)} />
                        ) : (
                            <span className={cn("text-xs", pageSubtleTextClass)} title={shiftManageHelpText}>
                                View only
                            </span>
                        )}
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                        <div className={cn("p-3", pageInsetSurfaceClass)}>
                            <div className={cn("text-xs", pageSubtleTextClass)}>Time Window</div>
                            <div className={cn("mt-1", pageMutedTextClass)}>
                                {shift.startTime && shift.endTime ? (
                                    <span className="font-mono text-xs">{shift.startTime} - {shift.endTime}</span>
                                ) : (
                                    <span className={cn("text-xs italic", pageSubtleTextClass)}>No time limit</span>
                                )}
                            </div>
                        </div>
                        <div className={cn("p-3", pageInsetSurfaceClass)}>
                            <div className={cn("text-xs", pageSubtleTextClass)}>Price</div>
                            <div className="mt-1 font-semibold text-white">₹{shift.price}</div>
                        </div>
                    </div>
                </div>
            ))}

            {multiShifts.map(ms => (
                <div key={ms.id} className={cn(pageGridCardClass, pageGridCardHoverClass)}>
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <p className="truncate font-medium text-white">{ms.name}</p>
                            <div className="mt-2">
                                <Badge variant="warning" className="bg-orange-500/10 text-orange-300 border-orange-500/20 font-bold tracking-wider text-[10px]">
                                    MULTI-SHIFT
                                </Badge>
                            </div>
                        </div>
                        {canManageBranch ? (
                            <RowActions actions={multiShiftActions(ms)} />
                        ) : (
                            <span className={cn("text-xs", pageSubtleTextClass)} title={shiftManageHelpText}>
                                View only
                            </span>
                        )}
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                        <div className={cn("p-3", pageInsetSurfaceClass)}>
                            <div className={cn("text-xs", pageSubtleTextClass)}>Slots</div>
                            <div className={cn("mt-1 text-xs", pageMutedTextClass)}>{ms.components.length} combined</div>
                        </div>
                        <div className={cn("p-3", pageInsetSurfaceClass)}>
                            <div className={cn("text-xs", pageSubtleTextClass)}>Price</div>
                            <div className="mt-1 font-semibold text-white">₹{ms.price}</div>
                        </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                        {ms.components.map(c => (
                            <span key={c.shiftId} className="rounded border border-[color:var(--ui-form-surface-border)] bg-[color:var(--ui-form-surface-bg)] px-1.5 py-0.5 text-[10px] text-[color:var(--text-secondary)]">
                                {c.shiftName}
                            </span>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );

    return (
        <div className="p-4 md:p-8 space-y-6 relative">
            {/* Toast */}
            {toast && (
                <div className={cn(
                    "fixed bottom-4 left-4 right-4 z-50 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm shadow-2xl animate-in fade-in slide-in-from-bottom-2 sm:bottom-6 sm:left-auto sm:right-6 sm:w-auto",
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
                onAdd={canManageBranch ? () => setDialog({ open: true, mode: "type-picker" }) : undefined}
                actionLabel="Add Shift"
            />

            {!canManageBranch && (
                <div className={cn("px-4 py-3 text-sm", formWarningBannerClass)}>
                    Shift changes are disabled. {shiftManageHelpText}
                </div>
            )}

            {shifts.length === 0 && multiShifts.length === 0 ? (
                <div className={pageEmptyStateClass}>
                    <Clock size={36} className="mx-auto mb-3 opacity-30" />
                    <p>No shifts found.</p>
                    {canManageBranch && (
                        <button
                            onClick={() => setDialog({ open: true, mode: "type-picker" })}
                            className="mt-3 text-sm text-[color:var(--ui-form-accent)] transition-colors hover:text-[color:var(--ui-form-accent-hover)]"
                        >
                            + Add your first shift
                        </button>
                    )}
                </div>
            ) : (
                <>
                <div className="md:hidden">{shiftCards}</div>
                <Card noHover className="hidden overflow-visible p-0 md:block md:p-0">
                    <div className="w-full overflow-x-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                    <table className="w-full min-w-[54rem] text-left text-sm">
                        <thead>
                            <tr className="border-b border-[color:var(--ui-table-divider)] bg-[color:var(--ui-table-head-bg)] text-[color:var(--ui-table-muted)]">
                                <th className="px-6 py-4 font-semibold">Shift Name</th>
                                <th className="px-6 py-4 font-semibold">Type</th>
                                <th className="px-6 py-4 font-semibold">Time Window</th>
                                <th className="px-6 py-4 font-semibold">Price</th>
                                <th className="px-6 py-4 text-right font-semibold">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[color:var(--ui-table-divider)]">
                            {/* Primary Shifts */}
                            {shifts.map(shift => (
                                <tr key={shift.id} className="group transition-colors hover:bg-[color:var(--ui-table-row-hover-bg)]">
                                    <td className="px-6 py-4 font-medium text-[color:var(--ui-table-text)]">{shift.name}</td>
                                    <td className="px-6 py-4">
                                        <Badge variant="warning" className="bg-yellow-500/10 text-yellow-300 border-yellow-500/20 font-bold tracking-wider text-[10px]">
                                            PRIMARY
                                        </Badge>
                                    </td>
                                    <td className="px-6 py-4 text-[color:var(--ui-table-muted)]">
                                        {shift.startTime && shift.endTime ? (
                                            <span className="font-mono flex items-center gap-1.5">
                                                <Clock size={12} className="text-[color:var(--ui-table-subtle)]" />
                                                {shift.startTime} – {shift.endTime}
                                            </span>
                                        ) : (
                                            <span className="text-xs italic text-[color:var(--ui-table-subtle)]">No time limit</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 font-medium text-[color:var(--ui-table-text)]">₹{shift.price}</td>
                                    <td className="px-6 py-4 text-right">
                                        {canManageBranch ? (
                                            <RowActions actions={primaryShiftActions(shift)} />
                                        ) : (
                                            <span className="text-xs text-[color:var(--ui-table-subtle)]" title={shiftManageHelpText}>
                                                View only
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))}

                            {/* Multi Shifts */}
                            {multiShifts.map(ms => (
                                <tr key={ms.id} className="group border-t border-[color:var(--ui-table-divider)] transition-colors hover:bg-[color:var(--ui-table-row-hover-bg)]">
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="font-medium text-[color:var(--ui-table-text)]">{ms.name}</span>
                                            <div className="flex flex-wrap gap-1 mt-1">
                                                {ms.components.map(c => (
                                                    <span key={c.shiftId} className="rounded border border-[color:var(--ui-table-border)] bg-[color:var(--ui-table-action-bg)] px-1.5 py-0.5 text-[9px] text-[color:var(--ui-table-muted)]">
                                                        {c.shiftName}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <Badge variant="warning" className="bg-orange-500/10 text-orange-300 border-orange-500/20 font-bold tracking-wider text-[10px]">
                                            MULTI-SHIFT
                                        </Badge>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-xs text-[color:var(--ui-table-subtle)]">
                                            {ms.components.length} slots combined
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 font-medium text-[color:var(--ui-table-text)]">₹{ms.price}</td>
                                    <td className="px-6 py-4 text-right">
                                        {canManageBranch ? (
                                            <RowActions actions={multiShiftActions(ms)} />
                                        ) : (
                                            <span className="text-xs text-[color:var(--ui-table-subtle)]" title={shiftManageHelpText}>
                                                View only
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    </div>
                </Card>
                </>
            )}

            {canManageBranch && (
                <>
                    <TypePickerDialog
                        isOpen={dialog.open && dialog.mode === "type-picker"}
                        onClose={() => setDialog({ ...dialog, open: false })}
                        onSelect={(type) => setDialog({ open: true, mode: type === "primary" ? "add-primary" : "add-multi" })}
                    />

                    <ShiftDialog
                        isOpen={dialog.open && (dialog.mode === "add-primary" || dialog.mode === "edit-primary")}
                        mode={dialog.mode === "add-primary" ? "add" : "edit"}
                        initial={dialog.shift}
                        branchId={branchId}
                        existingShifts={shifts}
                        onClose={() => setDialog({ ...dialog, open: false })}
                        onSuccess={handleDialogSuccess}
                    />

                    <MultiShiftDialog
                        isOpen={dialog.open && (dialog.mode === "add-multi" || dialog.mode === "edit-multi")}
                        mode={dialog.mode === "add-multi" ? "add" : "edit"}
                        initial={dialog.multiShift}
                        branchId={branchId}
                        primaryShifts={shifts}
                        existingMultiShifts={multiShifts}
                        onClose={() => setDialog({ ...dialog, open: false })}
                        onSuccess={(ms) => {
                            if (dialog.mode === "add-multi") setMultiShifts([...multiShifts, ms]);
                            else setMultiShifts(multiShifts.map(x => x.id === ms.id ? ms : x));
                            showToast(dialog.mode === "add-multi" ? `"${ms.name}" added.` : `"${ms.name}" updated.`);
                            setDialog({ ...dialog, open: false });
                        }}
                    />

                    {deleteTarget && (
                        <DeleteShiftDialog
                            shift={deleteTarget}
                            branchId={branchId}
                            existingShifts={shifts}
                            onClose={() => setDeleteTarget(null)}
                            onDeleted={handleDeleted}
                            onRenamed={handleRenamed}
                        />
                    )}
                </>
            )}
        </div>
    );
}
