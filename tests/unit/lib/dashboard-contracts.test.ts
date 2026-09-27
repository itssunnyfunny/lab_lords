import { describe, expect, it } from "vitest";
import { dashboardExpectationSchema, dashboardTermSchema, dashboardTaskSchema, dashboardFollowUpPatchSchema } from "@/lib/dashboardContracts";
import { dashboardDateOffset, dashboardDayStart, dashboardLocalTime, dashboardMonth, dashboardRate, dashboardToday } from "@/lib/dashboardMath";

describe("dashboard calendar and financial definitions", () => {
    it("uses the branch date and time, independent of the server timezone", () => {
        const now = new Date("2026-09-26T20:00:00Z");
        expect(dashboardToday(now, "Asia/Kolkata")).toBe("2026-09-27");
        expect(dashboardLocalTime(now, "Asia/Kolkata")).toBe("01:30");
        expect(dashboardDayStart("2026-09-27", "Asia/Kolkata").toISOString()).toBe("2026-09-26T18:30:00.000Z");
    });
    it("resolves both sides of daylight saving without a fixed offset", () => {
        expect(dashboardDayStart("2026-03-08", "America/New_York").toISOString()).toBe("2026-03-08T05:00:00.000Z");
        expect(dashboardDayStart("2026-03-09", "America/New_York").toISOString()).toBe("2026-03-09T04:00:00.000Z");
    });
    it("builds complete leap-month dates and handles year boundaries", () => {
        expect(dashboardMonth("2028-02", "Asia/Kolkata").days).toHaveLength(29);
        expect(dashboardDateOffset("2026-12-31", 1)).toBe("2027-01-01");
        expect(dashboardMonth("2026-12", "Asia/Kolkata").next).toBe("2027-01-01");
    });
    it("keeps waived amounts out of the collectible denominator and empty rates unavailable", () => {
        expect(dashboardRate(1900, 4300, 0)).toBe(44);
        expect(dashboardRate(1000, 2000, 1000)).toBe(100);
        expect(dashboardRate(0, 1000, 1000)).toBeNull();
        expect(dashboardRate(0, 0, 0)).toBeNull();
    });
});

describe("explicit operational configuration", () => {
    it("requires intentional weekdays and a valid deadline", () => {
        const valid = { studentId: "student", weekdays: [1, 3, 5], expectedBy: "09:30", enabled: true };
        expect(dashboardExpectationSchema.parse(valid)).toEqual(valid);
        expect(dashboardExpectationSchema.safeParse({ ...valid, weekdays: [] }).success).toBe(false);
        expect(dashboardExpectationSchema.safeParse({ ...valid, weekdays: [1, 1] }).success).toBe(false);
        expect(dashboardExpectationSchema.safeParse({ ...valid, expectedBy: "24:00" }).success).toBe(false);
    });
    it("requires real, ordered membership dates without any billing mutation fields", () => {
        const valid = { studentId: "student", label: "Agreed term", startDate: "2026-09-01", endDate: "2026-09-30" };
        expect(dashboardTermSchema.safeParse(valid).success).toBe(true);
        expect(dashboardTermSchema.safeParse({ ...valid, endDate: "2026-02-31" }).success).toBe(false);
        expect(dashboardTermSchema.safeParse({ ...valid, endDate: "2026-08-30" }).success).toBe(false);
        expect(dashboardTermSchema.safeParse({ ...valid, deactivate: true }).success).toBe(false);
    });
    it("does not accept payment settlement or provider delivery as follow-up completion", () => {
        expect(dashboardFollowUpPatchSchema.parse({ completed: true })).toEqual({ completed: true });
        expect(dashboardFollowUpPatchSchema.safeParse({ completed: true, paid: true }).success).toBe(false);
        expect(dashboardFollowUpPatchSchema.safeParse({ delivered: true }).success).toBe(false);
    });
    it("bounds manual tasks and assigns no owner implicitly", () => {
        expect(dashboardTaskSchema.parse({ title: "  Inspect seating  " })).toEqual({ title: "Inspect seating", dueAt: null, assigneeId: null });
        expect(dashboardTaskSchema.safeParse({ title: "x".repeat(161) }).success).toBe(false);
    });
});
