import { afterEach, describe, expect, it, vi } from "vitest";
import type { Prisma } from "@/app/generated/prisma/client";
import { billingStartAfterFreePeriods, missingMonthlyFees, updateLinkedStudentFees } from "@/services/studentFeePeriod";

const date = (day: string) => new Date(day + "T00:00:00");
const now = date("2026-05-18");

afterEach(() => vi.useRealTimers());

describe("free monthly fee periods", () => {
    it("keeps the outgoing rate on missing dues and honors both current and legacy cycle evidence", async () => {
        const student = { id: "student", branchId: "branch", joinedAt: date("2026-01-10"), rejoinedOn: null,
            billingStartAt: date("2026-02-10"), monthlyFee: 900 };
        const payment = { findMany: vi.fn().mockResolvedValue([
            // Recorded typed March fee with a corrected due date.
            { studentId: student.id, periodStart: date("2026-02-10"), dueDate: date("2026-03-13") },
            // Legacy April fee with a different period start and a time of day.
            { studentId: student.id, periodStart: date("2026-04-01"), dueDate: new Date("2026-04-10T16:00:00") },
        ]) };
        const client = { payment } as unknown as Prisma.TransactionClient;
        expect(await missingMonthlyFees(client, [student], now, student.branchId)).toEqual([{
            branchId: student.branchId, studentId: student.id, amount: 900, type: "MONTHLY", status: "DUE",
            periodStart: date("2026-04-10"), periodEnd: date("2026-05-10"), dueDate: date("2026-05-10"),
        }]);
        expect(payment.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({ branchId: "branch", type: "MONTHLY", studentId: { in: ["student"] } }),
        }));
    });
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
        await updateLinkedStudentFees({ student } as unknown as Prisma.TransactionClient, "editor", where, 900);

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
