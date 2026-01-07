import { getBranchHealthSnapshot } from "@/analytics/branch.analytics"
import { getSessionUser } from "@/lib/auth"
import { NextResponse } from "next/server"

export async function GET(
    _: Request,
    { params }: { params: Promise<{ branchId: string }> }
) {
    const user = await getSessionUser()
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    try {
        const { branchId } = await params;
        const health = await getBranchHealthSnapshot(branchId)

        // Transform to match BranchSnapshot interface in lib/api/analytics.ts
        const totalSeats = health.seats.overall.totalSeats;
        const assignedSeats = health.seats.overall.occupiedSeats;
        const totalStudents = health.students.status.active + health.students.status.inactive;

        // Calculate financial metrics
        const paidAmount = health.payments.paidAmount;
        const dueAmount = health.payments.dueAmount;
        const monthlyRevenue = paidAmount + dueAmount; // Total Billable Revenue

        // Avoid division by zero
        const collectionRate = monthlyRevenue > 0
            ? (paidAmount / monthlyRevenue) * 100
            : 0;

        const snapshot = {
            totalStudents,
            activeStudents: health.students.status.active,
            assignedSeats,
            totalSeats,
            occupancyRate: health.seats.overall.utilizationRatio * 100,
            monthlyRevenue,
            dueAmount,
            paidAmount,
            collectionRate
        };

        return NextResponse.json(snapshot)
    } catch (error) {
        console.error("Error fetching branch snapshot:", error)
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        )
    }
}
