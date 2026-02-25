import { NextRequest, NextResponse } from "next/server";
import { OrganizationService } from "@/services/organization.service";
import { getSessionUser } from "@/lib/auth";

/**
 * GET /api/organizations/[orgId]
 * Returns org details with branches.
 */
export async function GET(
    _req: NextRequest,
    context: { params: Promise<{ orgId: string }> }
) {
    try {
        const user = await getSessionUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { orgId } = await context.params;
        const org = await OrganizationService.getOrganizationById(orgId);
        if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });

        return NextResponse.json(org);
    } catch (error: any) {
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}

/**
 * PATCH /api/organizations/[orgId]
 * Updates org name and/or businessType. Owner only.
 */
export async function PATCH(
    req: NextRequest,
    context: { params: Promise<{ orgId: string }> }
) {
    try {
        const user = await getSessionUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { orgId } = await context.params;
        const body = await req.json();
        const { name, businessType } = body;

        if (name !== undefined && (typeof name !== "string" || name.trim().length === 0)) {
            return NextResponse.json({ error: "Organization name cannot be empty" }, { status: 400 });
        }

        const updated = await OrganizationService.updateOrganization(orgId, user.id, {
            name,
            businessType,
        });

        return NextResponse.json(updated);
    } catch (error: any) {
        const status = error.message.includes("not found") ? 404
            : error.message.includes("Unauthorized") ? 403
                : 500;
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status });
    }
}
