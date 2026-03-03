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
        let result: { date: string; value: number; category?: string }[] = []

        switch (type) {
            case "seat":
                const seatData = await getSeatUtilizationTrend(branchId, from, to)
                result = seatData.map(item => ({
                    date: item.asOf.toISOString(),
                    value: item.utilizationRatio * 100,
                    category: "Seat Utilization"
                }))
                break
            case "students":
                const studentData = await getBranchHealthTrend(branchId, from, to)
                result = studentData.flatMap(item => [
                    {
                        date: item.asOf.toISOString(),
                        value: item.snapshot.students.status.active,
                        category: "Active"
                    },
                    {
                        date: item.asOf.toISOString(),
                        value: item.snapshot.students.status.inactive,
                        category: "Inactive"
                    }
                ])
                break
            case "payment":
                const paymentData = await getPaymentTrend(branchId, from, to)
                result = paymentData.flatMap(item => [
                    {
                        date: item.asOf.toISOString(),
                        value: item.paidAmount,
                        category: "Collected"
                    },
                    {
                        date: item.asOf.toISOString(),
                        value: item.dueAmount,
                        category: "Pending"
                    }
                ])
                break
            case "health":
            default:
                const healthData = await getBranchHealthTrend(branchId, from, to)
                result = healthData.map(item => ({
                    date: item.asOf.toISOString(),
                    value: item.snapshot.seats.overall.utilizationRatio * 100,
                    category: "Health Score"
                }))
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
