import type { ImportIssue, ImportMappingState, ImportNormalizedRow, ParsedImportRow } from "../contracts/import-session.contract";
import { normalizeImportRow } from "./row-normalizer";

export const GUIDED_SOURCE_HOLDS = "__guidedSourceHolds";
export const GUIDED_CLEARED_FIELDS = "__guidedClearedFields";
const ALLOCATION_DEFERRED = "__guidedAllocationDeferred";
export function duplicateGuidedSourceColumns(mapping: ImportMappingState) {
    const aliases: Record<string, string> = { "seat.label": "allocation.seatLabel", "shift.name": "allocation.shiftName", "multiShift.name": "allocation.multiShiftName" };
    const fields = new Map<string, string[]>();
    for (const column of mapping.columnMappings) {
        if (column.targetField === "ignore") continue;
        const target = aliases[column.targetField] ?? column.targetField;
        fields.set(target, [...(fields.get(target) ?? []), column.sourceColumn]);
    }
    return new Set([...fields.values()].filter(columns => columns.length > 1).flat());
}
function record(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
export function guidedSourceHolds(mapped: unknown): ImportIssue[] {
    const value = record(mapped)[GUIDED_SOURCE_HOLDS];
    return Array.isArray(value) ? value as ImportIssue[] : [];
}
export function guidedManualMetadata(mapped: unknown, before: unknown, after: ImportNormalizedRow, preserveHolds: boolean, sourceFields: string[] = []) {
    const next = { ...record(mapped) };
    const removed = new Set(Array.isArray(next[GUIDED_CLEARED_FIELDS]) ? next[GUIDED_CLEARED_FIELDS] as string[] : []);
    for (const [entity, fields] of Object.entries(record(before))) {
        for (const field of Object.keys(record(fields))) if (!(field in record(record(after)[entity]))) removed.add(`${entity}.${field}`);
    }
    // Invalid uploaded values may never have produced a normalized leaf. An
    // explicit full-row save must still retain their intentional removal.
    for (const path of sourceFields) {
        const [entity, field] = path.split(".");
        if (entity && field && !(field in record(record(after)[entity]))) removed.add(path);
    }
    for (const [entity, fields] of Object.entries(after)) for (const field of Object.keys(record(fields))) removed.delete(`${entity}.${field}`);
    next[GUIDED_CLEARED_FIELDS] = [...removed];
    if (after.allocation && Object.keys(after.allocation).length === 0) next[ALLOCATION_DEFERRED] = true;
    else if (after.allocation?.seatLabel || after.allocation?.shiftName || after.allocation?.multiShiftName) delete next[ALLOCATION_DEFERRED];
    if (!preserveHolds) delete next[GUIDED_SOURCE_HOLDS];
    return next;
}

/** Enrich only newly interpreted source columns; never replay old FD values over
 * confirmed Full Day selections or overwrite an existing manual field. */
export function reconcileGuidedSource(raw: ParsedImportRow, normalized: ImportNormalizedRow, mapped: unknown,
    before: ImportMappingState, after: ImportMappingState) {
    const changed = after.columnMappings.filter(column => column.targetField !== "ignore" && (() => {
        const previous = before.columnMappings.find(old => old.sourceColumn === column.sourceColumn);
        return !previous || previous.targetField !== column.targetField || (previous.needsReview && !column.needsReview);
    })());
    if (!changed.length) return null;
    const proposed = normalizeImportRow(raw, changed, after.importOptions?.paymentMapping);
    const next = JSON.parse(JSON.stringify(normalized)) as Record<string, Record<string, unknown>>;
    const metadata = record(mapped);
    const cleared = new Set(Array.isArray(metadata[GUIDED_CLEARED_FIELDS]) ? metadata[GUIDED_CLEARED_FIELDS] as string[] : []);
    const issues = [...guidedSourceHolds(mapped), ...proposed.issues];
    for (const [entity, fields] of Object.entries(proposed.normalizedData)) {
        if (metadata[ALLOCATION_DEFERRED] && ["allocation", "seat", "shift", "multiShift"].includes(entity)) continue;
        for (const [field, value] of Object.entries(record(fields))) {
            const path = `${entity}.${field}`;
            const existing = next[entity]?.[field];
            const alternate = entity === "allocation" && ((field === "shiftName" && next.allocation?.multiShiftName) || (field === "multiShiftName" && next.allocation?.shiftName));
            if (cleared.has(path) || alternate || (existing !== undefined && JSON.stringify(existing) !== JSON.stringify(value))) {
                issues.push({ code: "SOURCE_INTERPRETATION_CONFLICT", field: path, severity: "error",
                    message: "A new source interpretation conflicts with a confirmed field. Review and save this row to confirm the correct value." });
            } else { next[entity] ??= {}; next[entity][field] = value; }
        }
    }
    const unique = [...new Map(issues.map(issue => [`${issue.code}:${issue.field}`, issue])).values()];
    return { normalizedData: next as ImportNormalizedRow, mappedData: { ...metadata, [GUIDED_SOURCE_HOLDS]: unique } };
}
