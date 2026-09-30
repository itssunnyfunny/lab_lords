import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { StaffService } from "@/services/staff.service";
import { BranchAccessNotFoundError } from "@/services/accessPolicy.service";

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

        // Verify the payment exists and belongs to a branch the user can view payments for.
        const payment = await prisma.payment.findUnique({
            where: { id: paymentId },
        });

        if (!payment) {
            return NextResponse.json({ error: "Payment not found" }, { status: 404 });
        }

        await StaffService.authorize(user.id, payment.branchId, "view_payments");

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
    } catch (error: unknown) {
        if (error instanceof BranchAccessNotFoundError) {
            return NextResponse.json({ error: "Payment not found" }, { status: 404 });
        }
        if (error instanceof Error && error.message.startsWith("Unauthorized:")) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        console.error("[PAYMENT_AUDIT_LOG_GET] Unexpected audit-log failure");
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
