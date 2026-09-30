import { describe, expect, it } from "vitest";
import { withoutFinancialAnalytics } from "@/lib/analyticsFinancialAccess";
import type { BranchSnapshot } from "@/lib/api/analytics";

describe("analytics permission transition", () => {
    it("removes previously loaded finance while retaining student and seat fields", () => {
        const previous: BranchSnapshot = {
            financialAccess: true, period: "month", totalStudents: 5,
            activeStudents: 4, assignedSeats: 3, totalSeats: 10,
            occupancyRate: 30, monthlyRevenue: 901, dueAmount: 101,
            paidAmount: 800, collectionRate: 89,
        };
        const visible = withoutFinancialAnalytics(previous);
        expect(visible).toEqual({
            financialAccess: false, period: "month", totalStudents: 5,
            activeStudents: 4, assignedSeats: 3, totalSeats: 10,
            occupancyRate: 30, seatDetails: undefined,
        });
        for (const key of ["monthlyRevenue", "dueAmount", "paidAmount", "collectionRate"]) {
            expect(visible).not.toHaveProperty(key);
        }
    });
});
