import { getBranchHealthSnapshot } from "@/analytics/branch.analytics"
import { getSessionUser } from "@/lib/auth"
import { NextResponse } from "next/server"

export async function GET(
    _: Request,
    { params }: { params: { branchId: string } }
) {
    const user = await getSessionUser()
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    try {
        const snapshot = await getBranchHealthSnapshot(params.branchId)
        return NextResponse.json(snapshot)
    } catch (error) {
        console.error("Error fetching branch snapshot:", error)
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        )
    }
}
