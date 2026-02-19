import { NextRequest, NextResponse } from "next/server";
import { PaymentService } from "@/services/payment.service";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ paymentId: string }> }
) {
    try {
        const user = await getSessionUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { paymentId } = await params;

        const payment = await PaymentService.markPaymentAsPaid(user.id, paymentId);

        // Update Branch lastDataChange & Delete Message Drafts for this student
        await prisma.$transaction([
            prisma.branch.update({
                where: { id: payment.branchId },
                data: { lastDataChange: new Date() }
            }),
            prisma.messageDraft.deleteMany({
                where: {
                    branchId: payment.branchId,
                    studentId: payment.studentId
                }
            })
        ]);

        return NextResponse.json(payment);
    } catch (error: any) {
        if (error.message.includes("Unauthorized")) {
            return NextResponse.json({ error: error.message }, { status: 403 });
        }
        if (error.message.includes("not found")) {
            return NextResponse.json({ error: error.message }, { status: 404 });
        }
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
