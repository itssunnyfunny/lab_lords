import { apiClient } from "./core";
import type { SeatAllocation } from "@/app/generated/prisma/browser";

export const seats = {
    // Re-export branch-level seat calls via convenience methods if needed, 
    // or keep them strictly in branches.ts. 
    // Here we focus on allocations which might be under `seat-allocations` or `branches/:id/seat-allocations`

    listAllocations: async (branchId: string, params?: { studentId?: string; shiftId?: string; activeOnly?: boolean }): Promise<SeatAllocation[]> => {
        const query = new URLSearchParams();
        if (params?.studentId) query.append("studentId", params.studentId);
        if (params?.shiftId) query.append("shiftId", params.shiftId);
        if (params?.activeOnly) query.append("activeOnly", "true");

        return apiClient.get(`/branches/${branchId}/seat-allocations?${query.toString()}`);
    },

    allocate: async (branchId: string, data: { seatId: string; studentId: string; shiftId: string }): Promise<SeatAllocation> => {
        return apiClient.post(`/branches/${branchId}/seat-allocations`, data);
    }
};
