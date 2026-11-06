import { ImportSessionService } from "./import-session.service";
import { assignmentState, isSetupImport, setupKey, type SetupResolution } from "../utils/guided-setup";
import type { ImportNormalizedRow } from "../contracts/import-session.contract";
import { ImportValidationError, ImportRevisionConflictError } from "../utils/import-errors";
import { guidedSavedFields } from "../utils/guided-import-presentation";

export class ImportSetupService {
    static async resolve(userId: string, branchId: string, sessionId: string, input: SetupResolution) {
        const detail = await ImportSessionService.getSessionDetail(userId, branchId, sessionId);
        if (!isSetupImport(detail.sourceConfiguration)) throw new Error("Import session not found");
        if (detail.draftRevision !== input.expectedRevision) throw new ImportRevisionConflictError();
        if (!["TIMING", "SEAT", "DEFER_UNRESOLVED", "DEFER_GROUP", "ASSIGN_ROW", "DEFER_ROW"].includes(input.action)
            || (input.source !== undefined && (typeof input.source !== "string" || input.source.length > 200))
            || [input.targetId, input.seatId, input.rowId].some(value => value !== undefined && (typeof value !== "string" || value.length > 300))) throw new ImportValidationError("Choose an assignment action.");
        const single = input.action === "ASSIGN_ROW" || input.action === "DEFER_ROW";
        const timing = [...detail.branchContext.shifts, ...detail.branchContext.multiShifts].find(s => s.id === input.targetId);
        const seat = detail.branchContext.seats.find(s => s.id === (single ? input.seatId : input.targetId));
        if ((input.action === "TIMING" && !timing) || (input.action === "SEAT" && !seat) || (input.action === "ASSIGN_ROW" && (!timing || !seat))) throw new ImportValidationError("Choose an existing or proposed option in this branch.");
        const group = input.action === "TIMING" ? "timing" : input.action === "SEAT" ? "seat" : input.group;
        if (!single && input.action !== "DEFER_UNRESOLVED" && !["timing", "seat"].includes(group ?? "")) throw new ImportValidationError("Choose the affected group.");
        const rows = detail.rows.filter(row => {
            if (row.skipped || row.status === "IMPORTED" || guidedSavedFields(row.createdEntityIds as Record<string, unknown> | null).seating) return false;
            const d = row.normalizedData as ImportNormalizedRow | null;
            if (single) return row.id === input.rowId;
            if (d?.allocation?.deferred) return false;
            if (input.action === "DEFER_UNRESOLVED") return ["decision", "conflict"].includes(assignmentState(row));
            const value = group === "timing" ? d?.allocation?.multiShiftName || d?.allocation?.shiftName || d?.multiShift?.name || d?.shift?.name : d?.allocation?.seatLabel || d?.seat?.label;
            return setupKey(value ?? "") === setupKey(input.source ?? "");
        });
        if (!rows.length) throw new ImportRevisionConflictError();
        // One revision-checked staged write for the whole group. Payment facts,
        // student fees, saved outcomes and unrelated manual fields are retained.
        return ImportSessionService.updateRows(userId, branchId, sessionId, { expectedRevision: input.expectedRevision, edits: rows.map(row => {
            const data = structuredClone(row.normalizedData ?? {}) as ImportNormalizedRow;
            data.allocation = { ...data.allocation };
            if (input.action.startsWith("DEFER")) { data.allocation = { deferred: true }; delete data.seat; delete data.shift; delete data.multiShift; }
            else if (seat && input.action === "SEAT") { data.allocation.seatLabel = seat.label; data.seat = { label: seat.label }; }
            else if (timing) {
                delete data.allocation.deferred;
                if (single && seat) { data.allocation.seatLabel = seat.label; data.seat = { label: seat.label }; }
                delete data.allocation.shiftName; delete data.allocation.multiShiftName; delete data.shift; delete data.multiShift;
                if ("componentShiftNames" in timing) { data.allocation.multiShiftName = timing.name; data.multiShift = { name: timing.name, componentShiftNames: timing.componentShiftNames }; }
                else { data.allocation.shiftName = timing.name; data.shift = { name: timing.name }; }
            }
            return { rowId: row.id, normalizedData: data };
        }) }, input.action === "TIMING" && input.source ? { field: "allocation.shiftName", source: input.source, target: timing!.name, affected: rows.length } : undefined, true);
    }
}
