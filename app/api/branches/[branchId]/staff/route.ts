import { NextRequest, NextResponse } from "next/server";
import { StaffService } from "@/services/staff.service";
import { getSessionUser } from "@/lib/auth";

// GET: List staff of a branch
export async function GET(
    req: NextRequest,
    context: { params: Promise<{ branchId: string }> }
) {
    try {
        const { branchId } = await context.params;
        const user = await getSessionUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const staffMembers = await StaffService.listStaff(user.id, branchId);
        return NextResponse.json(staffMembers);
    } catch (error: any) {
        return NextResponse.json(
            { error: error.message || "Failed to list staff" },
            { status: 403 } // 403 because it's usually permission denied
        );
    }
}

// POST: Add staff to a branch
export async function POST(
    req: NextRequest,
    context: { params: Promise<{ branchId: string }> }
) {
    try {
        const { branchId } = await context.params;
        const user = await getSessionUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { userId, role } = body;

        if (!userId || !role) {
            return NextResponse.json(
                { error: "Missing required fields: userId, role" },
                { status: 400 }
            );
        }

        const newStaff = await StaffService.addStaff(user.id, branchId, userId, role);
        return NextResponse.json(newStaff, { status: 201 });
    } catch (error: any) {
        return NextResponse.json(
            { error: error.message || "Failed to add staff" },
            { status: 400 }
        );
    }
}
