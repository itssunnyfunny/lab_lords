import { getSessionUser } from "@/lib/auth";
import { PaymentService } from "@/services/payment.service";
import { PaymentStatus } from "@prisma/client";
import { NextResponse } from "next/server";

export async function GET(
    req: Request,
    { params }: { params: { branchId: string } }
) {
    try {
        const session = await getSessionUser();
        if (!session?.id) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const statusParam = searchParams.get("status");

        let status: PaymentStatus | undefined;
        if (statusParam && Object.values(PaymentStatus).includes(statusParam as PaymentStatus)) {
            status = statusParam as PaymentStatus;
        }

        const payments = await PaymentService.listPayments(
            session.id,
            params.branchId,
            status
        );

        return NextResponse.json(payments);
    } catch (error) {
        if (error instanceof Error && error.message.includes("Unauthorized")) {
            return new NextResponse(error.message, { status: 403 });
        }
        console.error("[PAYMENTS_GET]", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
