// analytics/branch.analytics.ts

import { prisma } from "@/lib/prisma"
import { overdueCutoff } from "@/lib/utils/paymentStatus"
import { PAYMENT_OVERDUE_POLICY_SELECT } from "@/services/paymentOverduePolicy"
import { getPaymentStats, getOverduePayments } from "./payment.analytics"
import { getSeatOccupancySnapshot } from "./seat.analytics"
import {
  getStudentStatusSnapshot,
  getStudentSeatingSnapshot,
} from "./student.analytics"

type AsOf = Date | undefined

function resolveAsOf(asOf?: Date): Date {
  return asOf ?? new Date()
}

/** Operational analytics are available without payment visibility. */
export async function getBranchOperationalSnapshot(
  branchId: string,
  asOf?: AsOf
) {
  const date = resolveAsOf(asOf)

  const [
    studentStatus,
    studentSeating,
    occupancySnapshot,
  ] = await Promise.all([
    getStudentStatusSnapshot(branchId, date),
    getStudentSeatingSnapshot(branchId, date),
    getSeatOccupancySnapshot(branchId, date),
  ])

  const seatOverall = {
    totalSeats: occupancySnapshot.totalShiftCapacity,
    occupiedSeats: occupancySnapshot.totalUsedSlots,
    utilizationRatio: occupancySnapshot.totalOccupancyPercent / 100,
  }
  const seatByShift = Object.fromEntries(
    occupancySnapshot.shifts.map(shift => [
      shift.shiftId,
      {
        totalSeats: shift.capacity,
        occupiedSeats: shift.used,
        utilizationRatio: shift.occupancyPercent / 100,
      },
    ])
  )

  return {
    asOf: date,

    seats: {
      overall: seatOverall,
      byShift: seatByShift,
      occupancySnapshot,
    },

    students: {
      status: studentStatus,
      seating: studentSeating,
    },
  }
}

/** Full, payment-bearing snapshot for already authorized AI/owner callers. */
export async function getBranchHealthSnapshot(
  branchId: string,
  asOf?: AsOf
) {
  const date = resolveAsOf(asOf)
  const [operational, payments] = await Promise.all([
    getBranchOperationalSnapshot(branchId, date),
    getPaymentStats(branchId, date),
  ])
  return { ...operational, payments }
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
  const branch = await prisma.branch.findUniqueOrThrow({
    where: { id: branchId },
    select: { name: true, organization: { select: PAYMENT_OVERDUE_POLICY_SELECT } },
  })
  const policy = branch.organization
  const roster = prisma.student.groupBy({ by: ["status"], where: { branchId }, _count: { _all: true } })
  const activeDebtors = prisma.student.count({ where: {
    branchId,
    status: "ACTIVE",
    payments: { some: { branchId, status: "DUE", amount: { gt: 0 }, dueDate: { lt: overdueCutoff(policy, date) } } },
  } })
  const [seats, payments, overdueList, [studentCounts, activeStudentsWithOverdueFees]] = await Promise.all([
    getSeatOccupancySnapshot(branchId, date),
    getPaymentStats(branchId, date, policy),
    getOverduePayments(branchId, date, prisma, policy),
    // Both sides of the overdue-student percentage see the same roster.
    prisma.$transaction([roster, activeDebtors], { isolationLevel: "RepeatableRead" }),
  ])
  const active = studentCounts.find(row => row.status === "ACTIVE")?._count._all ?? 0
  const inactive = studentCounts.find(row => row.status === "INACTIVE")?._count._all ?? 0

  return {
    branchId,
    branchName: branch.name,

    seats: {
      // Shift-slot based occupancy (seat count x active shifts = totalShiftCapacity)
      total: seats.totalShiftCapacity,
      occupied: seats.totalUsedSlots,
      available: seats.totalShiftCapacity - seats.totalUsedSlots,
      utilizationPercent: seats.totalOccupancyPercent,
      // Per-shift breakdown for detailed LLM context
      shiftBreakdown: seats.shifts.map(s => ({
        shiftName: s.shiftName,
        used: s.used,
        capacity: s.capacity,
        occupancyPercent: s.occupancyPercent,
      })),
    },

    students: {
      total: active + inactive,
      active,
      inactive,
    },

    payments: {
      dueCount: payments.dueCount,
      paidCount: payments.paidCount,
      overdueCount: payments.overdueCount,
      activeStudentsWithOverdueFees,
      overduePayments: overdueList.payments.map(p => ({
        studentId: p.studentId,
        amount: p.amount,
        dueDate: p.dueDate
      }))
    },

    asOf: date,
  }
}
