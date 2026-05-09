// analytics/branch.analytics.ts

import { prisma } from "@/lib/prisma"
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
    studentStatus,
    studentSeating,
    occupancySnapshot,
  ] = await Promise.all([
    getPaymentStats(branchId, date),
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
      // Shift-slot based occupancy (seat count x active shifts = totalShiftCapacity)
      total: health.seats.occupancySnapshot.totalShiftCapacity,
      occupied: health.seats.occupancySnapshot.totalUsedSlots,
      available: health.seats.occupancySnapshot.totalShiftCapacity - health.seats.occupancySnapshot.totalUsedSlots,
      utilizationPercent: health.seats.occupancySnapshot.totalOccupancyPercent,
      // Per-shift breakdown for detailed LLM context
      shiftBreakdown: health.seats.occupancySnapshot.shifts.map(s => ({
        shiftName: s.shiftName,
        used: s.used,
        capacity: s.capacity,
        occupancyPercent: s.occupancyPercent,
      })),
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
