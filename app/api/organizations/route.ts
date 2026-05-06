import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { OrganizationService } from "@/services/organization.service";

export async function GET() {
    try {
        const user = await getSessionUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const organizations = await OrganizationService.getOrganizationsByUserId(user.id);
        return NextResponse.json(organizations);
    } catch (error) {
        console.error("Error fetching organizations:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const user = await getSessionUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const body = await req.json();
        if (!body.name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

        const organization = await OrganizationService.createOrganization({
            name: body.name,
            ownerId: user.id,
        });

        return NextResponse.json(organization, { status: 201 });
    } catch {
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
