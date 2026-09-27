import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ user: vi.fn(), overview: vi.fn(), capture: vi.fn(), createTask: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getSessionUser: mocks.user }));
vi.mock("@/services/dashboard.service", () => ({ DashboardService: { overview: mocks.overview, captureOccupancy: mocks.capture, createTask: mocks.createTask },
    DashboardInputError: class extends Error {}, DashboardNotFoundError: class extends Error {} }));
import { GET, POST } from "@/app/api/branches/[branchId]/dashboard/route";
import { POST as createTask } from "@/app/api/branches/[branchId]/dashboard/tasks/route";
import { BranchAccessNotFoundError } from "@/services/accessPolicy.service";
const context = { params: Promise.resolve({ branchId: "branch" }) };
const request = (body: unknown, headers: Record<string, string> = {}) => new Request("http://localhost/api/branches/branch/dashboard", {
    method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });

describe("dashboard API", () => {
    beforeEach(() => { vi.resetAllMocks(); mocks.user.mockResolvedValue({ id: "actor" }); });
    it("requires a session before reading tenant data or decoding a command", async () => {
        mocks.user.mockResolvedValue(null);
        expect((await GET(new Request("http://localhost/dashboard"), context)).status).toBe(401);
        expect((await POST(request({ kind: "CAPTURE_OCCUPANCY" }), context)).status).toBe(401);
        expect(mocks.overview).not.toHaveBeenCalled(); expect(mocks.capture).not.toHaveBeenCalled();
    });
    it("validates ranges and passes trusted actor and branch to private no-store reads", async () => {
        mocks.overview.mockResolvedValue({ branchId: "branch" });
        const response = await GET(new Request("http://localhost/dashboard?month=2026-09"), context);
        expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toContain("no-store");
        expect(mocks.overview).toHaveBeenCalledWith("actor", "branch", "2026-09");
        expect((await GET(new Request("http://localhost/dashboard?month=2026-13"), context)).status).toBe(400);
    });
    it("rejects cross-origin and oversized writes without running a service mutation", async () => {
        expect((await POST(request({ kind: "CAPTURE_OCCUPANCY" }, { origin: "https://foreign.example" }), context)).status).toBe(403);
        expect((await createTask(request({ title: "x".repeat(13000) }), context)).status).toBe(413);
        expect(mocks.capture).not.toHaveBeenCalled(); expect(mocks.createTask).not.toHaveBeenCalled();
    });
    it("bounds actual streaming bytes, including multibyte text without a length header", async () => {
        expect((await createTask(request({ title: "अ".repeat(6000) }), context)).status).toBe(413);
        let cancelled = false;
        let chunks = 0;
        const body = new ReadableStream<Uint8Array>({ pull(controller) { chunks++; controller.enqueue(new Uint8Array(2000)); },
            cancel() { cancelled = true; } });
        const streamed = new Request("http://localhost/dashboard", { method: "POST", headers: { "content-type": "application/json" },
            body, duplex: "half" } as RequestInit & { duplex: "half" });
        expect((await createTask(streamed, context)).status).toBe(413);
        expect(cancelled).toBe(true); expect(chunks).toBeLessThanOrEqual(8);
        expect(mocks.createTask).not.toHaveBeenCalled();
    });
    it("does not leak unknown tenant existence or internal source errors", async () => {
        mocks.overview.mockRejectedValue(new BranchAccessNotFoundError());
        const foreign = await GET(new Request("http://localhost/dashboard"), context);
        expect(foreign.status).toBe(404); expect(await foreign.json()).toEqual({ error: "Not found" });
        mocks.overview.mockRejectedValue(new Error("private SQL values"));
        const failed = await GET(new Request("http://localhost/dashboard"), context);
        expect(failed.status).toBe(500); expect(JSON.stringify(await failed.json())).not.toContain("private SQL");
    });
});
