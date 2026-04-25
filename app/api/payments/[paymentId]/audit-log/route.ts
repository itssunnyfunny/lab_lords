import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ paymentId: string }> }
) {
    try {
        const user = await getSessionUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { paymentId } = await params;

        // Verify the payment exists and belongs to a branch the user owns
        const payment = await prisma.payment.findUnique({
            where: { id: paymentId },
            include: { branch: { include: { organization: true } } },
        });

        if (!payment) {
            return NextResponse.json({ error: "Payment not found" }, { status: 404 });
        }

        if (payment.branch.organization.ownerId !== user.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        const logs = await prisma.auditLog.findMany({
            where: { paymentId },
            include: {
                user: {
                    select: { id: true, name: true, email: true },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        return NextResponse.json(logs);
    } catch (error: any) {
        console.error("[PAYMENT_AUDIT_LOG_GET]", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
