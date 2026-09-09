import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ user: vi.fn(), list: vi.fn(), save: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getSessionUser: mocks.user }));
vi.mock("@/services/renewals.service", () => ({
    RenewalsService: { list: mocks.list, saveFollowUp: mocks.save },
    RenewalInputError: class extends Error {},
}));
import { GET } from "@/app/api/branches/[branchId]/renewals/route";
import { PUT } from "@/app/api/branches/[branchId]/renewals/follow-up/route";
import { BranchAccessNotFoundError } from "@/services/accessPolicy.service";

const context = { params: Promise.resolve({ branchId: "branch" }) };
const input = { studentId: "student", type: "MONTHLY", periodStart: "2026-08-08T00:00:00.000Z",
    note: "Contacted", outcome: "CONTACTED", nextFollowUpAt: null };
const put = (value = input, headers = {}) => new Request("http://localhost/api/branches/branch/renewals/follow-up", {
    method: "PUT", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(value),
});
describe("renewal routes", () => {
    beforeEach(() => { vi.clearAllMocks(); mocks.user.mockResolvedValue({ id: "actor" }); });
    it("requires a session for reads and follow-up writes", async () => {
        mocks.user.mockResolvedValue(null);
        expect((await GET(new Request("http://localhost/renewals"), context)).status).toBe(401);
        expect((await PUT(put(), context)).status).toBe(401);
        expect(mocks.list).not.toHaveBeenCalled(); expect(mocks.save).not.toHaveBeenCalled();
    });
    it("validates queue filters and disables caching of private notes", async () => {
        mocks.list.mockResolvedValue({ items: [] });
        const response = await GET(new Request("http://localhost/renewals?days=3&search=Sample&limit=10"), context);
        expect(response.status).toBe(200);
        expect(response.headers.get("cache-control")).toContain("no-store");
        expect(mocks.list).toHaveBeenCalledWith("actor", "branch", { filter: "ALL", days: 3, search: "Sample", limit: 10 });
        expect((await GET(new Request("http://localhost/renewals?days=10"), context)).status).toBe(400);
    });
    it("passes clearing values and trusted actor/branch to the service", async () => {
        mocks.save.mockResolvedValue({ ...input, author: { name: "Author" } });
        expect((await PUT(put(), context)).status).toBe(200);
        expect(mocks.save).toHaveBeenCalledWith("actor", "branch", input);
    });
    it("rejects cross-origin requests and forged delivery state", async () => {
        expect((await PUT(put(input, { origin: "https://foreign.example" }), context)).status).toBe(403);
        expect((await PUT(put({ ...input, delivered: true } as typeof input), context)).status).toBe(400);
        expect(mocks.save).not.toHaveBeenCalled();
    });
    it("returns generic not-found and permission errors without private service details", async () => {
        mocks.list.mockRejectedValue(new BranchAccessNotFoundError());
        const response = await GET(new Request("http://localhost/renewals"), context);
        expect(response.status).toBe(404); expect(await response.json()).toEqual({ error: "Not found" });
        mocks.save.mockRejectedValue(new Error("Unauthorized: Permission is disabled"));
        expect((await PUT(put(), context)).status).toBe(403);
        mocks.save.mockRejectedValue(new Error("private SQL details"));
        const failed = await PUT(put(), context);
        expect(failed.status).toBe(500); expect(JSON.stringify(await failed.json())).not.toContain("private SQL");
    });
});
