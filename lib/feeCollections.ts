import { z } from "zod";

export const collectionInputSchema = z.object({
    studentId: z.string().min(1).max(100),
    paymentIds: z.array(z.string().min(1).max(100)).min(1).max(100).refine(ids => new Set(ids).size === ids.length),
    amount: z.number().int().positive().max(2147483647),
    method: z.enum(["CASH", "UPI", "BANK_TRANSFER"]),
    reference: z.string().trim().max(200).default(""),
    note: z.string().trim().max(1000).default(""),
    idempotencyKey: z.string().min(8).max(150),
}).strict();
export type CollectionInput = z.infer<typeof collectionInputSchema>;
export type FeeReceiptSnapshot = {
    version: 1; branchName: string; organizationName: string; address: string | null; contactPhone: string | null;
    studentName: string; studentId: string; recordedBy: string; recordedById: string;
    collectedAt: string; amount: number; method: string; reference: string; note: string;
    remainingBalance: number;
    allocations: { paymentId: string; type: string; periodStart: string; periodEnd: string; amount: number; remaining: number }[];
};
export type FeeCollectionView = {
    id: string; receiptNumber: string; amount: number; collectedAt: string; method: string;
    reference: string | null; voidedAt: string | null; voidReason: string | null;
    snapshot: FeeReceiptSnapshot;
};
