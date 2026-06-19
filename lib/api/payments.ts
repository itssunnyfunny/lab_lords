import { apiClient } from "./core";
import type { Payment } from "@/app/generated/prisma/browser";

export type AuditLogEntry = {
    id: string;
    action: "PAYMENT_MARKED_PAID" | "PAYMENT_WAIVED";
    paymentId: string;
    details: {
        from: string;
        to: string;
        amount: number;
        method?: "CASH" | "UPI" | "BANK_TRANSFER" | null;
        referenceId?: string | null;
    };
    createdAt: string;
    user: { id: string; name: string | null; email: string };
};

export type PaymentGenerationSummary = {
    generatedCount: number;
    skippedCount: number;
    totalStudents: number;
    updatedBranchIds: string[];
};

export const payments = {
    // List payments for a branch
    list: async (branchId: string, status?: "DUE" | "PAID" | "WAIVED"): Promise<Payment[]> => {
        const params = new URLSearchParams();
        if (status) params.append("status", status);
        return apiClient.get(`/branches/${branchId}/payments?${params.toString()}`);
    },

    // Generate payments (if logic exists in frontend to trigger this)
    generate: async (branchId: string): Promise<PaymentGenerationSummary> => {
        return apiClient.post(`/branches/${branchId}/payments/generate`, {});
    },

    // Mark payment as paid — method and referenceId are optional but recommended
    markAsPaid: async (
        paymentId: string,
        method?: "CASH" | "UPI" | "BANK_TRANSFER",
        referenceId?: string,
    ): Promise<Payment> => {
        return apiClient.patch(`/payments/${paymentId}/pay`, { method, referenceId });
    },

    // Mark payment as waived
    markAsWaived: async (paymentId: string): Promise<Payment> => {
        return apiClient.patch(`/payments/${paymentId}/waive`, {});
    },

    // Fetch audit log for a specific payment
    getAuditLog: async (paymentId: string): Promise<AuditLogEntry[]> => {
        return apiClient.get(`/payments/${paymentId}/audit-log`);
    },
};
