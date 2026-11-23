import { remainingFee } from "@/lib/feeBalance";
// analytics/payment.analytics.ts

import { prisma } from "@/lib/prisma"
import {
  daysPastDue,
  dueAsOfCutoff,
  overdueCutoff,
  type PaymentOverduePolicy,
} from "@/lib/utils/paymentStatus"
import { readBranchPaymentOverduePolicy } from "@/services/paymentOverduePolicy"
import {
  type DateIdCursor,
  pageFromRows,
  PaginationInputError,
  parsePageLimit,
} from "@/lib/cursorPagination"
import type { Prisma } from "@/app/generated/prisma/client"
import { dashboardDateOffset, dashboardDayStart, dashboardMonth, dashboardRate, dashboardToday } from "@/lib/dashboardMath"

type AsOf = Date | undefined
export type AnalyticsPeriod = "month" | "all"

function resolveAsOf(asOf?: Date): Date {
  return asOf ?? new Date()
}

function resolvePeriod(period?: AnalyticsPeriod): AnalyticsPeriod {
  return period === "month" ? "month" : "all"
}

function readOpenPaymentRows(branchId: string, dueDateEnd: Date) {
  return prisma.payment.findMany({
    where: {
      branchId,
      status: "DUE",
      amount: { gt: 0 },
      dueDate: { lte: dueDateEnd },
    },
    select: {
      id: true,
      studentId: true,
      amount: true, collectedAmount: true, waivedAmount: true,
      dueDate: true,
      type: true,
      student: {
        select: {
          id: true,
          name: true,
          phone: true,
        },
      },
    },
    orderBy: [
      { dueDate: "asc" },
      { id: "asc" },
    ],
  })
}

export async function getOpenPaymentLedger(
  branchId: string,
  asOf?: AsOf,
  dueDateEnd?: Date,
  paymentPolicy?: PaymentOverduePolicy,
) {
  const date = resolveAsOf(asOf)
  const policy = paymentPolicy ?? await readBranchPaymentOverduePolicy(branchId)
  const overdueBefore = overdueCutoff(policy, date)
  const rows = await readOpenPaymentRows(branchId, dueDateEnd ?? dueAsOfCutoff(date, policy.timezone))
  const duePayments = rows.map((payment) => {
    const paymentDaysPastDue = daysPastDue(payment.dueDate, date, policy.timezone)
    const amount = remainingFee(payment)

    return {
      paymentId: payment.id,
      studentId: payment.studentId,
      studentName: payment.student.name,
      phone: payment.student.phone,
      dueDate: payment.dueDate,
      amount,
      type: payment.type,
      daysPastDue: paymentDaysPastDue,
      daysOverdue: paymentDaysPastDue,
      isOverdue: payment.dueDate < overdueBefore,
    }
  })
  const overduePayments = duePayments.filter((payment) => payment.isOverdue)

  return {
    asOf: date,
    dueCount: duePayments.length,
    dueAmount: duePayments.reduce((sum, payment) => sum + payment.amount, 0),
    overdueCount: overduePayments.length,
    overdueAmount: overduePayments.reduce((sum, payment) => sum + payment.amount, 0),
    duePayments,
    overduePayments,
  }
}

/**
 * Period-aware finance metrics for analytics UI.
 *
 * Revenue/collected respect the selected period. Due is intentionally all
 * unpaid due up to the as-of day so old dues stay visible in every view.
 * Monthly summaries include the whole month; daily trend points opt into a
 * month-to-date cutoff so later receipts do not appear on earlier days.
 */
