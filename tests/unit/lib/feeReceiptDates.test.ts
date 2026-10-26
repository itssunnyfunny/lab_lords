import { afterEach, describe, expect, it, vi } from "vitest";
import { receiptCollectedAt, receiptPeriodDate } from "@/lib/feeReceiptDates";

afterEach(() => vi.unstubAllEnvs());

describe("recorded receipt dates", () => {
    it.each(["UTC", "Asia/Kolkata", "America/Los_Angeles", "Pacific/Auckland"])(
        "keeps India day/month/year boundaries when the browser uses %s", timezone => {
            vi.stubEnv("TZ", timezone);
            expect(receiptPeriodDate("2026-09-30T18:30:00.000Z")).toBe("1/10/2026");
            expect(receiptPeriodDate("2026-12-31T18:30:00.000Z")).toBe("1/1/2027");
            expect(receiptPeriodDate("2028-02-29T18:29:59.000Z")).toBe("29/2/2028");
            expect(receiptCollectedAt("2026-12-31T18:30:00.000Z")).toContain("1/1/2027");
            expect(receiptCollectedAt("2026-12-31T18:30:00.000Z")).toMatch(/ IST$/);
        },
    );
});
