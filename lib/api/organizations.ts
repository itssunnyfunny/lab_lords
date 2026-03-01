import { apiClient } from "./core";
import { Organization, Branch } from "@prisma/client";
import { CreateOrganizationDto, CreateBranchDto } from "@/types";

// What the /organizations/:orgId/branches endpoint actually returns —
// Prisma serialises Dates to strings over JSON, and the route includes _count.
export type BranchWithCounts = Omit<Branch, "createdAt" | "lastDataChange" | "aiLastCalledAt"> & {
    createdAt: string;
    lastDataChange: string;
    aiLastCalledAt: string | null;
    _count: {
        students: number;
        seats: number;
        shifts: number;
    };
};

export const organizations = {
    getAll: async (): Promise<Organization[]> => {
        return apiClient.get("/organizations");
    },

    create: async (data: Pick<CreateOrganizationDto, 'name'>): Promise<Organization> => {
        return apiClient.post("/organizations", data);
    },

    getBranches: async (orgId: string): Promise<BranchWithCounts[]> => {
        return apiClient.get(`/organizations/${orgId}/branches`);
    },

    createBranch: async (orgId: string, data: Pick<CreateBranchDto, 'name'>): Promise<Branch> => {
        return apiClient.post(`/organizations/${orgId}/branches`, data);
    }
};
