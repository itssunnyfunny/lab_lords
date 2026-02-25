import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

/**
 * GET /api/users/me
 * Returns the current user's profile with org and branch count.
 */
export async function GET(req: Request) {
    try {
        const session = await getSessionUser();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { id: session.id },
            include: {
                organizations: {
                    include: {
                        branches: { select: { id: true } },
                    },
                },
                staff: {
                    include: {
                        branch: { select: { id: true, name: true } },
                    },
                },
            },
        });

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        return NextResponse.json(user);
    } catch (error) {
        console.error("GET /api/users/me error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

/**
 * PATCH /api/users/me
 * Updates the current user's display name.
 */
export async function PATCH(req: Request) {
    try {
        const session = await getSessionUser();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { name } = body;

        if (!name || typeof name !== "string" || name.trim().length === 0) {
            return NextResponse.json({ error: "Name is required" }, { status: 400 });
        }

        const updated = await prisma.user.update({
            where: { id: session.id },
            data: { name: name.trim() },
        });

        return NextResponse.json(updated);
    } catch (error) {
        console.error("PATCH /api/users/me error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
