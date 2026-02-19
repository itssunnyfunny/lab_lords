// ai/readers/branch.reader.ts

import { getBranchSnapshot } from "@/analytics/branch.analytics"
import { AIBranchSnapshot } from "@/ai/contracts/branch.contract"

export async function readBranchSnapshotForAI(
    branchId: string,
    asOf: Date = new Date()
): Promise<AIBranchSnapshot> {
    const snapshot = await getBranchSnapshot(branchId, asOf)

    return {
        branchId: snapshot.branchId,
        branchName: snapshot.branchName,

        seats: snapshot.seats,
        students: snapshot.students,
        payments: {
            ...snapshot.payments,
            overduePayments: snapshot.payments.overduePayments
        },

        asOf,
    }
}
