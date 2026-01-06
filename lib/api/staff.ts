import { apiClient } from "./core";
import { Staff } from "@prisma/client";

export const staff = {
    list: async (branchId: string): Promise<Staff[]> => {
        return apiClient.get(`/branches/${branchId}/staff`);
    },

    add: async (branchId: string, data: { userId: string; role: "MANAGER" | "STAFF" }): Promise<Staff> => {
        return apiClient.post(`/branches/${branchId}/staff`, data);
    }
};
