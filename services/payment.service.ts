import { prisma } from "@/lib/prisma";
import { PaymentStatus, StudentStatus } from "@/types";
import { addMonths, differenceInMonths, startOfDay, isBefore } from "date-fns";

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
     * Calculates the current billing period for a student based on their join date.
     * Uses anniversary billing logic.
     */
    static getNextBillingPeriod(joinedAt: Date) {
        const now = new Date();
        const startOfToday = startOfDay(now);

        // Calculate the most recent anniversary
        const monthsDiff = differenceInMonths(startOfToday, joinedAt);
        const cycle1 = addMonths(joinedAt, monthsDiff);
        const cycle2 = addMonths(joinedAt, monthsDiff + 1);

        // Ideally, if today is Feb 28 and joined Jan 31, diff is 0?
        // If date-fns returns 0, cycle1 = Jan 31, cycle2 = Feb 28.
        // usage of startOfToday ensures we compare dates properly.

        let periodStart = cycle1;
        // If we have passed or met the *next* cycle start, use that.
        // e.g. Today Feb 28. cycle2 = Feb 28.
        // !isBefore(Feb 28, Feb 28) -> true (it is equivalent or after) -> Use cycle2.
        if (!isBefore(startOfToday, startOfDay(cycle2))) {
            periodStart = cycle2;
        }

        const periodEnd = addMonths(periodStart, 1);
        const dueDate = periodStart; // Due immediately upon cycle start

        return { periodStart, periodEnd, dueDate };
    }

    /**
     * Generates due payments for all ACTIVE students in a branch.
     * Uses student-specific anniversary dates.
     */
    static async generateDuePaymentsForBranch(
        userId: string,
        branchId: string,
        amount: number
    ) {
        await this.assertBranchOwnership(userId, branchId);

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
            const { periodStart, periodEnd, dueDate } = this.getNextBillingPeriod(student.joinedAt);

            // Check if payment already exists for this periodStart
            const existingPayment = await prisma.payment.findFirst({
                where: {
                    studentId: student.id,
                    periodStart: {
                        equals: periodStart // Exact match on calculated start date
                    }
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
                        joinedAt: true,
                    },
                },
            },
            orderBy: {
                createdAt: "desc",
            },
        });
    }

    /**
     * Marks a payment as PAID.
     */
    static async markPaymentAsPaid(userId: string, paymentId: string) {
        const payment = await prisma.payment.findUnique({
            where: { id: paymentId },
            include: {
                branch: {
                    include: { organization: true }
                }
            }
        });

        if (!payment) {
            throw new Error("Payment not found");
        }

        if (payment.branch.organization.ownerId !== userId) {
            throw new Error("Unauthorized: User does not own this branch");
        }

        if (payment.status === PaymentStatus.PAID) {
            return payment; // Already paid, idempotent
        }

        return prisma.payment.update({
            where: { id: paymentId },
            data: {
                status: PaymentStatus.PAID,
                paidAt: new Date(),
            },
        });
    }

    // Deprecated/unused for now but kept for interface/future use if single gen needed
    static async generatePaymentForStudent(
        userId: string,
        studentId: string,
        amount: number
    ) {
        // ... existing logic or remove if strictly unused. 
        // For now, I'll remove it to keep file clean as it wasn't strictly requested in the updated list, 
        // but `generateDuePaymentsForBranch` is the main one.
        // Actually user originally asked for it, I'll update it to use the new logic just in case.

        const student = await prisma.student.findUnique({
            where: { id: studentId },
            include: { branch: { include: { organization: true } } }
        });

        if (!student) throw new Error("Student not found");
        if (student.branch.organization.ownerId !== userId) throw new Error("Unauthorized");

        const { periodStart, periodEnd, dueDate } = this.getNextBillingPeriod(student.joinedAt);

        const existing = await prisma.payment.findFirst({
            where: {
                studentId: student.id,
                periodStart: { equals: periodStart }
            }
        });

        if (existing) {
            throw new Error("Payment already exists for this cycle");
        }

        return prisma.payment.create({
            data: {
                branchId: student.branchId,
                studentId: student.id,
                amount,
                status: PaymentStatus.DUE,
                periodStart,
                periodEnd,
                dueDate,
            }
        });
    }
}
