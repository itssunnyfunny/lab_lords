import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { OrganizationService } from "@/services/organization.service";

export async function GET(req: Request) {
    try {
        const users = await prisma.user.findMany({ select: { id: true, email: true } });
        const organizations = await prisma.organization.findMany({
            select: { id: true, name: true, ownerId: true }
        });

        // Test the service explicitly
        const serviceTestAlice = await OrganizationService.getOrganizationsByUserId("user_alice");

        // The previous return statement was removed as per the instruction.
        // This leaves the GET function without a return statement in the try block,
        // which might lead to an error if not handled by subsequent changes.
        return NextResponse.json({ users, organizations, serviceTestAlice });
    } catch (error: any) {
        return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 });
    }
}
