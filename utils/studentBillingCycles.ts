import { addMonths, differenceInCalendarMonths, endOfMonth, isAfter, isBefore, startOfDay, startOfMonth } from "date-fns";
import { studentRejoiningAnniversary, studentRejoiningToday } from "./studentRejoiningDate";

export type StudentBillingCycle = {
    index: number;
    periodStart: Date;
    periodEnd: Date;
    dueDate: Date;
};

function normalizeDate(value: Date) {
    return startOfDay(value);
}

export function studentBillingCycle(joinedAt: Date, index: number): StudentBillingCycle {
    const anchor = normalizeDate(joinedAt);
    const periodStart = normalizeDate(addMonths(anchor, index));
    const periodEnd = normalizeDate(addMonths(anchor, index + 1));

    return {
        index,
        periodStart,
        periodEnd,
        dueDate: periodEnd,
    };
}

type StudentFeeSchedule = {
    joinedAt: Date;
    rejoinedOn?: Date | null;
    billingStartAt?: Date | null;
};

function cycleAt(schedule: StudentFeeSchedule, index: number): StudentBillingCycle {
    if (!schedule.rejoinedOn) return studentBillingCycle(schedule.joinedAt, index);
    const periodStart = studentRejoiningAnniversary(schedule.rejoinedOn, index);
    const periodEnd = studentRejoiningAnniversary(schedule.rejoinedOn, index + 1);
    return { index, periodStart, periodEnd, dueDate: periodEnd };
}

export function studentFeeDay(schedule: Pick<StudentFeeSchedule, "rejoinedOn">, date: Date) {
    return schedule.rejoinedOn ? new Date(`${studentRejoiningToday(date)}T00:00:00Z`) : normalizeDate(date);
}

export function matchesStudentFeeCycle(schedule: StudentFeeSchedule, cycle: Omit<StudentBillingCycle, "index">) {
    const anchor = schedule.rejoinedOn ?? schedule.joinedAt;
    const index = schedule.rejoinedOn
        ? (cycle.periodStart.getUTCFullYear() - anchor.getUTCFullYear()) * 12 + cycle.periodStart.getUTCMonth() - anchor.getUTCMonth()
        : differenceInCalendarMonths(cycle.periodStart, anchor);
    if (index < 0 || (schedule.billingStartAt && cycle.periodStart < studentFeeDay(schedule, schedule.billingStartAt))) return false;
    const expected = cycleAt(schedule, index);
    return +cycle.periodStart === +expected.periodStart && +cycle.periodEnd === +expected.periodEnd && +cycle.dueDate === +expected.dueDate;
}

export function dueCyclesThrough(
    joinedAt: Date,
    asOf: Date,
    billingStartAt?: Date | null,
    rejoinedOn?: Date | null,
): StudentBillingCycle[] {
    const schedule = { joinedAt, billingStartAt, rejoinedOn };
    const dueCutoff = studentFeeDay(schedule, asOf);
    const billingStart = billingStartAt ? studentFeeDay(schedule, billingStartAt) : null;
    const cycles: StudentBillingCycle[] = [];

    for (let index = 0; index < 600; index++) {
        const cycle = cycleAt(schedule, index);
        if (isAfter(cycle.dueDate, dueCutoff)) break;

        if (!billingStart || !isBefore(cycle.periodStart, billingStart)) {
            cycles.push(cycle);
        }
    }

    return cycles;
}

export function currentMonthJoinedCycle(
    joinedAt: Date,
    asOf: Date
): StudentBillingCycle | null {
    const monthStart = startOfMonth(asOf);
    const monthEnd = endOfMonth(asOf);

    for (let index = 0; index < 600; index++) {
        const cycle = studentBillingCycle(joinedAt, index);
        if (isBefore(cycle.dueDate, monthStart)) continue;
        if (isAfter(cycle.dueDate, monthEnd)) return null;
        return cycle;
    }

    return null;
}

export function previousCyclesBefore(
    joinedAt: Date,
    dueDate: Date
): StudentBillingCycle[] {
    const cutoff = normalizeDate(dueDate);
    const cycles: StudentBillingCycle[] = [];

    for (let index = 0; index < 600; index++) {
        const cycle = studentBillingCycle(joinedAt, index);
        if (!isBefore(cycle.dueDate, cutoff)) break;
        cycles.push(cycle);
    }

    return cycles;
}

export function isCycleDue(cycle: StudentBillingCycle, asOf: Date) {
    return !isAfter(cycle.dueDate, normalizeDate(asOf));
}

/**
 * Calculates prospective anniversary cycles without creating Payment rows.
 * Messaging uses this only for pre-due planning; payment generation remains
 * the sole authority for due-today and past-due payment truth.
 */
export function upcomingCyclesBetween(
    joinedAt: Date,
    from: Date,
    through: Date,
    billingStartAt?: Date | null,
    rejoinedOn?: Date | null,
): StudentBillingCycle[] {
    const schedule = { joinedAt, billingStartAt, rejoinedOn };
    const start = studentFeeDay(schedule, from);
    const end = studentFeeDay(schedule, through);
    if (isAfter(start, end)) return [];

    const billingStart = billingStartAt ? studentFeeDay(schedule, billingStartAt) : null;
    const cycles: StudentBillingCycle[] = [];
    for (let index = 0; index < 600; index++) {
        const cycle = cycleAt(schedule, index);
        if (isAfter(cycle.dueDate, end)) break;
        if (isBefore(cycle.dueDate, start)) continue;
        if (billingStart && isBefore(cycle.periodStart, billingStart)) continue;
        cycles.push(cycle);
    }
    return cycles;
}
