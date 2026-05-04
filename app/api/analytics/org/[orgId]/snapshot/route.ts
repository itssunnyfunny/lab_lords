import { getOrganizationHealthSnapshot } from "@/analytics/org.analytics"
import { getSessionUser } from "@/lib/auth"
import { OrganizationService } from "@/services/organization.service"
import { NextResponse } from "next/server"

export async function GET(
    _: Request,
    { params }: { params: Promise<{ orgId: string }> }
) {
    const user = await getSessionUser()
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    try {
        const { orgId } = await params;
        const isOwner = await OrganizationService.isOwner(orgId, user.id)
        if (!isOwner) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }

        const snapshot = await getOrganizationHealthSnapshot(orgId)
        return NextResponse.json(snapshot)
    } catch (error) {
        console.error("Error fetching organization snapshot:", error)
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        )
    }
}
