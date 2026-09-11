import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { AttendanceService } from "@/services/attendance.service";
import { attendanceError } from "@/lib/attendanceHttp";
export async function POST(req: NextRequest, { params }: { params: Promise<{ branchId: string }> }) {
    try {
        const user = await getSessionUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const text = await req.text();
        if (text.length > 1024) return NextResponse.json({ error: "Request too large" }, { status: 413 });
        const { branchId } = await params, body = JSON.parse(text);
        return NextResponse.json(await AttendanceService.lookup(user.id, branchId, typeof body?.qr === "string" ? body.qr : ""), { headers: { "Cache-Control": "private, no-store" } });
    } catch (error) { return attendanceError(error); }
}
