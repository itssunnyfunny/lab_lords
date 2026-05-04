import { prisma } from "@/lib/prisma";
import { StudentStatus, PaymentType, PaymentStatus } from "@/types";
import { CreateStudentDto, DueResolution, UpdateStudentProfileDto } from "@/types";
import { SeatAllocationService } from "@/services/seatAllocation.service";
import { startOfDay } from "date-fns";
import { Prisma } from "@prisma/client";

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

    private static async resolveMonthlyFeeData(
        tx: Prisma.TransactionClient,
        branchId: string,
        data: {
            monthlyFee?: number;
            feeLinkedShiftId?: string | null;
            feeLinkedMultiShiftId?: string | null;
        },
        fallbackMonthlyFee: number
    ) {
        const feeLinkedShiftId = data.feeLinkedShiftId ?? null;
        const feeLinkedMultiShiftId = data.feeLinkedMultiShiftId ?? null;

        if (feeLinkedShiftId && feeLinkedMultiShiftId) {
            throw new Error("Fee can be linked to either a shift or a multi-shift, not both.");
        }

        if (feeLinkedShiftId) {
            const shift = await tx.shift.findUnique({
                where: { id: feeLinkedShiftId },
                select: { branchId: true, price: true, status: true },
            });
            if (!shift || shift.branchId !== branchId || shift.status !== "ACTIVE") {
                throw new Error("Linked shift not found in this branch.");
            }

            return {
                monthlyFee: shift.price,
                feeLinkedShiftId,
                feeLinkedMultiShiftId: null,
            };
        }

        if (feeLinkedMultiShiftId) {
            const multiShift = await tx.multiShift.findUnique({
                where: { id: feeLinkedMultiShiftId },
                select: { branchId: true, price: true },
            });
            if (!multiShift || multiShift.branchId !== branchId) {
                throw new Error("Linked multi-shift not found in this branch.");
            }

            return {
                monthlyFee: multiShift.price,
                feeLinkedShiftId: null,
                feeLinkedMultiShiftId,
            };
        }

        return {
            monthlyFee: data.monthlyFee ?? fallbackMonthlyFee,
            feeLinkedShiftId: null,
            feeLinkedMultiShiftId: null,
        };
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
            const feeData = await this.resolveMonthlyFeeData(
                tx,
                branchId,
                data,
                data.monthlyFee ?? branch.defaultFee ?? 0
            );

            const created = await tx.student.create({
                data: {
                    branchId,
                    name: data.name,
                    phone: data.phone,
                    status: StudentStatus.ACTIVE,
                    monthlyFee: feeData.monthlyFee,
                    feeLinkedShiftId: feeData.feeLinkedShiftId,
                    feeLinkedMultiShiftId: feeData.feeLinkedMultiShiftId,
                    joinedAt: new Date(),
                },
            });

            const admissionFee = data.admissionFee ?? branch.defaultAdmissionFee ?? 0;
            if (admissionFee > 0) {
                await tx.payment.create({
                    data: {
                        branchId,
                        studentId: created.id,
                        amount: admissionFee,
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

    static async updateStudentProfile(
        userId: string,
        studentId: string,
        data: UpdateStudentProfileDto
    ) {
        const verifiedStudent = await this.verifyStudentOwnership(userId, studentId);

        return prisma.$transaction(async (tx) => {
            const feeLinkTouched =
                data.feeLinkedShiftId !== undefined ||
                data.feeLinkedMultiShiftId !== undefined;
            const feeManuallyTouched = data.monthlyFee !== undefined;

            let feeData: Partial<{
                monthlyFee: number;
                feeLinkedShiftId: string | null;
                feeLinkedMultiShiftId: string | null;
            }> = {};

            if (feeLinkTouched) {
                feeData = await this.resolveMonthlyFeeData(
                    tx,
                    verifiedStudent.branchId,
                    {
                        monthlyFee: data.monthlyFee,
                        feeLinkedShiftId: data.feeLinkedShiftId ?? null,
                        feeLinkedMultiShiftId: data.feeLinkedMultiShiftId ?? null,
                    },
                    verifiedStudent.monthlyFee
                );
            } else if (feeManuallyTouched) {
                feeData = {
                    monthlyFee: data.monthlyFee ?? verifiedStudent.monthlyFee,
                    feeLinkedShiftId: null,
                    feeLinkedMultiShiftId: null,
                };
            }

            const updated = await tx.student.update({
                where: { id: studentId },
                data: {
                    ...(data.name !== undefined ? { name: data.name.trim() } : {}),
                    ...(data.phone !== undefined ? { phone: data.phone?.trim() || null } : {}),
                    ...feeData,
                },
            });

            await tx.branch.update({
                where: { id: verifiedStudent.branchId },
                data: { lastDataChange: new Date() },
            });

            return updated;
        });
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
