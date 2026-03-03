import { prisma } from "@/lib/prisma";

export type SeatOccupancySnapshot = {
    branchId: string
    seatCount: number
    shiftCount: number
    totalShiftCapacity: number
    totalUsedSlots: number
    totalOccupancyPercent: number
    shifts: {
        shiftId: string
        shiftName: string
        used: number
        capacity: number
        occupancyPercent: number
    }[]
    generatedAt: Date
}

export class SeatService {
    /**
     * Helper to verify that the user owns the branch via its organization.
     */
    private static async assertBranchOwnership(userId: string, branchId: string) {
        const branch = await prisma.branch.findUnique({
            where: { id: branchId },
            include: {
                organization: true,
            },
        });

        if (!branch) {
            throw new Error("Branch not found");
        }

        if (branch.organization.ownerId !== userId) {
            throw new Error("Unauthorized: User does not own this branch");
        }

        return branch;
    }

    static async createSeat(userId: string, branchId: string, label: string) {
        await this.assertBranchOwnership(userId, branchId);

        // Check if seat label already exists for this branch to avoid unique constraint error
        const existingSeat = await prisma.seat.findUnique({
            where: {
                branchId_label: {
                    branchId,
                    label,
                },
            },
        });

        if (existingSeat) {
            throw new Error(`Seat with label "${label}" already exists in this branch.`);
        }

        return prisma.seat.create({
            data: {
                branchId,
                label,
            },
        });
    }

    static async listSeats(userId: string, branchId: string, shiftId?: string) {
        await this.assertBranchOwnership(userId, branchId);

        return prisma.seat.findMany({
            where: {
                branchId,
            },
            include: {
                seatAllocations: {
                    where: {
                        endDate: null, // Only active allocations
                        ...(shiftId ? { shiftId } : {}),
                    },
                    include: {
                        student: {
                            select: { name: true },
                        },
                    },
                },
            },
            orderBy: {
                label: "asc",
            },
        });
    }

    static async generateOccupancySnapshot(branchId: string, asOf?: Date): Promise<SeatOccupancySnapshot> {
        const date = asOf ?? new Date()

        const branchInfo = await prisma.branch.findUnique({
            where: { id: branchId },
            select: {
                _count: { select: { seats: true } },
                shifts: { where: { status: "ACTIVE" }, select: { id: true, name: true } }
            }
        })

        if (!branchInfo) {
            throw new Error(`Branch ${branchId} not found`)
        }

        const seatCount = branchInfo._count.seats
        const shiftCount = branchInfo.shifts.length
        const totalShiftCapacity = seatCount * shiftCount

        const shiftBuckets: Record<string, { shiftName: string; used: number; capacity: number }> = {}
        for (const shift of branchInfo.shifts) {
            shiftBuckets[shift.id] = {
                shiftName: shift.name,
                used: 0,
                capacity: seatCount,
            }
        }

        const activeAllocations = await prisma.seatAllocation.findMany({
            where: {
                seat: { branchId },
                startDate: { lte: date },
                OR: [
                    { endDate: null },
                    { endDate: { gt: date } },
                ],
            },
            select: { shiftId: true }
        })

        for (const alloc of activeAllocations) {
            if (shiftBuckets[alloc.shiftId]) {
                shiftBuckets[alloc.shiftId].used += 1
            }
        }

        let totalUsedSlots = 0
        const shiftsResult = []

        for (const shiftId in shiftBuckets) {
            const bucket = shiftBuckets[shiftId]

            // Invariant: Per-shift used must never exceed seatCount
            if (bucket.used > bucket.capacity) {
                console.warn(`[SeatOccupancySnapshot] Shift ${shiftId} used (${bucket.used}) exceeds capacity (${bucket.capacity}). Capping to capacity.`)
                bucket.used = bucket.capacity
            }

            totalUsedSlots += bucket.used

            const occupancyPercent = bucket.capacity === 0 ? 0 : (bucket.used / bucket.capacity) * 100

            shiftsResult.push({
                shiftId,
                shiftName: bucket.shiftName,
                used: bucket.used,
                capacity: bucket.capacity,
                occupancyPercent
            })
        }

        // Invariant: totalUsedSlots must never exceed totalShiftCapacity
        if (totalUsedSlots > totalShiftCapacity) {
            console.warn(`[SeatOccupancySnapshot] totalUsedSlots (${totalUsedSlots}) exceeds totalShiftCapacity (${totalShiftCapacity}). Capping to capacity.`)
            totalUsedSlots = totalShiftCapacity
        }

        const totalOccupancyPercent = totalShiftCapacity === 0 ? 0 : (totalUsedSlots / totalShiftCapacity) * 100

        return {
            branchId,
            seatCount,
            shiftCount,
            totalShiftCapacity,
            totalUsedSlots,
            totalOccupancyPercent,
            shifts: shiftsResult,
            generatedAt: date
        }
    }

    /**
     * Returns a visual seat map for a specific shift.
     * Each seat shows whether it's occupied in that shift, and by whom.
     */
    static async getSeatMap(userId: string, branchId: string, shiftId: string) {
        await this.assertBranchOwnership(userId, branchId);

        const shift = await prisma.shift.findUnique({ where: { id: shiftId } });
        if (!shift || shift.branchId !== branchId) throw new Error("Shift not found");

        const seats = await prisma.seat.findMany({
            where: { branchId },
            include: {
                seatAllocations: {
                    where: { shiftId, endDate: null },
                    include: { student: { select: { name: true } } },
                    take: 1,
                },
            },
            orderBy: { label: "asc" },
        });

        const totalSeats = seats.length;
        const occupiedCount = seats.filter(s => s.seatAllocations.length > 0).length;

        return {
            shiftId: shift.id,
            shiftName: shift.name,
            isReserved: shift.isReserved,
            totalSeats,
            occupiedCount,
            availableCount: totalSeats - occupiedCount,
            seats: seats.map(s => ({
                seatId: s.id,
                label: s.label,
                occupied: s.seatAllocations.length > 0,
                occupiedBy: s.seatAllocations[0]?.student.name ?? null,
            })),
        };
    }

    /**
     * Returns all active shifts with current capacity counts.
     * Used by the AllocateSeatDialog shift selection step.
     */
    static async getShiftsCapacity(userId: string, branchId: string, studentId?: string) {
        await this.assertBranchOwnership(userId, branchId);

        const totalSeats = await prisma.seat.count({ where: { branchId } });

        const shifts = await prisma.shift.findMany({
            where: { branchId, status: "ACTIVE" },
            include: {
                _count: { select: { seatAllocations: { where: { endDate: null } } } },
            },
            orderBy: { name: "asc" },
        });

        // If studentId provided, find which shifts the student is already allocated in
        const studentAllocatedShiftIds = new Set<string>();
        if (studentId) {
            const studentAllocations = await prisma.seatAllocation.findMany({
                where: { studentId, endDate: null },
                select: { shiftId: true },
            });
            studentAllocations.forEach(a => studentAllocatedShiftIds.add(a.shiftId));
        }

        return shifts.map(shift => {
            const used = shift._count.seatAllocations;
            const available = Math.max(0, totalSeats - used);
            const occupancyPercent = totalSeats === 0 ? 0 : (used / totalSeats) * 100;
            return {
                shiftId: shift.id,
                name: shift.name,
                startTime: shift.startTime,
                endTime: shift.endTime,
                isReserved: shift.isReserved,
                totalSeats,
                used,
                available,
                occupancyPercent,
                isFull: available === 0,
                studentAlreadyAllocated: studentAllocatedShiftIds.has(shift.id),
            };
        });
    }
}
