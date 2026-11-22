import type { ImportMappingState, ImportNormalizedRow, ParsedImportRow } from "../contracts/import-session.contract";
import { GUIDED_CLEARED_FIELDS } from "./guided-source-reconciliation";
import { usesImportedCurrentStatus } from "./import-payment-plan";
import { classifyPaymentStatus, compactImportText } from "./row-normalizer";

const REVIEWED_STATUS = "__reviewedPaymentStatus";
type RowStatus = NonNullable<ImportNormalizedRow["payment"]>["status"];

/** Only a change submitted by the row editor is evidence of a per-student choice. */
export function recordEditedPaymentStatus(metadata: Record<string, unknown>, before: RowStatus, after: RowStatus) {
    return before === after ? metadata : { ...metadata, [REVIEWED_STATUS]: after ?? null };
}

export function paymentStatusForManualRow(
    raw: ParsedImportRow, mapping: ImportMappingState, normalized: ImportNormalizedRow, mappedData: unknown,
): ImportNormalizedRow {
    const options = mapping.importOptions;
    if (!options?.paymentMapping?.confirmed || options.paymentCycle === "SKIP_PAYMENTS" || !usesImportedCurrentStatus(options)) {
        return normalized;
    }
    const payment = normalized.payment;
    const status = payment?.status;
    const metadata = (mappedData ?? {}) as Record<string, unknown>;
    const cleared = metadata[GUIDED_CLEARED_FIELDS];
    if (metadata[REVIEWED_STATUS] === (status ?? null)
        || (status === undefined && Array.isArray(cleared) && cleared.includes("payment.status"))
        || (status === "DUE" && payment?.decision === "KEEP_DUE")
        || (status === "PAID" && payment?.decision === "CONFIRMED_PAID")) return normalized;

    // Match the parser's last populated status column for older multi-column mappings.
    // rawStatus can be rewritten by a whole-row editor even when only the shift changed.
    let label = "";
    for (const column of mapping.columnMappings) {
        if (column.targetField === "payment.status") label = compactImportText(raw[column.sourceColumn]) || label;
    }
    if (!label || classifyPaymentStatus(label, options.paymentMapping) === status) return normalized;

    // Neither side of a disagreement proves a past operator choice.
    return { ...normalized, payment: { ...payment, status: "UNCLEAR", rawStatus: label } };
}
