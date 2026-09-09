import { describe, expect, it } from "vitest";
import { addDays, format } from "date-fns";
import { renewalCategories, renewalQuerySchema, followUpSchema } from "@/lib/renewals";
import { upcomingCyclesBetween } from "@/utils/studentBillingCycles";
import { MANUAL_REMINDER_COPIED, paymentReminderDraft } from "@/lib/paymentReminderDraft";

const day = (value: string) => new Date(`${value}T00:00:00`);
describe("renewal dates and manual reminders", () => {
    it.each([
        ["2026-01-31", "2026-02-28", "2026-01-31"],
        ["2024-01-31", "2024-02-29", "2024-01-31"],
        ["2024-02-29", "2025-02-28", "2025-01-29"],
        ["2026-01-31", "2026-03-31", "2026-02-28"],
    ])("preserves anniversary boundaries %s → %s", (joined, due, start) => {
        const cycles = upcomingCyclesBetween(day(joined), day(due), addDays(day(due), 7));
        expect(cycles).toHaveLength(1);
        expect(format(cycles[0].dueDate, "yyyy-MM-dd")).toBe(due);
        expect(format(cycles[0].periodStart, "yyyy-MM-dd")).toBe(start);
    });
    it("keeps today separate from inclusive upcoming 3 and 7 day windows", () => {
        const asOf = day("2026-09-08");
        const categories = (offset: number, days: number, expected = true) => renewalCategories({
            dueDate: addDays(asOf, offset).toISOString(), expected,
        }, asOf, days);
        expect(categories(0, 7)).toEqual(["ALL", "TODAY"]);
        expect(categories(0, 7, false)).toEqual(["ALL", "TODAY", "OUTSTANDING"]);
        expect(categories(1, 3)).toContain("UPCOMING");
        expect(categories(3, 3)).toContain("UPCOMING");
        expect(categories(4, 3)).not.toContain("UPCOMING");
        expect(categories(7, 7)).toContain("UPCOMING");
        expect(categories(8, 7)).not.toContain("UPCOMING");
        expect(categories(-7, 7, false)).not.toContain("OVERDUE");
        expect(categories(-8, 7, false)).toContain("OVERDUE");
    });
    it("respects billingStartAt at the start of a cycle", () => {
        expect(upcomingCyclesBetween(day("2026-01-08"), day("2026-09-08"), day("2026-09-15"), day("2026-08-09"))).toEqual([]);
        expect(upcomingCyclesBetween(day("2026-01-08"), day("2026-09-08"), day("2026-09-15"), day("2026-08-08"))).toHaveLength(1);
    });
    it("validates bounded filters and follow-up input", () => {
        for (const value of [{ days: 8 }, { limit: 0 }, { limit: 101 }, { search: "a".repeat(101) }]) {
            expect(renewalQuerySchema.safeParse(value).success).toBe(false);
        }
        expect(followUpSchema.safeParse({ studentId: "s", type: "MONTHLY", periodStart: day("2026-08-08").toISOString(),
            note: "", outcome: "CONTACTED", nextFollowUpAt: "2026-02-30" }).success).toBe(false);
    });
    it("does not describe an expected fee as debt or copy as delivery", () => {
        const input = { studentName: "Sample", amount: "₹1,000", date: "15 Sep 2026", language: "EN" as const };
        expect(paymentReminderDraft({ ...input, expected: true })).toContain("expected");
        expect(paymentReminderDraft({ ...input, expected: true })).not.toContain("pending");
        expect(paymentReminderDraft(input)).toContain("pending");
        expect(paymentReminderDraft({ ...input, language: "HI", expected: true })).toContain("अनुमानित");
        expect(MANUAL_REMINDER_COPIED).toContain("Delivery is not confirmed");
    });
});
