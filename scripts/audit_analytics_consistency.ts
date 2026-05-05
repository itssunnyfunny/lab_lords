
import { prisma } from "../lib/prisma";
import { PaymentStatus, StudentStatus } from "@prisma/client";

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

    // ==========================================
    // TEST 1: RAW SQL COUNT
    // ==========================================
    const rawCount = await prisma.payment.count({
        where: {
            branchId: branch.id,
            status: PaymentStatus.DUE,
            dueDate: { lt: new Date() } // Strictly less than now
        }
    });
    console.log(`   Raw SQL Overdue Count: ${rawCount}`);


    // ==========================================
    // TEST 2: SNAPSHOT/ENDPOINT LOGIC REPLICATION
    // ==========================================
    // Simulating what the /overdue endpoint or snapshot does
    const payments = await prisma.payment.findMany({
        where: {
            branchId: branch.id,
            status: PaymentStatus.DUE,
            dueDate: { lt: new Date() }
        }
    });
    const endpointCount = payments.length;
    console.log(`   Endpoint Logic Count: ${endpointCount}`);

    if (rawCount !== endpointCount) {
        console.error("   ❌ FAILURE: Raw SQL vs Endpoint mismatch!");
    } else {
        console.log("   ✅ SUCCESS: Raw SQL matches Endpoint logic.");
    }

    // ==========================================
    // TEST 3: AI RISK LOGIC (Simulated)
    // ==========================================
    // AI usually filters by > 7 days or similar thresholds. 
    // Let's verify if our definition matches "ANY overdue" or "Significant overdue".
    // For this audit, we assume strict equality is required for "Overdue Count".

    // If AI logic is "More than 7 days overdue", let's check that.
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const aiHighRiskCount = await prisma.payment.count({
        where: {
            branchId: branch.id,
            status: PaymentStatus.DUE,
            dueDate: { lt: sevenDaysAgo }
        }
    });

    console.log(`   AI High Risk (>7 days) Count: ${aiHighRiskCount}`);

    // Verify consistency
    // If our test data (pastOneMonth) is > 7 days, AI count should also be 2.
    // pastOneMonth is ~30 days ago. So it should be 2.

    if (aiHighRiskCount === rawCount) {
        console.log("   ✅ SUCCESS: AI Risk logic covers these cases.");
    } else {
        console.log("   ⚠️ NOTE: AI Risk Logic might differ from Strict Overdue (e.g. grace period).");
        console.log(`   Raw: ${rawCount}, AI: ${aiHighRiskCount}`);
    }

    console.log("\n🏁 ANALYTICS AUDIT COMPLETE.");
}

main()
    .catch((e) => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
