import { describe, expect, it, vi } from "vitest";
import { collectionDraftKey, restoreCollectionDraft } from "@/lib/feeCollectionDraft";
import type { CollectionInput, FeeCollectionView } from "@/lib/feeCollections";

const request: CollectionInput = { studentId: "student", paymentIds: ["fee"], amount: 700, method: "UPI",
    reference: "reference-A", note: "cashier A's note", idempotencyKey: "original-key" };
const legacyKey = "fee-collection:branch:student";
function session(key: string) {
    const data = new Map([[key, JSON.stringify(request)]]);
    return { getItem: (k: string) => data.get(k) ?? null, removeItem: (k: string) => data.delete(k) };
}
const receipt: FeeCollectionView = {
    id: "receipt", receiptNumber: "LL-test", amount: 700, method: "UPI", collectedAt: "2026-10-01T12:00:00Z",
    reference: "reference-A", voidedAt: null, voidReason: null,
    snapshot: { version: 1, studentId: "student", studentName: "Student", recordedBy: "Cashier A", recordedById: "A",
        branchName: "Central", organizationName: "Organization", address: null, contactPhone: null, collectedAt: "2026-10-01T12:00:00Z",
        method: "UPI", amount: 700, reference: "reference-A", note: "", remainingBalance: 300, allocations: [] },
};

describe("restoring uncertain collection drafts", () => {
    it("restores the original frozen request only for its own account, branch and student", async () => {
        const storage = session(collectionDraftKey("A", "branch", "student"));
        const recover = vi.fn();
        for (const [account, branch, student] of [["B", "branch", "student"], ["A", "foreign", "student"], ["A", "branch", "another"]]) {
            expect(await restoreCollectionDraft(storage, account, branch, student, recover)).toEqual({ kind: "empty" });
        }
        expect(await restoreCollectionDraft(storage, "A", "branch", "student", recover)).toEqual({ kind: "pending", request });
        expect(recover).not.toHaveBeenCalled();
    });
    it("checks only a legacy key and never passes its contents to the next cashier", async () => {
        const storage = session(legacyKey);
        const recover = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(receipt);
        expect(await restoreCollectionDraft(storage, "B", "branch", "student", recover)).toEqual({ kind: "review" });
        expect(recover).toHaveBeenCalledExactlyOnceWith("branch", request.idempotencyKey);
        expect(storage.getItem(legacyKey)).not.toBeNull();
        expect(await restoreCollectionDraft(storage, "A", "branch", "student", recover)).toEqual({ kind: "receipt", receipt });
        expect(storage.getItem(legacyKey)).toBeNull();
    });
    it("retains the uncertain key if receipt verification fails or the account changes mid-read", async () => {
        const storage = session(legacyKey);
        await expect(restoreCollectionDraft(storage, "A", "branch", "student", vi.fn().mockRejectedValue(new Error("offline"))))
            .rejects.toThrow("offline");
        await restoreCollectionDraft(storage, "A", "branch", "student", vi.fn().mockResolvedValue(receipt), () => false);
        expect(storage.getItem(legacyKey)).toBe(JSON.stringify(request));
    });
});
