// analytics/org.analytics.ts

import { EntitlementService, SubscriptionEntitlementError } from "@/services/entitlement.service"
import { AnalyticsScopeChangedError } from "@/lib/organizationErrors"
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
  const scope = await EntitlementService.getOrganizationFeatureScope(organizationId, "ADVANCED_ANALYTICS")
  if (!scope.entitled) throw new SubscriptionEntitlementError("Advanced analytics requires the Standard plan.")
  const branches = scope.branches?.included ?? await prisma.branch.findMany({
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
  if (scope.branches) {
    const current = await EntitlementService.getEligibleBranchScope(organizationId, "ADVANCED_ANALYTICS")
    if (!current.included.length) throw new SubscriptionEntitlementError("Advanced analytics requires the Standard plan.")
    if (current.included.length !== branches.length
      || current.included.some((branch, index) => branches[index]?.id !== branch.id)
      || current.excluded.length !== scope.branches.excluded.length
      || current.excluded.some((branch, index) => scope.branches?.excluded[index]?.id !== branch.id)) {
      throw new AnalyticsScopeChangedError()
    }
  }

  // Step 3: rollups (pure math)
  let physicalSeats = 0
  let totalSlots = 0
  let usedSlots = 0

  let activeStudents = 0
  let inactiveStudents = 0

  let dueCount = 0
  let paidCount = 0
  let overdueCount = 0
  let dueAmount = 0
  let paidAmount = 0

  for (const b of branchSnapshots) {
    physicalSeats += b.snapshot.seats.occupancySnapshot.seatCount
    totalSlots += b.snapshot.seats.occupancySnapshot.totalShiftCapacity
    usedSlots += b.snapshot.seats.occupancySnapshot.totalUsedSlots

    activeStudents += b.snapshot.students.status.active
    inactiveStudents += b.snapshot.students.status.inactive

    dueCount += b.snapshot.payments.dueCount
    paidCount += b.snapshot.payments.paidCount
    overdueCount += b.snapshot.payments.overdueCount
    dueAmount += b.snapshot.payments.dueAmount
    paidAmount += b.snapshot.payments.paidAmount
  }

  return {
    asOf: date,

    organization: {
      totalBranches: branches.length,
      includedBranches: branches,
      excludedBranches: scope.branches?.excluded ?? [],
    },

    seats: {
      // Legacy field names retained for API compatibility; values are slots.
      totalSeats: totalSlots,
      occupiedSeats: usedSlots,
      utilizationRatio:
        totalSlots === 0 ? 0 : usedSlots / totalSlots,
      physicalSeats,
      totalSlots,
      usedSlots,
    },

    students: {
      active: activeStudents,
      inactive: inactiveStudents,
      total: activeStudents + inactiveStudents,
    },

    payments: {
      dueCount,
      paidCount,
      overdueCount,
      dueAmount,
      paidAmount,
    },

    branches: branchSnapshots, // AI & UI gold
  }
}

/**
 * AI-ready snapshot for organization
 * Flattens structure and includes metadata
 */
export async function getOrgSnapshot(
  orgId: string,
  asOf?: AsOf
) {
  const date = resolveAsOf(asOf)

  const [org, health] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: orgId },
      select: { name: true }
    }),
    getOrganizationHealthSnapshot(orgId, date)
  ])

  return {
    orgId,
    orgName: org?.name ?? "Unknown",

    includedBranches: health.organization.includedBranches,
    excludedBranches: health.organization.excludedBranches,
    branches: health.branches.map(b => ({
      branchId: b.branchId,
      branchName: b.branchName,
      seatUtilizationPercent: b.snapshot.seats.overall.utilizationRatio * 100,
      overduePayments: b.snapshot.payments.overdueCount,
    })),

    totals: {
      totalBranches: health.organization.totalBranches,
      totalStudents: health.students.total,
      totalSeats: health.seats.physicalSeats,
      totalOverduePayments: health.payments.overdueCount,
    },

    asOf: date,
  }
}
