import type { ImportIssue, ImportNormalizedRow } from "@/importing/contracts/import-session.contract";
import { parseNullableTime, timesOverlap } from "@/utils/shiftTime";

type StagedAllocationRow = {
    id: string;
    rowNumber: number;
    status: string;
    skipped?: boolean;
    normalizedData: ImportNormalizedRow | null;
};

type ShiftLike = {
    id: string;
    name: string;
    startTime?: string | null;
    endTime?: string | null;
};

type MultiShiftLike = {
    id: string;
    name: string;
    components: { shiftId: string; shiftName: string }[];
};

export type StagedAllocationContext = {
    shiftsByName: ReadonlyMap<string, ShiftLike>;
    multiShiftsByName: ReadonlyMap<string, MultiShiftLike>;
};

function key(value: string | undefined | null) {
    return (value ?? "").trim().toLowerCase();
}

function shiftsConflict(left: ShiftLike, right: ShiftLike) {
    if (left.id === right.id) return true;
    return timesOverlap(
        parseNullableTime(left.startTime ?? null),
        parseNullableTime(left.endTime ?? null),
        parseNullableTime(right.startTime ?? null),
        parseNullableTime(right.endTime ?? null)
    );
}

export function resolveImportAllocationShifts(
    normalized: ImportNormalizedRow,
    context: StagedAllocationContext
): ShiftLike[] {
    const shiftName = normalized.allocation?.shiftName ?? normalized.shift?.name;
    const multiShiftName = normalized.allocation?.multiShiftName ?? normalized.multiShift?.name;
    const shifts: ShiftLike[] = [];

    if (shiftName) {
        const shift = context.shiftsByName.get(key(shiftName));
        if (shift) shifts.push(shift);
    }

    if (multiShiftName) {
        const multiShift = context.multiShiftsByName.get(key(multiShiftName));
        for (const component of multiShift?.components ?? []) {
            const shift = context.shiftsByName.get(key(component.shiftName));
            shifts.push(shift ?? { id: component.shiftId, name: component.shiftName });
        }
    }

    return shifts;
}

export function findStagedAllocationConflicts(input: {
    rowId: string;
    normalizedData: ImportNormalizedRow;
    rows: StagedAllocationRow[];
    context: StagedAllocationContext;
}): ImportIssue[] {
    const seatLabel = input.normalizedData.allocation?.seatLabel ?? input.normalizedData.seat?.label;
    const requestedShifts = resolveImportAllocationShifts(input.normalizedData, input.context);
    if (!seatLabel || requestedShifts.length === 0) return [];

    const conflicts: ImportIssue[] = [];
    for (const row of input.rows) {
        if (row.id === input.rowId || row.skipped || ["SKIPPED", "IMPORTED", "FAILED"].includes(row.status)) continue;
        const other = row.normalizedData;
        if (!other) continue;

        const otherSeatLabel = other.allocation?.seatLabel ?? other.seat?.label;
        if (!otherSeatLabel || key(otherSeatLabel) !== key(seatLabel)) continue;

        const otherShifts = resolveImportAllocationShifts(other, input.context);
        const conflictShift = requestedShifts.find(shift => otherShifts.some(otherShift => shiftsConflict(shift, otherShift)));
        if (!conflictShift) continue;

        conflicts.push({
            code: "STAGED_ALLOCATION_CONFLICT",
            field: "allocation.seatLabel",
            message: `Seat ${seatLabel} is already staged for row ${row.rowNumber}${other.student?.name ? ` (${other.student.name})` : ""} in ${conflictShift.name}.`,
            severity: "error",
        });
    }

    return conflicts;
}

export function stagedAllocationConflictWarnings(conflicts: ImportIssue[]): ImportIssue[] {
    return conflicts.map(conflict => ({
        ...conflict,
        code: "ALLOCATION_SKIPPED_STAGED_CONFLICT",
        message: conflict.message.replace(/^Seat /, "Student will import without allocation because seat "),
        severity: "info",
    }));
}

export function stagedRowsForRequestedShifts(input: {
    rowId: string;
    rows: StagedAllocationRow[];
    requestedShifts: ShiftLike[];
    context: StagedAllocationContext;
}) {
    return input.rows.flatMap(row => {
        if (row.id === input.rowId || row.skipped || ["SKIPPED", "IMPORTED", "FAILED"].includes(row.status)) return [];
        const normalized = row.normalizedData;
        if (!normalized) return [];

        const seatLabel = normalized.allocation?.seatLabel ?? normalized.seat?.label;
        if (!seatLabel) return [];

        const shifts = resolveImportAllocationShifts(normalized, input.context);
        const conflicts = input.requestedShifts.some(shift => shifts.some(otherShift => shiftsConflict(shift, otherShift)));
        if (!conflicts) return [];

        return [{
            rowId: row.id,
            rowNumber: row.rowNumber,
            seatLabel,
            studentName: normalized.student?.name,
        }];
    });
}
