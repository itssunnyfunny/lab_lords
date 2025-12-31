// analytics/org.analytics.ts

import { prisma } from "@/lib/prisma"
import { getBranchHealthSnapshot } from "./branch.analytics"

type AsOf = Date | undefined

function resolveAsOf(asOf?: Date): Date {
  return asOf ?? new Date()
}

/**
 * Organization-level health snapshot
 * Composes branch analytics only
 */
export async function getOrganizationHealthSnapshot(
  organizationId: string,
  asOf?: AsOf
) {
  const date = resolveAsOf(asOf)

  // Step 1: get branches
  const branches = await prisma.branch.findMany({
    where: { organizationId },
    select: { id: true, name: true },
  })

  // Step 2: get branch snapshots
  const branchSnapshots = await Promise.all(
    branches.map(async (branch) => {
      const snapshot = await getBranchHealthSnapshot(branch.id, date)
      return {
        branchId: branch.id,
        branchName: branch.name,
        snapshot,
      }
    })
  )

  // Step 3: rollups (pure math)
  let totalSeats = 0
  let occupiedSeats = 0

  let activeStudents = 0
  let inactiveStudents = 0

  let dueCount = 0
  let paidCount = 0
  let dueAmount = 0
  let paidAmount = 0

  for (const b of branchSnapshots) {
    totalSeats += b.snapshot.seats.overall.totalSeats
    occupiedSeats += b.snapshot.seats.overall.occupiedSeats

    activeStudents += b.snapshot.students.status.active
    inactiveStudents += b.snapshot.students.status.inactive

    dueCount += b.snapshot.payments.dueCount
    paidCount += b.snapshot.payments.paidCount
    dueAmount += b.snapshot.payments.dueAmount
    paidAmount += b.snapshot.payments.paidAmount
  }

  return {
    asOf: date,

    organization: {
      totalBranches: branches.length,
    },

    seats: {
      totalSeats,
      occupiedSeats,
      utilizationRatio:
        totalSeats === 0 ? 0 : occupiedSeats / totalSeats,
    },

    students: {
      active: activeStudents,
      inactive: inactiveStudents,
      total: activeStudents + inactiveStudents,
    },

    payments: {
      dueCount,
      paidCount,
      dueAmount,
      paidAmount,
    },

    branches: branchSnapshots, // AI & UI gold
  }
}
