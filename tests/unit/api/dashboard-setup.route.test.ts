import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ user: vi.fn(), expectations: vi.fn(), terms: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getSessionUser: mocks.user }));
vi.mock("@/services/dashboard.service", () => ({
    DashboardService: { expectations: mocks.expectations, terms: mocks.terms },
    DashboardInputError: class extends Error {}, DashboardNotFoundError: class extends Error {},
}));
import { GET as expectations } from "@/app/api/branches/[branchId]/dashboard/expectations/route";
import { GET as terms } from "@/app/api/branches/[branchId]/dashboard/terms/route";

const context = { params: Promise.resolve({ branchId: "branch" }) };
beforeEach(() => {
    vi.resetAllMocks(); mocks.user.mockResolvedValue({ id: "actor" });
    mocks.expectations.mockResolvedValue({ items: [], total: 501 }); mocks.terms.mockResolvedValue({ items: [], total: 501 });
});
describe.each(["expectations", "terms"] as const)("dashboard setup %s GET", kind => {
    const handler = kind === "terms" ? terms : expectations;
    it("forwards independent cursors, page size and focused student to the policy-bearing service", async () => {
        const query = { cursor: "record", studentCursor: "student", studentId: "focused", limit: "50" };
        const response = await handler(new Request(`http://test.local?${new URLSearchParams(query)}`), context);
        expect(response.status).toBe(200); expect(response.headers.get("Cache-Control")).toBe("private, no-store");
        expect(await response.json()).toEqual({ items: [], total: 501 });
        expect(mocks[kind]).toHaveBeenCalledExactlyOnceWith(...(kind === "terms"
            ? ["actor", "branch", undefined, query] : ["actor", "branch", query]));
    });
    it("requires authentication before requesting a page", async () => {
        mocks.user.mockResolvedValue(null);
        const response = await handler(new Request("http://test.local"), context);
        expect(response.status).toBe(401); expect(mocks[kind]).not.toHaveBeenCalled();
    });
});
