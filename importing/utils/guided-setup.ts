import type { ImportBranchContext, ImportIssue, ImportNormalizedRow, ImportOptions } from "../contracts/import-session.contract";
import { validateRequiredText, validateSeatLabel, FORM_LIMITS } from "@/lib/formValidation";
import { parseNullableTime, timesOverlap } from "@/utils/shiftTime";

export type ImportSetup = {
    seats: string[];
    shifts: { name: string; startTime: string; endTime: string; price: number }[];
    multiShifts: { name: string; componentShiftNames: string[]; price: number }[];
};
export const emptyImportSetup = (): ImportSetup => ({ seats: [], shifts: [], multiShifts: [] });
export const setupKey = (value: string) => value.normalize("NFKC").trim().toLocaleLowerCase("en-IN");
export const proposedId = (kind: string, name: string) => `draft:${kind}:${encodeURIComponent(setupKey(name))}`;
export function isSetupImport(source: unknown) {
    return !!source && typeof source === "object" && "experience" in source && source.experience === "GUIDED_SETUP_V2";
}

/** Strictly bounded, explicit configuration. No price ever comes from a student. */
export function parseImportSetup(value: unknown): ImportSetup {
    const fail = (): never => { throw new Error("Check the proposed seats, timing names, hours and whole-rupee fees."); };
    if (!value || typeof value !== "object" || Array.isArray(value)) return fail();
    const data = value as Record<string, unknown>;
    if (Object.keys(data).some(k => !["seats", "shifts", "multiShifts"].includes(k))) return fail();
    if (!Array.isArray(data.seats) || data.seats.length > FORM_LIMITS.seatsMax
        || !Array.isArray(data.shifts) || data.shifts.length > FORM_LIMITS.shiftsMax
        || !Array.isArray(data.multiShifts) || data.multiShifts.length > FORM_LIMITS.multiShiftsMax) return fail();
    const text = (v: unknown, seat = false) => {
        const result = seat ? validateSeatLabel(v) : validateRequiredText(v, "Timing name", 50);
        return result.ok ? result.value : fail();
    };
    const object = (v: unknown, keys: string[]) => {
        if (!v || typeof v !== "object" || Array.isArray(v) || Object.keys(v).some(k => !keys.includes(k))) return fail();
        return v as Record<string, unknown>;
    };
    const fee = (v: unknown) => typeof v === "number" && Number.isSafeInteger(v) && v >= 0 && v <= FORM_LIMITS.moneyMax ? v : fail();
    const time = (v: unknown) => typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : fail();
    const unique = (values: string[]) => { if (new Set(values.map(setupKey)).size !== values.length) fail(); };
    const seats = data.seats.map(v => text(v, true));
    const shifts = data.shifts.map(v => { const r = object(v, ["name", "startTime", "endTime", "price"]); return { name: text(r.name), startTime: time(r.startTime), endTime: time(r.endTime), price: fee(r.price) }; });
    const multiShifts = data.multiShifts.map(v => {
        const r = object(v, ["name", "componentShiftNames", "price"]);
        if (!Array.isArray(r.componentShiftNames) || r.componentShiftNames.length < 2 || r.componentShiftNames.length > FORM_LIMITS.shiftsMax) return fail();
        const componentShiftNames = r.componentShiftNames.map(v => text(v)); unique(componentShiftNames);
        return { name: text(r.name), componentShiftNames, price: fee(r.price) };
    });
    unique(seats); unique([...shifts, ...multiShifts].map(r => r.name));
    return { seats, shifts, multiShifts };
}

