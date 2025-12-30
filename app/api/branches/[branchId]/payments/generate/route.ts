import { getSessionUser } from "@/lib/auth";
import { PaymentService } from "@/services/payment.service";
import { NextResponse } from "next/server";
import { z } from "zod";

const generateSchema = z.object({
    amount: z.number().int().positive(),
});

export async function POST(
    req: Request,
    { params }: { params: { branchId: string } }
) {
    try {
        const session = await getSessionUser();
        if (!session?.id) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const body = await req.json();
        const { amount } = generateSchema.parse(body);
        const branchId = params.branchId;

        const result = await PaymentService.generateDuePaymentsForBranch(
            session.id,
            branchId,
            amount
        );

        return NextResponse.json(result);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return new NextResponse("Invalid request data", { status: 400 });
        }
        if (error instanceof Error && error.message.includes("Unauthorized")) {
            return new NextResponse(error.message, { status: 403 });
        }
        console.error("[PAYMENTS_GENERATE_POST]", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
