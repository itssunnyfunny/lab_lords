import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { AllocationMoveError } from "@/lib/allocationMove";
const mocks = vi.hoisted(() => ({ user: vi.fn(), move: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getSessionUser: mocks.user }));
vi.mock("@/services/seatAllocation.service", () => ({ SeatAllocationService: { moveAllocation: mocks.move } }));
import { PATCH } from "@/app/api/seat-allocations/[allocationId]/route";
const body = { branchId: "branch", studentId: "student", seatId: "seat", shiftIds: ["shift"], allocationIds: ["source"] };
const key = "7d25da92-f6b7-4701-b9cb-e520329976a5";
function request(value: unknown = body) { return new NextRequest("http://localhost/api/seat-allocations/source", {
    method: "PATCH", headers: { "Content-Type": "application/json", "Idempotency-Key": key }, body: JSON.stringify(value),
}); }
const context = { params: Promise.resolve({ allocationId: "source" }) };
beforeEach(() => { vi.resetAllMocks(); mocks.user.mockResolvedValue({ id: "actor" }); });
describe("durable allocation route contract", () => {
    it("requires authentication before calling the command service", async () => {
        mocks.user.mockResolvedValue(null);
        expect((await PATCH(request(), context)).status).toBe(401);
        expect(mocks.move).not.toHaveBeenCalled();
    });
    it.each([null, [], { ...body, allocationIds: ["another-source"] }])("rejects malformed or unbound source groups", async value => {
        expect((await PATCH(request(value), context)).status).toBe(400);
        expect(mocks.move).not.toHaveBeenCalled();
    });
    it("passes the immutable command identity and returns its actual outcome", async () => {
        const outcome = { replayed: true, current: false, allocations: [{ id: "current" }] };
        mocks.move.mockResolvedValue(outcome);
        const response = await PATCH(request(), context);
        expect(response.status).toBe(200); expect(await response.json()).toEqual(outcome);
        expect(mocks.move).toHaveBeenCalledWith("actor", key, body);
    });
    it("preserves a controlled conflict but hides unexpected internal details", async () => {
        mocks.move.mockRejectedValueOnce(new AllocationMoveError("This change request was already used with different details.", 409));
        expect((await PATCH(request(), context)).status).toBe(409);
        mocks.move.mockRejectedValueOnce(new Error("synthetic SQL/internal-connection-details"));
        const response = await PATCH(request(), context);
        expect(response.status).toBe(500);
        expect(JSON.stringify(await response.json())).not.toContain("internal-connection");
    });
});
