import { describe, expect, it } from "vitest";
import { combinationFeeSuggestion, removeSetupTimeSlot, suggestedSchedule, validateSetupSchedule } from "@/lib/onboardingSchedule";
import { translateError } from "@/lib/i18n";

describe("onboarding time slots and student fees", () => {
    it("explains custom seat-count mismatches in every interface language", () => {
        for (const language of ["en", "hi", "hinglish"] as const) {
            const message = translateError(language, "Custom ranges create 10 labels, but total seats is 12.");
            expect(message).toContain("10"); expect(message).toContain("12");
            expect(message).not.toBe(translateError(language, "unknown-internal-error"));
        }
    });
    it("starts with one editable session and no implicit zero fee or combination", () => {
        const schedule = suggestedSchedule();
        expect(schedule.shifts).toHaveLength(1);
        expect(schedule.multiShifts).toEqual([]);
        expect(validateSetupSchedule(schedule).errors).toEqual({ "daily.price": "Enter a monthly fee, or enter 0 for no fee." });
        schedule.shifts[0].price = "0";
        expect(validateSetupSchedule(schedule)).toMatchObject({ errors: {}, shifts: [{ price: 0 }], multiShifts: [] });
    });

    it("places an overnight timing conflict beside both affected slots", () => {
        const schedule = suggestedSchedule(true);
        schedule.shifts.forEach(row => { row.price = "500"; });
        schedule.shifts[0].startTime = "22:00";
        schedule.shifts[0].endTime = "12:00";
        const errors = validateSetupSchedule(schedule).errors;
        for (const id of ["morning", "afternoon"]) for (const field of ["startTime", "endTime"]) {
            expect(errors[`${id}.${field}`]).toBe("These times overlap another time slot. Adjust the start or end time.");
        }
        expect(errors["evening.startTime"]).toBeUndefined();
    });

    it("permits different combinations to share slots without duplicating an identical set", () => {
        const schedule = suggestedSchedule(true);
        schedule.shifts.forEach(row => { row.price = "500"; });
        schedule.multiShifts = [
            { clientId: "day", name: "Day", price: "800", componentShiftIds: ["morning", "afternoon"] },
            { clientId: "late", name: "Late", price: "900", componentShiftIds: ["afternoon", "evening"] },
        ];
        expect(validateSetupSchedule(schedule).errors).toEqual({});
        schedule.multiShifts.push({ ...schedule.multiShifts[0], clientId: "duplicate", name: "Same slots", componentShiftIds: ["afternoon", "morning"] });
        expect(validateSetupSchedule(schedule).errors["duplicate.components"]).toContain("already exists");
    });

    it("keeps references valid on rename and removes deleted IDs without silently repricing", () => {
        const schedule = suggestedSchedule(true);
        schedule.shifts.forEach(row => { row.price = "500"; });
        schedule.multiShifts = [{ clientId: "all", name: "Full day", price: "1200", componentShiftIds: ["morning", "afternoon", "evening"] }];
        schedule.shifts[0].name = "Early session";
        expect(validateSetupSchedule(schedule).multiShifts[0].componentShiftNames[0]).toBe("Early session");
        expect(combinationFeeSuggestion(schedule.multiShifts[0], schedule.shifts)).toBe(1500);
        const removed = removeSetupTimeSlot(schedule, "afternoon");
        expect(removed.multiShifts[0]).toMatchObject({ price: "1200", componentShiftIds: ["morning", "evening"] });
        expect(combinationFeeSuggestion(removed.multiShifts[0], removed.shifts)).toBe(1000);
        expect(schedule.multiShifts[0].componentShiftIds).toContain("afternoon");
    });

    it("never suggests a total using unanswered fees", () => {
        const schedule = suggestedSchedule(true);
        const row = { clientId: "all", name: "Full day", price: "", componentShiftIds: ["morning", "afternoon"] };
        expect(combinationFeeSuggestion(row, schedule.shifts)).toBeNull();
        schedule.shifts[0].price = "0";
        schedule.shifts[1].price = "600";
        expect(combinationFeeSuggestion(row, schedule.shifts)).toBe(600);
        expect(row.price).toBe("");
    });

    it("localizes unfinished combination errors instead of showing a system failure", () => {
        const schedule = suggestedSchedule(true);
        schedule.multiShifts = [{ clientId: "new", name: "", price: "", componentShiftIds: [] }];
        const errors = Object.values(validateSetupSchedule(schedule).errors);
        for (const error of errors) for (const language of ["en", "hi", "hinglish"] as const) {
            const translated = translateError(language, error);
            expect(translated).not.toBe(translateError(language, "unknown-internal-error"));
            if (language !== "en") expect(translated).not.toBe(error);
        }
    });
});
