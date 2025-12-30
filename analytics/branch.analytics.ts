// analytics/branch.analytics.ts

import { getPaymentSnapshot } from "./payment.analytics"
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
    getPaymentSnapshot(branchId, date),
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
