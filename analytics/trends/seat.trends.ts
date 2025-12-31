// analytics/trends/seat.trends.ts

import { getSeatUtilization } from "../seat.analytics"

export async function getSeatUtilizationTrend(
  branchId: string,
  from: Date,
  to: Date
) {
  const points: {
    asOf: Date
    utilizationRatio: number
  }[] = []

  let cursor = new Date(from)

  while (cursor <= to) {
    const snapshot = await getSeatUtilization(branchId, cursor)

    points.push({
      asOf: new Date(cursor),
      utilizationRatio: snapshot.utilizationRatio,
    })

    cursor.setDate(cursor.getDate() + 1)
  }

  return points
}
