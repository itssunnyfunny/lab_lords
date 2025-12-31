// analytics/trends/payment.trends.ts

import { getPaymentSnapshot } from "../payment.analytics"

type TrendInterval = "DAY"

function addDays(date: Date, days: number) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

export async function getPaymentTrend(
  branchId: string,
  from: Date,
  to: Date,
  interval: TrendInterval = "DAY"
) {
  const points: {
    asOf: Date
    dueAmount: number
    paidAmount: number
  }[] = []

  let cursor = new Date(from)

  while (cursor <= to) {
    const snapshot = await getPaymentSnapshot(branchId, cursor)

    points.push({
      asOf: new Date(cursor),
      dueAmount: snapshot.dueAmount,
      paidAmount: snapshot.paidAmount,
    })

    cursor = addDays(cursor, 1)
  }

  return points
}
