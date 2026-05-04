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

        const payment = await PaymentService.markPaymentAsWaived(user.id, paymentId);

        return NextResponse.json(payment);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Internal Server Error";
        if (message.includes("Unauthorized")) {
            return NextResponse.json({ error: message }, { status: 403 });
        }
        if (message.includes("not found")) {
            return NextResponse.json({ error: message }, { status: 404 });
        }
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
