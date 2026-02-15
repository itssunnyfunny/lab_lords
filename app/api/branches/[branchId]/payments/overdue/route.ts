
import { NextRequest, NextResponse } from "next/server"
import { getOverduePayments } from "@/analytics/payment.analytics"

export async function GET(
    req: NextRequest,
    { params }: { params: { branchId: string } }
) {
    try {
        const { branchId } = params
        const result = await getOverduePayments(branchId)

        return NextResponse.json(result)
    } catch (error) {
        console.error("Failed to fetch overdue payments", error)
        return NextResponse.json(
            { error: "Failed to fetch overdue payments" },
            { status: 500 }
        )
    }
}
