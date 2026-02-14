
import { PaymentService } from "../services/payment.service";
import { prisma } from "../lib/prisma";

async function main() {
    const branch = await prisma.branch.findFirst();
    if (!branch) {
        console.log("No branch found");
        return;
    }
    const user = await prisma.user.findFirst();
    if (!user) {
        console.log("No user found");
        return;
    }

    console.log("Branch:", branch.id);
    console.log("User:", user.id);

    // List payments
    const payments = await PaymentService.listPayments(user.id, branch.id);
    console.log("Payments Found:", payments.length);
    payments.forEach(p => {
        console.log(`Payment: ${p.id}, Amount: ${p.amount} (Type: ${typeof p.amount}), Status: ${p.status}, DueDate: ${p.dueDate}`);
    });
}

main()
    .catch(e => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
