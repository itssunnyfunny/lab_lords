// analytics/seat.analytics.ts

import { SeatService } from "@/services/seat.service"

type AsOf = Date | undefined

function resolveAsOf(asOf?: Date): Date {
  return asOf ?? new Date()
}

/**
 * Overall seat-slot utilization for a branch.
 *
 * `totalSeats` and `occupiedSeats` are kept for the existing API shape, but
 * they represent total shift slots and used shift slots respectively.
 */
export async function getSeatUtilization(
  branchId: string,
  asOf?: AsOf
) {
  const snapshot = await getSeatOccupancySnapshot(branchId, asOf)

  return {
    totalSeats: snapshot.totalShiftCapacity,
    occupiedSeats: snapshot.totalUsedSlots,
    utilizationRatio: snapshot.totalOccupancyPercent / 100,
  }
}

/**
 * Seat utilization broken down by shift
 */
export async function getSeatUtilizationByShift(
  branchId: string,
  asOf?: AsOf
) {
  const snapshot = await getSeatOccupancySnapshot(branchId, asOf)
  const result: Record<
    string,
    { totalSeats: number; occupiedSeats: number; utilizationRatio: number }
  > = {}

  for (const shift of snapshot.shifts) {
    result[shift.shiftId] = {
      totalSeats: shift.capacity,
      occupiedSeats: shift.used,
      utilizationRatio: shift.occupancyPercent / 100,
    }
  }

  return result
}

export async function getSeatOccupancySnapshot(
  branchId: string,
  asOf?: AsOf
) {
  return SeatService.generateOccupancySnapshot(branchId, resolveAsOf(asOf))
}
