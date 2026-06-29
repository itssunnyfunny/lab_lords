import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    getSessionUser: vi.fn(),
    commitSession: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
    getSessionUser: mocks.getSessionUser,
}));

vi.mock("@/importing/services/import-commit.service", () => ({
    ImportCommitService: {
        commitSession: mocks.commitSession,
    },
}));

describe("/api/branches/[branchId]/import-sessions/[sessionId]/commit", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("requires a reviewed plan version", async () => {
        mocks.getSessionUser.mockResolvedValueOnce({ id: "user_1" });
        const { POST } = await import("@/app/api/branches/[branchId]/import-sessions/[sessionId]/commit/route");

        const response = await POST(
            new Request("http://test.local/api/branches/branch_1/import-sessions/session_1/commit", {
                method: "POST",
                body: JSON.stringify({ confirm: true, mode: "SAFE_PARTIAL" }),
            }),
            { params: Promise.resolve({ branchId: "branch_1", sessionId: "session_1" }) }
        );

        expect(response.status).toBe(400);
        expect(mocks.commitSession).not.toHaveBeenCalled();
    });

    it("passes plan version to ImportCommitService", async () => {
        mocks.getSessionUser.mockResolvedValueOnce({ id: "user_1" });
        mocks.commitSession.mockResolvedValueOnce({ status: "SUCCESS", summary: {}, errors: [] });
        const { POST } = await import("@/app/api/branches/[branchId]/import-sessions/[sessionId]/commit/route");

        const response = await POST(
            new Request("http://test.local/api/branches/branch_1/import-sessions/session_1/commit", {
                method: "POST",
                body: JSON.stringify({ confirm: true, mode: "SAFE_PARTIAL", planVersion: "abc123" }),
            }),
            { params: Promise.resolve({ branchId: "branch_1", sessionId: "session_1" }) }
        );

        expect(response.status).toBe(200);
        expect(mocks.commitSession).toHaveBeenCalledWith("user_1", "branch_1", "session_1", "SAFE_PARTIAL", "abc123");
    });
});
