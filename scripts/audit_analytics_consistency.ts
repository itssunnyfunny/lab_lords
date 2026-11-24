
import { prisma } from "../lib/prisma";
import { PaymentStatus, StudentStatus } from "../app/generated/prisma/enums";
import { getOverduePayments, getPaymentStats } from "../analytics/payment.analytics";
import { overdueCutoff } from "../lib/utils/paymentStatus";

async function main() {
    console.log("🔍 STARTING ANALYTICS CONSISTENCY AUDIT...");

    // SETUP
    const user = await prisma.user.create({ data: { email: `audit-analytics-${Date.now()}@test.com`, name: "Audit User" } });
    const org = await prisma.organization.create({ data: { name: "Audit Org", ownerId: user.id } });
    const branch = await prisma.branch.create({ data: { name: "Audit Branch", organizationId: org.id } });

    // Create 3 active students
    const s1 = await prisma.student.create({ data: { branchId: branch.id, name: "S1", status: StudentStatus.ACTIVE, monthlyFee: 1000 } });
    const s2 = await prisma.student.create({ data: { branchId: branch.id, name: "S2", status: StudentStatus.ACTIVE, monthlyFee: 1000 } });
    await prisma.student.create({ data: { branchId: branch.id, name: "S3", status: StudentStatus.ACTIVE, monthlyFee: 1000 } });

    // Create overdue payments for 2 of them
    const pastOneMonth = new Date();
    pastOneMonth.setMonth(pastOneMonth.getMonth() - 1);

    await prisma.payment.create({
        data: {
            branchId: branch.id,
            studentId: s1.id,
            amount: 1000,
            status: PaymentStatus.DUE,
            dueDate: pastOneMonth, // Overdue
            periodStart: pastOneMonth,
            periodEnd: new Date()
        }
    });

    await prisma.payment.create({
        data: {
            branchId: branch.id,
            studentId: s2.id,
            amount: 1000,
            status: PaymentStatus.DUE,
            dueDate: pastOneMonth, // Overdue
            periodStart: pastOneMonth,
            periodEnd: new Date()
        }
    });

    console.log(`✅ Setup Complete. Created 2 overdue students.`);

    const asOf = new Date();
    const rawCount = await prisma.payment.count({
        where: {
            branchId: branch.id,
            status: PaymentStatus.DUE,
            amount: { gt: 0 },
            dueDate: { lt: overdueCutoff(org, asOf) },
        }
    });
    const [queue, stats] = await Promise.all([
        getOverduePayments(branch.id, asOf),
        getPaymentStats(branch.id, asOf),
    ]);
    if (queue.count !== rawCount || stats.overdueCount !== rawCount) {
        throw new Error(`Overdue count mismatch: expected ${rawCount}, queue ${queue.count}, stats ${stats.overdueCount}`);
    }
    console.log(`Overdue counts agree across analytics and the queue (${rawCount}).`);
}

main()
    .catch((e) => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
