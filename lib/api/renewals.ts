import { apiClient } from "./core";
import type { FollowUpInput, RenewalFollowUp, RenewalPage, RenewalQuery } from "@/lib/renewals";

export const renewals = {
    list(branchId: string, query: RenewalQuery): Promise<RenewalPage> {
        const params = new URLSearchParams({ filter: query.filter, days: String(query.days),
            search: query.search, limit: String(query.limit) });
        if (query.cursor) params.set("cursor", query.cursor);
        return apiClient.get(`/branches/${branchId}/renewals?${params}`);
    },
    saveFollowUp(branchId: string, input: FollowUpInput): Promise<RenewalFollowUp> {
        return apiClient.put(`/branches/${branchId}/renewals/follow-up`, input);
    },
};
