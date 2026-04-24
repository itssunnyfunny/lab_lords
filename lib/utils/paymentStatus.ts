import { differenceInDays } from "date-fns";

/**
 * A payment is considered OVERDUE only after a 7-day grace period past its dueDate.
 * This is a display/query-time concept — the DB status column stays "DUE".
 */
export const OVERDUE_GRACE_DAYS = 7;

export function isOverdue(dueDate: Date | string): boolean {
    return differenceInDays(new Date(), new Date(dueDate)) > OVERDUE_GRACE_DAYS;
}

/** Returns the cutoff date before which a DUE payment is considered overdue. */
export function overdueCutoff(asOf: Date = new Date()): Date {
    const d = new Date(asOf);
    d.setDate(d.getDate() - OVERDUE_GRACE_DAYS);
    return d;
}
