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

export interface OrganizationAnalyticsSnapshot {
    asOf: string;
    organization: {
        totalBranches: number;
    };
    seats: {
        totalSeats: number;
        occupiedSeats: number;
        utilizationRatio: number;
    };
    students: {
        active: number;
        inactive: number;
        total: number;
    };
    payments: {
        dueCount: number;
        paidCount: number;
        overdueCount: number;
        dueAmount: number;
        paidAmount: number;
    };
    branches: {
        branchId: string;
        branchName: string;
        snapshot: {
            seats: {
                overall: {
                    totalSeats: number;
                    occupiedSeats: number;
                    utilizationRatio: number;
                };
            };
            students: {
                status: {
                    active: number;
                    inactive: number;
                    total: number;
                };
                seating: {
                    seated: number;
                    notSeated: number;
                    activeStudents: number;
                };
            };
            payments: {
                dueCount: number;
                paidCount: number;
                overdueCount: number;
                dueAmount: number;
                paidAmount: number;
            };
        };
    }[];
}

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
    },

    getOrganizationSnapshot: async (orgId: string): Promise<OrganizationAnalyticsSnapshot> => {
        return apiClient.get(`/analytics/org/${orgId}/snapshot`);
    },
};
