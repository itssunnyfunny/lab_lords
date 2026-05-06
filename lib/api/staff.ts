import { apiClient } from "./core";
import { Staff, StaffRole } from "@prisma/client";

export type StaffWithUser = Staff & {
    user: { id: string; name: string | null; email: string };
};

export type StaffInviteResponse = {
    id: string;
    role: StaffRole;
    token: string;
    expiresAt: string;
    inviteUrl: string;
};

export const staff = {
    list: async (branchId: string): Promise<StaffWithUser[]> => {
        return apiClient.get(`/branches/${branchId}/staff`);
    },

    add: async (branchId: string, data: { email: string; role: StaffRole }): Promise<StaffWithUser> => {
        return apiClient.post(`/branches/${branchId}/staff`, data);
    },

    createInvite: async (branchId: string, data: { role: StaffRole; ttlDays?: number }): Promise<StaffInviteResponse> => {
        return apiClient.post(`/branches/${branchId}/staff-invites`, data);
    }
};
