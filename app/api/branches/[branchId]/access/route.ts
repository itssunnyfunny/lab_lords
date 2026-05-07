import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { StaffService } from "@/services/staff.service";

function statusForError(message: string) {
    if (message.includes("not found")) return 404;
    if (message.includes("Unauthorized")) return 403;
    return 500;
}

export async function GET(
    _req: Request,
    { params }: { params: Promise<{ branchId: string }> }
) {
    try {
        const { branchId } = await params;
        const user = await getSessionUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const access = await StaffService.getBranchAccess(user.id, branchId);
        return NextResponse.json(access);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Internal Server Error";
        return NextResponse.json({ error: message }, { status: statusForError(message) });
    }
}
