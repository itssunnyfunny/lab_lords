import { prisma } from "@/lib/prisma";
import { StudentStatus, PaymentType, PaymentStatus } from "@/types";
import { CreateStudentDto, DueResolution } from "@/types";
import { SeatAllocationService } from "@/services/seatAllocation.service";
import { startOfDay } from "date-fns";

export class StudentService {
    /**
     * Helper to verify that the user owns the branch via its organization.
     */
    private static async verifyBranchOwnership(userId: string, branchId: string) {
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

    /**
     * Helper to verify that the user owns the student via branch -> organization.
     */
    private static async verifyStudentOwnership(userId: string, studentId: string) {
        const student = await prisma.student.findUnique({
            where: { id: studentId },
            include: {
                branch: {
                    include: {
                        organization: true,
                    },
                },
            },
        });

        if (!student) {
            throw new Error("Student not found");
        }

        if (student.branch.organization.ownerId !== userId) {
            throw new Error("Unauthorized: User does not own this student");
        }

        return student;
    }

    static async createStudent(
        userId: string,
        branchId: string,
        data: CreateStudentDto
    ) {
        const branch = await this.verifyBranchOwnership(userId, branchId);

        // Normalise shiftId (legacy singular) → shiftIds (new array)
        const shiftIds: string[] = data.shiftIds && data.shiftIds.length > 0
            ? data.shiftIds
            : data.shiftId
                ? [data.shiftId]
                : [];

        // 1. Create student + admission payment in one transaction
        const student = await prisma.$transaction(async (tx) => {
            const created = await tx.student.create({
                data: {
                    branchId,
                    name: data.name,
                    phone: data.phone,
                    status: StudentStatus.ACTIVE,
                    monthlyFee: data.monthlyFee ?? branch.defaultFee ?? 0,
                    joinedAt: new Date(),
                },
            });

            if (data.admissionFee && data.admissionFee > 0) {
                await tx.payment.create({
                    data: {
                        branchId,
                        studentId: created.id,
                        amount: data.admissionFee,
                        status: PaymentStatus.DUE,
                        type: PaymentType.ADMISSION,
                        // Normalize to midnight so it never collides with a MONTHLY
                        // payment's periodStart (which is also normalized via startOfDay)
                        dueDate:     startOfDay(created.joinedAt),
                        periodStart: startOfDay(created.joinedAt),
                        periodEnd:   startOfDay(created.joinedAt),
                    },
                });
            }

            await tx.branch.update({
                where: { id: branchId },
                data: { lastDataChange: new Date() },
            });

            return created;
        });

        // 2. If seat + shifts provided, assign via SeatAllocationService
        //    (runs its own transaction with full cross-shift conflict checks)
        if (data.seatId && shiftIds.length > 0) {
            await SeatAllocationService.assignSeatToShifts(
                userId,
                data.seatId,
                student.id,
                shiftIds
            );
        }

        return student;
    }


    static async getStudentsByBranch(
        userId: string,
        branchId: string,
        filters?: { status?: StudentStatus; shiftId?: string }
    ) {
        await this.verifyBranchOwnership(userId, branchId);

        return prisma.student.findMany({
            where: {
                branchId,
                ...(filters?.status ? { status: filters.status } : {}),
                ...(filters?.shiftId
                    ? {
                        seatAllocations: {
                            some: {
                                shiftId: filters.shiftId,
                                endDate: null,
                            },
                        },
                    }
                    : {}),
            },
            orderBy: {
                name: "asc",
            },
        });
    }

    /**
     * Updates student status.
     *
     * When INACTIVATING:
     * 1. Ends all active seat allocations (sets endDate = now)
     * 2. Resolves DUE payments based on dueResolution:
     *    - PAID  → marks as PAID with paidAt = now
     *    - WAIVED → marks as WAIVED
     *    - KEEP (default) → leaves DUE payments untouched
     *
     * When ACTIVATING: simply sets status = ACTIVE.
     */
    static async updateStudentStatus(
        userId: string,
        studentId: string,
        status: StudentStatus,
        dueResolution: DueResolution = "KEEP"
    ) {
        const verifiedStudent = await this.verifyStudentOwnership(userId, studentId);
        const now = new Date();

        return prisma.$transaction(async (tx) => {
            // 1. Update student status
            const student = await tx.student.update({
                where: { id: studentId },
                data: { status },
            });

            if (status === StudentStatus.INACTIVE) {
                // 2. End all active seat allocations
                await tx.seatAllocation.updateMany({
                    where: {
                        studentId,
                        endDate: null,
                    },
                    data: {
                        endDate: now,
                    },
                });

                // 3. Resolve DUE payments based on owner's choice
                if (dueResolution === "PAID") {
                    await tx.payment.updateMany({
                        where: {
                            studentId,
                            status: PaymentStatus.DUE,
                        },
                        data: {
                            status: PaymentStatus.PAID,
                            paidAt: now,
                        },
                    });
                } else if (dueResolution === "WAIVED") {
                    await tx.payment.updateMany({
                        where: {
                            studentId,
                            status: PaymentStatus.DUE,
                        },
                        data: {
                            status: PaymentStatus.WAIVED,
                        },
                    });
                }
                // KEEP: do nothing, DUE payments stay as-is
            }

            // 4. Update Branch lastDataChange
            await tx.branch.update({
                where: { id: verifiedStudent.branch.id },
                data: { lastDataChange: now },
            });

            return student;
        });
    }
}
