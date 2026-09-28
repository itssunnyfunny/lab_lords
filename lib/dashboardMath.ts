import { attendanceDay, attendanceTimezone } from "@/lib/attendance";

export function dashboardDateOffset(day: string, days: number) {
    const date = new Date(`${day}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
}
/** Resolve a local calendar boundary without relying on the server timezone. */
export function dashboardDayStart(day: string, timezone: string) {
    const target = Date.parse(`${day}T00:00:00Z`);
    let instant = target;
    for (let n = 0; n < 3; n++) {
        const values = new Intl.DateTimeFormat("en-GB", { timeZone: attendanceTimezone(timezone),
            year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" })
            .formatToParts(new Date(instant));
        const value = (type: string) => values.find(p => p.type === type)!.value;
        const represented = Date.parse(`${value("year")}-${value("month")}-${value("day")}T${value("hour")}:${value("minute")}:${value("second")}Z`);
        instant += target - represented;
    }
    return new Date(instant);
}
export function dashboardLocalTime(now: Date, timezone: string) {
    return new Intl.DateTimeFormat("en-GB", { timeZone: attendanceTimezone(timezone), hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(now);
}
export function dashboardMonth(month: string, timezone: string) {
    const first = `${month}-01`;
    const date = new Date(`${first}T12:00:00Z`);
    date.setUTCMonth(date.getUTCMonth() + 1);
    const next = date.toISOString().slice(0, 10);
    const days: string[] = [];
    for (let day = first; day < next; day = dashboardDateOffset(day, 1)) days.push(day);
    return { first, next, days, start: dashboardDayStart(first, timezone), end: dashboardDayStart(next, timezone) };
}
export function dashboardToday(now: Date, timezone: string) { return attendanceDay(now, timezone); }
export function dashboardRate(collected: number, billed: number, waived: number) {
    return billed > waived ? Math.round(collected / (billed - waived) * 100) : null;
}
