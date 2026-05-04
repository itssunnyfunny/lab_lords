import { NextResponse } from "next/server";
import { OnboardingService } from "@/services/onboarding.service";

function getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : "Failed to complete setup";
}

export async function POST(req: Request) {
    try {
        // TEMP AUTH: Get user from header
        const userId = req.headers.get("x-user-id");
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { orgName, businessType, branchName, city, defaultFee } = body;

        // Basic validation
        if (!orgName || !branchName) {
            return NextResponse.json(
                { error: "Organization Name and Branch Name are required." },
                { status: 400 }
            );
        }

        const result = await OnboardingService.createNetwork({
            userId,
            orgData: {
                name: orgName,
                businessType,
            },
            branchData: {
                name: branchName,
                city,
                defaultFee: defaultFee ? parseInt(defaultFee) : 0,
            },
        });

        return NextResponse.json(result, { status: 201 });
    } catch (error: unknown) {
        console.error("Onboarding Error:", error);
        return NextResponse.json(
            { error: getErrorMessage(error) },
            { status: 500 }
        );
    }
}
