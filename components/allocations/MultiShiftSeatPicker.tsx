"use client";

import { useEffect, useState } from "react";
import { Loader2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SeatCell {
    seatId: string;
    label: string;
    occupied: boolean;
    occupiedBy: string | null;
}

interface MultiShiftSeatPickerProps {
    branchId: string;
    multiShiftId: string;
    selectedSeatId: string | null;
    onSelectSeat: (seatId: string | null) => void;
}

/**
 * Dedicated seat picker for multi-shift allocation.
 * Fetches /api/branches/[branchId]/multi-shifts/[multiShiftId]/seat-map
 * A seat is shown occupied if it conflicts (exact or time-overlap) with ANY
 * component shift of the multi-shift.
 */
export function MultiShiftSeatPicker({
    branchId,
    multiShiftId,
    selectedSeatId,
    onSelectSeat,
}: MultiShiftSeatPickerProps) {
    const [seats, setSeats] = useState<SeatCell[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [stats, setStats] = useState<{ available: number; occupied: number } | null>(null);
    const [hoveredSeat, setHoveredSeat] = useState<string | null>(null);

    useEffect(() => {
        if (!multiShiftId) return;
        setLoading(true);
        setError(null);
        setSeats([]);
        onSelectSeat(null); // clear previous seat selection

        fetch(`/api/branches/${branchId}/multi-shifts/${multiShiftId}/seat-map`)
            .then(r => {
                if (!r.ok) throw new Error("Failed to load seats");
                return r.json();
            })
            .then(data => {
                setSeats(data.seats ?? []);
                setStats({ available: data.availableCount, occupied: data.occupiedCount });
            })
            .catch(e => setError(e.message))
            .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [branchId, multiShiftId]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8 text-zinc-500">
                <Loader2 size={16} className="animate-spin mr-2" /> Loading seats...
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-3 text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg">
                {error}
            </div>
        );
    }

    if (seats.length === 0) return null;

    return (
        <div className="space-y-3 pt-2 border-t border-white/5">
            <div className="flex items-center justify-between">
                <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium">Select a seat</p>
                {stats && (
                    <div className="text-[10px] text-zinc-500">
                        <span className="text-emerald-400 font-medium">{stats.available}</span> free
                        · <span className="text-red-400/80">{stats.occupied}</span> taken
                    </div>
                )}
            </div>

            <p className="text-xs text-zinc-400 bg-orange-500/[0.06] border border-orange-500/10 rounded-lg px-3 py-2">
                💡 A seat is available only if it is free across <span className="text-orange-300 font-medium">all component shifts</span>.
            </p>

            <div className="grid grid-cols-5 gap-2 sm:grid-cols-6 lg:grid-cols-7">
                {seats.map(seat => {
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

                            {seat.occupied && isHovered && seat.occupiedBy && (
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-10 bg-zinc-900 border border-white/10 text-white text-[10px] px-2 py-1 rounded-md whitespace-nowrap shadow-xl pointer-events-none">
                                    {seat.occupiedBy}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
