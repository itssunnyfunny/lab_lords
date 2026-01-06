import { apiClient } from "./core";
import { Payment } from "@prisma/client";

export const payments = {
    // List payments for a branch
    list: async (branchId: string, status?: "DUE" | "PAID"): Promise<Payment[]> => {
        const params = new URLSearchParams();
        if (status) params.append("status", status);
        return apiClient.get(`/branches/${branchId}/payments?${params.toString()}`);
    },

    // Generate payments (if logic exists in frontend to trigger this)
    // Based on routes: `branches/[branchId]/payments/generate/route.ts`
    generate: async (branchId: string): Promise<any> => {
        return apiClient.post(`/branches/${branchId}/payments/generate`, {});
    },

    // Mark payment as paid
    // Based on routes: `payments/[paymentId]/pay/route.ts`
    markAsPaid: async (paymentId: string): Promise<Payment> => {
        return apiClient.post(`/payments/${paymentId}/pay`, {});
    }
};
