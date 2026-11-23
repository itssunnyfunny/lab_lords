import { differenceInCalendarDays, endOfDay } from "date-fns";
import { dashboardDateOffset, dashboardDayStart, dashboardToday } from "@/lib/dashboardMath";

export type PaymentOverduePolicy = Readonly<{ paymentGraceDays: number; timezone: string }>;

export function dueAsOfCutoff(asOf: Date = new Date(), timezone?: string): Date {
    if (!timezone) return endOfDay(asOf);
    return new Date(dashboardDayStart(dashboardDateOffset(dashboardToday(asOf, timezone), 1), timezone).getTime() - 1);
}

export function daysPastDue(dueDate: Date | string, asOf: Date = new Date(), timezone?: string): number {
    if (!timezone) return Math.max(0, differenceInCalendarDays(asOf, new Date(dueDate)));
    const days = (Date.parse(dashboardToday(asOf, timezone)) - Date.parse(dashboardToday(new Date(dueDate), timezone))) / 86_400_000;
    return Math.max(0, days);
}

export function isOverdue(dueDate: Date | string, policy: PaymentOverduePolicy, asOf = new Date()): boolean {
    return daysPastDue(dueDate, asOf, policy.timezone) > policy.paymentGraceDays;
}

/** A DUE fee is overdue if its due date is strictly before this local day. */
export function overdueCutoffForDay(policy: PaymentOverduePolicy, day: string): Date {
    return dashboardDayStart(dashboardDateOffset(day, -policy.paymentGraceDays), policy.timezone);
}

export function overdueCutoff(policy: PaymentOverduePolicy, asOf = new Date()): Date {
    return overdueCutoffForDay(policy, dashboardToday(asOf, policy.timezone));
}
