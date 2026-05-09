import { differenceInCalendarDays, endOfDay, startOfDay, subDays } from "date-fns";

/**
 * A payment is considered OVERDUE only after a 7-day grace period past its dueDate.
 * This is a display/query-time concept; the DB status column stays "DUE".
 */
export const OVERDUE_GRACE_DAYS = 7;

export function dueAsOfCutoff(asOf: Date = new Date()): Date {
    return endOfDay(asOf);
}

export function daysPastDue(dueDate: Date | string, asOf: Date = new Date()): number {
    return Math.max(
        0,
        differenceInCalendarDays(startOfDay(asOf), startOfDay(new Date(dueDate)))
    );
}

export function isOverdue(dueDate: Date | string, asOf: Date = new Date()): boolean {
    return daysPastDue(dueDate, asOf) > OVERDUE_GRACE_DAYS;
}

/** Returns the cutoff date before which a DUE payment is considered overdue. */
export function overdueCutoff(asOf: Date = new Date()): Date {
    return startOfDay(subDays(asOf, OVERDUE_GRACE_DAYS));
}