export async function getPaymentPeriodStats(
  branchId: string,
  asOf?: AsOf,
  period?: AnalyticsPeriod,
  options: { throughAsOfDay?: boolean; timezone?: string } = {}
) {
  const date = resolveAsOf(asOf)
  const selectedPeriod = resolvePeriod(period)
  const timezone = options.timezone ?? "Asia/Kolkata"
  const today = dashboardToday(date, timezone)
  const nextDay = dashboardDayStart(dashboardDateOffset(today, 1), timezone)
  const month = selectedPeriod === "month" ? dashboardMonth(today.slice(0, 7), timezone) : null
  const range = { gte: month?.start, lt: month && !options.throughAsOfDay ? month.end : nextDay }

  const [fees, collectedAgg, actual, openRows] = await Promise.all([
    prisma.payment.groupBy({
      by: ["ledgerBacked", "status"],
      where: { branchId, dueDate: range },
      _sum: { amount: true, waivedAmount: true, collectedAmount: true },
    }),
    prisma.payment.aggregate({
      where: {
        branchId,
        status: "PAID", ledgerBacked: false,
        resolutionEvents: { none: { source: "IMPORT_EXECUTION" } },
        paidAt: range,
      },
      _sum: { amount: true },
    }),
    prisma.feeCollection.aggregate({ where: { branchId, voidedAt: null, collectedAt: range }, _sum: { amount: true } }),
    readOpenPaymentRows(branchId, new Date(nextDay.getTime() - 1)),
  ])

  let billed = 0, waived = 0, settled = 0
  for (const fee of fees) {
    const amount = fee._sum.amount ?? 0
    billed += amount
    waived += fee.ledgerBacked ? fee._sum.waivedAmount ?? 0 : fee.status === "WAIVED" ? amount : 0
    settled += fee.ledgerBacked ? fee._sum.collectedAmount ?? 0 : fee.status === "PAID" ? amount : 0
  }
  const paidAmount = (collectedAgg._sum.amount ?? 0) + (actual._sum.amount ?? 0)
  const dueAmount = openRows.reduce((total, payment) => total + remainingFee(payment), 0)

  return {
    period: selectedPeriod,
    revenueAmount: billed - waived,
    paidAmount,
    dueAmount,
    collectionRate: dashboardRate(settled, billed, waived),
  }
}

/**
 * Snapshot of payment state for a branch.
 */
export async function getPaymentStats(
  branchId: string,
  asOf?: AsOf,
  paymentPolicy?: PaymentOverduePolicy,
) {
  const date = resolveAsOf(asOf)
  const policy = paymentPolicy ?? await readBranchPaymentOverduePolicy(branchId)
  const dateEnd = dueAsOfCutoff(date, policy.timezone)

  // ⚡ Bolt: Replaced memory-heavy findMany + reduce with database-level aggregate and count
  // Impact: Reduces memory overhead from O(N) to O(1) and eliminates payload transfer for thousands of payment records.
  const [openLedger, paidAgg] = await Promise.all([
    getOpenPaymentLedger(branchId, date, dateEnd, policy),
    prisma.payment.aggregate({
      where: {
        branchId,
        status: "PAID", ledgerBacked: false,
        resolutionEvents: { none: { source: "IMPORT_EXECUTION" } },
        OR: [
          { paidAt: { lte: dateEnd } },

        ],
      },
      _sum: { amount: true },
      _count: { _all: true },
    }),
  ])

  const actual = await prisma.feeCollection.aggregate({ where: { branchId, voidedAt: null, collectedAt: { lte: dateEnd } }, _sum: { amount: true } })
  const paidAmount = (paidAgg._sum.amount ?? 0) + (actual._sum.amount ?? 0)
  // A historical PAID status can count as a resolved fee without inventing income or its date.
  const paidFeeCount = await prisma.payment.count({ where: { branchId, status: "PAID", OR: [
    { paidAt: { lte: dateEnd } }, { paidAt: null, dueDate: { lte: dateEnd } },
  ] } })

  return {
    dueCount: openLedger.dueCount,
    paidCount: paidFeeCount,
    overdueCount: openLedger.overdueCount,
    dueAmount: openLedger.dueAmount,
    paidAmount,
    overdueAmount: openLedger.overdueAmount,
  }
}

/**
 * List of students who are due as of a date.
 * Structured for AI and UI.
 */
