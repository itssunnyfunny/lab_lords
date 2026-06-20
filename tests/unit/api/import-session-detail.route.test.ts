import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    getSessionUser: vi.fn(),
    getSessionDetail: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
    getSessionUser: mocks.getSessionUser,
}));

vi.mock("@/importing/services/import-session.service", () => ({
    ImportSessionService: {
        getSessionDetail: mocks.getSessionDetail,
    },
}));

describe("/api/branches/[branchId]/import-sessions/[sessionId]", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("passes row paging query options to ImportSessionService", async () => {
        mocks.getSessionUser.mockResolvedValueOnce({ id: "user_1" });
        mocks.getSessionDetail.mockResolvedValueOnce({ id: "session_1", rows: [], rowPage: { returnedRows: 0 } });
        const { GET } = await import("@/app/api/branches/[branchId]/import-sessions/[sessionId]/route");

        const response = await GET(
            new Request("http://test.local/api/branches/branch_1/import-sessions/session_1?rowFilter=attention&limit=50&cursor=200"),
            { params: Promise.resolve({ branchId: "branch_1", sessionId: "session_1" }) }
        );

        expect(response.status).toBe(200);
        expect(mocks.getSessionDetail).toHaveBeenCalledWith("user_1", "branch_1", "session_1", {
            rowFilter: "attention",
            limit: 50,
            cursor: 200,
        });
    });
});
