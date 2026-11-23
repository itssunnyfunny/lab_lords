import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { decodeDateIdCursor, PaginationInputError, parsePageLimit } from "@/lib/cursorPagination";
import { StudentService } from "@/services/student.service";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ branchId: string; studentId: string }> },
) {
    try {
        const user = await getSessionUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { branchId, studentId } = await params;
        const { searchParams } = req.nextUrl;
        const limit = parsePageLimit(searchParams.get("limit"));
        const cursor = decodeDateIdCursor(searchParams.get("cursor"));
        return NextResponse.json(await StudentService.getEnrollmentHistory(user.id, branchId, studentId, limit, cursor));
    } catch (error) {
        if (error instanceof PaginationInputError) return NextResponse.json({ error: error.message }, { status: 400 });
        const message = error instanceof Error ? error.message : "";
        if (message.includes("Unauthorized")) return NextResponse.json({ error: message }, { status: 403 });
        if (message.includes("not found")) return NextResponse.json({ error: "Student not found" }, { status: 404 });
        return NextResponse.json({ error: "Unable to load enrollment history." }, { status: 500 });
    }
}
