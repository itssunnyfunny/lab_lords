"use client";

import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, Lock, Check, Layers } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Shared Types ─────────────────────────────────────────────────────────────

export interface ShiftCapacity {
    type: "PRIMARY" | "MULTISHIFT";
    shiftId: string;          // For PRIMARY: shift DB id; For MULTISHIFT: multiShift DB id
    multiShiftId?: string;    // Only set for MULTISHIFT
    name: string;
    startTime: string | null;
    endTime: string | null;
    price: number;
    isReserved: boolean;
    totalSeats: number;
    used: number;
    available: number;
    occupancyPercent: number;
    isFull: boolean;
    studentAlreadyAllocated: boolean;
    componentShiftIds?: string[];
    componentShiftNames?: string[];
}

export interface SeatCell {
    seatId: string;
    label: string;
    occupied: boolean;
    occupiedBy: string | null;
}

export interface SeatMapData {
    shiftId: string;
    shiftName: string;
    isReserved: boolean;
    totalSeats: number;
    occupiedCount: number;
    availableCount: number;
    seats: SeatCell[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function capacityBarColor(pct: number, isFull: boolean) {
    if (isFull) return "bg-red-500/80";
    if (pct >= 70) return "bg-amber-400/80";
    return "bg-emerald-400/80";
}

function capacityTextColor(pct: number, isFull: boolean) {
    if (isFull) return "text-red-400";
    if (pct >= 70) return "text-amber-400";
    return "text-emerald-400";
}

function formatTime(t: string | null) {
    if (!t) return "";
    const [h, m] = t.split(":").map(Number);
    const suffix = h < 12 ? "AM" : "PM";
    const hh = h % 12 || 12;
    return `${hh}:${String(m).padStart(2, "0")} ${suffix}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface SeatPickerProps {
    branchId: string;
    studentId?: string;
    selectedShiftIds: string[];
    selectedMultiShiftId?: string | null;
    selectedSeatId: string | null;
    onToggleShift: (shift: ShiftCapacity) => void;
    onSelectSeat: (seatId: string | null) => void;
    /** Allocation IDs to exclude from occupancy checks — used for update/change flows */
    excludeAllocationIds?: string[];
    /** Seat ID of the student's current allocation — shown with a special "Current" indicator */
    currentSeatId?: string;
}

export function SeatPicker({
    branchId,
    studentId,
    selectedShiftIds,
    selectedMultiShiftId,
    selectedSeatId,
    onToggleShift,
    onSelectSeat,
    excludeAllocationIds,
    currentSeatId,
}: SeatPickerProps) {
    const [shifts, setShifts] = useState<ShiftCapacity[]>([]);
    const [shiftsLoading, setShiftsLoading] = useState(false);
    const [shiftsError, setShiftsError] = useState<string | null>(null);

    // The seat map is always fetched for the FIRST selected primary shift.
    // For multi-shifts, selectedShiftIds contains the expanded component IDs,
    // so primaryShiftId is the first component shift ID.
    const primaryShiftId = selectedShiftIds[0] ?? null;
    const [seatMap, setSeatMap] = useState<SeatMapData | null>(null);
    const [seatMapLoading, setSeatMapLoading] = useState(false);
    const [seatMapError, setSeatMapError] = useState<string | null>(null);
    const [hoveredSeat, setHoveredSeat] = useState<string | null>(null);

    // 1. Fetch capacity cards (includes multi-shifts)
    useEffect(() => {
        setShiftsLoading(true);
        setShiftsError(null);
        let url = `/api/branches/${branchId}/shifts/capacity`;
        const capacityParams = new URLSearchParams();
        if (studentId) capacityParams.set("studentId", studentId);
        if (excludeAllocationIds?.length) capacityParams.set("excludeAllocationIds", excludeAllocationIds.join(","));
        const capacityQuery = capacityParams.toString();
        if (capacityQuery) url += `?${capacityQuery}`;

        fetch(url)
            .then(r => {
                if (!r.ok) throw new Error("Failed to load shifts");
                return r.json();
            })
            .then(setShifts)
            .catch(e => setShiftsError(e.message))
            .finally(() => setShiftsLoading(false));
    }, [branchId, studentId, excludeAllocationIds?.join(",")]);

    // 2. Fetch seat grid when shift selection changes.
    //
    //    MULTI-SHIFT: selectedMultiShiftId is set (the MultiShift DB id).
    //      → URL: /shifts/{firstComponentId}/seat-map?multiShiftId={msId}
    //      → Server checks ALL component shifts; seat is occupied if taken in ANY of them.
    //
    //    PRIMARY: selectedMultiShiftId is null.
    //      → URL: /shifts/{shiftId}/seat-map
    //      → Server checks single shift (+ time-overlap logic).
    useEffect(() => {
        if (!primaryShiftId) {
            setSeatMap(null);
            return;
        }
        setSeatMapLoading(true);
        setSeatMapError(null);

        const seatMapParams = new URLSearchParams();
        if (selectedMultiShiftId) seatMapParams.set("multiShiftId", selectedMultiShiftId);
        if (excludeAllocationIds?.length) seatMapParams.set("excludeAllocationIds", excludeAllocationIds.join(","));
        const seatMapQuery = seatMapParams.toString();
        const seatMapUrl = `/api/branches/${branchId}/shifts/${primaryShiftId}/seat-map${seatMapQuery ? `?${seatMapQuery}` : ""}`;

        fetch(seatMapUrl)
            .then(r => {
                if (!r.ok) throw new Error("Failed to load seat map");
                return r.json();
            })
            .then(setSeatMap)
            .catch(e => setSeatMapError(e.message))
            .finally(() => setSeatMapLoading(false));
    }, [branchId, primaryShiftId, selectedMultiShiftId, excludeAllocationIds?.join(",")]);

    const selectedCount = selectedShiftIds.length;

    // Separate primary and multi-shift items
    const primaryShifts = shifts.filter(s => s.type === "PRIMARY");
    const multiShifts = shifts.filter(s => s.type === "MULTISHIFT");

    return (
        <div className="space-y-6">
            {/* Step 1: Shifts */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium">
                        Select shift(s)
                    </p>
                    {selectedCount > 0 && (
                        <span className="text-xs text-indigo-300 font-medium">
                            {selectedCount} shift{selectedCount > 1 ? "s" : ""} selected
                        </span>
                    )}
                </div>

                {shiftsLoading && (
                    <div className="flex items-center justify-center py-6 text-zinc-500">
                        <Loader2 size={16} className="animate-spin mr-2" /> Loading shifts...
                    </div>
                )}

                {shiftsError && (
                    <div className="p-3 text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg">
                        {shiftsError}
                    </div>
                )}

                {!shiftsLoading && !shiftsError && (
                    <div className="space-y-4">
                        {/* Primary Shifts */}
                        {primaryShifts.length > 0 && (
                            <div className="space-y-2">
                                <p className="text-[10px] text-zinc-600 uppercase tracking-wider font-semibold flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-yellow-400/70 inline-block" />
                                    Primary Shifts
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {primaryShifts.map(shift => (
                                        <ShiftCard
                                            key={shift.shiftId}
                                            shift={shift}
                                            isSelected={selectedShiftIds.includes(shift.shiftId)}
                                            onToggle={onToggleShift}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Multi-Shifts */}
                        {multiShifts.length > 0 && (
                            <div className="space-y-2">
                                <p className="text-[10px] text-zinc-600 uppercase tracking-wider font-semibold flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-orange-400/70 inline-block" />
                                    Multi-Shifts
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {multiShifts.map(shift => (
                                        <ShiftCard
                                            key={shift.shiftId}
                                            shift={shift}
                                            isSelected={
                                                // A MULTISHIFT card is selected when its component IDs are in selectedShiftIds
                                                shift.type === "MULTISHIFT"
                                                    ? (shift.componentShiftIds?.length ?? 0) > 0 &&
                                                      shift.componentShiftIds!.every(id => selectedShiftIds.includes(id))
                                                    : selectedShiftIds.includes(shift.shiftId)
                                            }
                                            onToggle={onToggleShift}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Hint: only show the "first shift only" caveat for manual multi-primary selections */}
                {selectedCount > 1 && !selectedMultiShiftId && (
                    <p className="text-xs text-zinc-400 bg-white/[0.03] border border-white/5 rounded-lg px-3 py-2">
                        💡 Seat availability is shown for the first selected shift. The same seat will be booked across all selected shifts.
                    </p>
                )}
                {selectedMultiShiftId && (
                    <p className="text-xs text-zinc-400 bg-orange-500/[0.06] border border-orange-500/10 rounded-lg px-3 py-2">
                        💡 Showing seats free across <span className="text-orange-300 font-medium">all component shifts</span>. A seat is available only if it is unoccupied in every shift of this multi-shift.
                    </p>
                )}
            </div>

            {/* Step 2: Seats (only if at least one shift is selected) */}
            {primaryShiftId && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200 pt-2 border-t border-white/5">
                    <div className="flex items-center justify-between">
                        <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium">
                            Select a seat
                        </p>
                        {seatMap && (
                            <div className="text-[10px] text-zinc-500">
                                <span className="text-emerald-400 font-medium">{seatMap.availableCount}</span> free
                                · <span className="text-red-400/80">{seatMap.occupiedCount}</span> taken
                            </div>
                        )}
                    </div>

                    {seatMapLoading && (
                        <div className="flex items-center justify-center py-8 text-zinc-500">
                            <Loader2 size={16} className="animate-spin mr-2" /> Loading seats...
                        </div>
                    )}

                    {seatMapError && (
                        <div className="p-3 text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg">
                            {seatMapError}
                        </div>
                    )}

                    {!seatMapLoading && !seatMapError && seatMap && (
                        <div className="grid grid-cols-5 gap-2 sm:grid-cols-6 lg:grid-cols-7">
                            {seatMap.seats.map(seat => {
                                const isSelected = selectedSeatId === seat.seatId;
                                const isHovered = hoveredSeat === seat.seatId;
                                const isCurrent = currentSeatId === seat.seatId;

                                return (
                                    <div key={seat.seatId} className="relative group">
                                        <button
                                            type="button"
                                            disabled={seat.occupied}
                                            onClick={() => onSelectSeat(isSelected ? null : seat.seatId)}
                                            onMouseEnter={() => setHoveredSeat(seat.seatId)}
                                            onMouseLeave={() => setHoveredSeat(null)}
                                            className={cn(
                                                "w-full aspect-square rounded-lg border text-xs font-medium transition-all flex flex-col items-center justify-center select-none gap-0.5",
                                                seat.occupied
                                                    ? "bg-red-500/10 border-red-500/20 text-red-400/70 cursor-not-allowed"
                                                    : isSelected
                                                        ? "bg-indigo-500/30 border-indigo-400/60 text-indigo-200 shadow-[0_0_12px_rgba(99,102,241,0.25)]"
                                                        : isCurrent
                                                            ? "bg-amber-500/15 border-amber-400/50 text-amber-200 hover:bg-amber-500/25 hover:border-amber-400/70 cursor-pointer"
                                                            : "bg-emerald-500/10 border-emerald-400/25 text-emerald-300 hover:bg-emerald-500/20 hover:border-emerald-400/50 cursor-pointer"
                                            )}
                                        >
                                            {isSelected
                                                ? <CheckCircle2 size={14} />
                                                : <span className="truncate px-1 leading-none">{seat.label}</span>
                                            }
                                            {isCurrent && !isSelected && (
                                                <span className="text-[8px] font-bold tracking-wide uppercase text-amber-400/80 leading-none">
                                                    current
                                                </span>
                                            )}
                                        </button>

                                        {/* Tooltip */}
                                        {seat.occupied && isHovered && seat.occupiedBy && (
                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-10 bg-zinc-900 border border-white/10 text-white text-[10px] px-2 py-1 rounded-md whitespace-nowrap shadow-xl pointer-events-none">
                                                {seat.occupiedBy}
                                            </div>
                                        )}
                                        {/* Current seat tooltip */}
                                        {isCurrent && !isSelected && isHovered && (
                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-10 bg-amber-900/80 border border-amber-500/30 text-amber-200 text-[10px] px-2 py-1 rounded-md whitespace-nowrap shadow-xl pointer-events-none">
                                                Currently assigned
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Shift Card ────────────────────────────────────────────────────────────────

function ShiftCard({
    shift,
    isSelected,
    onToggle,
}: {
    shift: ShiftCapacity;
    isSelected: boolean;
    onToggle: (s: ShiftCapacity) => void;
}) {
    const blocked = shift.isFull || shift.studentAlreadyAllocated;
    const pct = shift.occupancyPercent;
    const isMulti = shift.type === "MULTISHIFT";

    return (
        <div
            className={cn(
                "relative rounded-xl border p-3.5 transition-all text-left w-full cursor-pointer select-none",
                blocked
                    ? "border-white/5 bg-white/[0.02] opacity-60 cursor-not-allowed"
                    : isSelected
                        ? isMulti
                            ? "border-orange-500/50 bg-orange-500/10 shadow-[0_0_15px_rgba(249,115,22,0.15)]"
                            : "border-indigo-500/50 bg-indigo-500/10 shadow-[0_0_15px_rgba(99,102,241,0.15)]"
                        : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]"
            )}
            tabIndex={blocked ? -1 : 0}
            role="checkbox"
            aria-checked={isSelected}
            onClick={() => !blocked && onToggle(shift)}
            onKeyDown={(e) => { if (!blocked && (e.key === " " || e.key === "Enter")) onToggle(shift); }}
        >
            {/* Checkmark */}
            {!blocked && (
                <span className={cn(
                    "absolute top-2.5 right-2.5 w-4 h-4 rounded border flex items-center justify-center transition-all",
                    isSelected
                        ? isMulti ? "bg-orange-500 border-orange-400" : "bg-indigo-500 border-indigo-400"
                        : "border-white/20 bg-white/5"
                )}>
                    {isSelected && <Check size={10} className="text-white" strokeWidth={3} />}
                </span>
            )}

            {/* Type badge */}
            <div className="mb-1 pr-6">
                <div className="flex items-center gap-1.5 mb-0.5">
                    {isMulti ? (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold tracking-widest uppercase px-1.5 py-0.5 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/20">
                            <Layers size={8} /> MULTI-SHIFT
                        </span>
                    ) : (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold tracking-widest uppercase px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-500/20">
                            PRIMARY
                        </span>
                    )}
                </div>

                <div className="flex items-start justify-between">
                    <div>
                        <p className={cn("font-medium text-sm", isSelected ? (isMulti ? "text-orange-200" : "text-indigo-200") : "text-white")}>
                            {shift.name}
                        </p>
                        {isMulti && shift.componentShiftNames && (
                            <p className="text-[11px] text-zinc-500 mt-0.5">
                                {shift.componentShiftNames.join(" + ")}
                            </p>
                        )}
                        {!isMulti && (shift.startTime || shift.endTime) && (
                            <p className="text-[11px] text-zinc-500 mt-0.5">
                                {formatTime(shift.startTime)} – {formatTime(shift.endTime)}
                            </p>
                        )}
                    </div>
                    <div className="text-right flex-shrink-0 ml-4">
                        {shift.studentAlreadyAllocated ? (
                            <span className="inline-flex items-center gap-1 text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-1.5 py-0.5 rounded-full">
                                <Lock size={10} /> Allocated
                            </span>
                        ) : shift.isFull ? (
                            <span className="text-xs text-red-400 font-medium">Full</span>
                        ) : (
                            <span className={cn("text-xs font-medium", capacityTextColor(pct, shift.isFull))}>
                                {shift.available} / {shift.totalSeats} free
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Capacity bar */}
            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div
                    className={cn("h-full rounded-full transition-all", capacityBarColor(pct, shift.isFull))}
                    style={{ width: `${Math.min(100, pct)}%` }}
                />
            </div>
        </div>
    );
}
