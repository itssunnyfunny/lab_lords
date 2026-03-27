"use client";

import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, Lock, Check } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Shared Types ─────────────────────────────────────────────────────────────

export interface ShiftCapacity {
    shiftId: string;
    name: string;
    startTime: string | null;
    endTime: string | null;
    isReserved: boolean;
    totalSeats: number;
    used: number;
    available: number;
    occupancyPercent: number;
    isFull: boolean;
    studentAlreadyAllocated: boolean;
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
    selectedShiftIds: string[];   // Changed: array of selected shift IDs
    selectedSeatId: string | null;
    onToggleShift: (shift: ShiftCapacity) => void; // Toggle a shift on/off
    onSelectSeat: (seatId: string | null) => void;
}

export function SeatPicker({
    branchId,
    studentId,
    selectedShiftIds,
    selectedSeatId,
    onToggleShift,
    onSelectSeat,
}: SeatPickerProps) {
    const [shifts, setShifts] = useState<ShiftCapacity[]>([]);
    const [shiftsLoading, setShiftsLoading] = useState(false);
    const [shiftsError, setShiftsError] = useState<string | null>(null);

    // The seat map is always fetched for the FIRST selected shift
    // (since shifts must be non-overlapping, all valid shifts share the same physical seats)
    const primaryShiftId = selectedShiftIds[0] ?? null;
    const [seatMap, setSeatMap] = useState<SeatMapData | null>(null);
    const [seatMapLoading, setSeatMapLoading] = useState(false);
    const [seatMapError, setSeatMapError] = useState<string | null>(null);
    const [hoveredSeat, setHoveredSeat] = useState<string | null>(null);

    // 1. Fetch capacity cards
    useEffect(() => {
        setShiftsLoading(true);
        setShiftsError(null);
        let url = `/api/branches/${branchId}/shifts/capacity`;
        if (studentId) url += `?studentId=${studentId}`;

        fetch(url)
            .then(r => {
                if (!r.ok) throw new Error("Failed to load shifts");
                return r.json();
            })
            .then(setShifts)
            .catch(e => setShiftsError(e.message))
            .finally(() => setShiftsLoading(false));
    }, [branchId, studentId]);

    // 2. Fetch seat grid when primary shift changes
    useEffect(() => {
        if (!primaryShiftId) {
            setSeatMap(null);
            return;
        }
        setSeatMapLoading(true);
        setSeatMapError(null);
        fetch(`/api/branches/${branchId}/shifts/${primaryShiftId}/seat-map`)
            .then(r => {
                if (!r.ok) throw new Error("Failed to load seat map");
                return r.json();
            })
            .then(setSeatMap)
            .catch(e => setSeatMapError(e.message))
            .finally(() => setSeatMapLoading(false));
    }, [branchId, primaryShiftId]);

    const selectedCount = selectedShiftIds.length;

    return (
        <div className="space-y-6">
            {/* Step 1: Shifts — multi-select */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium">
                        Select shift(s)
                    </p>
                    {selectedCount > 0 && (
                        <span className="text-xs text-indigo-300 font-medium">
                            {selectedCount} selected
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {shifts.map(shift => {
                            const pct = shift.occupancyPercent;
                            const blocked = shift.isFull || shift.studentAlreadyAllocated;
                            const isSelected = selectedShiftIds.includes(shift.shiftId);

                            return (
                                <div
                                    key={shift.shiftId}
                                    className={cn(
                                        "relative rounded-xl border p-3.5 transition-all text-left w-full cursor-pointer select-none",
                                        blocked
                                            ? "border-white/5 bg-white/[0.02] opacity-60 cursor-not-allowed"
                                            : isSelected
                                                ? "border-indigo-500/50 bg-indigo-500/10 shadow-[0_0_15px_rgba(99,102,241,0.15)]"
                                                : "border-white/10 bg-white/[0.03] hover:border-indigo-500/40 hover:bg-white/[0.06]"
                                    )}
                                    tabIndex={blocked ? -1 : 0}
                                    role="checkbox"
                                    aria-checked={isSelected}
                                    onClick={() => !blocked && onToggleShift(shift)}
                                    onKeyDown={(e) => { if (!blocked && (e.key === " " || e.key === "Enter")) onToggleShift(shift); }}
                                >
                                    {/* Multi-select checkmark */}
                                    {!blocked && (
                                        <span className={cn(
                                            "absolute top-2.5 right-2.5 w-4 h-4 rounded border flex items-center justify-center transition-all",
                                            isSelected
                                                ? "bg-indigo-500 border-indigo-400"
                                                : "border-white/20 bg-white/5"
                                        )}>
                                            {isSelected && <Check size={10} className="text-white" strokeWidth={3} />}
                                        </span>
                                    )}

                                    <div className="flex items-start justify-between mb-1 pr-6">
                                        <div>
                                            <p className={cn("font-medium text-sm", isSelected ? "text-indigo-200" : "text-white")}>
                                                {shift.name}
                                                {shift.isReserved && (
                                                    <span className="ml-2 text-[10px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded-full font-medium">
                                                        RESERVED
                                                    </span>
                                                )}
                                            </p>
                                            {(shift.startTime || shift.endTime) && (
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

                                    {/* Capacity bar */}
                                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                                        <div
                                            className={cn("h-full rounded-full transition-all", capacityBarColor(pct, shift.isFull))}
                                            style={{ width: `${Math.min(100, pct)}%` }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {selectedCount > 1 && (
                    <p className="text-xs text-zinc-400 bg-white/[0.03] border border-white/5 rounded-lg px-3 py-2">
                        💡 Seat availability is shown for the first selected shift. The same seat will be booked across all selected shifts.
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

                                return (
                                    <div key={seat.seatId} className="relative group">
                                        <button
                                            type="button"
                                            disabled={seat.occupied}
                                            onClick={() => onSelectSeat(isSelected ? null : seat.seatId)}
                                            onMouseEnter={() => setHoveredSeat(seat.seatId)}
                                            onMouseLeave={() => setHoveredSeat(null)}
                                            className={cn(
                                                "w-full aspect-square rounded-lg border text-xs font-medium transition-all flex items-center justify-center select-none",
                                                seat.occupied
                                                    ? "bg-red-500/10 border-red-500/20 text-red-400/70 cursor-not-allowed"
                                                    : isSelected
                                                        ? "bg-indigo-500/30 border-indigo-400/60 text-indigo-200 shadow-[0_0_12px_rgba(99,102,241,0.25)]"
                                                        : "bg-emerald-500/10 border-emerald-400/25 text-emerald-300 hover:bg-emerald-500/20 hover:border-emerald-400/50 cursor-pointer"
                                            )}
                                        >
                                            {isSelected
                                                ? <CheckCircle2 size={14} />
                                                : <span className="truncate px-1">{seat.label}</span>
                                            }
                                        </button>

                                        {/* Tooltip */}
                                        {seat.occupied && isHovered && seat.occupiedBy && (
                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-10 bg-zinc-900 border border-white/10 text-white text-[10px] px-2 py-1 rounded-md whitespace-nowrap shadow-xl pointer-events-none">
                                                {seat.occupiedBy}
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
