import { NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/lib/auth"
import { getBranchHealthTrend } from "@/analytics/trends/branch.trends"
import { getPaymentTrend } from "@/analytics/trends/payment.trends"
import { getSeatUtilizationTrend } from "@/analytics/trends/seat.trends"
import { AnalyticsPeriod } from "@/analytics/payment.analytics"
import { StaffService } from "@/services/staff.service"

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ branchId: string }> }
) {
    const user = await getSessionUser()
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const { branchId } = await params;
    try {
        await StaffService.authorize(user.id, branchId, "analytics")
    } catch (error) {
        if (error instanceof Error && error.message.includes("Branch not found")) {
            return NextResponse.json({ error: error.message }, { status: 404 })
        }
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const fromParam = searchParams.get("from")
    const toParam = searchParams.get("to")
    const type = searchParams.get("type") || "health"
    const period: AnalyticsPeriod = searchParams.get("period") === "month" ? "month" : "all"

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
                const paymentData = await getPaymentTrend(branchId, from, to, "DAY", period)
                result = paymentData.flatMap(item => [
                    {
                        date: item.asOf.toISOString(),
                        value: item.revenueAmount,
                        category: "Revenue"
                    },
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
                    value: item.snapshot.seats.occupancySnapshot.totalOccupancyPercent,
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
