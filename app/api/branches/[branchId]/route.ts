import { NextResponse } from "next/server";
import { BranchService } from "@/services/branch.service";
import { getSessionUser } from "@/lib/auth";

function responseForError(error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    const status = message.includes("not found") || message.includes("not found")
        ? 404
        : message.includes("Unauthorized")
            ? 403
            : message.includes("Unknown") || message.includes("must") || message.includes("required") || message.includes("supported")
                ? 400
                : 500;
    return NextResponse.json({ error: message }, { status });
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

        const branch = await BranchService.getBranchDetails(user.id, branchId);
        if (!branch) {
            return NextResponse.json({ error: "Branch not found" }, { status: 404 });
        }

        return NextResponse.json(branch);
    } catch (error) {
        console.error("Error fetching branch:", error);
        return responseForError(error);
    }
}

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ branchId: string }> }
) {
    try {
        const { branchId } = await params;
        const user = await getSessionUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const updated = await BranchService.updateSettings(user.id, branchId, await req.json());
        return NextResponse.json(updated);
    } catch (error) {
        console.error("Error updating branch:", error);
        return responseForError(error);
    }
}
