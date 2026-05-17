"use client";

import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { SkeletonBlock } from "@/components/ui";
import { formErrorBannerClass } from "@/components/ui/formSurface";
import {
    pickerDividerClass,
    pickerSeatAvailableClass,
    pickerSeatButtonBaseClass,
    pickerSeatOccupiedClass,
    pickerSeatSelectedClass,
    pickerSectionLabelClass,
    pickerTooltipClass,
    pickerWarningHintClass,
} from "@/components/ui/pickerSurface";

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

function MultiShiftSeatSkeleton() {
    return (
        <div role="status" aria-live="polite" className="grid grid-cols-5 gap-2 sm:grid-cols-6 lg:grid-cols-7">
            <span className="sr-only">Loading seats</span>
            {Array.from({ length: 14 }, (_, index) => (
                <SkeletonBlock key={index} className="aspect-square w-full" />
            ))}
        </div>
    );
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
        return <MultiShiftSeatSkeleton />;
    }

    if (error) {
        return (
            <div className={cn("p-3 text-sm", formErrorBannerClass)}>
                {error}
            </div>
        );
    }

    if (seats.length === 0) return null;

    return (
        <div className={cn("space-y-3 pt-2", pickerDividerClass)}>
            <div className="flex items-center justify-between">
                <p className={pickerSectionLabelClass}>Select a seat</p>
                {stats && (
                    <div className="text-[10px] text-[color:var(--text-muted)]">
                        <span className="font-medium text-[color:var(--ui-tone-success-text)]">{stats.available}</span> free
                        <span className="mx-1">/</span><span className="text-[color:var(--ui-tone-danger-text)]">{stats.occupied}</span> taken
                    </div>
                )}
            </div>

            <p className={pickerWarningHintClass}>
                A seat is available only if it is free across <span className="font-medium text-[color:var(--ui-badge-warning-text)]">all component shifts</span>.
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
                                    pickerSeatButtonBaseClass,
                                    seat.occupied
                                        ? pickerSeatOccupiedClass
                                        : isSelected
                                            ? pickerSeatSelectedClass
                                            : pickerSeatAvailableClass
                                )}
                            >
                                {isSelected
                                    ? <CheckCircle2 size={14} />
                                    : <span className="truncate px-1">{seat.label}</span>
                                }
                            </button>

                            {seat.occupied && isHovered && seat.occupiedBy && (
                                <div className={pickerTooltipClass}>
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
