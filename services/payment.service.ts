import { prisma } from "@/lib/prisma";
import { StaffService } from "@/services/staff.service";
import { PaymentStatus, StudentStatus, PaymentType, PaymentMethod } from "@/types";
import type { StaffAction } from "@/types";
import type { Prisma } from "@/app/generated/prisma/client";
import { addMonths, startOfDay, isBefore, startOfMonth, endOfMonth } from "date-fns";

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

    static async assertBranchAccess(userId: string, branchId: string, action: StaffAction) {
        await StaffService.authorize(userId, branchId, action);

        const branch = await prisma.branch.findUnique({ where: { id: branchId } });

        if (!branch) {
            throw new Error("Branch not found");
        }

        return branch;
    }



    /**
     * Generates due payments for all ACTIVE students in a branch.
     *
     * ANCHOR-BASED LOGIC (idempotent):
     * - For each active student, compute due dates as addMonths(joinedAt, N)
     *   for N = 1, 2, 3 … until dueDate > today.
     * - This anchors permanently on the join day-of-month (e.g. always the 19th).
     * - Check if a MONTHLY payment already exists for each dueDate — skip if yes.
     * - Works correctly whether the previous month was PAID or DUE.
     * - Handles catch-up: if the app was not opened for 10 months, generates all 10.
     */
    static async generateDuePaymentsForBranch(
        userId: string,
        branchId: string,
        asOfDate: Date = new Date()
    ) {
        await this.assertBranchAccess(userId, branchId, "generate_payments");

        const today = startOfDay(asOfDate);

        // Fetch all active students and their existing MONTHLY payment dueDates
        // (so we can skip already-generated dates without hitting DB per-date)
        const students = await prisma.student.findMany({
            where: {
                branchId,
                status: StudentStatus.ACTIVE,
            },
            select: {
                id: true,
                joinedAt: true,
                monthlyFee: true,
                payments: {
                    where: { type: PaymentType.MONTHLY },
                    select: { dueDate: true },
                },
            },
        });


        let generatedCount = 0;
        let skippedCount = 0;
        const paymentsToCreate = [];

        for (const student of students) {
            // Build a Set of existing due dates (as ISO strings) for O(1) lookup
            const existingDueDates = new Set(
                student.payments.map((p) => startOfDay(p.dueDate).toISOString())
            );

            let paymentsGeneratedForStudent = 0;
            let month = 1;

            // Walk anchor-based due dates: joinedAt + 1 month, +2 months, …
            while (true) {
                const dueDate = addMonths(student.joinedAt, month);
                const dueDateNormalized = startOfDay(dueDate);

                // Stop when dueDate is in the future
                if (isBefore(today, dueDateNormalized)) break;

                // Skip if already generated (idempotent)
                if (!existingDueDates.has(dueDateNormalized.toISOString())) {
                    paymentsToCreate.push({
                        branchId,
                        studentId: student.id,
                        amount: student.monthlyFee,
                        status: PaymentStatus.DUE,
                        type: PaymentType.MONTHLY,
                        // periodStart = previous anchor (normalized to midnight to avoid
                        // colliding with the ADMISSION payment's periodStart timestamp)
                        periodStart: startOfDay(addMonths(student.joinedAt, month - 1)),
                        periodEnd: dueDate,
                        dueDate: dueDate,
                    });
                    paymentsGeneratedForStudent++;
                }

                month++;
            }

            if (paymentsGeneratedForStudent === 0) {
                skippedCount++;
            }
        }

        if (paymentsToCreate.length > 0) {
            // Bulk insert to avoid N+1 query problem during generation
            const created = await prisma.payment.createMany({
                data: paymentsToCreate,
            });
            generatedCount = created.count;

            await prisma.branch.update({
                where: { id: branchId },
                data: { lastDataChange: new Date() },
            });
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
        await this.assertBranchAccess(userId, branchId, "view_payments");

        // Default: exclude WAIVED when no specific status requested
        let whereClause: Prisma.PaymentWhereInput = {
            branchId,
            ...(status ? { status } : { status: { not: "WAIVED" } }),
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
    static async markPaymentAsPaid(
        userId: string,
        paymentId: string,
        method?: PaymentMethod,
        referenceId?: string,
    ) {
        const payment = await prisma.payment.findUnique({
            where: { id: paymentId },
        });

        if (!payment) {
            throw new Error("Payment not found");
        }

        await StaffService.authorize(userId, payment.branchId, "mark_payment_paid");

        if (payment.status === PaymentStatus.PAID) {
            return payment; // Already paid, idempotent
        }

        return prisma.$transaction(async (tx) => {
            // 1. Mark as PAID (write-once: method + referenceId set only here)
            const updatedPayment = await tx.payment.update({
                where: { id: paymentId },
                data: {
                    status: PaymentStatus.PAID,
                    paidAt: new Date(),
                    ...(method      ? { paymentMethod: method } : {}),
                    ...(referenceId ? { referenceId }           : {}),
                },
            });

            // 2. Delete associated MessageDrafts (stop pestering once paid)
            await tx.messageDraft.deleteMany({
                where: {
                    studentId: payment.studentId,
                    branchId: payment.branchId,
                    action: "FOLLOW_UP_OVERDUE_PAYMENTS"
                }
            });

            // 3. Update Branch lastDataChange
            await tx.branch.update({
                where: { id: payment.branchId },
                data: { lastDataChange: new Date() }
            });

            // 4. Create Audit Log
            await tx.auditLog.create({
                data: {
                    branchId: payment.branchId,
                    userId,
                    action: "PAYMENT_MARKED_PAID",
                    paymentId: payment.id,
                    details: {
                        from: payment.status,
                        to: "PAID",
                        amount: payment.amount,
                        method: method ?? null,
                        referenceId: referenceId ?? null,
                    }
                }
            });

            return updatedPayment;
        });
    }

    /**
     * Marks a payment as WAIVED.
     * WAIVED = owner consciously decided not to pursue this debt.
     * Preserves history; excluded from overdue/due analytics.
     */
    static async markPaymentAsWaived(userId: string, paymentId: string) {
        const payment = await prisma.payment.findUnique({
            where: { id: paymentId },
        });

        if (!payment) {
            throw new Error("Payment not found");
        }

        await StaffService.authorize(userId, payment.branchId, "waive_payments");

        if (payment.status === PaymentStatus.WAIVED) {
            return payment; // Already waived, idempotent
        }

        return prisma.$transaction(async (tx) => {
            const updatedPayment = await tx.payment.update({
                where: { id: paymentId },
                data: {
                    status: PaymentStatus.WAIVED,
                },
            });

            await tx.branch.update({
                where: { id: payment.branchId },
                data: { lastDataChange: new Date() }
            });

            // Create Audit Log
            await tx.auditLog.create({
                data: {
                    branchId: payment.branchId,
                    userId,
                    action: "PAYMENT_WAIVED",
                    paymentId: payment.id,
                    details: {
                        from: payment.status,
                        to: "WAIVED",
                        amount: payment.amount
                    }
                }
            });

            return updatedPayment;
        });
    }

}
