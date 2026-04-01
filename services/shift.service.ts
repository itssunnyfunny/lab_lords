
import { prisma } from "@/lib/prisma";
import { CreateShiftDto } from "@/types";
import { parseNullableTime, parseTime, timesOverlap } from "@/utils/shiftTime";

export const DEFAULT_SHIFTS = [
    { name: "Morning", startTime: "06:00", endTime: "11:59", price: 0, isReserved: false },
    { name: "Afternoon", startTime: "12:00", endTime: "16:59", price: 0, isReserved: false },
    { name: "Evening", startTime: "17:00", endTime: "22:00", price: 0, isReserved: false },
];

// ─── Resolution Plan Types ─────────────────────────────────────────────────────

export type ResolutionPlan =
    | { type: "END_ALL" }
    | { type: "REALLOCATE_BULK"; targetShiftId: string }
    | { type: "REALLOCATE_MANUAL"; assignments: { allocationId: string; targetShiftId: string }[] };

export interface ShiftImpactAnalysis {
    studentsInShift: number;
    allocations: { allocationId: string; studentId: string; studentName: string; seatLabel: string }[];
    otherShifts: { shiftId: string; name: string; totalSeats: number; activeAllocations: number; emptySeats: number }[];
    totalEmptyElsewhere: number;
    shiftsWithEnoughCapacity: string[];
    willOverflowBy: number;
    isLastActiveShift: boolean;
}

export class ShiftService {
    private static async assertBranchOwnership(userId: string, branchId: string) {
        const branch = await prisma.branch.findUnique({
            where: { id: branchId },
            include: { organization: true },
        });
        if (!branch) throw new Error("Branch not found");
        if (branch.organization.ownerId !== userId) throw new Error("Unauthorized: User does not own this branch");
        return branch;
    }

    /**
     * Validates that the given time window does not overlap with any existing
     * ACTIVE shift in the branch. Throws a descriptive error if a conflict is found.
     * @param excludeShiftId - skip this shift ID when checking (used for updates)
     */
    private static async checkTimeOverlap(
        branchId: string,
        startTime: string | null,
        endTime: string | null,
        excludeShiftId?: string
    ) {
        const newStart = parseNullableTime(startTime);
        const newEnd = parseNullableTime(endTime);

        const activeShifts = await prisma.shift.findMany({
            where: {
                branchId,
                status: "ACTIVE",
                ...(excludeShiftId ? { id: { not: excludeShiftId } } : {}),
            },
            select: { id: true, name: true, startTime: true, endTime: true },
        });

        for (const shift of activeShifts) {
            const existStart = parseNullableTime(shift.startTime);
            const existEnd = parseNullableTime(shift.endTime);
            if (timesOverlap(newStart, newEnd, existStart, existEnd)) {
                throw new Error(
                    `Shift time overlaps with an existing active shift ("${shift.name}": ${shift.startTime ?? "?"} – ${shift.endTime ?? "?"})`
                );
            }
        }
    }

    static async createShift(userId: string, branchId: string, data: CreateShiftDto) {
        await this.assertBranchOwnership(userId, branchId);

        const existingShift = await prisma.shift.findFirst({
            where: { branchId, name: data.name, status: "ACTIVE" },
        });
        if (existingShift) throw new Error(`Shift with name "${data.name}" already exists in this branch.`);

        // Always check overlap, even for null times (null = full day, overlaps everything)
        await this.checkTimeOverlap(branchId, data.startTime ?? null, data.endTime ?? null);

        return prisma.shift.create({
            data: {
                branchId,
                name: data.name,
                startTime: data.startTime,
                endTime: data.endTime,
                price: data.price ?? 0,
                isReserved: data.isReserved ?? false,
            },
        });
    }

