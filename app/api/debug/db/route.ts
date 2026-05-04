import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { OrganizationService } from "@/services/organization.service";

export async function GET(req: Request) {
    try {
        const users = await prisma.user.findMany({ select: { id: true, email: true } });
        const organizations = await prisma.organization.findMany({
            select: { id: true, name: true, ownerId: true },
        });

        const headers = Object.fromEntries(req.headers.entries());
        const userIdHeader = headers["x-user-id"];
        const serviceTestAlice = await OrganizationService.getOrganizationsByUserId("user_alice");

        return NextResponse.json({
            users,
            organizations,
            userIdHeader,
            serviceTestAlice,
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Debug query failed";
        const stack = error instanceof Error ? error.stack : undefined;
        return NextResponse.json({ error: message, stack }, { status: 500 });
    }
}
