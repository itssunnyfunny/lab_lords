import { prisma } from "@/lib/prisma";
import { PaymentStatus, StudentStatus, PaymentType } from "@/types";
import { addMonths, differenceInMonths, startOfDay, isBefore, startOfMonth, endOfMonth } from "date-fns";

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
     * Generates due payments for all ACTIVE students in a branch.
     * Uses student-specific anniversary dates.
     */
    /**
     * Generates due payments for all ACTIVE students in a branch.
     * STRICT LOGIC:
     * - Iterate active students.
     * - Find last payment.
     * - Calculate nextDueDate = lastPayment.dueDate + 1 month (or joinedAt + 1 month if none).
     * - If nextDueDate <= asOfDate, create payment.
     * - Idempotent: check if payment exists for that dueDate.
     */
    static async generateDuePaymentsForBranch(
        userId: string,
        branchId: string,
        asOfDate: Date = new Date() // Default to now
    ) {
        await this.assertBranchOwnership(userId, branchId);

        // Get all active students with their latest payment
        const students = await prisma.student.findMany({
            where: {
                branchId,
                status: StudentStatus.ACTIVE,
            },
            include: {
                payments: {
                    where: {
                        type: PaymentType.MONTHLY,
                    },
                    take: 1,
                    orderBy: {
                        dueDate: "desc",
                    },
                },
            },
        });

        let generatedCount = 0;
        let skippedCount = 0;

        for (const student of students) {
            const lastPayment = student.payments[0];
            let nextDueDate: Date;

            if (lastPayment) {
                // Next due date is strictly 1 month after last payment's due date
                nextDueDate = addMonths(lastPayment.dueDate, 1);
            } else {
                // First payment is due 1 month after joining
                nextDueDate = addMonths(student.joinedAt, 1);
            }

            let paymentsGeneratedForStudent = 0;

            // Catch-up loop: generate all due payments up to asOfDate
            // Check if nextDueDate is on or before asOfDate (ignoring time if desired, but here specific logic)
            // Using !isBefore(asOfDate, startOfDay(nextDueDate)) ensures that if today is 15th, and due is 15th, we generate.
            while (!isBefore(asOfDate, startOfDay(nextDueDate))) {
                // Check if payment already exists for this dueDate (Idempotency)
                // We trust strict date equality from addMonths logic, but validation is safer
                const existing = await prisma.payment.findFirst({
                    where: {
                        studentId: student.id,
                        dueDate: nextDueDate,
                        type: PaymentType.MONTHLY
                    }
                });

                if (!existing) {
                    const pStart = addMonths(nextDueDate, -1);
                    const pEnd = nextDueDate;

                    await prisma.payment.create({
                        data: {
                            branchId,
                            studentId: student.id,
                            amount: student.monthlyFee,
                            status: PaymentStatus.DUE,
                            periodStart: pStart,
                            periodEnd: pEnd,
                            dueDate: nextDueDate,
                        },
                    });
                    paymentsGeneratedForStudent++;
                    generatedCount++;
                }

                // Advance to next month for catch-up
                nextDueDate = addMonths(nextDueDate, 1);
            }

            if (paymentsGeneratedForStudent === 0) {
                skippedCount++;
            }
        }

        return {
            generatedCount,
            skippedCount,
            totalStudents: students.length,
        };
    }

    /**
     * Lists payments for a branch with optional status filter.
     * Supports strict monthly view logic:
     * - If month provided:
     *   - DUE: All due payments <= end of that month (includes overdue).
     *   - PAID: Only payments paid/due IN that month (strict filter).
     */
    static async listPayments(
        userId: string,
        branchId: string,
        status?: PaymentStatus,
        month?: Date
    ) {
        await this.assertBranchOwnership(userId, branchId);

        let whereClause: any = {
            branchId,
            ...(status ? { status } : {}),
        };

        if (month) {
            const start = startOfMonth(month);
            const end = endOfMonth(month);

            if (status === PaymentStatus.DUE) {
                // If asking strictly for DUE, show everything due before or during this month
                whereClause = {
                    ...whereClause,
                    status: PaymentStatus.DUE,
                    dueDate: { lte: end }
                };
            } else if (status === PaymentStatus.PAID) {
                // If asking strictly for PAID, show only this month
                whereClause = {
                    ...whereClause,
                    status: PaymentStatus.PAID,
                    dueDate: { gte: start, lte: end }
                };
            } else {
                // Mixed view (default):
                // Show DUE if (dueDate <= end)    <-- Includes past due
                // Show PAID if (start <= dueDate <= end) <-- Strict window for paid
                whereClause = {
                    branchId,
                    AND: [
                        {
                            OR: [
                                {
                                    status: PaymentStatus.DUE,
                                    dueDate: { lte: end }
                                },
                                {
                                    status: PaymentStatus.PAID,
                                    dueDate: { gte: start, lte: end }
                                }
                            ]
                        }
                    ]
                };
            }
        }

        return prisma.payment.findMany({
            where: whereClause,
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
                dueDate: "asc", // Sort by due date ascending (oldest first) so overdue shows at top provided we group/sort in UI
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

}
