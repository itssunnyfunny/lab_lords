import { apiClient } from "./core";
import { Staff, StaffRole } from "@prisma/client";

export type StaffWithUser = Staff & {
    user: { id: string; name: string | null; email: string };
};

export const staff = {
    list: async (branchId: string): Promise<StaffWithUser[]> => {
        return apiClient.get(`/branches/${branchId}/staff`);
    },

    add: async (branchId: string, data: { userId: string; role: StaffRole }): Promise<StaffWithUser> => {
        return apiClient.post(`/branches/${branchId}/staff`, data);
    }
};
