import type { ImportAvailabilityPreview, ImportAvailabilityShift } from "../contracts/import-preview.contract";
import type { ImportBranchContext, ImportNormalizedRow } from "../contracts/import-session.contract";
import { parseNullableTime, timesOverlap } from "@/utils/shiftTime";
import { setupKey } from "./guided-setup";

type Row = { id: string; rowNumber: number; status: string; skipped: boolean; normalizedData: ImportNormalizedRow | null };
type Occupancy = { seatId: string; shiftId: string; shift: { startTime?: string | null; endTime?: string | null } };
export function setupAvailability(branch: ImportBranchContext, rows: Row[], occupied: Occupancy[], input: { rowId: string; shiftIds?: string[]; multiShiftId?: string | null }): ImportAvailabilityPreview {
    const overlaps = (a: { startTime?: string | null; endTime?: string | null }, b: { startTime?: string | null; endTime?: string | null }) => timesOverlap(parseNullableTime(a.startTime ?? null), parseNullableTime(a.endTime ?? null), parseNullableTime(b.startTime ?? null), parseNullableTime(b.endTime ?? null));
    const shiftByName = new Map(branch.shifts.map(s => [setupKey(s.name), s]));
    const bundleByName = new Map(branch.multiShifts.map(s => [setupKey(s.name), s]));
    const components = (names: string[]) => names.map(n => shiftByName.get(setupKey(n))).filter((s): s is ImportBranchContext["shifts"][number] => !!s);
    const forRow = (row: Row) => {
        const a = row.normalizedData?.allocation;
        if (!a || a.deferred) return [];
        return a.multiShiftName ? components(bundleByName.get(setupKey(a.multiShiftName))?.componentShiftNames ?? []) : components([a.shiftName ?? ""]);
    };
    const liveBySeat = new Map<string, Occupancy[]>();
    for (const allocation of occupied) liveBySeat.set(allocation.seatId, [...(liveBySeat.get(allocation.seatId) ?? []), allocation]);
    const draftBySeat = new Map<string, { row: Row; shifts: ReturnType<typeof forRow> }[]>();
    for (const row of rows) {
        if (row.id === input.rowId || row.skipped || row.status === "IMPORTED" || row.normalizedData?.allocation?.deferred) continue;
        const label = setupKey(row.normalizedData?.allocation?.seatLabel ?? "");
        if (label) draftBySeat.set(label, [...(draftBySeat.get(label) ?? []), { row, shifts: forRow(row) }]);
    }
    const seatsFor = (requested: ImportBranchContext["shifts"]) => branch.seats.map(seat => {
        const live = liveBySeat.get(seat.id)?.some(a => requested.some(s => s.id === a.shiftId || overlaps(s, a.shift))) ?? false;
        const staged = draftBySeat.get(setupKey(seat.label))?.find(candidate => candidate.shifts.some(s => requested.some(t => s.id === t.id || overlaps(s, t))))?.row;
        return { seatId: seat.id, label: seat.label, occupied: live || !!staged, occupiedBy: live ? "Occupied in the branch" : staged ? `Row ${staged.rowNumber}: ${staged.normalizedData?.student?.name ?? ""}` : null,
            source: live ? "existing" as const : staged ? "staged" as const : "available" as const, stagedRowId: staged?.id, stagedRowNumber: staged?.rowNumber };
    });
    const choices = [...branch.shifts.map(s => ({ ...s, type: "PRIMARY" as const, componentShiftNames: [s.name] })),
        ...branch.multiShifts.map(s => ({ ...s, type: "MULTISHIFT" as const, startTime: null, endTime: null }))];
    const shifts: ImportAvailabilityShift[] = choices.map(choice => {
        const seats = seatsFor(components(choice.componentShiftNames)), used = seats.filter(s => s.source === "existing").length, stagedUsed = seats.filter(s => s.source === "staged").length, available = seats.length - used - stagedUsed;
        return { ...choice, shiftId: choice.id, multiShiftId: choice.type === "MULTISHIFT" ? choice.id : undefined, isReserved: false,
            componentShiftIds: components(choice.componentShiftNames).map(s => s.id), totalSeats: seats.length, used, available, stagedUsed, stagedAvailable: available,
            occupancyPercent: seats.length ? Math.round(100 * (used + stagedUsed) / seats.length) : 0, isFull: available === 0, studentAlreadyAllocated: false };
    });
    const selected = shifts.find(s => input.multiShiftId ? s.multiShiftId === input.multiShiftId : s.type === "PRIMARY" && input.shiftIds?.includes(s.shiftId));
    if (!selected) return { shifts, seatMap: null, conflicts: [] };
    const seats = seatsFor(components(selected.componentShiftNames ?? [])), occupiedCount = seats.filter(s => s.occupied).length;
    return { shifts, conflicts: [], seatMap: { shiftId: selected.shiftId, shiftName: selected.name, isReserved: false,
        totalSeats: seats.length, occupiedCount, availableCount: seats.length - occupiedCount, seats } };
}
