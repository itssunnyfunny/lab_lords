import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { AttendanceService } from "@/services/attendance.service";
import { attendanceError } from "@/lib/attendanceHttp";
const headers = { "Cache-Control": "private, no-store" };
export async function GET(req: NextRequest, { params }: { params: Promise<{ branchId: string }> }) {
    try {
        const user = await getSessionUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { branchId } = await params, query = Object.fromEntries(req.nextUrl.searchParams);
        const result = query.studentId ? await AttendanceService.history(user.id, branchId, query) : await AttendanceService.list(user.id, branchId, query);
        return NextResponse.json(result, { headers });
    } catch (error) { return attendanceError(error); }
}
export async function POST(req: NextRequest, { params }: { params: Promise<{ branchId: string }> }) {
    try {
        const user = await getSessionUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { branchId } = await params;
        const origin = req.headers.get("origin");
        if ((origin && origin !== new URL(req.url).origin) || req.headers.get("sec-fetch-site") === "cross-site") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        if (!req.headers.get("content-type")?.startsWith("application/json")) return NextResponse.json({ error: "JSON required" }, { status: 415 });
        const text = await req.text();
        if (text.length > 32768) return NextResponse.json({ error: "Attendance request too large" }, { status: 413 });
        return NextResponse.json(await AttendanceService.command(user.id, branchId, JSON.parse(text)), { headers });
    } catch (error) { return attendanceError(error); }
}
