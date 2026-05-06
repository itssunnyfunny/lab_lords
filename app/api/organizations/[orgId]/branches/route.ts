import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { BranchService } from "@/services/branch.service";
import { OrganizationService } from "@/services/organization.service";

// Correctly type the params as a Promise for Next.js 15+
interface Params {
    params: Promise<{
        orgId: string;
    }>;
}

export async function GET(_req: Request, { params }: Params) {
    try {
        const { orgId } = await params;
        const user = await getSessionUser();

        if (!user) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const isOwner = await OrganizationService.isOwner(orgId, user.id);
        if (!isOwner) {
            return NextResponse.json(
                { error: "Forbidden: You do not own this organization" },
                { status: 403 }
            );
        }

        const branches = await BranchService.getBranchesByOrganizationId(orgId);
        return NextResponse.json(branches);
    } catch (error) {
        console.error("Error fetching branches:", error);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}

export async function POST(req: Request, { params }: Params) {
    try {
        const { orgId } = await params;
        const user = await getSessionUser();

        if (!user) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const isOwner = await OrganizationService.isOwner(orgId, user.id);
        if (!isOwner) {
            return NextResponse.json(
                { error: "Forbidden: You do not own this organization" },
                { status: 403 }
            );
        }

        const body = await req.json();

        if (!body.name) {
            return NextResponse.json(
                { error: "Name is required" },
                { status: 400 }
            );
        }

        const branch = await BranchService.createBranch({
            name: body.name,
            organizationId: orgId,
        });

        return NextResponse.json(branch, { status: 201 });
    } catch (error) {
        console.error("Error creating branch:", error);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