    static async updateShift(
        userId: string,
        shiftId: string,
        data: Partial<{ name: string; startTime: string | null; endTime: string | null; price: number; isReserved: boolean }>
    ) {
        const shift = await prisma.shift.findUnique({ where: { id: shiftId } });
        if (!shift) throw new Error("Shift not found");
        await this.assertBranchOwnership(userId, shift.branchId);

        if (data.name && data.name !== shift.name) {
            const duplicate = await prisma.shift.findFirst({
                where: { branchId: shift.branchId, name: data.name, status: "ACTIVE", id: { not: shiftId } },
            });
            if (duplicate) throw new Error(`Shift with name "${data.name}" already exists in this branch.`);
        }

        const newStart = data.startTime !== undefined ? data.startTime : shift.startTime;
        const newEnd = data.endTime !== undefined ? data.endTime : shift.endTime;
        // Always check overlap
        await this.checkTimeOverlap(shift.branchId, newStart ?? null, newEnd ?? null, shiftId);

        return prisma.shift.update({
            where: { id: shiftId },
            data: {
                ...(data.name !== undefined ? { name: data.name } : {}),
                ...(data.startTime !== undefined ? { startTime: data.startTime } : {}),
                ...(data.endTime !== undefined ? { endTime: data.endTime } : {}),
                ...(data.price !== undefined ? { price: data.price } : {}),
                ...(data.isReserved !== undefined ? { isReserved: data.isReserved } : {}),
            },
        });
    }

    // ─── Analyze shift deletion impact (read-only) ────────────────────────────

    static async analyzeShiftDeletion(userId: string, shiftId: string): Promise<ShiftImpactAnalysis> {
        const shift = await prisma.shift.findUnique({ where: { id: shiftId } });
        if (!shift) throw new Error("Shift not found");
        await this.assertBranchOwnership(userId, shift.branchId);

        const branchId = shift.branchId;

        const activeShiftCount = await prisma.shift.count({
            where: { branchId, status: "ACTIVE" },
        });
        const isLastActiveShift = activeShiftCount <= 1;

        const rawAllocations = await prisma.seatAllocation.findMany({
            where: { shiftId, endDate: null },
            include: {
                student: { select: { id: true, name: true } },
                seat: { select: { label: true } },
            },
        });

        const allocations = rawAllocations.map(a => ({
            allocationId: a.id,
            studentId: a.student.id,
            studentName: a.student.name,
            seatLabel: a.seat.label,
        }));

        const studentsInShift = allocations.length;

        const otherActiveShifts = await prisma.shift.findMany({
            where: { branchId, status: "ACTIVE", id: { not: shiftId } },
            include: {
                _count: { select: { seatAllocations: { where: { endDate: null } } } },
            },
        });

        const totalBranchSeats = await prisma.seat.count({ where: { branchId } });

        const otherShifts = otherActiveShifts.map(s => {
            const activeAllocations = s._count.seatAllocations;
            const emptySeats = Math.max(0, totalBranchSeats - activeAllocations);
            return {
                shiftId: s.id,
                name: s.name,
                totalSeats: totalBranchSeats,
                activeAllocations,
                emptySeats,
            };
        });

        const totalEmptyElsewhere = otherShifts.reduce((sum, s) => sum + s.emptySeats, 0);
        const willOverflowBy = Math.max(0, studentsInShift - totalEmptyElsewhere);
        const shiftsWithEnoughCapacity = otherShifts
            .filter(s => s.emptySeats >= studentsInShift)
            .map(s => s.shiftId);

        return {
            studentsInShift,
            allocations,
            otherShifts,
            totalEmptyElsewhere,
            shiftsWithEnoughCapacity,
            willOverflowBy,
            isLastActiveShift,
        };
    }

    // ─── Delete shift with resolution (transactional) ─────────────────────────

