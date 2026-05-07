import { NextRequest, NextResponse } from "next/server";
import { StaffInviteService } from "@/services/staffInvite.service";
import { getSessionUser } from "@/lib/auth";

function getStatusForError(message: string) {
    if (message.includes("Unauthorized")) return 403;
    if (message.includes("not found")) return 404;
    if (message.includes("Accepted invites")) return 409;
    return 500;
}

export async function DELETE(
    _req: NextRequest,
    context: { params: Promise<{ branchId: string; inviteId: string }> }
) {
    try {
        const { branchId, inviteId } = await context.params;
        const user = await getSessionUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        await StaffInviteService.revokeInvite(user.id, branchId, inviteId);

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Failed to revoke invite";
        return NextResponse.json(
            { error: message },
            { status: getStatusForError(message) }
        );
    }
}
