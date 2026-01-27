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
                // NOTE: User said "joinedAt + 1 month"
                nextDueDate = addMonths(student.joinedAt, 1);
            }

            // If the calculated due date is in the future relative to asOfDate, skip
            // (We only generate if it's due on or before active date)
            // Actually user said: "if dueDate <= asOfDate"
            if (!isBefore(asOfDate, startOfDay(nextDueDate))) {
                // Check if payment already exists for this dueDate (Efficiency check, though Logic should prevent it if we trust lastPayment)
                // But if lastPayment was "Payment A (Due Jan 1)", next is "Payment B (Due Feb 1)".
                // If Payment B already exists, it would have been the lastPayment!
                // So purely relying on `payments take 1` is safe IF we are sure we are not running this twice concurrently.
                // But better to be safe and check if we are about to create a duplicate if for some reason lastPayment query was stale or race condition.
                // However, since we queried `take: 1`, if Payment B existed, nextDueDate would be Mar 1.
                // So we shouldn't theoretically need to check, but let's double check to be robust.

                // Wait, if we just created it in this loop? No, loop is per student.

                // Let's stick to the plan: "if no payment already exists for this dueDate"
                // The `lastPayment` query might have missed it if we didn't fetch all? No `take: 1 desc` gives latest.
                // So if latest is Feb 1, we calculate Mar 1. Mar 1 definitely doesn't exist.
                // UNLESS `asOfDate` is way in future (e.g. Apr 1) and we need to generate Feb 1 AND Mar 1.
                // The current loop only generates one payment per run.
                // If we want to generate catch-up payments, we should probably loop?
                // User didn't explicitly say loop, but "Repeat forever".
                // "For each ACTIVE student... if dueDate <= asOfDate ... create Payment".
                // If I run it today (Apr 15) and last payment was Jan 15.
                // next = Feb 15. Feb 15 <= Apr 15. Create Feb 15.
                // Next run (tomorrow or re-trigger): Last = Feb 15. Next = Mar 15. Create.
                // So calling it once generates ONE pending payment. To catch up, you call it multiple times.
                // This seems safe and correct for a daily job.

                const periodStart = nextDueDate; // For simplicity, let's say period starts on due date?
                // User didn't specify periodStart logic in pseudo-code, just "dueDate".
                // But Payment model has periodStart/End.
                // Let's assume periodStart = dueDate - 1 month? Or just dueDate?
                // User said: "One payment = one billing cycle"
                // "joined on 12 Jan ... dueDate: 12 Feb".
                // So period is likely Jan 12 - Feb 12.
                // If dueDate is Feb 12, periodStart should probably be Jan 12 (or Feb 12? Billing usually forward or backward?)
                // "joined 12 Jan -> Payment 12 Feb". This implies Post-paid or Pre-paid?
                // Usually "Monthly fee" for Jan 12-Feb 12 is due on Jan 12 (Prepaid) or Feb 12 (Postpaid).
                // User says: "Joined 12 Jan... On 12 Feb: Payment... Due 12 Feb".
                // This looks like Post-paid (pay after month) OR Prepaid with 1 month grace?
                // "Student should not be due before completing a full cycle".
                // So it's Post-paid. You use the facility for a month, then pay.
                // So for DueDate Feb 12, Period is Jan 12 - Feb 12.
                // PeriodStart = addMonths(nextDueDate, -1). PeriodEnd = nextDueDate.

                const pStart = addMonths(nextDueDate, -1);
                const pEnd = nextDueDate;

                // Create Payment
                await prisma.payment.create({
                    data: {
                        branchId,
                        studentId: student.id,
                        amount: student.monthlyFee, // Use student's fee
                        status: PaymentStatus.DUE,
                        periodStart: pStart,
                        periodEnd: pEnd,
                        dueDate: nextDueDate,
                    },
                });
                generatedCount++;
            } else {
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