export async function getDueStudents(
  branchId: string,
  asOf?: AsOf
) {
  const ledger = await getOpenPaymentLedger(branchId, asOf)

  return ledger.duePayments.map((payment) => ({
    studentId: payment.studentId,
    dueDate: payment.dueDate,
    amount: remainingFee(payment),
    daysOverdue: payment.daysPastDue,
    isOverdue: payment.isOverdue,
  }))
}

/**
 * Detailed list of overdue payments for manual follow-up.
 */
export async function getOverduePayments(
  branchId: string,
  asOf?: AsOf,
  client: PaymentAnalyticsClient = prisma,
  policy?: PaymentOverduePolicy,
) {
  const page = await getOverduePaymentsPage(branchId, { asOf, all: true }, client, policy)

  return {
    count: page.total,
    payments: page.items,
  }
}

export type OverduePaymentPageOptions = {
  asOf?: AsOf
  cursor?: DateIdCursor | null
  limit?: number
  all?: boolean
}
type PaymentAnalyticsClient = Pick<Prisma.TransactionClient, "payment" | "branch">

/**
 * Stable, bounded overdue queue for browser/API consumers.
 * Analytics and AI callers use getOverduePayments(), which explicitly requests
 * the complete queue so aggregate counts and generated drafts are never clipped.
 */
export async function getOverduePaymentsPage(
  branchId: string,
  options: OverduePaymentPageOptions = {},
  client: PaymentAnalyticsClient = prisma,
  paymentPolicy?: PaymentOverduePolicy,
) {
  if (options.all && options.cursor) {
    throw new PaginationInputError("all cannot be combined with cursor")
  }

  const date = resolveAsOf(options.asOf)
  const policy = paymentPolicy ?? await readBranchPaymentOverduePolicy(branchId, client)
  const limit = parsePageLimit(
    options.limit == null ? undefined : String(options.limit)
  )
  const baseWhere: Prisma.PaymentWhereInput = {
    branchId,
    status: "DUE",
    amount: { gt: 0 },
    dueDate: { lt: overdueCutoff(policy, date) },
  }
  const cursor = options.cursor ?? null
  const where: Prisma.PaymentWhereInput = cursor
    ? {
        ...baseWhere,
        OR: [
          { dueDate: { gt: cursor.sort } },
          { dueDate: cursor.sort, id: { gt: cursor.id } },
        ],
      }
    : baseWhere

  const [rows, total] = await Promise.all([
    client.payment.findMany({
      where,
      select: {
        id: true,
        studentId: true,
        dueDate: true,
        amount: true, collectedAmount: true, waivedAmount: true,
        student: {
          select: {
            name: true,
            phone: true,
          },
        },
      },
      orderBy: [
        { dueDate: "asc" },
        { id: "asc" },
      ],
      ...(options.all ? {} : { take: limit + 1 }),
    }),
    client.payment.count({ where: baseWhere }),
  ])

  const page = options.all
    ? { items: rows, nextCursor: null, total }
    : pageFromRows(rows, limit, total, row => ({ sort: row.dueDate, id: row.id }))

  return {
    ...page,
    items: page.items.map(payment => ({
      paymentId: payment.id,
      studentId: payment.studentId,
      studentName: payment.student.name,
      phone: payment.student.phone,
      dueDate: payment.dueDate,
      amount: remainingFee(payment),
      daysOverdue: daysPastDue(payment.dueDate, date, policy.timezone),
    })),
  }
}

/**
 * AI-ready snapshot including summary and buckets.
 */
export async function getPaymentSnapshot(
  branchId: string,
  asOf?: AsOf
) {
  const date = resolveAsOf(asOf)
  const policy = await readBranchPaymentOverduePolicy(branchId)
  const [stats, ledger] = await Promise.all([
    getPaymentStats(branchId, date, policy),
    getOpenPaymentLedger(branchId, date, undefined, policy)
  ])

  const buckets = new Map<number, number>()
  for (const payment of ledger.overduePayments) {
    const days = payment.daysOverdue
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
