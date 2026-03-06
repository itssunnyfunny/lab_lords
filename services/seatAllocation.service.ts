import { prisma } from "@/lib/prisma";
import { StudentStatus, SeatAllocationFilters } from "@/types";

export class SeatAllocationService {
    /**
     * Assign a seat to a student for a specific shift.
     * STRICT Validation Rules:
     * 1. Student must be ACTIVE.
     * 2. Seat, Student, Shift must belong to the same branch.
     * 3. One seat can have only ONE active allocation per shift.
     */
    /**
     * Assign a seat to a student for a specific shift.
     * STRICT Validation Rules:
     * 1. User must OWN the branch (via seat).
     * 2. Student must be ACTIVE.
     * 3. Seat, Student, Shift must belong to the same branch.
     * 4. One seat can have only ONE active allocation per shift.
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

            // 5. Validate Seat Conflicts (Reserved vs Timed)
            // Fetch all active allocations for this seat to check for conflicts
            const seatAllocations = await tx.seatAllocation.findMany({
                where: { seatId, endDate: null },
                include: { shift: true },
            });

            // Rule: If target shift is RESERVED, seat must be completely empty
            if (shift.isReserved) {
                if (seatAllocations.length > 0) {
                    throw new Error("Cannot allocate RESERVED shift. Seat is already assigned in other shifts.");
                }
            } else {
                // Rule: If target shift is TIMED, seat must not be RESERVED
                const hasReservedAllocation = seatAllocations.some(a => a.shift.isReserved);
                if (hasReservedAllocation) {
                    throw new Error("Cannot allocate in this shift. Seat is explicitly RESERVED.");
                }

                // Rule: Seat cannot be allocated twice in the SAME shift
                const sameShiftAllocation = seatAllocations.find(a => a.shiftId === shiftId);
                if (sameShiftAllocation) {
                    throw new Error("Seat is already assigned in this shift");
                }
            }

            // 6. Validate Student Conflicts (One seat per shift)
            const studentAllocations = await tx.seatAllocation.findFirst({
                where: {
                    studentId,
                    shiftId,
                    endDate: null,
                },
            });

            if (studentAllocations) {
                throw new Error("Student already has a seat in this shift.");
            }

            // 7. Create Allocation
            const allocation = await tx.seatAllocation.create({
                data: {
                    seatId,
                    studentId,
                    shiftId,
                },
            });
            // 8. Update Branch lastDataChange
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
