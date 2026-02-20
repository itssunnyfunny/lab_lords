// analytics/payment.analytics.ts

import { prisma } from "@/lib/prisma"

type AsOf = Date | undefined

function resolveAsOf(asOf?: Date): Date {
  return asOf ?? new Date()
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
      OR: [
        {
          // Standard due payments logic
          dueDate: {
            lte: date,
          },
        },
        {
          // Include ANY paid payment (even if paid early before due date)
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
      type: true, // Need type for canonical overdue check
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

      // Canonical Overdue Logic: DUE + MONTHLY + dueDate < asOf (strict)
      if (p.type === "MONTHLY" && p.dueDate < date) {
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
      status: "DUE",
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
        lt: date, // Strictly less than today (overdue)
      },
      type: "MONTHLY" // Canonical rule for "Overdue" in Phase 6
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
