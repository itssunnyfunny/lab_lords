import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { checkRateLimit, getRequestRateLimitKey } from "@/lib/rateLimit";
import { OrganizationService } from "@/services/organization.service";
import { validateRequiredPhone, validateRequiredText } from "@/lib/formValidation";

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

        const rateLimitKey = getRequestRateLimitKey(req, "organization-create", user.id);
        const { allowed, retryAfter } = checkRateLimit(rateLimitKey, { limit: 10, windowMs: 60000 });
        if (!allowed) {
            return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": retryAfter.toString() } });
        }

        const body = await req.json();
        const nameResult = validateRequiredText(body.name, "Organization name", 120);
        if (!nameResult.ok) return NextResponse.json({ error: nameResult.error }, { status: 400 });
        const contactPhoneResult = validateRequiredPhone(body.contactPhone, "Contact phone");
        if (!contactPhoneResult.ok) return NextResponse.json({ error: contactPhoneResult.error }, { status: 400 });

        const organization = await OrganizationService.createOrganization({
            name: nameResult.value,
            ownerId: user.id,
            contactPhone: contactPhoneResult.value,
        });

        return NextResponse.json(organization, { status: 201 });
    } catch {
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
