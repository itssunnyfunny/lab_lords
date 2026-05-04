// analytics/payment.analytics.ts

import { prisma } from "@/lib/prisma"
import { overdueCutoff } from "@/lib/utils/paymentStatus"
import { endOfMonth, startOfMonth } from "date-fns"

type AsOf = Date | undefined
export type AnalyticsPeriod = "month" | "all"

function resolveAsOf(asOf?: Date): Date {
  return asOf ?? new Date()
}

function resolvePeriod(period?: AnalyticsPeriod): AnalyticsPeriod {
  return period === "month" ? "month" : "all"
}

function dayEnd(date: Date): Date {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d
}

/**
 * Period-aware finance metrics for analytics UI.
 *
 * Revenue/collected respect the selected period. Due is intentionally all
 * unpaid due up to the as-of date so old dues stay visible in every view.
 */
export async function getPaymentPeriodStats(
  branchId: string,
  asOf?: AsOf,
  period?: AnalyticsPeriod
) {
  const date = resolveAsOf(asOf)
  const selectedPeriod = resolvePeriod(period)
  const periodStart = selectedPeriod === "month" ? startOfMonth(date) : undefined
  const periodEnd = selectedPeriod === "month" ? endOfMonth(date) : dayEnd(date)

  const [revenueRows, collectedRows, dueRows] = await Promise.all([
    prisma.payment.findMany({
      where: {
        branchId,
        status: { not: "WAIVED" },
        dueDate: selectedPeriod === "month"
          ? { gte: periodStart, lte: periodEnd }
          : { lte: periodEnd },
      },
      select: { amount: true },
    }),
    prisma.payment.findMany({
      where: {
        branchId,
        status: "PAID",
        OR: selectedPeriod === "month"
          ? [
              { paidAt: { gte: periodStart, lte: periodEnd } },
              { paidAt: null, dueDate: { gte: periodStart, lte: periodEnd } },
            ]
          : [
              { paidAt: { lte: periodEnd } },
              { paidAt: null, dueDate: { lte: periodEnd } },
            ],
      },
      select: { amount: true },
    }),
    prisma.payment.findMany({
      where: {
        branchId,
        status: "DUE",
        dueDate: { lte: dayEnd(date) },
      },
      select: { amount: true },
    }),
  ])

  const revenueAmount = revenueRows.reduce((sum, p) => sum + p.amount, 0)
  const paidAmount = collectedRows.reduce((sum, p) => sum + p.amount, 0)
  const dueAmount = dueRows.reduce((sum, p) => sum + p.amount, 0)

  return {
    period: selectedPeriod,
    revenueAmount,
    paidAmount,
    dueAmount,
    collectionRate: revenueAmount > 0 ? (paidAmount / revenueAmount) * 100 : 0,
  }
}

/**
 * Snapshot of payment state for a branch
 */
export async function getPaymentStats(
  branchId: string,
  asOf?: AsOf
) {
  const date = resolveAsOf(asOf)

  const payments = await prisma.payment.findMany({
    where: {
      branchId,
      status: { not: "WAIVED" }, // WAIVED = resolved debt, exclude from analytics
      OR: [
        {
          dueDate: {
            lte: date,
          },
        },
        {
          status: "PAID",
          paidAt: {
            lte: date
          }
        }
      ]
    },
    select: {
      status: true,
      amount: true,
      dueDate: true,
      type: true,
    },
  })

  let dueCount = 0
  let paidCount = 0
  let overdueCount = 0
  let dueAmount = 0
  let paidAmount = 0

  for (const p of payments) {
    if (p.status === "DUE") {
      dueCount++
      dueAmount += p.amount

      // Canonical Overdue Rule: DUE + MONTHLY + dueDate > 7 days ago
      if (p.type === "MONTHLY" && p.dueDate < overdueCutoff(date)) {
        overdueCount++
      }
    } else if (p.status === "PAID") {
      paidCount++
      paidAmount += p.amount
    }
  }

  return {
    dueCount,
    paidCount,
    overdueCount,
    dueAmount,
    paidAmount,
  }
}


/**
 * List of students who are due as of a date
 * Structured for AI + UI
 */
export async function getDueStudents(
  branchId: string,
  asOf?: AsOf
) {
  const date = resolveAsOf(asOf)

  const payments = await prisma.payment.findMany({
    where: {
      branchId,
      status: "DUE", // WAIVED excluded — not status "DUE" by definition
      dueDate: {
        lte: date,
      },
    },
    select: {
      studentId: true,
      dueDate: true,
      amount: true,
    },
  })

  return payments.map((p) => {
    const daysOverdue = Math.max(
      0,
      Math.floor(
        (date.getTime() - p.dueDate.getTime()) / (1000 * 60 * 60 * 24)
      )
    )

    return {
      studentId: p.studentId,
      dueDate: p.dueDate,
      amount: p.amount,
      daysOverdue,
    }
  })
}

/**
 * Detailed list of overdue payments for manual follow-up
 * Canonical Rule: status = DUE AND dueDate < today AND type = MONTHLY
 */
export async function getOverduePayments(
  branchId: string,
  asOf?: AsOf
) {
  const date = resolveAsOf(asOf)

  // 1. Get raw payments
  const payments = await prisma.payment.findMany({
    where: {
      branchId,
      status: "DUE",
      dueDate: {
        lt: overdueCutoff(date), // 7-day grace: only flag after 7 days past dueDate
      },
      type: "MONTHLY"
    },
    select: {
      id: true,
      amount: true,
      dueDate: true,
      student: {
        select: {
          id: true,
          name: true,
          phone: true
        }
      }
    },
    orderBy: {
      dueDate: 'asc' // Oldest due date first
    }
  })

  // 2. Format for UI
  return {
    count: payments.length,
    payments: payments.map(p => ({
      paymentId: p.id,
      studentId: p.student.id,
      studentName: p.student.name,
      phone: p.student.phone,
      dueDate: p.dueDate,
      amount: p.amount
    }))
  }
}

/**
 * AI-ready snapshot including summary and buckets
 */
export async function getPaymentSnapshot(
  branchId: string,
  asOf?: AsOf
) {
  const date = resolveAsOf(asOf)
  const [stats, dueStudents] = await Promise.all([
    getPaymentStats(branchId, date),
    getDueStudents(branchId, date)
  ])

  // Calculate overdue buckets
  const buckets = new Map<number, number>()
  for (const student of dueStudents) {
    const days = student.daysOverdue
    buckets.set(days, (buckets.get(days) || 0) + 1)
  }

  const overdueBuckets = Array.from(buckets.entries()).map(([days, count]) => ({
    days,
    count
  })).sort((a, b) => b.days - a.days)

  return {
    branchId,
    summary: {
      totalDue: stats.dueAmount,
      totalPaid: stats.paidAmount,
      totalOverdue: stats.overdueCount
    },
    overdueBuckets,
    asOf: date,
  }
}
