import { prisma } from "@/lib/prisma";

/** Converts "HH:MM" to integer minutes since midnight. */
function parseTime(time: string): number {
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m;
}

function timesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
    return aStart < bEnd && aEnd > bStart;
}

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
     * A seat is marked occupied if it has an active allocation in the requested
     * shift OR in ANY shift whose time window overlaps with the requested shift
     * (e.g. a Full Time allocation makes the seat appear occupied in Morning).
     */
    static async getSeatMap(userId: string, branchId: string, shiftId: string) {
        await this.assertBranchOwnership(userId, branchId);

        const shift = await prisma.shift.findUnique({ where: { id: shiftId } });
        if (!shift || shift.branchId !== branchId) throw new Error("Shift not found");

        // Determine the time window of the requested shift
        const requestedStart = shift.startTime ? parseTime(shift.startTime) : null;
        const requestedEnd = shift.endTime ? parseTime(shift.endTime) : null;

        // Load all ACTIVE shifts in this branch (to do overlap comparisons)
        const allShifts = await prisma.shift.findMany({
            where: { branchId, status: "ACTIVE" },
            select: { id: true, startTime: true, endTime: true },
        });
        const shiftTimeMap = new Map(allShifts.map(s => [s.id, s]));

        const seats = await prisma.seat.findMany({
            where: { branchId },
            include: {
                seatAllocations: {
                    where: { endDate: null },
                    include: { student: { select: { name: true } }, shift: { select: { startTime: true, endTime: true } } },
                },
            },
            orderBy: { label: "asc" },
        });

        const totalSeats = seats.length;
        let occupiedCount = 0;

        const mappedSeats = seats.map(s => {
            // Find any active allocation that conflicts with the requested shift's time window
            let occupiedBy: string | null = null;

            for (const alloc of s.seatAllocations) {
                // Exact shift match — always occupied
                if (alloc.shiftId === shiftId) {
                    occupiedBy = alloc.student.name;
                    break;
                }

                // Time-overlap match (e.g. Full Time blocks Morning)
                if (requestedStart !== null && requestedEnd !== null) {
                    const existingShift = shiftTimeMap.get(alloc.shiftId);
                    if (existingShift?.startTime && existingShift?.endTime) {
                        const es = parseTime(existingShift.startTime);
                        const ee = parseTime(existingShift.endTime);
                        if (timesOverlap(requestedStart, requestedEnd, es, ee)) {
                            occupiedBy = alloc.student.name;
                            break;
                        }
                    }
                }
            }

            if (occupiedBy) occupiedCount++;

            return {
                seatId: s.id,
                label: s.label,
                occupied: occupiedBy !== null,
                occupiedBy,
            };
        });

        return {
            shiftId: shift.id,
            shiftName: shift.name,
            isReserved: shift.isReserved,
            totalSeats,
            occupiedCount,
            availableCount: totalSeats - occupiedCount,
            seats: mappedSeats,
        };
    }

    /**
     * Returns all active shifts with current capacity counts.
     * If studentId is provided, marks a shift as studentAlreadyAllocated when
     * the student has any active allocation that time-overlaps with that shift.
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

        // Load student's current allocations with their shift times
        type AllocWithTime = { shiftId: string; startTime: string | null; endTime: string | null };
        const studentAllocations: AllocWithTime[] = [];
        if (studentId) {
            const rawAllocations = await prisma.seatAllocation.findMany({
                where: { studentId, endDate: null },
                include: { shift: { select: { id: true, startTime: true, endTime: true } } },
            });
            for (const a of rawAllocations) {
                studentAllocations.push({
                    shiftId: a.shiftId,
                    startTime: a.shift.startTime,
                    endTime: a.shift.endTime,
                });
            }
        }

        return shifts.map(shift => {
            const used = shift._count.seatAllocations;
            const available = Math.max(0, totalSeats - used);
            const occupancyPercent = totalSeats === 0 ? 0 : (used / totalSeats) * 100;

            // Check if student is already allocated in this shift or any overlapping shift
            let studentAlreadyAllocated = false;
            if (studentId && studentAllocations.length > 0) {
                const shiftStart = shift.startTime ? parseTime(shift.startTime) : null;
                const shiftEnd = shift.endTime ? parseTime(shift.endTime) : null;

                for (const alloc of studentAllocations) {
                    if (alloc.shiftId === shift.id) {
                        studentAlreadyAllocated = true;
                        break;
                    }
                    if (shiftStart !== null && shiftEnd !== null && alloc.startTime && alloc.endTime) {
                        if (timesOverlap(shiftStart, shiftEnd, parseTime(alloc.startTime), parseTime(alloc.endTime))) {
                            studentAlreadyAllocated = true;
                            break;
                        }
                    }
                }
            }

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
                studentAlreadyAllocated,
            };
        });
    }
}
