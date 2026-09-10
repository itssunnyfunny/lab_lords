import { apiClient } from "./core";
import type { CollectionInput, FeeCollectionView } from "@/lib/feeCollections";
import type { PaymentListItem } from "./payments";
export const feeCollections = {
    collect: (branchId: string, data: CollectionInput): Promise<FeeCollectionView> => apiClient.post(`/branches/${branchId}/collections`, data),
    dues: (branchId: string, studentId: string): Promise<{ student: { id: string; name: string }; payments: PaymentListItem[] }> =>
        apiClient.get(`/branches/${branchId}/collections?dues=true&studentId=${encodeURIComponent(studentId)}`),
    get: (branchId: string, id: string): Promise<FeeCollectionView> => apiClient.get(`/branches/${branchId}/collections/${id}`),
    list: (branchId: string, query: Record<string, string>): Promise<{ items: FeeCollectionView[]; total: number; nextCursor: string | null }> =>
        apiClient.get(`/branches/${branchId}/collections?${new URLSearchParams(query)}`),
    void: (branchId: string, id: string, reason: string): Promise<FeeCollectionView> => apiClient.patch(`/branches/${branchId}/collections/${id}`, { reason }),
};
