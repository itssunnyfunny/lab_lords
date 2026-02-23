import { apiClient } from "./core";

export interface BranchSnapshot {
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

export type TrendData = {
    date: string;
    value: number;
    category?: string;
}[];

export const analytics = {
    getSnapshot: async (branchId: string): Promise<BranchSnapshot> => {
        return apiClient.get(`/analytics/branch/${branchId}/snapshot`);
    },

    getTrends: async (branchId: string, params: { from: string; to: string; type: "health" | "seat" | "payment" }): Promise<TrendData> => {
        const query = new URLSearchParams({
            from: params.from,
            to: params.to,
            type: params.type
        });
        return apiClient.get(`/analytics/branch/${branchId}/trends?${query.toString()}`);
    }
};
