import { prisma } from "@/lib/prisma";
import { StudentStatus } from "@/types";
import { CreateStudentDto } from "@/types";

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
        await this.verifyBranchOwnership(userId, branchId);

        return prisma.$transaction(async (tx) => {
            // 1. Create Student
            const student = await tx.student.create({
                data: {
                    branchId,
                    name: data.name,
                    phone: data.phone,
                    status: StudentStatus.ACTIVE,
                },
            });

            // 2. If seat and shift are provided, perform allocation
            if (data.seatId && data.shiftId) {
                // Fetch seat and shift to validate
                const seat = await tx.seat.findUnique({ where: { id: data.seatId } });
                const shift = await tx.shift.findUnique({ where: { id: data.shiftId } });

                if (!seat) throw new Error("Seat not found");
                if (!shift) throw new Error("Shift not found");

                // Validate "Same Branch" Rule
                if (seat.branchId !== branchId || shift.branchId !== branchId) {
                    throw new Error("Seat and Shift must belong to the same branch");
                }

                // Check for existing active allocation for this seat in this shift
                const existingAllocation = await tx.seatAllocation.findFirst({
                    where: {
                        seatId: data.seatId,
                        shiftId: data.shiftId,
                        endDate: null,
                    },
                });

                if (existingAllocation) {
                    throw new Error("Seat is already assigned in this shift");
                }

                // Create Allocation
                await tx.seatAllocation.create({
                    data: {
                        seatId: data.seatId,
                        studentId: student.id,
                        shiftId: data.shiftId,
                    },
                });
            }

            return student;
        });
    }

    static async getStudentsByBranch(userId: string, branchId: string) {
        await this.verifyBranchOwnership(userId, branchId);

        return prisma.student.findMany({
            where: {
                branchId,
            },
            orderBy: {
                name: "asc",
            },
        });
    }

    static async updateStudentStatus(
        userId: string,
        studentId: string,
        status: StudentStatus
    ) {
        await this.verifyStudentOwnership(userId, studentId);

        return prisma.student.update({
            where: { id: studentId },
            data: {
                status,
            },
        });
    }
}
