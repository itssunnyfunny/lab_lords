import { NextRequest, NextResponse } from "next/server";
import { PaymentService } from "@/services/payment.service";
import { getSessionUser } from "@/lib/auth";

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
