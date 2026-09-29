import { getSessionUser } from "@/lib/auth"
import { OrganizationAccessNotFoundError } from "@/lib/organizationErrors"
import { AccessPolicy } from "@/services/accessPolicy.service"
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
        const { orgId } = await params
        await AccessPolicy.authorizeOrganization(user.id, orgId)

        // "No need to overbuild yet"
        // Organization-level trends require aggregating branch trends over time,
        // which is computationally expensive and not yet optimized.
        return NextResponse.json(
            { message: "Organization trends not yet implemented" },
            { status: 501 }
        )
    } catch (error) {
        if (error instanceof OrganizationAccessNotFoundError) {
            return NextResponse.json({ error: error.message }, { status: 404 })
        }
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
