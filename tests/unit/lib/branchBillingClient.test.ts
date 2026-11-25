import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { billingForBranch } from "@/lib/api/billing";
import { apiClient } from "@/lib/api/core";

vi.mock("@/lib/api/core", () => ({ apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));

beforeEach(() => {
    const keys = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
        getItem: (key: string) => keys.get(key) ?? null,
        setItem: (key: string, value: string) => keys.set(key, value),
        removeItem: (key: string) => keys.delete(key),
    });
});
afterEach(() => { vi.unstubAllGlobals(); vi.resetAllMocks(); });

describe("independent branch billing requests", () => {
    it("binds checkout, confirmation, recovery, invoice pagination and operation status to the selected branch", async () => {
        const branch = billingForBranch("west");
        await branch.createSubscription("org", "STANDARD", "/branch/west");
        await branch.verifySubscription("org", { changeId: "change", razorpay_payment_id: "payment", razorpay_subscription_id: "sub", razorpay_signature: "fixture" });
        await branch.retryOperation("org", "change");
        await branch.createRecovery("org");
        await branch.getInvoices("org", "older");
        await branch.getOperation("org", "change");
        for (const [address] of vi.mocked(apiClient.post).mock.calls) expect(address).toMatch(/\?branchId=west$/);
        expect(vi.mocked(apiClient.get).mock.calls.map(([url]) => url)).toEqual([
            "/organizations/org/billing/invoices?cursor=older&branchId=west",
            "/organizations/org/billing/mutations/change?branchId=west",
        ]);
    });

    it("recovers a lost change response with the original intent while a sibling gets its own", async () => {
        vi.mocked(apiClient.patch).mockRejectedValueOnce(new Error("connection lost")).mockResolvedValue({});
        await expect(billingForBranch("a").changePlan("org", "PRO")).rejects.toThrow("connection lost");
        await billingForBranch("b").changePlan("org", "PRO");
        await billingForBranch("a").changePlan("org", "PRO");
        const [lost, separate, resumed] = vi.mocked(apiClient.patch).mock.calls;
        expect(resumed).toEqual(lost);
        expect(separate[0]).toBe("/organizations/org/billing/subscription?branchId=b");
        expect(separate[2]?.headers?.["Idempotency-Key"]).not.toEqual(lost[2]?.headers?.["Idempotency-Key"]);
    });
});
