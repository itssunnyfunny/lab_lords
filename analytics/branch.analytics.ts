// analytics/branch.analytics.ts

import { getPaymentSnapshot } from "./payment.analytics"
// later:
// import { getSeatUtilization } from "./seat.analytics"
// import { getStudentStatusSnapshot } from "./student.analytics"

type AsOf = Date | undefined

function resolveAsOf(asOf?: Date): Date {
  return asOf ?? new Date()
}

/**
 * Snapshot of overall branch health
 * Read-only, deterministic, AI-friendly
 */
export async function getBranchHealthSnapshot(
  branchId: string,
  asOf?: AsOf
) {
  const date = resolveAsOf(asOf)

  const [
    paymentSnapshot,
    // seatSnapshot,
    // studentSnapshot,
  ] = await Promise.all([
    getPaymentSnapshot(branchId, date),
    // getSeatUtilization(branchId, date),
    // getStudentStatusSnapshot(branchId, date),
  ])

  return {
    asOf: date,

    payments: {
      dueCount: paymentSnapshot.dueCount,
      paidCount: paymentSnapshot.paidCount,
      dueAmount: paymentSnapshot.dueAmount,
      paidAmount: paymentSnapshot.paidAmount,
    },

    // seats: {
    //   utilizationRatio: seatSnapshot.utilizationRatio,
    // },

    // students: {
    //   active: studentSnapshot.active,
    //   inactive: studentSnapshot.inactive,
    // },
  }
}
