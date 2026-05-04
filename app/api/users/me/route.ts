import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { UserService } from "@/services/user.service";

/**
 * GET /api/users/me
 * Returns the current user's profile with org and branch count.
 */
export async function GET() {
    try {
        const session = await getSessionUser();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const user = await UserService.getUserProfile(session.id);

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

        const updated = await UserService.updateSettings(session.id, await req.json());

        return NextResponse.json(updated);
    } catch (error) {
        console.error("PATCH /api/users/me error:", error);
        const message = error instanceof Error ? error.message : "Internal Server Error";
        const status = message.includes("Unknown") || message.includes("must") || message.includes("required")
            ? 400
            : 500;
        return NextResponse.json({ error: message }, { status });
    }
}
