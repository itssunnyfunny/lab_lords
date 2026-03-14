import { prisma } from "@/lib/prisma";
import { StudentStatus, SeatAllocationFilters } from "@/types";

/** Converts "HH:MM" to integer minutes since midnight. */
function parseTime(time: string): number {
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m;
}

export class SeatAllocationService {
    /**
     * Assign a seat to a student for a specific shift.
     * STRICT Validation Rules:
     * 1. User must OWN the branch (via seat).
     * 2. Student must be ACTIVE.
     * 3. Seat, Student, Shift must belong to the same branch.
     * 4. Seat cannot be occupied in any time-overlapping shift.
     * 5. Student cannot be allocated in any time-overlapping shift.
     */
    static async assignSeat(
        userId: string,
        seatId: string,
        studentId: string,
        shiftId: string
    ) {
        return prisma.$transaction(async (tx) => {
            // 1. Fetch entities
            const seat = await tx.seat.findUnique({
                where: { id: seatId },
                include: { branch: { include: { organization: true } } }
            });
            const student = await tx.student.findUnique({ where: { id: studentId } });
            const shift = await tx.shift.findUnique({ where: { id: shiftId } });

            if (!seat) throw new Error("Seat not found");
            if (!student) throw new Error("Student not found");
            if (!shift) throw new Error("Shift not found");
            if (shift.status !== "ACTIVE") throw new Error("Cannot allocate seat in an inactive shift");

            // 2. Validate Ownership
            if (seat.branch.organization.ownerId !== userId) {
                throw new Error("Unauthorized: You do not own this seat's branch");
            }

            const branchId = seat.branchId;

            // 3. Validate "Same Branch" Rule
            if (
                student.branchId !== branchId ||
                shift.branchId !== branchId
            ) {
                throw new Error("Seat, Student, and Shift must belong to the same branch");
            }

            // 4. Validate "Student must be ACTIVE" Rule
            if (student.status !== StudentStatus.ACTIVE) {
                throw new Error("Only ACTIVE students can be assigned a seat");
            }

            // 5. Load all ACTIVE shifts in branch for time-overlap lookups
            const allBranchShifts = await tx.shift.findMany({
                where: { branchId, status: "ACTIVE" },
                select: { id: true, name: true, startTime: true, endTime: true },
            });
            const shiftTimeMap = new Map(allBranchShifts.map(s => [s.id, s]));

            const newShiftData = shiftTimeMap.get(shiftId);
            const newStart = newShiftData?.startTime ? parseTime(newShiftData.startTime) : null;
            const newEnd = newShiftData?.endTime ? parseTime(newShiftData.endTime) : null;

            function timesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number) {
                return aStart < bEnd && aEnd > bStart;
            }

            // 6. Seat conflict — block if seat occupied in exact or time-overlapping shift
            const activeSeatAllocations = await tx.seatAllocation.findMany({
                where: { seatId, endDate: null },
            });

            for (const alloc of activeSeatAllocations) {
                if (alloc.shiftId === shiftId) {
                    throw new Error("Seat is already assigned in this shift");
                }
                if (newStart !== null && newEnd !== null) {
                    const existing = shiftTimeMap.get(alloc.shiftId);
                    if (existing?.startTime && existing?.endTime) {
                        if (timesOverlap(newStart, newEnd, parseTime(existing.startTime), parseTime(existing.endTime))) {
                            throw new Error(
                                `Seat is already occupied during this time (conflict with "${existing.name}")`
                            );
                        }
                    }
                }
            }

            // 7. Student conflict — block if student allocated in exact or time-overlapping shift
            const activeStudentAllocations = await tx.seatAllocation.findMany({
                where: { studentId, endDate: null },
            });

            for (const alloc of activeStudentAllocations) {
                if (alloc.shiftId === shiftId) {
                    throw new Error("Student already has a seat in this shift.");
                }
                if (newStart !== null && newEnd !== null) {
                    const existing = shiftTimeMap.get(alloc.shiftId);
                    if (existing?.startTime && existing?.endTime) {
                        if (timesOverlap(newStart, newEnd, parseTime(existing.startTime), parseTime(existing.endTime))) {
                            throw new Error(
                                `Student is already allocated in an overlapping shift ("${existing.name}")`
                            );
                        }
                    }
                }
            }

            // 8. Create Allocation
            const allocation = await tx.seatAllocation.create({
                data: { seatId, studentId, shiftId },
            });

            // 9. Update Branch lastDataChange
            await tx.branch.update({
                where: { id: branchId },
                data: { lastDataChange: new Date() },
            });

            return allocation;
        });
    }

    /**
     * Unassign (Release) a seat.
     * Sets the endDate to now, marking it as inactive (history).
     * Does NOT delete the record.
     */
    static async unassignSeat(allocationId: string) {
        return prisma.$transaction(async (tx) => {
            const allocation = await tx.seatAllocation.findUnique({
                where: { id: allocationId },
                include: { seat: true }
            });

            if (!allocation) throw new Error("Allocation not found");

            const updatedAllocation = await tx.seatAllocation.update({
                where: { id: allocationId },
                data: {
                    endDate: new Date(),
                },
            });

            await tx.branch.update({
                where: { id: allocation.seat.branchId },
                data: { lastDataChange: new Date() }
            });

            return updatedAllocation;
        });
    }

    /**
     * List allocations for a branch with optional filters.
     */
    static async listAllocations(
        branchId: string,
        filters?: SeatAllocationFilters
    ) {
        return prisma.seatAllocation.findMany({
            where: {
                seat: { branchId }, // Ensure we strictly scope to branch via seat
                studentId: filters?.studentId,
                shiftId: filters?.shiftId,
                endDate: filters?.activeOnly ? null : undefined,
            },
            include: {
                seat: true,
                student: true,
                shift: true,
            },
            orderBy: {
                startDate: "desc",
            },
        });
    }
}
