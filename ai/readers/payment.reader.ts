// ai/readers/payment.reader.ts

import { getPaymentSnapshot } from "@/analytics/payment.analytics"
import { AIPaymentSnapshot } from "@/ai/contracts/payment.contract"

export async function readPaymentSnapshotForAI(
    branchId: string,
    asOf: Date = new Date()
): Promise<AIPaymentSnapshot> {
    const snapshot = await getPaymentSnapshot(branchId, asOf)

    return {
        branchId: snapshot.branchId,
        summary: snapshot.summary,
        overdueBuckets: snapshot.overdueBuckets,
        asOf: snapshot.asOf,
    }
}
