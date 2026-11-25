// ai/readers/org.reader.ts

import { getOrgSnapshot } from "@/analytics/org.analytics"
import { AIOrgSnapshot } from "@/ai/contracts/org.contract"

export async function readOrgSnapshotForAI(
    orgId: string,
    asOf: Date = new Date()
): Promise<AIOrgSnapshot> {
    const snapshot = await getOrgSnapshot(orgId, asOf)

    return {
        orgId: snapshot.orgId,
        orgName: snapshot.orgName,
        includedBranches: snapshot.includedBranches,
        excludedBranches: snapshot.excludedBranches,
        branches: snapshot.branches,
        totals: snapshot.totals,
        asOf: snapshot.asOf,
    }
}
