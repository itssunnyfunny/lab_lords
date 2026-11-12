import { LANGUAGE_TAGS, type InterfaceLanguage } from "@/lib/i18n/language";

const calendarOptions = { day: "2-digit", month: "short", year: "numeric" } as const;

/** Display only. Date-only strings retain their calendar day; timestamps use the
 * supplied timezone. Raw report/CSV values and recorded precision are unchanged. */
export function financialCalendarDate(value: Date | string | number, language: InterfaceLanguage = "en", timezone = "Asia/Kolkata") {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "—";
    return new Intl.DateTimeFormat(LANGUAGE_TAGS[language], {
        ...calendarOptions, timeZone: typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? "UTC" : timezone,
    }).format(date);
}

/** Receipts describe the recorded India billing calendar, independently of the
 * browser timezone. Screen, copied text and PDF share this display owner. */
export function receiptPeriodDate(value: Date | string | number, language: InterfaceLanguage = "en") {
    return financialCalendarDate(value, language);
}

export function financialDateTime(value: Date | string | number, language: InterfaceLanguage = "en", timezone = "Asia/Kolkata") {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "—";
    return new Intl.DateTimeFormat(LANGUAGE_TAGS[language], {
        ...calendarOptions, timeZone: timezone, hour: "numeric", minute: "2-digit", hour12: true, timeZoneName: "short",
    }).format(date);
}

export function receiptCollectedAt(value: Date | string | number, language: InterfaceLanguage = "en") {
    return financialDateTime(value, language);
}
