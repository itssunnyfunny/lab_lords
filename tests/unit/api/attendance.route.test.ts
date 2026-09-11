import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ user: vi.fn(), list: vi.fn(), history: vi.fn(), command: vi.fn(), lookup: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getSessionUser: mocks.user }));
vi.mock("@/services/attendance.service", async importOriginal => ({ ...await importOriginal<typeof import("@/services/attendance.service")>(), AttendanceService: mocks }));
import { AttendanceError } from "@/services/attendance.service";
import { GET, POST } from "@/app/api/branches/[branchId]/attendance/route";
import { POST as LOOKUP } from "@/app/api/branches/[branchId]/attendance/lookup/route";
const context = { params: Promise.resolve({ branchId: "branch" }) };
const post = (body: unknown = {}, origin?: string) => new NextRequest("http://localhost/api/branches/branch/attendance", { method: "POST", headers: { "content-type": "application/json", ...(origin ? { origin } : {}) }, body: JSON.stringify(body) });
describe("attendance routes", () => {
    beforeEach(() => { vi.clearAllMocks(); mocks.user.mockResolvedValue({ id: "trusted" }); });
    it("requires a signed-in session for every read, lookup and mutation", async () => {
        mocks.user.mockResolvedValue(null);
        for (const result of [await GET(new NextRequest("http://localhost/attendance"), context), await POST(post(), context), await LOOKUP(post(), context)]) expect(result.status).toBe(401);
        expect(mocks.command).not.toHaveBeenCalled(); expect(mocks.lookup).not.toHaveBeenCalled();
    });
    it("uses authenticated actor and branch, and no-store for history and roster", async () => {
        mocks.list.mockResolvedValue({ items: [] }); mocks.history.mockResolvedValue({ visits: [] });
        let result = await GET(new NextRequest("http://localhost/attendance?date=2026-09-11"), context);
        expect(mocks.list).toHaveBeenCalledWith("trusted", "branch", { date: "2026-09-11" }); expect(result.headers.get("cache-control")).toContain("no-store");
        result = await GET(new NextRequest("http://localhost/attendance?studentId=student&from=2026-09-01&to=2026-09-11"), context);
        expect(mocks.history).toHaveBeenCalled(); expect(result.status).toBe(200);
        mocks.command.mockResolvedValue({ message: "Recorded" }); await POST(post({ key: "request" }), context);
        expect(mocks.command).toHaveBeenCalledWith("trusted", "branch", { key: "request" });
    });
    it("rejects cross-origin mutations and oversized requests", async () => {
        expect((await POST(post({}, "https://foreign.example"), context)).status).toBe(403);
        expect((await POST(post({ note: "x".repeat(33000) }), context)).status).toBe(413);
        expect(mocks.command).not.toHaveBeenCalled();
    });
    it("maps foreign/missing, stale, denied and uncertain outcomes without leaking internals", async () => {
        mocks.command.mockRejectedValue(new AttendanceError("Attendance record not found", 404));
        let result = await POST(post(), context); expect(result.status).toBe(404); expect(await result.json()).toEqual({ error: "Not found" });
        mocks.command.mockRejectedValue(new AttendanceError("Attendance changed", 409)); expect((await POST(post(), context)).status).toBe(409);
        mocks.command.mockRejectedValue(new Error("Unauthorized: permission disabled")); expect((await POST(post(), context)).status).toBe(403);
        mocks.command.mockRejectedValue(new Error("private SQL data")); result = await POST(post(), context);
        expect(result.status).toBe(500); expect(JSON.stringify(await result.json())).not.toContain("private SQL");
        mocks.lookup.mockRejectedValue(new AttendanceError("Attendance record not found", 404)); expect((await LOOKUP(post({ qr: "foreign" }), context)).status).toBe(404);
    });
});
