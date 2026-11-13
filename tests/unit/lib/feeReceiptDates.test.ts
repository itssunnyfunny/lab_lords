import { afterEach, describe, expect, it, vi } from "vitest";
import { financialCalendarDate, receiptCollectedAt, receiptPeriodDate } from "@/lib/feeReceiptDates";

afterEach(() => vi.unstubAllEnvs());

describe("recorded receipt dates", () => {
    it.each(["UTC", "Asia/Kolkata", "America/Los_Angeles", "Pacific/Auckland"])(
        "keeps India day/month/year boundaries when the browser uses %s", timezone => {
            vi.stubEnv("TZ", timezone);
            expect(receiptPeriodDate("2026-09-30T18:30:00.000Z")).toBe("01 Oct 2026");
            expect(receiptPeriodDate("2026-12-31T18:30:00.000Z")).toBe("01 Jan 2027");
            expect(receiptPeriodDate("2028-02-29T18:29:59.000Z")).toBe("29 Feb 2028");
            expect(receiptCollectedAt("2026-12-31T18:30:00.000Z")).toContain("01 Jan 2027");
            expect(receiptCollectedAt("2026-12-31T18:30:00.000Z")).toBe("01 Jan 2027, 12:00 am IST");
            expect(financialCalendarDate("2026-10-01", "en", timezone)).toBe("01 Oct 2026");
        },
    );
});
