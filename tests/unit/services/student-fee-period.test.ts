import { afterEach, describe, expect, it, vi } from "vitest";
import type { Prisma } from "@/app/generated/prisma/client";
import { billingStartAfterFreePeriods, updateLinkedStudentFees } from "@/services/studentFeePeriod";

const date = (day: string) => new Date(day + "T00:00:00");
const now = date("2026-05-18");

afterEach(() => vi.useRealTimers());

describe("free monthly fee periods", () => {
    it("moves the manual start to the last completed free anniversary only on a free-to-paid change", () => {
        const free = { monthlyFee: 0, joinedAt: date("2026-01-31"), billingStartAt: null };
        expect(billingStartAfterFreePeriods(free, 900, now)).toEqual(date("2026-04-30"));
        expect(billingStartAfterFreePeriods({ ...free, billingStartAt: date("2026-06-01") }, 900, now)).toBeUndefined();
        expect(billingStartAfterFreePeriods({ ...free, monthlyFee: 700 }, 900, now)).toBeUndefined();
        expect(billingStartAfterFreePeriods(free, 0, now)).toBeUndefined();
        expect(billingStartAfterFreePeriods(free, undefined, now)).toBeUndefined();
    });

    it.each([
        { branchId: "branch", feeLinkedShiftId: "morning" },
        { branchId: "branch", feeLinkedMultiShiftId: "full-day" },
    ])("groups free anniversaries within the linked price scope %o", async where => {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(now);
        const student = {
            findMany: vi.fn().mockResolvedValue([
                { id: "first", joinedAt: date("2026-01-05"), monthlyFee: 0, billingStartAt: null },
                { id: "second", joinedAt: date("2026-02-05"), monthlyFee: 0, billingStartAt: null },
                { id: "later-day", joinedAt: date("2026-01-23"), monthlyFee: 0, billingStartAt: null },
                { id: "future-start", joinedAt: date("2026-01-05"), monthlyFee: 0, billingStartAt: date("2026-06-05") },
            ]),
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        };
        await updateLinkedStudentFees({ student } as unknown as Prisma.TransactionClient, where, 900);

        expect(student.findMany).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
            where: { ...where, monthlyFee: 0 },
        }));
        expect(student.updateMany).toHaveBeenCalledTimes(3);
        expect(student.updateMany).toHaveBeenCalledWith({
            where: { ...where, id: { in: ["first", "second"] }, monthlyFee: 0 },
            data: { billingStartAt: date("2026-05-05") },
        });
        expect(student.updateMany).toHaveBeenCalledWith({
            where: { ...where, id: { in: ["later-day"] }, monthlyFee: 0 },
            data: { billingStartAt: date("2026-04-23") },
        });
        expect(student.updateMany).toHaveBeenLastCalledWith({ where, data: { monthlyFee: 900 } });
    });
});
