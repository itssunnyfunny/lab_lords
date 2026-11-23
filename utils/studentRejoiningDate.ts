const INDIA_CALENDAR = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
});

export const INVALID_STUDENT_REJOINING_DATE = "Enter a valid rejoining date on or before today.";
export const INVALID_RETURN_ORDER = "Choose a rejoining date on or after departure and after the previous rejoining date.";
export const STUDENT_ALREADY_ACTIVE = "This student is already active. Refresh the record before changing enrollment.";

export function studentRejoiningToday(now = new Date()): string {
    const parts = INDIA_CALENDAR.formatToParts(now);
    const part = (type: "year" | "month" | "day") => parts.find(entry => entry.type === type)!.value;
    return `${part("year")}-${part("month")}-${part("day")}`;
}

export function parseStudentRejoiningDate(value: unknown): Date | null {
    if (typeof value !== "string" || !/^[1-9]\d{3}-\d{2}-\d{2}$/.test(value)) return null;
    const date = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
}

export function validateStudentRejoiningDate(value: unknown, now = new Date()): string | null {
    const date = parseStudentRejoiningDate(value);
    const key = date?.toISOString().slice(0, 10);
    return key && key <= studentRejoiningToday(now) ? key : null;
}

/** Month arithmetic for a date-only enrollment, independent of the runtime timezone. */
export function studentRejoiningAnniversary(rejoinedOn: Date, months: number): Date {
    const year = rejoinedOn.getUTCFullYear();
    const month = rejoinedOn.getUTCMonth() + months;
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    return new Date(Date.UTC(year, month, Math.min(rejoinedOn.getUTCDate(), lastDay)));
}

export function firstStudentRejoiningDueDate(value: string): string | null {
    const date = parseStudentRejoiningDate(value);
    return date ? studentRejoiningAnniversary(date, 1).toISOString().slice(0, 10) : null;
}
