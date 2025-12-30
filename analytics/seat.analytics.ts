// analytics/seat.analytics.ts

import { prisma } from "@/lib/prisma"

type AsOf = Date | undefined

function resolveAsOf(asOf?: Date): Date {
  return asOf ?? new Date()
}

/**
 * Overall seat utilization for a branch
 */
export async function getSeatUtilization(
  branchId: string,
  asOf?: AsOf
) {
  const date = resolveAsOf(asOf)

  const totalSeats = await prisma.seat.count({
    where: { branchId },
  })

  if (totalSeats === 0) {
    return {
      totalSeats: 0,
      occupiedSeats: 0,
      utilizationRatio: 0,
    }
  }

  // Active allocations as of date (any shift)
  const occupiedSeats = await prisma.seatAllocation.count({
    where: {
      seat: { branchId },
      startDate: { lte: date },
      OR: [
        { endDate: null },
        { endDate: { gt: date } },
      ],
    },
    //@ts-ignore  
    distinct: ["seatId"], // one seat counted once // TODO: fix type
  })

  return {
    totalSeats,
    occupiedSeats,
    utilizationRatio: occupiedSeats / totalSeats,
  }
}

/**
 * Seat utilization broken down by shift
 */
export async function getSeatUtilizationByShift(
  branchId: string,
  asOf?: AsOf
) {
  const date = resolveAsOf(asOf)

  const seatsCount = await prisma.seat.count({
    where: { branchId },
  })

  // Fetch shifts once
  const shifts = await prisma.shift.findMany({
    where: { branchId },
    select: { id: true, name: true },
  })

  // Active allocations grouped by shift
  const allocations = await prisma.seatAllocation.findMany({
    where: {
      seat: { branchId },
      startDate: { lte: date },
      OR: [
        { endDate: null },
        { endDate: { gt: date } },
      ],
    },
    select: {
      seatId: true,
      shiftId: true,
    },
  })

  // Build map: shiftId -> set(seatId)
  const byShift: Record<string, Set<string>> = {}
  for (const a of allocations) {
    if (!byShift[a.shiftId]) byShift[a.shiftId] = new Set()
    byShift[a.shiftId].add(a.seatId)
  }

  // Produce structured output
  const result: Record<
    string,
    { totalSeats: number; occupiedSeats: number; utilizationRatio: number }
  > = {}

  for (const shift of shifts) {
    const occupied = byShift[shift.id]?.size ?? 0
    result[shift.id] = {
      totalSeats: seatsCount,
      occupiedSeats: occupied,
      utilizationRatio:
        seatsCount === 0 ? 0 : occupied / seatsCount,
    }
  }

  return result
}
