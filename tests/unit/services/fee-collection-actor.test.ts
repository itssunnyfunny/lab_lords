import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { CollectionInput } from "@/lib/feeCollections";
import { FeeCollectionService } from "@/services/feeCollection.service";
import { POST } from "@/app/api/branches/[branchId]/collections/route";

const mocks = vi.hoisted(() => {
    const tx = { feeCollection: { findUnique: vi.fn(), create: vi.fn() }, $queryRaw: vi.fn() };
    return { tx, authorize: vi.fn(), auth: vi.fn(), user: vi.fn() };
});
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: (callback: (tx: typeof mocks.tx) => Promise<unknown>) => callback(mocks.tx) } }));
vi.mock("@/services/accessPolicy.service", () => ({
    BranchAccessNotFoundError: class extends Error {}, AccessPolicy: { authorizeCapability: mocks.authorize },
}));
vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@/lib/auth", () => ({ getSessionUser: mocks.user }));

const request: CollectionInput = { studentId: "student", paymentIds: ["fee"], amount: 500, method: "CASH", reference: "",
    note: "", idempotencyKey: "legacy-retry-key" };
const receipt = { id: "legacy-receipt", actorId: "cashier-A", requestHash: createHash("sha256").update(JSON.stringify(request)).digest("hex") };

describe("collection retry identity", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        mocks.tx.$queryRaw.mockResolvedValue([{ id: "student" }]);
        mocks.tx.feeCollection.findUnique.mockResolvedValue(receipt);
    });
    it("retains a committed legacy receipt for the original cashier and rejects another cashier's replay", async () => {
        expect(await FeeCollectionService.collect("cashier-A", "branch", request)).toBe(receipt);
        await expect(FeeCollectionService.collect("cashier-B", "branch", request)).rejects.toThrow("different collection request");
        expect(mocks.tx.feeCollection.create).not.toHaveBeenCalled();
    });
    it("rejects an uncommitted tab request when the signed-in account changes before dispatch", async () => {
        mocks.auth.mockResolvedValue({ userId: "clerk-B" });
        const response = await POST(new NextRequest("http://test.local/collections", {
            method: "POST", headers: { "X-Collection-Account": "clerk-A" }, body: JSON.stringify(request),
        }), { params: Promise.resolve({ branchId: "branch" }) });
        expect(response.status).toBe(409);
        expect(mocks.tx.$queryRaw).not.toHaveBeenCalled();
        expect(mocks.tx.feeCollection.create).not.toHaveBeenCalled();
    });
});
