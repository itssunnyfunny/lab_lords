import type { ImportBranchContext, ImportNormalizedRow } from "../contracts/import-session.contract";

type Draft = { id: string; status: string; skipped: boolean; normalizedData: unknown };
export type ImportGuidanceGroup = { source: string; count: number; suggestionId: string | null };
export function unresolvedShift(row: Draft, branch: ImportBranchContext) {
    if (row.skipped || row.status === "IMPORTED") return null;
    const data = (row.normalizedData ?? {}) as ImportNormalizedRow;
    const source = data.allocation?.multiShiftName ?? data.allocation?.shiftName ?? data.multiShift?.name ?? data.shift?.name;
    if (!source || branch.shifts.some(s => s.name.toLowerCase() === source.toLowerCase())
        || branch.multiShifts.some(s => s.name.toLowerCase() === source.toLowerCase())) return null;
    return source.trim();
}
/** Count students across the complete draft, never the visible page. */
export function importGuidanceGroups(rows: Draft[], branch: ImportBranchContext): ImportGuidanceGroup[] {
    const groups = new Map<string, ImportGuidanceGroup>();
    const choices = [...branch.shifts, ...branch.multiShifts];
    for (const row of rows) {
        const source = unresolvedShift(row, branch);
        if (!source) continue;
        const key = source.toLocaleLowerCase("en-IN");
        const existing = groups.get(key);
        if (existing) { existing.count++; continue; }
        const matches = choices.filter(choice => choice.name.split(/\s+/).map(word => word[0]).join("").toLowerCase() === key);
        groups.set(key, { source, count: 1, suggestionId: matches.length === 1 ? matches[0].id : null });
    }
    return [...groups.values()].sort((a, b) => b.count - a.count || a.source.localeCompare(b.source));
}
