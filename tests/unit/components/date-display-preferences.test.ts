import { describe, expect, it } from "vitest";
import { formatPreferenceDate, formatPreferenceDateTime } from "@/components/settings/UserPreferencesApplier";

describe("account date display preferences", () => {
    it.each([
        ["dd MMM yyyy", "04 Nov 2026"],
        ["MMM dd, yyyy", "Nov 04, 2026"],
        ["yyyy-MM-dd", "2026-11-04"],
    ] as const)("honors %s for dates and timestamps in the user's timezone", (dateFormat, expected) => {
        const preferences = { dateFormat, locale: "en-IN", timezone: "Asia/Kolkata" };
        const instant = "2026-11-03T20:00:00Z";
        expect(formatPreferenceDate(instant, preferences)).toBe(expected);
        expect(formatPreferenceDateTime(instant, preferences)).toMatch(expected + ", ");
        expect(formatPreferenceDate(instant, preferences, { day: "2-digit", timeZone: "UTC" })).toBe("03");
    });
});
