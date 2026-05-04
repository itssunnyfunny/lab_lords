import { apiClient } from "./core";

export interface BranchSnapshot {
    period?: AnalyticsPeriod;
    totalStudents: number;
    activeStudents: number;
    assignedSeats: number;
    totalSeats: number;
    occupancyRate: number;
    monthlyRevenue: number;
    dueAmount: number;
    paidAmount: number;
    collectionRate: number;
    seatDetails?: {
        totalUsedSlots: number;
        totalShiftCapacity: number;
        shifts: {
            shiftId: string;
            shiftName: string;
            used: number;
            capacity: number;
            occupancyPercent: number;
        }[];
    };
}

export type AnalyticsPeriod = "month" | "all";
export type AnalyticsTrendType = "health" | "seat" | "payment" | "students";

export type TrendData = {
    date: string;
    value: number;
    category?: string;
}[];

export const analytics = {
    getSnapshot: async (branchId: string, params?: { period?: AnalyticsPeriod }): Promise<BranchSnapshot> => {
        const query = params?.period ? `?${new URLSearchParams({ period: params.period }).toString()}` : "";
        return apiClient.get(`/analytics/branch/${branchId}/snapshot${query}`);
    },

    getTrends: async (branchId: string, params: { from: string; to: string; type: AnalyticsTrendType; period?: AnalyticsPeriod }): Promise<TrendData> => {
        const query = new URLSearchParams({
            from: params.from,
            to: params.to,
            type: params.type
        });
        if (params.period) {
            query.set("period", params.period);
        }
        return apiClient.get(`/analytics/branch/${branchId}/trends?${query.toString()}`);
    }
};
