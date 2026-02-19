// analytics/branch.analytics.ts

import { prisma } from "@/lib/prisma"
import { getPaymentStats, getOverduePayments } from "./payment.analytics"
import {
  getSeatUtilization,
  getSeatUtilizationByShift,
} from "./seat.analytics"
import {
  getStudentStatusSnapshot,
  getStudentSeatingSnapshot,
} from "./student.analytics"

type AsOf = Date | undefined

function resolveAsOf(asOf?: Date): Date {
  return asOf ?? new Date()
}

/**
 * Aggregated, snapshot-first view of branch health
 * Read-only, deterministic, AI-friendly
 */
export async function getBranchHealthSnapshot(
  branchId: string,
  asOf?: AsOf
) {
  const date = resolveAsOf(asOf)

  const [
    payment,
    seatOverall,
    seatByShift,
    studentStatus,
    studentSeating,
  ] = await Promise.all([
    getPaymentStats(branchId, date),
    getSeatUtilization(branchId, date),
    getSeatUtilizationByShift(branchId, date),
    getStudentStatusSnapshot(branchId, date),
    getStudentSeatingSnapshot(branchId, date),
  ])

  return {
    asOf: date,

    seats: {
      overall: seatOverall,
      byShift: seatByShift,
    },

    students: {
      status: studentStatus,
      seating: studentSeating,
    },

    payments: payment,
  }
}

/**
 * AI-ready snapshot for branch
 * Flattens structure and includes metadata
 */
export async function getBranchSnapshot(
  branchId: string,
  asOf?: AsOf
) {
  const date = resolveAsOf(asOf)

  const [branch, health, overdueList] = await Promise.all([
    prisma.branch.findUnique({
      where: { id: branchId },
      select: { name: true }
    }),
    getBranchHealthSnapshot(branchId, date),
    getOverduePayments(branchId, date)
  ])

  return {
    branchId,
    branchName: branch?.name ?? "Unknown",

    seats: {
      total: health.seats.overall.totalSeats,
      occupied: health.seats.overall.occupiedSeats,
      available: health.seats.overall.totalSeats - health.seats.overall.occupiedSeats,
      utilizationPercent: health.seats.overall.utilizationRatio * 100,
    },

    students: {
      total: health.students.status.active + health.students.status.inactive,
      active: health.students.status.active,
      inactive: health.students.status.inactive,
    },

    payments: {
      dueCount: health.payments.dueCount,
      paidCount: health.payments.paidCount,
      overdueCount: health.payments.overdueCount,
      overduePayments: overdueList.payments.map(p => ({
        studentId: p.studentId,
        amount: p.amount,
        dueDate: p.dueDate
      }))
    },

    asOf: date,
  }
}
