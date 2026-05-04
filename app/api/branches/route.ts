import { NextResponse } from "next/server";
import { BranchService } from "@/services/branch.service";
import { getSessionUser } from "@/lib/auth";

function getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : "Internal Server Error";
}

/**
 * POST /api/branches
 * Creates a new branch under an existing organization.
 * Shared with the onboarding flow's underlying logic via BranchService.createBranchForOrg.
 */
export async function POST(req: Request) {
    try {
        const user = await getSessionUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { organizationId, name, city, defaultFee, seatCount, shifts } = body;

        if (!organizationId || typeof organizationId !== "string") {
            return NextResponse.json({ error: "organizationId is required" }, { status: 400 });
        }
        if (!name || typeof name !== "string" || name.trim().length === 0) {
            return NextResponse.json({ error: "Branch name is required" }, { status: 400 });
        }

        const branch = await BranchService.createBranchForOrg({
            organizationId,
            userId: user.id,
            name: name.trim(),
            city: city?.trim() || undefined,
            defaultFee: defaultFee ? parseInt(defaultFee) : 0,
            seatCount: seatCount ? parseInt(seatCount) : 0,
            shifts: shifts && Array.isArray(shifts) ? shifts : undefined,
        });

        return NextResponse.json(branch, { status: 201 });
    } catch (error: unknown) {
        const message = getErrorMessage(error);
        console.error("Error creating branch:", error);
        return NextResponse.json(
            { error: message },
            { status: 500 }
        );
    }
}
