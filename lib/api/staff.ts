import { apiClient } from "./core";
import type { Staff, StaffPermissionOverride, StaffRole } from "@prisma/client";
import type { StaffPermissionUpdate } from "@/types";

export type StaffWithUser = Staff & {
    user: { id: string; name: string | null; email: string };
    permissionOverrides?: StaffPermissionOverride[];
};

export type StaffInviteResponse = {
    id: string;
    role: StaffRole;
    token: string;
    expiresAt: string;
    createdAt: string;
    inviteUrl: string;
};

export const staff = {
    list: async (branchId: string): Promise<StaffWithUser[]> => {
        return apiClient.get(`/branches/${branchId}/staff`);
    },

    add: async (branchId: string, data: { email: string; role: StaffRole }): Promise<StaffWithUser> => {
        return apiClient.post(`/branches/${branchId}/staff`, data);
    },

    update: async (
        branchId: string,
        staffId: string,
        data: { role?: StaffRole; permissions?: StaffPermissionUpdate }
    ): Promise<StaffWithUser> => {
        return apiClient.patch(`/branches/${branchId}/staff/${staffId}`, data);
    },

    createInvite: async (branchId: string, data: { role: StaffRole; ttlDays?: number }): Promise<StaffInviteResponse> => {
        return apiClient.post(`/branches/${branchId}/staff-invites`, data);
    },

    listInvites: async (branchId: string): Promise<StaffInviteResponse[]> => {
        return apiClient.get(`/branches/${branchId}/staff-invites`);
    },

    revokeInvite: async (branchId: string, inviteId: string): Promise<{ success: boolean }> => {
        return apiClient.delete(`/branches/${branchId}/staff-invites/${inviteId}`);
    },
};
