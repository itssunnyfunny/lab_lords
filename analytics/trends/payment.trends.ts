import { assertTrendRange } from "./range"
import { dashboardDateOffset, dashboardDayStart, dashboardToday } from "@/lib/dashboardMath"
// analytics/trends/payment.trends.ts

import { AnalyticsPeriod, getPaymentPeriodStats } from "../payment.analytics"

type TrendInterval = "DAY"

export async function getPaymentTrend(
  branchId: string,
  from: Date,
  to: Date,
  interval: TrendInterval = "DAY",
  period: AnalyticsPeriod = "all",
  timezone = "Asia/Kolkata"
) {
  void interval

  assertTrendRange(from, to, timezone)

  const points: {
    asOf: Date
    revenueAmount: number
    dueAmount: number
    paidAmount: number
  }[] = []

  const firstDay = dashboardToday(from, timezone)
  const lastDay = dashboardToday(to, timezone)
  for (let day = firstDay; day <= lastDay; day = dashboardDateOffset(day, 1)) {
    const cursor = dashboardDayStart(day, timezone)
    const snapshot = await getPaymentPeriodStats(branchId, cursor, period, { throughAsOfDay: true, timezone })

    points.push({
      asOf: new Date(cursor),
      revenueAmount: snapshot.revenueAmount,
      dueAmount: snapshot.dueAmount,
      paidAmount: snapshot.paidAmount,
    })

  }

  return points
}
