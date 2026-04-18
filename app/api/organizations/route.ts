import { NextResponse } from "next/server";
import { OrganizationService } from "@/services/organization.service";
import { getSessionUser } from "@/lib/auth";

export async function GET(req: Request) {
    try {
        // SECURE: Retrieve user from session instead of easily spoofed headers
        const user = await getSessionUser();
        const userId = user?.id;

        if (!userId) {
            return NextResponse.json({ error: "Unauthorized: Invalid session" }, { status: 401 });
        }

        const organizations = await OrganizationService.getOrganizationsByUserId(userId);
        return NextResponse.json(organizations);
    } catch (error) {
        console.error("Error fetching organizations:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        // SECURE: Retrieve user from session instead of easily spoofed headers
        const user = await getSessionUser();
        const userId = user?.id;
        if (!userId) return NextResponse.json({ error: "Unauthorized: Invalid session" }, { status: 401 });
        const body = await req.json();
        if (!body.name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

        const organization = await OrganizationService.createOrganization({
            name: body.name,
            ownerId: userId,
        });

        return NextResponse.json(organization, { status: 201 });
    } catch (error) {
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
