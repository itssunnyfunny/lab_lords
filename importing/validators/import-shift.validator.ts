import type { ImportNormalizedRow } from "@/importing/contracts/import-session.contract";
import { emptyValidatorResult, type ImportValidatorResult } from "./import-required-fields.validator";

export function validateImportShift(
    normalized: ImportNormalizedRow,
    context: {
        shiftsByName: Map<string, { id: string; name: string }>;
        multiShiftsByName: Map<string, { id: string; name: string }>;
        createUnknownShifts?: boolean;
        createUnknownMultiShifts?: boolean;
    }
): ImportValidatorResult {
    const result = emptyValidatorResult();
    const shiftName = normalized.allocation?.shiftName ?? normalized.shift?.name;
    const multiShiftName = normalized.allocation?.multiShiftName ?? normalized.multiShift?.name;
    const hasSeat = Boolean(normalized.allocation?.seatLabel ?? normalized.seat?.label);

    if (hasSeat && !shiftName && !multiShiftName) {
        result.warnings.push({
            code: "MISSING_ALLOCATION_SHIFT",
            field: "allocation.shiftName",
            message: "Seat is present but shift is missing. The student can import, but allocation needs review.",
            severity: "warning",
        });
        result.questions.push({
            field: "allocation.shiftName",
            question: "Which shift should rows without a shift use?",
            options: Array.from(context.shiftsByName.values()).map(shift => shift.name),
        });
    }

    if (shiftName && !context.shiftsByName.has(shiftName.toLowerCase())) {
        if (context.createUnknownShifts) {
            result.warnings.push({
                code: "WILL_CREATE_SHIFT",
                field: "shift.name",
                message: `Shift "${shiftName}" will be created without times unless corrected.`,
                severity: "warning",
            });
        } else {
            result.warnings.push({
                code: "UNKNOWN_SHIFT",
                field: "allocation.shiftName",
                message: `Shift "${shiftName}" does not exist yet.`,
                severity: "warning",
            });
            result.questions.push({
                field: "allocation.shiftName",
                question: `What should happen with unknown shift "${shiftName}"?`,
                options: ["CREATE_SHIFT", "MAP_TO_EXISTING_SHIFT", "SKIP_ALLOCATIONS"],
            });
        }
    }

    if (multiShiftName && !context.multiShiftsByName.has(multiShiftName.toLowerCase())) {
        if (context.createUnknownMultiShifts) {
            result.warnings.push({
                code: "WILL_CREATE_MULTI_SHIFT",
                field: "multiShift.name",
                message: `Multi-shift "${multiShiftName}" will be created if its component shifts are known.`,
                severity: "warning",
            });
        } else {
            result.warnings.push({
                code: "UNKNOWN_MULTI_SHIFT",
                field: "allocation.multiShiftName",
                message: `Multi-shift "${multiShiftName}" does not exist yet.`,
                severity: "warning",
            });
            result.questions.push({
                field: "allocation.multiShiftName",
                question: `Create or map unknown multi-shift "${multiShiftName}"?`,
                options: ["CREATE_MULTI_SHIFT", "MAP_TO_EXISTING_MULTI_SHIFT", "SKIP_ALLOCATIONS"],
            });
        }
    }

    return result;
}
