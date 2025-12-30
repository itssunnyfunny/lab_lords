import { prisma } from "@/lib/prisma";
import { PaymentStatus, StudentStatus } from "@prisma/client";
import { startOfMonth, endOfMonth, addDays } from "date-fns";

export class PaymentService {
    /**
     * Helper to verify that the user owns the branch via its organization.
     */
    static async assertBranchOwnership(userId: string, branchId: string) {
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
     * Generates due payments for all ACTIVE students in a branch for the current month.
     * Skips students who already have a payment record for this period.
     */
    static async generateDuePaymentsForBranch(
        userId: string,
        branchId: string,
        amount: number
    ) {
        await this.assertBranchOwnership(userId, branchId);

        const now = new Date();
        const periodStart = startOfMonth(now);
        const periodEnd = endOfMonth(now);
        const dueDate = addDays(now, 7); // Default due date to 7 days from now

        // Get all active students
        const students = await prisma.student.findMany({
            where: {
                branchId,
                status: StudentStatus.ACTIVE,
            },
        });

        let generatedCount = 0;
        let skippedCount = 0;

        for (const student of students) {
            // Check if payment already exists for this period
            const existingPayment = await prisma.payment.findUnique({
                where: {
                    studentId_periodStart: {
                        studentId: student.id,
                        periodStart: periodStart,
                    },
                },
            });

            if (existingPayment) {
                skippedCount++;
                continue;
            }

            // Create payment
            await prisma.payment.create({
                data: {
                    branchId,
                    studentId: student.id,
                    amount,
                    status: PaymentStatus.DUE,
                    periodStart,
                    periodEnd,
                    dueDate,
                },
            });
            generatedCount++;
        }

        return {
            generatedCount,
            skippedCount,
            totalStudents: students.length,
        };
    }

    /**
     * Lists payments for a branch with optional status filter.
     */
    static async listPayments(
        userId: string,
        branchId: string,
        status?: PaymentStatus
    ) {
        await this.assertBranchOwnership(userId, branchId);

        return prisma.payment.findMany({
            where: {
                branchId,
                ...(status ? { status } : {}),
            },
            include: {
                student: {
                    select: {
                        id: true,
                        name: true,
                        phone: true,
                    },
                },
            },
            orderBy: {
                createdAt: "desc",
            },
        });
    }

    /**
     * Generates a single payment for a specific student (Wrapper mainly for reusing logic if needed, 
     * but currently `generateDuePaymentsForBranch` does the bulk work).
     * Keeping it placeholder or simple if specific single generation is needed later.
     */
    static async generatePaymentForStudent(
        userId: string,
        studentId: string,
        amount: number
    ) {
        // Retrieve student to get branchId
        const student = await prisma.student.findUnique({
            where: { id: studentId },
            include: { branch: { include: { organization: true } } }
        });

        if (!student) throw new Error("Student not found");
        if (student.branch.organization.ownerId !== userId) throw new Error("Unauthorized");

        const now = new Date();
        const periodStart = startOfMonth(now);

        // Specific check for this student
        const existing = await prisma.payment.findUnique({
            where: {
                studentId_periodStart: {
                    studentId: student.id,
                    periodStart
                }
            }
        });

        if (existing) {
            throw new Error("Payment already exists for this month");
        }

        return prisma.payment.create({
            data: {
                branchId: student.branchId,
                studentId: student.id,
                amount,
                status: PaymentStatus.DUE,
                periodStart,
                periodEnd: endOfMonth(now),
                dueDate: addDays(now, 7),
            }
        });
    }
}
