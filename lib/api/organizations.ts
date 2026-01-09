import { apiClient } from "./core";
import { Organization, Branch } from "@prisma/client";
import { CreateOrganizationDto, CreateBranchDto } from "@/types";

export const organizations = {
    getAll: async (): Promise<Organization[]> => {
        return apiClient.get("/organizations");
    },

    create: async (data: Pick<CreateOrganizationDto, 'name'>): Promise<Organization> => {
        return apiClient.post("/organizations", data);
    },

    getBranches: async (orgId: string): Promise<Branch[]> => {
        return apiClient.get(`/organizations/${orgId}/branches`);
    },

    createBranch: async (orgId: string, data: Pick<CreateBranchDto, 'name'>): Promise<Branch> => {
        return apiClient.post(`/organizations/${orgId}/branches`, data);
    }
};
