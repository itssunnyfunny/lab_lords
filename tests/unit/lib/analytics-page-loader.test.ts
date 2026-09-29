import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ResourceState } from "@/types";
import type { BranchAnalyticsPayload } from "@/lib/analyticsPageLoader";

const mocks = vi.hoisted(() => ({ getDetails: vi.fn(), getSnapshot: vi.fn(), getTrends: vi.fn() }));
vi.mock("@/lib/api/branches", () => ({ branches: { getDetails: mocks.getDetails } }));
vi.mock("@/lib/api/analytics", () => ({ analytics: { getSnapshot: mocks.getSnapshot, getTrends: mocks.getTrends } }));

import { loadBranchAnalyticsPage } from "@/lib/analyticsPageLoader";

function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}

const operational = {
    financialAccess: false as const,
    totalStudents: 5, activeStudents: 4, assignedSeats: 3,
    totalSeats: 10, occupancyRate: 30,
};

describe("analytics page loading across permission changes", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getDetails.mockResolvedValue({ id: "branch", name: "Central" });
    });

    it("clears previous finance before an eventually restricted snapshot waits for a seat trend", async () => {
        const snapshot = deferred<typeof operational>();
        const seatTrend = deferred<{ date: string; value: number }[]>();
        mocks.getSnapshot.mockReturnValue(snapshot.promise);
        mocks.getTrends.mockReturnValue(seatTrend.promise);
        let visible: ResourceState<BranchAnalyticsPayload> = {
            status: "success", updatedAt: "2026-09-01T00:00:00.000Z",
            data: { row: { id: "branch", branch: "Central", students: 5, util: 30 },
                snapshot: { ...operational, financialAccess: true, monthlyRevenue: 901, dueAmount: 101, paidAmount: 800, collectionRate: 89 },
                trends: [], period: "month", chart: "revenue", from: "", to: "" },
        };
        const publish = (state: ResourceState<BranchAnalyticsPayload>) => { visible = state; };
        const loading = loadBranchAnalyticsPage("branch", "month", "revenue", true, publish);
        expect(visible).toEqual({ status: "loading" });
        snapshot.resolve(operational);
        await vi.waitFor(() => expect(mocks.getTrends).toHaveBeenCalledOnce());
        expect(mocks.getTrends.mock.calls[0][1].type).toBe("seat");
        expect(visible).toEqual({ status: "loading" });
        seatTrend.resolve([{ date: "2026-09-01", value: 30 }]);
        await loading;
        expect(visible.status).toBe("success");
        if (visible.status !== "success") throw new Error("Expected success");
        expect(visible.data.chart).toBe("utilization");
        expect(visible.data.snapshot.financialAccess).toBe(false);
    });

    it("does not restore previous finance when a restricted refresh fails", async () => {
        mocks.getSnapshot.mockRejectedValue(new Error("Forbidden"));
        let visible: ResourceState<BranchAnalyticsPayload> = {
            status: "success", updatedAt: "2026-09-01T00:00:00.000Z",
            data: { row: { id: "branch", branch: "Central", students: 0, util: 0 },
                snapshot: { ...operational, financialAccess: true, monthlyRevenue: 901, dueAmount: 101, paidAmount: 800, collectionRate: 89 },
                trends: [], period: "month", chart: "revenue", from: "", to: "" },
        };
        await loadBranchAnalyticsPage("branch", "month", "revenue", false, state => { visible = state; });
        expect(visible).toEqual({ status: "error", message: "The requested analytics view could not be refreshed.", retryable: true });
        expect(mocks.getTrends).not.toHaveBeenCalled();
    });
});
