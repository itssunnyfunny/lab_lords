import type { ImportNormalizedRow } from "@/importing/contracts/import-session.contract";
import { emptyValidatorResult, type ImportValidatorResult } from "./import-required-fields.validator";
import { parseNullableTime, timesOverlap } from "@/utils/shiftTime";

export function validateImportAllocation(
    normalized: ImportNormalizedRow,
    context: {
        seatsByLabel: Map<string, { id: string; label: string }>;
        shiftsByName: Map<string, { id: string; name: string; startTime?: string | null; endTime?: string | null }>;
        multiShiftsByName: Map<string, { id: string; name: string; components: { shiftId: string; shiftName: string }[] }>;
        activeAllocations: { seatId: string; shiftId: string; seat: { label: string }; shift: { name: string; startTime?: string | null; endTime?: string | null } }[];
        skipConflictingAllocations?: boolean;
    }
): ImportValidatorResult {
    const result = emptyValidatorResult();
    const seatLabel = normalized.allocation?.seatLabel;
    const shiftName = normalized.allocation?.shiftName;
    const multiShiftName = normalized.allocation?.multiShiftName;
    if (!seatLabel || (!shiftName && !multiShiftName)) return result;

    const seat = context.seatsByLabel.get(seatLabel.toLowerCase());
    if (!seat) return result;

    const requestedShifts: { id: string; name: string; startTime?: string | null; endTime?: string | null }[] = [];
    if (shiftName) {
        const shift = context.shiftsByName.get(shiftName.toLowerCase());
        if (shift) requestedShifts.push(shift);
    }

    if (multiShiftName) {
        const multiShift = context.multiShiftsByName.get(multiShiftName.toLowerCase());
        for (const component of multiShift?.components ?? []) {
            const shift = context.shiftsByName.get(component.shiftName.toLowerCase());
            requestedShifts.push(shift ?? { id: component.shiftId, name: component.shiftName });
        }
    }

    if (requestedShifts.length === 0) return result;

    const conflict = context.activeAllocations.find(allocation => {
        if (allocation.seatId !== seat.id) return false;
        return requestedShifts.some(shift => {
            if (allocation.shiftId === shift.id) return true;
            return timesOverlap(
                parseNullableTime(shift.startTime ?? null),
                parseNullableTime(shift.endTime ?? null),
                parseNullableTime(allocation.shift.startTime ?? null),
                parseNullableTime(allocation.shift.endTime ?? null)
            );
        });
    });

    if (conflict && context.skipConflictingAllocations) {
        result.warnings.push({
            code: "ALLOCATION_SKIPPED_CONFLICT",
            field: "allocation.seatLabel",
            message: `Student will import without allocation because seat ${conflict.seat.label} is already occupied in ${conflict.shift.name}.`,
            severity: "info",
        });
    } else if (conflict) {
        result.issues.push({
            code: "ALLOCATION_CONFLICT",
            field: "allocation.seatLabel",
            message: `Seat ${conflict.seat.label} is already occupied in ${conflict.shift.name}.`,
            severity: "error",
        });
    }

    return result;
}
