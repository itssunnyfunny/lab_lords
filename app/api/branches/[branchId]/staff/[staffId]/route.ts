import { NextRequest, NextResponse } from "next/server";
import { StaffService } from "@/services/staff.service";
import { getSessionUser } from "@/lib/auth";

// DELETE: Remove staff from a branch
export async function DELETE(
    req: NextRequest,
    context: { params: Promise<{ branchId: string; staffId: string }> }
) {
    try {
        const { branchId, staffId } = await context.params;
        const user = await getSessionUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        await StaffService.removeStaff(user.id, branchId, staffId);
        return NextResponse.json({ success: true, message: "Staff removed" });
    } catch (error: any) {
        return NextResponse.json(
            { error: error.message || "Failed to remove staff" },
            { status: 400 }
        );
    }
}