export function validateImportSetup(setup: ImportSetup, branch: ImportBranchContext) {
    const fail = (message: string): never => { throw new Error(message); };
    const allShifts = [...branch.shifts];
    for (const shift of setup.shifts) {
        if (branch.multiShifts.some(b => setupKey(b.name) === setupKey(shift.name))) fail("A combination already uses this name. Choose a different timing name.");
        const existing = branch.shifts.find(s => setupKey(s.name) === setupKey(shift.name));
        if (existing) {
            if (existing.startTime !== shift.startTime || existing.endTime !== shift.endTime || existing.price !== shift.price) fail("An existing timing has this name. Match it instead of changing its hours or price.");
        } else {
            if (allShifts.some(s => timesOverlap(parseNullableTime(s.startTime), parseNullableTime(s.endTime), parseNullableTime(shift.startTime), parseNullableTime(shift.endTime)))) fail("These hours overlap another timing. Use combined access for existing time slots.");
            allShifts.push({ ...shift, id: proposedId("shift", shift.name) });
        }
    }
    const combination = (names: string[]) => names.map(setupKey).sort().join("|");
    const allBundles = [...branch.multiShifts];
    for (const bundle of setup.multiShifts) {
        if (allShifts.some(s => setupKey(s.name) === setupKey(bundle.name))) fail("A daily timing already uses this name. Choose a different combination name.");
        if (bundle.componentShiftNames.some(name => !allShifts.some(s => setupKey(s.name) === setupKey(name)))) fail("Choose existing or proposed daily timings for combined access.");
        const existing = allBundles.find(b => setupKey(b.name) === setupKey(bundle.name));
        if (existing) {
            if (existing.price !== bundle.price || combination(existing.componentShiftNames) !== combination(bundle.componentShiftNames)) fail("An existing combination has this name. Match it instead of changing it.");
        } else {
            if (allBundles.some(b => combination(b.componentShiftNames) === combination(bundle.componentShiftNames))) fail("This combination already exists. Choose it instead of creating a duplicate.");
            allBundles.push({ ...bundle, id: proposedId("multi", bundle.name) });
        }
    }
}

export function branchWithImportSetup(branch: ImportBranchContext, setup?: ImportSetup): ImportBranchContext {
    if (!setup) return branch;
    return { ...branch,
        seats: [...branch.seats, ...setup.seats.filter(label => !branch.seats.some(s => setupKey(s.label) === setupKey(label))).map(label => ({ id: proposedId("seat", label), label }))],
        shifts: [...branch.shifts, ...setup.shifts.filter(s => !branch.shifts.some(b => setupKey(s.name) === setupKey(b.name))).map(s => ({ ...s, id: proposedId("shift", s.name) }))],
        multiShifts: [...branch.multiShifts, ...setup.multiShifts.filter(s => !branch.multiShifts.some(b => setupKey(s.name) === setupKey(b.name))).map(s => ({ ...s, id: proposedId("multi", s.name) }))],
    };
}

type SetupValidationContext = {
    seatsByLabel: Map<string, { id: string; label: string }>;
    shiftsByName: Map<string, { id: string; name: string; startTime: string | null; endTime: string | null; price: number }>;
    multiShiftsByName: Map<string, { id: string; name: string; price: number; components: { shiftId: string; shiftName: string; startTime?: string | null; endTime?: string | null }[] }>;
};
export function contextBranch(context: SetupValidationContext): ImportBranchContext {
    return { defaultFee: 0, defaultAdmissionFee: 0, seats: [...context.seatsByLabel.values()], shifts: [...context.shiftsByName.values()],
        multiShifts: [...context.multiShiftsByName.values()].map(s => ({ ...s, componentShiftNames: s.components.map(c => c.shiftName) })) };
}
export function addSetupToValidationContext(context: SetupValidationContext, setup?: ImportSetup) {
    const branch = branchWithImportSetup(contextBranch(context), setup);
    for (const seat of branch.seats) context.seatsByLabel.set(seat.label.toLowerCase(), seat);
    for (const shift of branch.shifts) context.shiftsByName.set(shift.name.toLowerCase(), shift);
    for (const bundle of branch.multiShifts) context.multiShiftsByName.set(bundle.name.toLowerCase(), { ...bundle,
        components: bundle.componentShiftNames.map(name => { const shift = branch.shifts.find(s => setupKey(s.name) === setupKey(name));
            return { shiftId: shift?.id ?? "", shiftName: name, startTime: shift?.startTime ?? null, endTime: shift?.endTime ?? null }; }) });
    return branch;
}

/** Exact labels, explicit hours and complete component sets are evidence. A
 * sole option or a free seat is not evidence of the student's intention. */
