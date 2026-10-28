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

        // There is no supported caller or reliable organization historical
        // snapshot source. Retire the placeholder instead of inventing history.
        return NextResponse.json(
            { code: "ORGANIZATION_TRENDS_RETIRED", message: "Organization trends are retired. Use the organization snapshot." },
            { status: 410 }
        )
    } catch (error) {
        if (error instanceof OrganizationAccessNotFoundError) {
            return NextResponse.json({ error: error.message }, { status: 404 })
        }
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
