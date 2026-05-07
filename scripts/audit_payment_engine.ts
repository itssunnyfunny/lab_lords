
import { prisma } from "../lib/prisma";
import { PaymentService } from "../services/payment.service";
import { StudentService } from "../services/student.service";
import { PaymentStatus, StudentStatus } from "../app/generated/prisma/enums";
import { format } from "date-fns";

async function main() {
    console.log("🔍 STARTING PAYMENT ENGINE AUDIT...");

    // SETUP: Create Org, Branch, User
    const user = await prisma.user.create({
        data: { email: `audit-pay-${Date.now()}@test.com`, name: "Audit User" }
    });
    const org = await prisma.organization.create({
        data: { name: "Audit Org", ownerId: user.id }
    });
    const branch = await prisma.branch.create({
        data: { name: "Audit Branch", organizationId: org.id, defaultFee: 1000 }
    });

    console.log(`✅ Setup Complete. Branch: ${branch.name}`);

    // ==========================================
    // CASE A: 3 Months Simulation
    // ==========================================
    console.log("\n🧪 CASE A: 3 Months Simulation (Jan - Apr)");
    const joinDate = new Date("2024-01-10"); // Jan 10

    // Create Student
    const student = await prisma.student.create({
        data: {
            branchId: branch.id,
            name: "Sim Student",
            status: StudentStatus.ACTIVE,
            joinedAt: joinDate,
            monthlyFee: 1000
        }
    });

    // 1. Run for Feb 10
    console.log("   Running Gen for Feb 10...");
    await PaymentService.generateDuePaymentsForBranch(user.id, branch.id, new Date("2024-02-10"));
    let payments = await prisma.payment.findMany({ where: { studentId: student.id }, orderBy: { dueDate: 'asc' } });
    console.log(`   Payments: ${payments.length}`);
    if (payments.length !== 1) console.error("   ❌ Payment count mismatch (Expected 1)");
    else console.log(`   ✅ Correct: 1 Payment (Due: ${format(payments[0].dueDate, 'yyyy-MM-dd')})`);

    // 2. Run for Mar 10
    console.log("   Running Gen for Mar 10...");
    await PaymentService.generateDuePaymentsForBranch(user.id, branch.id, new Date("2024-03-10"));
    payments = await prisma.payment.findMany({ where: { studentId: student.id }, orderBy: { dueDate: 'asc' } });
    console.log(`   Payments: ${payments.length}`);
    if (payments.length !== 2) console.error("   ❌ Payment count mismatch (Expected 2)");
    else console.log(`   ✅ Correct: 2 Payments`);

    // 3. Run for Apr 10
    console.log("   Running Gen for Apr 10...");
    await PaymentService.generateDuePaymentsForBranch(user.id, branch.id, new Date("2024-04-10"));
    payments = await prisma.payment.findMany({ where: { studentId: student.id }, orderBy: { dueDate: 'asc' } });

    if (payments.length !== 3) {
        console.error(`   ❌ Payment count mismatch. Found ${payments.length}, Expected 3.`);
        process.exit(1);
    }

    // Verify dates
    const dueDates = payments.map(p => format(p.dueDate, 'yyyy-MM-dd'));
    const expectedDates = ["2024-02-10", "2024-03-10", "2024-04-10"];
    const datesMatch = JSON.stringify(dueDates) === JSON.stringify(expectedDates);

    if (datesMatch) {
        console.log(`   ✅ Correct Dates: ${dueDates.join(", ")}`);
    } else {
        console.error(`   ❌ Date mismatch. Found ${dueDates.join(", ")}`);
    }

    // ==========================================
    // CASE B: Late Payment
    // ==========================================
    console.log("\n🧪 CASE B: Late Payment Handling");
    // Mark Feb payment (index 0) as PAID in April context
    // We already generated up to April. Let's mark the first one as paid.

    const febPayment = payments[0];
    await PaymentService.markPaymentAsPaid(user.id, febPayment.id);
    console.log("   Marked Feb payment as PAID.");

    // Verify it didn't mess up others
    const refetchedPayments = await prisma.payment.findMany({ where: { studentId: student.id }, orderBy: { dueDate: 'asc' } });

    if (refetchedPayments[0].status === PaymentStatus.PAID &&
        refetchedPayments[1].status === PaymentStatus.DUE &&
        refetchedPayments[2].status === PaymentStatus.DUE) {
        console.log("   ✅ Status Correct: Paid, Due, Due");
    } else {
        console.error("   ❌ Status Mismatch");
    }

    // Verify dates again
    const newDueDates = refetchedPayments.map(p => format(p.dueDate, 'yyyy-MM-dd'));
    if (JSON.stringify(newDueDates) === JSON.stringify(expectedDates)) {
        console.log("   ✅ Dates Unaffected");
    } else {
        console.error("   ❌ CORRUPTION: Dates changed!");
    }

    // ==========================================
    // CASE C: Inactive Student
    // ==========================================
    console.log("\n🧪 CASE C: Inactivate Student");
    // Make student inactive on Mar 5.
    // NOTE: In our system, status is just a field. 
    // We need to ensure that subsequent generations DO NOT create payments for inactive students.

    await StudentService.updateStudentStatus(user.id, student.id, StudentStatus.INACTIVE);
    console.log("   Student set to INACTIVE.");

    // Run gen for May 10 (Should NOT generate May payment)
    console.log("   Running Gen for May 10...");
    await PaymentService.generateDuePaymentsForBranch(user.id, branch.id, new Date("2024-05-10"));

    const finalPayments = await prisma.payment.findMany({ where: { studentId: student.id }, orderBy: { dueDate: 'asc' } });

    if (finalPayments.length === 3) {
        console.log("   ✅ Correct: No new payment generated for May.");
    } else {
        console.error(`   ❌ Failed: Created ${finalPayments.length} payments. Expected 3.`);
    }

    // Verify old dues remain
    const unpaidCount = finalPayments.filter(p => p.status === PaymentStatus.DUE).length;
    if (unpaidCount === 2) {
        console.log("   ✅ Old dues remain (Mar, Apr still due).");
    } else {
        console.error("   ❌ Old dues modified/deleted.");
    }

    console.log("\n🏁 PAYMENT AUDIT COMPLETE.");
}

main()
    .catch((e) => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
