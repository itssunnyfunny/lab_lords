import { describe, expect, it } from "vitest";
import { dailyDashboardCollections, dashboardActivity, dashboardPriorities } from "@/lib/dashboardPresentation";
import type { BranchDashboardSources } from "@/lib/branchDashboard";
import type { FeeCollectionView } from "@/lib/feeCollections";

function sources(): BranchDashboardSources {
    return {
        snapshot: null, collectionsTrend: null, students: [], allocations: [], collections: [], overduePayments: [],
        attendance: null, followUps: null,
        upcoming: { items: [], counts: { ALL: 1, TODAY: 1, UPCOMING: 0, OUTSTANDING: 0, OVERDUE: 0 },
            outstandingAmount: 0, expectedAmount: 500, nextCursor: null, asOf: "2026-09-23" },
        resources: { analytics: "success", collectionsTrend: "success", students: "success", allocations: "success", payments: "success",
            overdue: "success", attendance: "success", followUps: "success", upcoming: "success" },
        updatedAt: "2026-09-23T10:00:00Z",
    };
}

describe("dashboard priority and event meaning", () => {
    it("derives daily collections from consecutive cumulative observations, not monthly totals", () => {
        expect(dailyDashboardCollections([
            { date: "2026-09-20T00:00:00Z", value: 5000, category: "Collected" },
            { date: "2026-09-21T00:00:00Z", value: 5400, category: "Collected" },
            { date: "2026-09-22T00:00:00Z", value: 5400, category: "Collected" },
            { date: "2026-09-22T00:00:00Z", value: 9900, category: "Revenue" },
        ])).toEqual([{ date: "2026-09-21T00:00:00Z", amount: 400 }, { date: "2026-09-22T00:00:00Z", amount: 0 }]);
    });
    it("never fills missing days or invalid cumulative values with invented bars", () => {
        expect(dailyDashboardCollections(null)).toEqual([]);
        expect(dailyDashboardCollections([
            { date: "2026-09-20", value: 5000, category: "Collected" },
            { date: "2026-09-22", value: 5400, category: "Collected" },
        ])).toEqual([]);
    });
    it("orders confirmed overdue fees before today's dates and counts periods, not students", () => {
        const data = sources();
        data.overduePayments = ["a", "b"].map(paymentId => ({ paymentId, studentId: "same-student", studentName: "Synthetic",
            phone: null, dueDate: "2026-08-01", amount: 300 }));
        expect(dashboardPriorities(data)).toEqual([
            { kind: "overdue", count: 2, amount: 600, href: "/overdue" },
            { kind: "today", count: 1, href: "/renewals" },
        ]);
    });
    it("does not turn failed or restricted sources into priorities", () => {
        const data = sources();
        data.resources.upcoming = "error";
        expect(dashboardPriorities(data)).toEqual([]);
        data.resources.upcoming = "restricted";
        expect(dashboardPriorities(data)).toEqual([]);
    });
    it("does not manufacture alerts for an empty queue or low utilization", () => {
        const data = sources();
        data.upcoming!.counts.TODAY = 0;
        expect(dashboardPriorities(data)).toEqual([]);
    });
    it("uses recorded creation and collection timestamps, with no refresh-time or start-date fallback", () => {
        const data = sources();
        data.students = [{ id: "old", name: "Older student", status: "ACTIVE", joinedAt: "2026-09-23" },
            { id: "new", name: "New student", status: "ACTIVE", createdAt: "2026-09-22T10:00:00Z" }];
        data.allocations = [{ startDate: "2026-09-23", seat: { label: "A1" }, student: { name: "Older student" } }];
        data.overduePayments = [{ paymentId: "due", studentId: "old", studentName: "Older student", amount: 500, dueDate: "2026-08-01", phone: null }];
        expect(dashboardActivity(data)).toEqual([{ type: "enrollment", studentName: "New student", ts: "2026-09-22T10:00:00.000Z" }]);
    });
    it("shows partial collections as their actual received amounts and excludes voided or undated facts", () => {
        const data = sources();
        const collection = { amount: 400, collectedAt: "2026-09-23T08:00:00Z", voidedAt: null,
            snapshot: { studentName: "Synthetic" } } as FeeCollectionView;
        data.collections = [collection, { ...collection, voidedAt: "2026-09-23T09:00:00Z" }, { ...collection, collectedAt: "invalid" }];
        expect(dashboardActivity(data)).toEqual([{ type: "payment", amount: 400, studentName: "Synthetic", ts: "2026-09-23T08:00:00.000Z" }]);
    });
});
