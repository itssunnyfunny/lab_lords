import { getSessionUser } from "@/lib/auth";
import { PaymentService } from "@/services/payment.service";
import { NextResponse } from "next/server";

export async function POST(
    req: Request,
    { params }: { params: { paymentId: string } }
) {
    try {
        const session = await getSessionUser();
        if (!session?.id) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const payment = await PaymentService.markPaymentAsPaid(
            session.id,
            params.paymentId
        );

        return NextResponse.json(payment);
    } catch (error) {
        if (error instanceof Error && error.message.includes("Unauthorized")) {
            return new NextResponse(error.message, { status: 403 });
        }
        if (error instanceof Error && error.message.includes("not found")) {
            return new NextResponse(error.message, { status: 404 });
        }
        console.error("[PAYMENT_PAY_POST]", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
