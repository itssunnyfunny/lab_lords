import { AnalyticsAccessService } from "@/services/analyticsAccess.service"
import { getSessionUser } from "@/lib/auth"
import { OrganizationAccessNotFoundError } from "@/lib/organizationErrors"
import { SubscriptionEntitlementError } from "@/services/entitlement.service"
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
        const snapshot = await AnalyticsAccessService.organizationSnapshot(user.id, orgId)
        return NextResponse.json(snapshot)
    } catch (error) {
        if (error instanceof OrganizationAccessNotFoundError) {
            return NextResponse.json({ error: error.message }, { status: 404 })
        }
        if (error instanceof SubscriptionEntitlementError) {
            return NextResponse.json({ error: error.message, code: error.code }, { status: 403 })
        }
        console.error("Error fetching organization snapshot:", error)
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        )
    }
}
