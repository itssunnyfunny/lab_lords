import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { BranchAccessNotFoundError } from "@/services/accessPolicy.service";
import { SeatAllocationService } from "@/services/seatAllocation.service";

export async function GET(_request: Request, { params }: { params: Promise<{ branchId: string }> }) {
    try {
        const user = await getSessionUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { branchId } = await params;
        const result = await SeatAllocationService.listStudentOptions(user.id, branchId);
        return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
    } catch (error) {
        if (error instanceof BranchAccessNotFoundError) {
            return NextResponse.json({ error: "Branch not found" }, { status: 404 });
        }
        if (error instanceof Error && error.message.startsWith("Unauthorized:")) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        console.error("[ALLOCATION_STUDENT_OPTIONS_GET] Unexpected selector failure");
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
