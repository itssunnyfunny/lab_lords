import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    getSessionUser: vi.fn(),
    previewRowDraft: vi.fn(),
    getAvailability: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
    getSessionUser: mocks.getSessionUser,
}));

vi.mock("@/importing/services/import-wiring.service", () => ({
    ImportWiringService: {
        previewRowDraft: mocks.previewRowDraft,
        getAvailability: mocks.getAvailability,
    },
}));

describe("import wiring API routes", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns 401 for unauthenticated row preview", async () => {
        mocks.getSessionUser.mockResolvedValueOnce(null);
        const { POST } = await import("@/app/api/branches/[branchId]/import-sessions/[sessionId]/rows/preview/route");

        const response = await POST(
            new Request("http://test.local/api/branches/branch_1/import-sessions/session_1/rows/preview", {
                method: "POST",
                body: JSON.stringify({ rowId: "row_1", normalizedData: {} }),
            }),
            { params: Promise.resolve({ branchId: "branch_1", sessionId: "session_1" }) }
        );

        expect(response.status).toBe(401);
        expect(mocks.previewRowDraft).not.toHaveBeenCalled();
    });

    it("delegates row draft preview to ImportWiringService", async () => {
        mocks.getSessionUser.mockResolvedValueOnce({ id: "user_1" });
        mocks.previewRowDraft.mockResolvedValueOnce({ rowId: "row_1", status: "READY" });
        const { POST } = await import("@/app/api/branches/[branchId]/import-sessions/[sessionId]/rows/preview/route");

        const response = await POST(
            new Request("http://test.local/api/branches/branch_1/import-sessions/session_1/rows/preview", {
                method: "POST",
                body: JSON.stringify({ rowId: "row_1", normalizedData: { student: { name: "Asha" } } }),
            }),
            { params: Promise.resolve({ branchId: "branch_1", sessionId: "session_1" }) }
        );

        expect(response.status).toBe(200);
        expect(mocks.previewRowDraft).toHaveBeenCalledWith("user_1", "branch_1", "session_1", {
            rowId: "row_1",
            normalizedData: { student: { name: "Asha" } },
        });
    });

    it("delegates availability preview to ImportWiringService", async () => {
        mocks.getSessionUser.mockResolvedValueOnce({ id: "user_1" });
        mocks.getAvailability.mockResolvedValueOnce({ shifts: [], seatMap: null, conflicts: [] });
        const { POST } = await import("@/app/api/branches/[branchId]/import-sessions/[sessionId]/availability/route");

        const response = await POST(
            new Request("http://test.local/api/branches/branch_1/import-sessions/session_1/availability", {
                method: "POST",
                body: JSON.stringify({ rowId: "row_1", shiftIds: ["shift_1"], multiShiftId: null }),
            }),
            { params: Promise.resolve({ branchId: "branch_1", sessionId: "session_1" }) }
        );

        expect(response.status).toBe(200);
        expect(mocks.getAvailability).toHaveBeenCalledWith("user_1", "branch_1", "session_1", {
            rowId: "row_1",
            shiftIds: ["shift_1"],
            multiShiftId: null,
        });
    });
});
