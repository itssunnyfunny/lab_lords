import { NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth"
import { getBranchHealthTrend } from "@/analytics/trends/branch.trends"
import { getPaymentTrend } from "@/analytics/trends/payment.trends"
import { getSeatUtilizationTrend } from "@/analytics/trends/seat.trends"

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ branchId: string }> }
) {
    const user = await getSessionUser()
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const { branchId } = await params;

    const searchParams = request.nextUrl.searchParams
    const fromParam = searchParams.get("from")
    const toParam = searchParams.get("to")
    const type = searchParams.get("type") || "health"

    if (!fromParam || !toParam) {
        return NextResponse.json(
            { error: "Missing 'from' and 'to' query parameters" },
            { status: 400 }
        )
    }

    const from = new Date(fromParam)
    const to = new Date(toParam)

    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
        return NextResponse.json({ error: "Invalid date format" }, { status: 400 })
    }

    try {
        let result
        switch (type) {
            case "seat":
                result = await getSeatUtilizationTrend(branchId, from, to)
                break
            case "payment":
                result = await getPaymentTrend(branchId, from, to)
                break
            case "health":
                result = await getBranchHealthTrend(branchId, from, to)
                break
            default:
                // Defaulting to health if unknown type, or could return error
                result = await getBranchHealthTrend(branchId, from, to)
                break
        }

        return NextResponse.json(result)
    } catch (error) {
        console.error("Error fetching branch trends:", error)
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        )
    }
}
