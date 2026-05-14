import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    getSessionUser: vi.fn(),
    createSession: vi.fn(),
    listSessions: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
    getSessionUser: mocks.getSessionUser,
}));

vi.mock("@/importing/services/import-session.service", () => ({
    ImportSessionService: {
        createSession: mocks.createSession,
        listSessions: mocks.listSessions,
    },
}));

describe("/api/branches/[branchId]/import-sessions", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns 401 for unauthenticated POST", async () => {
        mocks.getSessionUser.mockResolvedValueOnce(null);
        const { POST } = await import("@/app/api/branches/[branchId]/import-sessions/route");

        const response = await POST(
            new Request("http://test.local/api/branches/branch_1/import-sessions", {
                method: "POST",
                body: JSON.stringify({ pastedTable: "Name\nAsha" }),
            }),
            { params: Promise.resolve({ branchId: "branch_1" }) }
        );

        expect(response.status).toBe(401);
        expect(mocks.createSession).not.toHaveBeenCalled();
    });

    it("returns 401 for unauthenticated GET", async () => {
        mocks.getSessionUser.mockResolvedValueOnce(null);
        const { GET } = await import("@/app/api/branches/[branchId]/import-sessions/route");

        const response = await GET(
            new Request("http://test.local/api/branches/branch_1/import-sessions"),
            { params: Promise.resolve({ branchId: "branch_1" }) }
        );

        expect(response.status).toBe(401);
        expect(mocks.listSessions).not.toHaveBeenCalled();
    });

    it("delegates pasted-table creation to ImportSessionService", async () => {
        mocks.getSessionUser.mockResolvedValueOnce({ id: "user_1" });
        mocks.createSession.mockResolvedValueOnce({ id: "session_1" });
        const { POST } = await import("@/app/api/branches/[branchId]/import-sessions/route");

        const response = await POST(
            new Request("http://test.local/api/branches/branch_1/import-sessions", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ pastedTable: "Name\nAsha" }),
            }),
            { params: Promise.resolve({ branchId: "branch_1" }) }
        );

        expect(response.status).toBe(201);
        expect(mocks.createSession).toHaveBeenCalledWith("user_1", "branch_1", expect.objectContaining({
            sourceType: "PASTED_TABLE",
            pastedTable: "Name\nAsha",
        }));
    });
});
