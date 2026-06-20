import type { ImportNormalizedRow } from "@/importing/contracts/import-session.contract";
import { emptyValidatorResult, type ImportValidatorResult } from "./import-required-fields.validator";

export function validateImportShift(
    normalized: ImportNormalizedRow,
    context: {
        shiftsByName: Map<string, { id: string; name: string }>;
        multiShiftsByName: Map<string, { id: string; name: string }>;
        createUnknownShifts?: boolean;
        createUnknownMultiShifts?: boolean;
        skipUnknownShiftAllocations?: boolean;
        skipUnknownMultiShiftAllocations?: boolean;
        skipMissingShiftAllocations?: boolean;
    }
): ImportValidatorResult {
    const result = emptyValidatorResult();
    const shiftName = normalized.allocation?.shiftName ?? normalized.shift?.name;
    const multiShiftName = normalized.allocation?.multiShiftName ?? normalized.multiShift?.name;
    const hasSeat = Boolean(normalized.allocation?.seatLabel ?? normalized.seat?.label);

    if (hasSeat && !shiftName && !multiShiftName && context.skipMissingShiftAllocations) {
        result.warnings.push({
            code: "ALLOCATION_SKIPPED_MISSING_SHIFT",
            field: "allocation.shiftName",
            message: "Student will import without allocation because no shift was provided.",
            severity: "info",
        });
    }

    if (hasSeat && !shiftName && !multiShiftName && !context.skipMissingShiftAllocations) {
        result.warnings.push({
            code: "MISSING_ALLOCATION_SHIFT",
            field: "allocation.shiftName",
            message: "Seat is present but shift is missing. The student can import, but allocation needs review.",
            severity: "warning",
        });
        result.questions.push({
            field: "allocation.shiftName",
            question: "Which shift should rows without a shift use?",
            options: [...Array.from(context.shiftsByName.values()).map(shift => shift.name), "SKIP_MISSING_SHIFT_ALLOCATION"],
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
        } else if (context.skipUnknownShiftAllocations) {
            result.warnings.push({
                code: "ALLOCATION_SKIPPED_UNKNOWN_SHIFT",
                field: "allocation.shiftName",
                message: `Student will import without allocation because shift "${shiftName}" is not in this branch.`,
                severity: "info",
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
                options: ["CREATE_SHIFT", "SKIP_UNKNOWN_SHIFT_ALLOCATION"],
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
        } else if (context.skipUnknownMultiShiftAllocations) {
            result.warnings.push({
                code: "ALLOCATION_SKIPPED_UNKNOWN_MULTI_SHIFT",
                field: "allocation.multiShiftName",
                message: `Student will import without allocation because multi-shift "${multiShiftName}" is not in this branch.`,
                severity: "info",
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
                options: ["CREATE_MULTI_SHIFT", "SKIP_UNKNOWN_MULTI_SHIFT_ALLOCATION"],
            });
        }
    }

    return result;
}
