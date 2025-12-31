// analytics/trends/branch.trends.ts

import { getBranchHealthSnapshot } from "../branch.analytics"

export async function getBranchHealthTrend(
  branchId: string,
  from: Date,
  to: Date
) {
  const points: {
    asOf: Date
    snapshot: Awaited<ReturnType<typeof getBranchHealthSnapshot>>
  }[] = []

  let cursor = new Date(from)

  while (cursor <= to) {
    const snapshot = await getBranchHealthSnapshot(branchId, cursor)

    points.push({
      asOf: new Date(cursor),
      snapshot,
    })

    cursor.setDate(cursor.getDate() + 1)
  }

  return points
}
