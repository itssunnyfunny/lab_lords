import type { ImportColumnMapping, ImportPaymentMapping } from "@/importing/contracts/import-session.contract";
import { classifyPaymentStatus, compactImportText } from "@/importing/utils/row-normalizer";

function addUnique(target: string[], value: string) {
    if (!target.some(item => item.toLocaleLowerCase("en-IN") === value.toLocaleLowerCase("en-IN"))) {
        target.push(value);
    }
}

function rawDataRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function inferConfirmedPaymentMapping(input: {
    current?: ImportPaymentMapping;
    columnMappings: ImportColumnMapping[];
    rows: Array<{ rawData: unknown }>;
}): ImportPaymentMapping | undefined {
    if (input.current?.confirmed) return input.current;

    const sourceColumns = input.columnMappings
        .filter(mapping => mapping.targetField === "payment.status")
        .map(mapping => mapping.sourceColumn);
    if (sourceColumns.length === 0) return undefined;

    const next: ImportPaymentMapping = {
        paidValues: [...(input.current?.paidValues ?? [])],
        unpaidValues: [...(input.current?.unpaidValues ?? [])],
        waivedValues: [...(input.current?.waivedValues ?? [])],
        unclearValues: [],
        confirmed: false,
        ...(input.current?.defaultMethod ? { defaultMethod: input.current.defaultMethod } : {}),
    };
    let seenStatusValue = false;

    for (const row of input.rows) {
        const rawData = rawDataRecord(row.rawData);
        for (const sourceColumn of sourceColumns) {
            const value = compactImportText(rawData[sourceColumn]);
            if (!value) continue;
            seenStatusValue = true;

            const status = classifyPaymentStatus(value);
            if (status === "PAID") addUnique(next.paidValues, value);
            else if (status === "DUE") addUnique(next.unpaidValues, value);
            else if (status === "WAIVED") addUnique(next.waivedValues, value);
            else addUnique(next.unclearValues, value);
        }
    }

    if (!seenStatusValue) return undefined;
    next.confirmed = next.unclearValues.length === 0;
    return next.confirmed ? next : undefined;
}
