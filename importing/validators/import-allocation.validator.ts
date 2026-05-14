import type { ImportNormalizedRow } from "@/importing/contracts/import-session.contract";
import { emptyValidatorResult, type ImportValidatorResult } from "./import-required-fields.validator";

export function validateImportAllocation(
    normalized: ImportNormalizedRow,
    context: {
        seatsByLabel: Map<string, { id: string; label: string }>;
        shiftsByName: Map<string, { id: string; name: string }>;
        multiShiftsByName: Map<string, { id: string; name: string; components: { shiftId: string; shiftName: string }[] }>;
        activeAllocations: { seatId: string; shiftId: string; seat: { label: string }; shift: { name: string } }[];
    }
): ImportValidatorResult {
    const result = emptyValidatorResult();
    const seatLabel = normalized.allocation?.seatLabel;
    const shiftName = normalized.allocation?.shiftName;
    const multiShiftName = normalized.allocation?.multiShiftName;
    if (!seatLabel || (!shiftName && !multiShiftName)) return result;

    const seat = context.seatsByLabel.get(seatLabel.toLowerCase());
    if (!seat) return result;

    const shiftIds = new Set<string>();
    if (shiftName) {
        const shift = context.shiftsByName.get(shiftName.toLowerCase());
        if (shift) shiftIds.add(shift.id);
    }

    if (multiShiftName) {
        const multiShift = context.multiShiftsByName.get(multiShiftName.toLowerCase());
        for (const component of multiShift?.components ?? []) {
            shiftIds.add(component.shiftId);
        }
    }

    if (shiftIds.size === 0) return result;

    const conflict = context.activeAllocations.find(allocation =>
        allocation.seatId === seat.id && shiftIds.has(allocation.shiftId)
    );

    if (conflict) {
        result.issues.push({
            code: "ALLOCATION_CONFLICT",
            field: "allocation.seatLabel",
            message: `Seat ${conflict.seat.label} is already occupied in ${conflict.shift.name}.`,
            severity: "error",
        });
    }

    return result;
}
