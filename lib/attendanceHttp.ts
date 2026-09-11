import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { PaginationInputError } from "@/lib/cursorPagination";
import { BranchAccessNotFoundError } from "@/services/accessPolicy.service";
import { AttendanceError } from "@/services/attendance.service";
export function attendanceError(error: unknown) {
    if (error instanceof AttendanceError) return NextResponse.json({ error: error.status === 404 ? "Not found" : error.message }, { status: error.status });
    if (error instanceof BranchAccessNotFoundError) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (error instanceof ZodError || error instanceof SyntaxError || error instanceof PaginationInputError) return NextResponse.json({ error: "Invalid attendance request" }, { status: 400 });
    if (error instanceof Error && /Unauthorized|permission|read.only|writ|archived|entitlement|subscription|activation/i.test(error.message)) {
        return NextResponse.json({ error: "This action is unavailable with your current access or branch status." }, { status: 403 });
    }
    return NextResponse.json({ error: "Unable to confirm the result. Retry the same request to recover it safely." }, { status: 500 });
}
