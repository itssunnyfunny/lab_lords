import { NextResponse } from "next/server";
import { PaymentService } from "@/services/payment.service";

export async function GET(request: Request) {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const result = await PaymentService.generateDuePaymentsForAllActiveStudents();

        return NextResponse.json({
            ok: true,
            ...result,
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Internal Server Error";
        console.error("[PAYMENTS_DAILY_CRON]", error);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
