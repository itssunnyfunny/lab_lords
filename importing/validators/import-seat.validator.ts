import type { ImportNormalizedRow } from "@/importing/contracts/import-session.contract";
import { emptyValidatorResult, type ImportValidatorResult } from "./import-required-fields.validator";

export function validateImportSeat(
    normalized: ImportNormalizedRow,
    context: {
        seatsByLabel: Map<string, { id: string; label: string }>;
        createUnknownSeats?: boolean;
        skipUnknownSeatAllocations?: boolean;
    }
): ImportValidatorResult {
    const result = emptyValidatorResult();
    const label = normalized.allocation?.seatLabel ?? normalized.seat?.label;
    if (!label) return result;

    const known = context.seatsByLabel.has(label.toLowerCase());
    if (!known && context.skipUnknownSeatAllocations) {
        result.warnings.push({
            code: "ALLOCATION_SKIPPED_UNKNOWN_SEAT",
            field: "allocation.seatLabel",
            message: `Student will import without allocation because seat "${label}" is not in this branch.`,
            severity: "info",
        });
    }

    if (!known && !context.createUnknownSeats && !context.skipUnknownSeatAllocations) {
        result.warnings.push({
            code: "UNKNOWN_SEAT",
            field: "allocation.seatLabel",
            message: `Seat "${label}" does not exist yet. Confirm whether to create it.`,
            severity: "warning",
        });
        result.questions.push({
            field: "seat.label",
            question: `Create missing seat "${label}" during import?`,
            options: ["YES_CREATE_SEATS", "SKIP_UNKNOWN_SEAT_ALLOCATION"],
        });
    }

    if (!known && context.createUnknownSeats) {
        result.warnings.push({
            code: "WILL_CREATE_SEAT",
            field: "seat.label",
            message: `Seat "${label}" will be created before allocation.`,
            severity: "warning",
        });
    }

    return result;
}
