import { apiClient } from "./core";
import { Organization, Branch } from "@prisma/client";

export const organizations = {
    getAll: async (): Promise<Organization[]> => {
        return apiClient.get("/organizations");
    },

    create: async (data: { name: string }): Promise<Organization> => {
        return apiClient.post("/organizations", data);
    },

    getBranches: async (orgId: string): Promise<Branch[]> => {
        return apiClient.get(`/organizations/${orgId}/branches`);
    },

    createBranch: async (orgId: string, data: { name: string }): Promise<Branch> => {
        return apiClient.post(`/organizations/${orgId}/branches`, data);
    }
};
