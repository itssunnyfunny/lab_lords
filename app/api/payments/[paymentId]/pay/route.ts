import { NextRequest, NextResponse } from "next/server";
import { PaymentService } from "@/services/payment.service";
import { getSessionUser } from "@/lib/auth";
import { PaymentMethod } from "@/types";

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

        // Parse optional body — callers that send no body still work
        const body = await req.json().catch(() => ({}));
        const method = body.method as PaymentMethod | undefined;
        const referenceId = body.referenceId as string | undefined;

        // markPaymentAsPaid handles: marking PAID, deleting message drafts, updating lastDataChange
        const payment = await PaymentService.markPaymentAsPaid(user.id, paymentId, method, referenceId);

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

