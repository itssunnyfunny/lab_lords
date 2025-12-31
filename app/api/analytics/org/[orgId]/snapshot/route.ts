import { getOrganizationHealthSnapshot } from "@/analytics/org.analytics"
import { getSessionUser } from "@/lib/auth"
import { NextResponse } from "next/server"

export async function GET(
    _: Request,
    { params }: { params: { orgId: string } }
) {
    const user = await getSessionUser()
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    try {
        const snapshot = await getOrganizationHealthSnapshot(params.orgId)
        return NextResponse.json(snapshot)
    } catch (error) {
        console.error("Error fetching organization snapshot:", error)
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        )
    }
}