    static async deleteShift(userId: string, shiftId: string, resolution: ResolutionPlan) {
        const shift = await prisma.shift.findUnique({ where: { id: shiftId } });
        if (!shift) throw new Error("Shift not found");
        await this.assertBranchOwnership(userId, shift.branchId);

        const branchId = shift.branchId;

        const activeShiftCount = await prisma.shift.count({
            where: { branchId, status: "ACTIVE" },
        });
        if (activeShiftCount <= 1) {
            throw new Error("Cannot delete the last active shift in this branch.");
        }

        const now = new Date();

        if (resolution.type === "END_ALL") {
            await prisma.$transaction(async (tx) => {
                await tx.seatAllocation.updateMany({
                    where: { shiftId, endDate: null },
                    data: { endDate: now },
                });
                await tx.shift.update({
                    where: { id: shiftId },
                    data: { status: "INACTIVE", deletedAt: now },
                });
            });
            return { success: true };
        }

        if (resolution.type === "REALLOCATE_BULK") {
            const { targetShiftId } = resolution;

            await prisma.$transaction(async (tx) => {
                // Validate target shift
                const target = await tx.shift.findUnique({ where: { id: targetShiftId } });
                if (!target || target.status !== "ACTIVE") throw new Error("Target shift not found or inactive.");
                if (target.id === shiftId) throw new Error("Target shift cannot be the same shift.");

                // Validate capacity
                const totalSeats = await tx.seat.count({ where: { branchId } });
                const targetActive = await tx.seatAllocation.count({
                    where: { shiftId: targetShiftId, endDate: null },
                });
                const sourceAllocations = await tx.seatAllocation.findMany({
                    where: { shiftId, endDate: null },
                    include: { seat: true, student: true },
                });

                if (targetActive + sourceAllocations.length > totalSeats) {
                    throw new Error("Target shift does not have enough capacity for all students.");
                }

                // Load all branch shifts for overlap comparison
                const allShifts = await tx.shift.findMany({
                    where: { branchId, status: "ACTIVE" },
                    select: { id: true, startTime: true, endTime: true },
                });
                const shiftMap = new Map(allShifts.map(s => [s.id, s]));

                const targetShiftData = shiftMap.get(targetShiftId);
                const targetStart = parseNullableTime(targetShiftData?.startTime);
                const targetEnd = parseNullableTime(targetShiftData?.endTime);

                for (const oldAlloc of sourceAllocations) {
                    // Check: student not already in target or any time-overlapping shift
                    const studentActiveAllocs = await tx.seatAllocation.findMany({
                        where: { studentId: oldAlloc.studentId, endDate: null, shiftId: { not: shiftId } },
                    });
                    for (const sa of studentActiveAllocs) {
                        if (sa.shiftId === targetShiftId) {
                            throw new Error(
                                `Student "${oldAlloc.student.name}" is already allocated in the target shift.`
                            );
                        }
                        const existing = shiftMap.get(sa.shiftId);
                        if (timesOverlap(targetStart, targetEnd, parseNullableTime(existing?.startTime), parseNullableTime(existing?.endTime))) {
                            throw new Error(
                                `Student "${oldAlloc.student.name}" is already in an overlapping shift.`
                            );
                        }
                    }
                }

                // Find available seats in branchId not occupied in targetShift (or its time-overlapping shifts)
                const allTargetOverlapShiftIds = allShifts
                    .filter(s => s.id !== shiftId && timesOverlap(targetStart, targetEnd, parseNullableTime(s.startTime), parseNullableTime(s.endTime)))
                    .map(s => s.id);

                const occupiedSeatIds = (await tx.seatAllocation.findMany({
                    where: { shiftId: { in: allTargetOverlapShiftIds }, endDate: null },
                    select: { seatId: true },
                })).map(a => a.seatId);

                const availableSeats = await tx.seat.findMany({
                    where: { branchId, id: { notIn: occupiedSeatIds } },
                    orderBy: { label: "asc" },
                    take: sourceAllocations.length,
                });

                if (availableSeats.length < sourceAllocations.length) {
                    throw new Error("Not enough unoccupied seats available in target shift.");
                }

                // ⚡ Bolt: Optimizing bulk shift reassignment.
                // Impact: Changed O(n) individual updates/creates to two batch operations (updateMany and createMany).
                // Significantly reduces DB overhead and locks during reallocations.
                const oldAllocIds = sourceAllocations.map(a => a.id);
                await tx.seatAllocation.updateMany({
                    where: { id: { in: oldAllocIds } },
                    data: { endDate: now },
                });

                const newAllocations = sourceAllocations.map((oldAlloc, i) => ({
                    studentId: oldAlloc.studentId,
                    shiftId: targetShiftId,
                    seatId: availableSeats[i].id,
                    startDate: now,
                }));

                if (newAllocations.length > 0) {
                    await tx.seatAllocation.createMany({
                        data: newAllocations,
                    });
                }

                await tx.shift.update({
                    where: { id: shiftId },
                    data: { status: "INACTIVE", deletedAt: now },
                });
            });
            return { success: true };
        }

        if (resolution.type === "REALLOCATE_MANUAL") {
            const { assignments } = resolution;

            await prisma.$transaction(async (tx) => {
                const totalSeats = await tx.seat.count({ where: { branchId } });
                const allShifts = await tx.shift.findMany({
                    where: { branchId, status: "ACTIVE" },
                    select: { id: true, name: true, startTime: true, endTime: true },
                });
                const shiftMap = new Map(allShifts.map(s => [s.id, s]));

                // Group assignments by targetShiftId to validate capacity in bulk
                const targetShiftCounts = new Map<string, number>();
                for (const a of assignments) {
                    targetShiftCounts.set(a.targetShiftId, (targetShiftCounts.get(a.targetShiftId) ?? 0) + 1);
                }

                for (const [targetShiftId, incoming] of targetShiftCounts.entries()) {
                    const target = shiftMap.get(targetShiftId);
                    if (!target) throw new Error(`Target shift not found.`);
                    if (target.id === shiftId) throw new Error(`Target shift cannot be the same shift being deleted.`);

                    const currentActive = await tx.seatAllocation.count({
                        where: { shiftId: targetShiftId, endDate: null },
                    });
                    if (currentActive + incoming > totalSeats) {
                        throw new Error(`Shift "${target.name}" does not have enough capacity.`);
                    }
                }

                // Execute assignments — fetch allocation first, then create
                for (const assignment of assignments) {
                    const oldAlloc = await tx.seatAllocation.findUnique({
                        where: { id: assignment.allocationId },
                        include: { student: true },
                    });
                    if (!oldAlloc) throw new Error(`Allocation ${assignment.allocationId} not found.`);

                    const targetShiftData = shiftMap.get(assignment.targetShiftId);
                    const targetStart = parseNullableTime(targetShiftData?.startTime);
                    const targetEnd = parseNullableTime(targetShiftData?.endTime);

                    // Check student isn't already in target or overlapping shift
                    const studentActiveAllocs = await tx.seatAllocation.findMany({
                        where: { studentId: oldAlloc.studentId, endDate: null, shiftId: { not: shiftId } },
                    });
                    for (const sa of studentActiveAllocs) {
                        if (sa.shiftId === assignment.targetShiftId) {
                            throw new Error(
                                `Student "${oldAlloc.student.name}" is already in the target shift.`
                            );
                        }
                        const existing = shiftMap.get(sa.shiftId);
                        if (timesOverlap(targetStart, targetEnd, parseNullableTime(existing?.startTime), parseNullableTime(existing?.endTime))) {
                            throw new Error(
                                `Student "${oldAlloc.student.name}" is already in an overlapping shift.`
                            );
                        }
                    }

                    // Find an available seat for this specific target shift (overlap-aware)
                    const overlapShiftIds = allShifts
                        .filter(s => s.id !== shiftId && timesOverlap(targetStart, targetEnd, parseNullableTime(s.startTime), parseNullableTime(s.endTime)))
                        .map(s => s.id);

                    const occupiedSeatIds = (await tx.seatAllocation.findMany({
                        where: { shiftId: { in: overlapShiftIds }, endDate: null },
                        select: { seatId: true },
                    })).map(a => a.seatId);

                    const availableSeat = await tx.seat.findFirst({
                        where: { branchId, id: { notIn: occupiedSeatIds } },
                        orderBy: { label: "asc" },
                    });
                    if (!availableSeat) throw new Error("No available seat found in target shift.");

                    await tx.seatAllocation.update({
                        where: { id: assignment.allocationId },
                        data: { endDate: now },
                    });
                    await tx.seatAllocation.create({
                        data: {
                            studentId: oldAlloc.studentId,
                            shiftId: assignment.targetShiftId,
                            seatId: availableSeat.id,
                            startDate: now,
                        },
                    });
                }

                await tx.shift.update({
                    where: { id: shiftId },
                    data: { status: "INACTIVE", deletedAt: now },
                });
            });
            return { success: true };
        }

        throw new Error("Invalid resolution type.");
    }

    static async ensureDefaultShifts(branchId: string) {
        for (const def of DEFAULT_SHIFTS) {
            const existing = await prisma.shift.findFirst({
                where: { branchId, name: def.name, status: "ACTIVE" },
            });
            if (!existing) {
                await prisma.shift.create({
                    data: {
                        branchId,
                        name: def.name,
                        startTime: def.startTime,
                        endTime: def.endTime,
                        price: def.price,
                        isReserved: def.isReserved,
                    },
                });
            }
        }
    }

    static async listShifts(userId: string, branchId: string) {
        await this.assertBranchOwnership(userId, branchId);
        await this.ensureDefaultShifts(branchId);
        return prisma.shift.findMany({
            where: { branchId, status: "ACTIVE" },
            orderBy: { name: "asc" },
        });
    }
}