export function prepareSupportedAssignment(row: ImportNormalizedRow, branch: ImportBranchContext): ImportNormalizedRow {
    if (row.allocation?.deferred) return row;
    const data = structuredClone(row), allocation = { ...data.allocation };
    const label = allocation.seatLabel || data.seat?.label;
    const seat = label && branch.seats.find(s => setupKey(s.label) === setupKey(label));
    if (seat) { allocation.seatLabel = seat.label; data.seat = { label: seat.label }; }
    const name = allocation.multiShiftName || allocation.shiftName || data.multiShift?.name || data.shift?.name;
    const exact = name && [...branch.shifts, ...branch.multiShifts].filter(s => setupKey(s.name) === setupKey(name));
    let choice = exact && exact.length === 1 ? exact[0] : undefined;
    if (!choice && data.shift?.startTime && data.shift.endTime) {
        const matches = branch.shifts.filter(s => s.startTime === data.shift!.startTime && s.endTime === data.shift!.endTime);
        if (matches.length === 1) choice = matches[0];
    }
    if (!choice && data.multiShift?.componentShiftNames?.length) {
        const keys = data.multiShift.componentShiftNames.map(setupKey).sort().join("|");
        const matches = branch.multiShifts.filter(s => s.componentShiftNames.map(setupKey).sort().join("|") === keys);
        if (matches.length === 1) choice = matches[0];
    }
    if (choice) {
        delete allocation.shiftName; delete allocation.multiShiftName; delete data.shift; delete data.multiShift;
        if ("componentShiftNames" in choice) { allocation.multiShiftName = choice.name; data.multiShift = { name: choice.name, componentShiftNames: choice.componentShiftNames }; }
        else { allocation.shiftName = choice.name; data.shift = { name: choice.name, ...(choice.startTime ? { startTime: choice.startTime } : {}), ...(choice.endTime ? { endTime: choice.endTime } : {}) }; }
    }
    data.allocation = allocation;
    return data;
}

export function allocationDecisionIssues(row: ImportNormalizedRow, options?: ImportOptions): ImportIssue[] {
    if (options?.allocationPolicy !== "EXPLICIT_DECISION" || row.allocation?.deferred) return [];
    return row.allocation?.seatLabel && (row.allocation.shiftName || row.allocation.multiShiftName) ? [] : [{
        code: "ALLOCATION_DECISION_REQUIRED", field: "allocation.seatLabel", severity: "error",
        message: "Choose timings and a seat, or explicitly leave seating for later.",
    }];
}

export function assignmentState(row: { normalizedData: unknown; issues?: unknown; warnings?: unknown }) {
    const data = row.normalizedData as ImportNormalizedRow | null;
    if (data?.allocation?.deferred) return "deferred" as const;
    const issues = [...(Array.isArray(row.issues) ? row.issues : []), ...(Array.isArray(row.warnings) ? row.warnings : [])] as ImportIssue[];
    if (issues.some(i => /CONFLICT|OVERLAP/.test(i.code))) return "conflict" as const;
    if (data?.allocation?.seatLabel && (data.allocation.shiftName || data.allocation.multiShiftName)
        && !issues.some(i => /UNKNOWN_SEAT|UNKNOWN_SHIFT|UNKNOWN_MULTI_SHIFT|ALLOCATION_SKIPPED/.test(i.code))) return "matched" as const;
    return "decision" as const;
}
export function setupOverview(rows: { normalizedData: unknown; skipped: boolean; status: string; issues?: unknown; warnings?: unknown }[]) {
    const counts = { matched: 0, decision: 0, conflict: 0, deferred: 0 };
    const timings = new Map<string, { value: string; count: number }>(), seats = new Map<string, { value: string; count: number }>();
    for (const row of rows.filter(r => !r.skipped && r.status !== "IMPORTED")) {
        const state = assignmentState(row); counts[state]++;
        if (state === "deferred") continue;
        const d = row.normalizedData as ImportNormalizedRow | null;
        for (const [groups, value] of [[timings, d?.allocation?.multiShiftName || d?.allocation?.shiftName || d?.multiShift?.name || d?.shift?.name || ""],
            [seats, d?.allocation?.seatLabel || d?.seat?.label || ""]] as const) {
            const k = setupKey(value), previous = groups.get(k);
            groups.set(k, { value, count: (previous?.count ?? 0) + 1 });
        }
    }
    return { counts, timings: [...timings.values()], seats: [...seats.values()] };
}

export type SetupResolution = { expectedRevision: number; action: "TIMING" | "SEAT" | "DEFER_UNRESOLVED" | "DEFER_GROUP" | "ASSIGN_ROW" | "DEFER_ROW"; source?: string; targetId?: string; group?: "timing" | "seat"; rowId?: string; seatId?: string };
