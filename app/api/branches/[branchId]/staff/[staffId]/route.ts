import { NextRequest, NextResponse } from "next/server";
import { StaffService } from "@/services/staff.service";
import { getSessionUser } from "@/lib/auth";
import { StaffRole } from "@/types";

// DELETE: Remove staff from a branch
export async function DELETE(
    req: NextRequest,
    context: { params: Promise<{ branchId: string; staffId: string }> }
) {
    try {
        const { branchId, staffId } = await context.params;
        const user = await getSessionUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        await StaffService.removeStaff(user.id, branchId, staffId);
        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Failed to remove staff";
        return NextResponse.json({ error: message }, { status: 400 });
    }
}

// PATCH: Update a staff member's role
export async function PATCH(
    req: NextRequest,
    context: { params: Promise<{ branchId: string; staffId: string }> }
) {
    try {
        const { branchId, staffId } = await context.params;
        const user = await getSessionUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const body = await req.json();
        const { role } = body;

        if (!role || !Object.values(StaffRole).includes(role)) {
            return NextResponse.json({ error: "Invalid role. Must be MANAGER or STAFF." }, { status: 400 });
        }

        const updated = await StaffService.updateStaffRole(user.id, branchId, staffId, role as StaffRole);
        return NextResponse.json(updated);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Failed to update role";
        const status = message.includes("not found") ? 404
            : message.includes("Unauthorized") ? 403
                : 400;
        return NextResponse.json({ error: message }, { status });
    }
}
