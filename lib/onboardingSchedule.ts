import { FORM_LIMITS, parseIntegerField, type NormalizedMultiShiftDraft, type NormalizedShiftDraft } from "@/lib/formValidation";
import { parseTime, timesOverlap } from "@/utils/shiftTime";

export type SetupTimeSlot = { clientId: string; name: string; startTime: string; endTime: string; price: string };
export type SetupCombination = { clientId: string; name: string; price: string; componentShiftIds: string[] };
export type SetupSchedule = { shifts: SetupTimeSlot[]; multiShifts: SetupCombination[] };
export type SetupErrors = Record<string, string>;
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
export const TIME_SLOT_OVERLAP_ERROR = "These times overlap another time slot. Adjust the start or end time.";

export function suggestedSchedule(multiple = false): SetupSchedule {
    return {
        shifts: multiple ? [
            { clientId: "morning", name: "Morning", startTime: "06:00", endTime: "10:00", price: "" },
            { clientId: "afternoon", name: "Afternoon", startTime: "10:00", endTime: "16:00", price: "" },
            { clientId: "evening", name: "Evening", startTime: "16:00", endTime: "22:00", price: "" },
        ] : [{ clientId: "daily", name: "Daily session", startTime: "06:00", endTime: "22:00", price: "" }],
        multiShifts: [],
    };
}

/** A combination keeps stable IDs while names are edited. Removed slots never
 * survive as hidden references; a previously agreed fee is never recomputed. */
export function removeSetupTimeSlot(schedule: SetupSchedule, id: string): SetupSchedule {
    return {
        shifts: schedule.shifts.filter(row => row.clientId !== id),
        multiShifts: schedule.multiShifts.map(row => ({ ...row, componentShiftIds: row.componentShiftIds.filter(component => component !== id) })),
    };
}

export function combinationFeeSuggestion(row: SetupCombination, shifts: SetupTimeSlot[]): number | null {
    if (row.componentShiftIds.length < 2) return null;
    let total = 0;
    for (const id of row.componentShiftIds) {
        const shift = shifts.find(item => item.clientId === id);
        const parsed = parseIntegerField(shift?.price, "Student monthly fee", { required: true, min: 0, max: FORM_LIMITS.moneyMax });
        if (!parsed.ok) return null;
        total += parsed.value!;
    }
    return total <= FORM_LIMITS.moneyMax ? total : null;
}

export function validateSetupSchedule(schedule: SetupSchedule): {
    errors: SetupErrors; shifts: NormalizedShiftDraft[]; multiShifts: NormalizedMultiShiftDraft[];
} {
    const errors: SetupErrors = {};
    const names = new Map<string, string>();
    const normalized: NormalizedShiftDraft[] = [];
    if (!schedule.shifts.length) errors.shifts = "Add at least one daily time slot.";
    if (schedule.shifts.length > FORM_LIMITS.shiftsMax) errors.shifts = "Use up to 12 daily time slots.";
    const feeError = (value: string) => value.trim() === ""
        ? "Enter a monthly fee, or enter 0 for no fee."
        : !parseIntegerField(value, "Student monthly fee", { required: true, min: 0, max: FORM_LIMITS.moneyMax }).ok
            ? "Enter a whole-rupee fee between 0 and 10000000." : null;
    for (const row of schedule.shifts) {
        const name = row.name.trim().replace(/\s+/g, " ");
        if (!name || name.length > 50) errors[`${row.clientId}.name`] = "Enter a time slot name of up to 50 characters.";
        const previous = names.get(name.toLowerCase());
        if (previous) {
            errors[`${previous}.name`] = errors[`${row.clientId}.name`] = "Choose a different name for each time slot.";
        }
        if (name) names.set(name.toLowerCase(), row.clientId);
        if (!timePattern.test(row.startTime)) errors[`${row.clientId}.startTime`] = "Enter a valid start time.";
        if (!timePattern.test(row.endTime)) errors[`${row.clientId}.endTime`] = "Enter a valid end time.";
        const fee = feeError(row.price);
        if (fee) errors[`${row.clientId}.price`] = fee;
        normalized.push({ name, startTime: row.startTime, endTime: row.endTime, price: Number(row.price) });
    }
    for (let i = 0; i < schedule.shifts.length; i++) for (let j = i + 1; j < schedule.shifts.length; j++) {
        const a = schedule.shifts[i], b = schedule.shifts[j];
        if ([a.startTime, a.endTime, b.startTime, b.endTime].every(time => timePattern.test(time))
            && timesOverlap(parseTime(a.startTime), parseTime(a.endTime), parseTime(b.startTime), parseTime(b.endTime))) {
            for (const row of [a, b]) for (const field of ["startTime", "endTime"]) {
                errors[`${row.clientId}.${field}`] = TIME_SLOT_OVERLAP_ERROR;
            }
        }
    }
    const combinations: NormalizedMultiShiftDraft[] = [];
    const combinationNames = new Set<string>(), componentSets = new Set<string>();
    if (schedule.multiShifts.length > FORM_LIMITS.multiShiftsMax) errors.multiShifts = "Use up to 12 combinations.";
    for (const row of schedule.multiShifts) {
        const name = row.name.trim().replace(/\s+/g, " ");
        if (!name || name.length > 50) errors[`${row.clientId}.name`] = "Enter a combination name of up to 50 characters.";
        if (combinationNames.has(name.toLowerCase())) errors[`${row.clientId}.name`] = "Choose a different name for each combination.";
        combinationNames.add(name.toLowerCase());
        const components = row.componentShiftIds.map(id => schedule.shifts.find(shift => shift.clientId === id));
        if (components.length < 2 || components.some(item => !item) || new Set(row.componentShiftIds).size !== components.length) {
            errors[`${row.clientId}.components`] = "Choose at least two existing time slots for this combination.";
        }
        const componentSet = [...row.componentShiftIds].sort().join("|");
        if (componentSets.has(componentSet)) errors[`${row.clientId}.components`] = "This combination already exists. Choose a different set of time slots.";
        componentSets.add(componentSet);
        const fee = feeError(row.price);
        if (fee) errors[`${row.clientId}.price`] = fee;
        combinations.push({ name, price: Number(row.price), componentShiftNames: components.flatMap(component => component ? [component.name.trim().replace(/\s+/g, " ")] : []) });
    }
    return { errors, shifts: normalized, multiShifts: combinations };
}
