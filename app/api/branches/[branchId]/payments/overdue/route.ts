
import { NextRequest, NextResponse } from "next/server"
import { getOverduePayments } from "@/analytics/payment.analytics"
import { getSessionUser } from "@/lib/auth"
import { PaymentService } from "@/services/payment.service"

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ branchId: string }> }
) {
    try {
        const { branchId } = await params
        const user = await getSessionUser()
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        await PaymentService.assertBranchAccess(user.id, branchId, "view_payments")
        const result = await getOverduePayments(branchId)

        return NextResponse.json(result)
    } catch (error) {
        console.error("Failed to fetch overdue payments", error)
        const message = error instanceof Error ? error.message : "Failed to fetch overdue payments"
        return NextResponse.json(
            { error: message },
            { status: message.includes("Unauthorized") ? 403 : 500 }
        )
    }
}
