import { beforeEach, describe, expect, it, vi } from "vitest";
import { OnboardingService } from "@/services/onboarding.service";

const mocks = vi.hoisted(() => ({
    transaction: vi.fn(), lock: vi.fn(), userUpdate: vi.fn(), orgCreate: vi.fn(),
    branchCreate: vi.fn(), branchFind: vi.fn(), shifts: vi.fn(), seats: vi.fn(),
    staff: vi.fn(), trial: vi.fn(), receiptFind: vi.fn(), receiptCreate: vi.fn(),
    enabled: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: mocks.transaction } }));
vi.mock("@/lib/billingFeature", () => ({ isWorkspaceBillingEnabled: mocks.enabled }));
vi.mock("@/services/ownerTrial.service", () => ({ OwnerTrialService: { startOnboardingTrial: mocks.trial } }));

const key = "11111111-1111-4111-8111-111111111111";
const params = () => ({
    userId: "owner_1", idempotencyKey: key, selectedPostTrialPlan: "BASIC" as const,
    ownerPhone: "9876543210", orgData: { name: "Example library" },
    branchData: { name: "Main branch" }, seatCount: 2, includeFullTimeMultiShift: false,
});
type Receipt = { ownerId: string; idempotencyKey: string; requestHash: string; organizationId: string; branchId: string };
let receipts: Map<string, Receipt>;
const tx = {
    $queryRaw: mocks.lock, user: { update: mocks.userUpdate },
    organization: { create: mocks.orgCreate },
    branch: { create: mocks.branchCreate, findFirst: mocks.branchFind },
    shift: { createMany: mocks.shifts }, seat: { createMany: mocks.seats },
    staff: { create: mocks.staff },
    onboardingRequest: { findUnique: mocks.receiptFind, create: mocks.receiptCreate },
};
beforeEach(() => {
    vi.resetAllMocks();
    receipts = new Map();
    mocks.enabled.mockReturnValue(true);
    mocks.transaction.mockImplementation(async callback => callback(tx));
    mocks.lock.mockResolvedValue([{ id: "owner_1" }]);
    mocks.orgCreate.mockResolvedValue({ id: "org_1", name: "Private organization name" });
    mocks.branchCreate.mockResolvedValue({ id: "branch_1", contactPhone: "Private phone" });
    mocks.branchFind.mockResolvedValue({ id: "branch_1", organizationId: "org_1" });
    mocks.receiptFind.mockImplementation(async ({ where }) => {
        const scope = where.ownerId_idempotencyKey;
        return receipts.get(`${scope.ownerId}:${scope.idempotencyKey}`) ?? null;
    });
    mocks.receiptCreate.mockImplementation(async ({ data }: { data: Receipt }) => {
        receipts.set(`${data.ownerId}:${data.idempotencyKey}`, data);
        return data;
    });
});
function expectNoSetupWrites() {
    for (const write of [mocks.userUpdate, mocks.orgCreate, mocks.branchCreate, mocks.shifts, mocks.seats, mocks.staff, mocks.trial, mocks.receiptCreate]) {
        expect(write).not.toHaveBeenCalled();
    }
}

describe("onboarding durable replay", () => {
    it("locks before writes and records only the scoped hash/result in the creation transaction", async () => {
        const result = await OnboardingService.createNetwork(params());
        expect(result).toEqual({ org: { id: "org_1" }, branch: { id: "branch_1" } });
        expect(mocks.lock).toHaveBeenCalledOnce();
        expect(mocks.lock.mock.invocationCallOrder[0]).toBeLessThan(mocks.userUpdate.mock.invocationCallOrder[0]);
        expect(mocks.receiptFind.mock.invocationCallOrder[0]).toBeLessThan(mocks.userUpdate.mock.invocationCallOrder[0]);
        expect(mocks.receiptCreate).toHaveBeenCalledWith({ data: {
            ownerId: "owner_1", idempotencyKey: key, requestHash: expect.stringMatching(/^v1:[a-f0-9]{64}$/),
            organizationId: "org_1", branchId: "branch_1",
        } });
        expect(mocks.trial).toHaveBeenCalledWith(tx, "owner_1", "org_1", expect.any(Date));
        expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "ReadCommitted" });
    });

    it("recovers a completed result without setup writes even when new creation is held", async () => {
        const first = await OnboardingService.createNetwork(params());
        vi.clearAllMocks();
        mocks.enabled.mockReturnValue(false);
        expect(await OnboardingService.createNetwork(params())).toEqual(first);
        expect(mocks.branchFind).toHaveBeenCalledWith({
            where: { id: "branch_1", organizationId: "org_1", organization: { ownerId: "owner_1" } },
            select: { id: true, organizationId: true },
        });
        expectNoSetupWrites();
    });

    it("rejects changed valid input under the original key without changing anything", async () => {
        await OnboardingService.createNetwork(params());
        vi.clearAllMocks();
        await expect(OnboardingService.createNetwork({ ...params(), ownerPhone: "9876543211" }))
            .rejects.toMatchObject({ code: "ONBOARDING_KEY_CONFLICT", status: 409 });
        expectNoSetupWrites();
    });

    it("keeps the same UUID independent across authenticated owners", async () => {
        await OnboardingService.createNetwork(params());
        await OnboardingService.createNetwork({ ...params(), userId: "owner_2" });
        expect(mocks.orgCreate).toHaveBeenCalledTimes(2);
        expect(receipts.size).toBe(2);
        expect(mocks.receiptFind).toHaveBeenLastCalledWith({
            where: { ownerId_idempotencyKey: { ownerId: "owner_2", idempotencyKey: key } },
        });
    });

    it.each(["", "not-a-key", "x".repeat(1000)])("rejects an invalid key before opening a transaction", async idempotencyKey => {
        await expect(OnboardingService.createNetwork({ ...params(), idempotencyKey }))
            .rejects.toMatchObject({ code: "ONBOARDING_INVALID_KEY", status: 400 });
        expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("returns a generic error for a receipt whose current result is missing or foreign", async () => {
        await OnboardingService.createNetwork(params());
        vi.clearAllMocks();
        mocks.branchFind.mockResolvedValue(null);
        await expect(OnboardingService.createNetwork(params()))
            .rejects.toMatchObject({ code: "ONBOARDING_RESULT_NOT_FOUND", status: 404, message: "Workspace setup result not found." });
        expectNoSetupWrites();
    });

    it("holds a new command without writing a receipt or legacy workspace", async () => {
        mocks.enabled.mockReturnValue(false);
        await expect(OnboardingService.createNetwork(params()))
            .rejects.toMatchObject({ code: "ONBOARDING_UNAVAILABLE", status: 503 });
        expectNoSetupWrites();
    });

    it("does not acknowledge creation when receipt insertion fails", async () => {
        mocks.receiptCreate.mockRejectedValue(new Error("synthetic transaction failure"));
        await expect(OnboardingService.createNetwork(params())).rejects.toThrow("synthetic transaction failure");
        expect(mocks.transaction).toHaveBeenCalledOnce();
    });
});
