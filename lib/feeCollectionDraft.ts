import { collectionInputSchema, type CollectionInput, type FeeCollectionView } from "@/lib/feeCollections";

export function collectionDraftKey(account: string, branchId: string, studentId: string) {
    return ["fee-collection", "v2", ...[account, branchId, studentId].map(encodeURIComponent)].join(":");
}

type RestoredCollection =
    | { kind: "empty" | "review" }
    | { kind: "pending"; request: CollectionInput }
    | { kind: "receipt"; receipt: FeeCollectionView };

/** Unscoped requests from older tabs have no actor evidence. Only the server can recover their receipt. */
export async function restoreCollectionDraft(
    storage: Pick<Storage, "getItem" | "removeItem">, account: string, branchId: string, studentId: string,
    recover: (branchId: string, key: string) => Promise<FeeCollectionView | null>,
    isCurrent: () => boolean = () => true,
): Promise<RestoredCollection> {
    const scoped = storage.getItem(collectionDraftKey(account, branchId, studentId));
    const legacyKey = `fee-collection:${branchId}:${studentId}`;
    const raw = scoped ?? storage.getItem(legacyKey);
    if (raw === null) return { kind: "empty" };
    let input: unknown;
    try { input = JSON.parse(raw); } catch { return { kind: "review" }; }
    const parsed = collectionInputSchema.safeParse(input);
    if (!parsed.success || parsed.data.studentId !== studentId) return { kind: "review" };
    if (scoped !== null) return { kind: "pending", request: parsed.data };
    const receipt = await recover(branchId, parsed.data.idempotencyKey);
    if (!receipt || receipt.snapshot?.studentId !== studentId) return { kind: "review" };
    if (isCurrent() && storage.getItem(legacyKey) === raw) storage.removeItem(legacyKey);
    return { kind: "receipt", receipt };
}
