import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { billingForBranch } from "@/lib/api/billing";
import { apiClient } from "@/lib/api/core";

vi.mock("@/lib/api/core", () => ({ apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));

beforeEach(() => {
    vi.mocked(apiClient.get).mockResolvedValue({});
    vi.mocked(apiClient.post).mockResolvedValue({});
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

    it.each(["cancellation", "operation"])("queues a new cancellation after a lost response, refresh and successful %s Undo", async undoRoute => {
        const cancellations = new Map<string, "QUEUED" | "UNDONE">();
        vi.mocked(apiClient.post).mockImplementation(async (_url, _data, config) => {
            const key = String(config?.headers?.["Idempotency-Key"]);
            if (!cancellations.has(key)) cancellations.set(key, "QUEUED");
            if (vi.mocked(apiClient.post).mock.calls.length === 1) throw new Error("response lost");
            return { scheduled: cancellations.get(key) === "QUEUED", clientIntent: { key, resolved: false } };
        });
        await expect(billingForBranch("a").cancelSubscription("org")).rejects.toThrow("response lost");
        const [originalKey] = cancellations.keys();
        const refreshed = billingForBranch("a");
        vi.mocked(apiClient.get).mockResolvedValue({ scheduledChanges: [{ id: "cancellation", status: "QUEUED" }] });
        expect((await refreshed.getOverview("org")).scheduledChanges[0].status).toBe("QUEUED");
        vi.mocked(apiClient.delete).mockImplementation(async () => {
            cancellations.set(originalKey, "UNDONE");
            return { undone: true, clientIntent: { key: originalKey, resolved: true } };
        });
        if (undoRoute === "cancellation") await refreshed.undoCancellation("org");
        else await refreshed.undoChange("org", "cancellation");
        expect(await refreshed.cancelSubscription("org")).toMatchObject({ scheduled: true });
        expect([...cancellations.values()]).toEqual(["UNDONE", "QUEUED"]);
    });

    it.each(["poll", "reconcile", "overview"])("retires only the recovered plan key after %s confirms resolution", async recovery => {
        const branch = billingForBranch("a");
        const sibling = billingForBranch("b");
        vi.mocked(apiClient.patch).mockRejectedValue(new Error("response lost"));
        await expect(branch.changePlan("org", "STANDARD")).rejects.toThrow();
        await expect(sibling.changePlan("org", "STANDARD")).rejects.toThrow();
        const patchCalls = vi.mocked(apiClient.patch).mock.calls;
        const key = patchCalls[0][2]?.headers?.["Idempotency-Key"];
        const siblingKey = patchCalls[1][2]?.headers?.["Idempotency-Key"];
        vi.mocked(apiClient.get).mockResolvedValueOnce({ operation: { clientIntent: { key, resolved: false } } });
        await branch.getOperation("org", "upgrade");
        await expect(branch.changePlan("org", "STANDARD")).rejects.toThrow();
        expect(patchCalls[2][2]?.headers?.["Idempotency-Key"]).toBe(key);

        const settled = { operation: { clientIntent: { key, resolved: true } } };
        if (recovery === "poll") {
            vi.mocked(apiClient.get).mockResolvedValueOnce(settled);
            await branch.getOperation("org", "upgrade");
        } else if (recovery === "reconcile") {
            vi.mocked(apiClient.post).mockResolvedValueOnce(settled);
            await branch.reconcileOperation("org", "upgrade");
        } else {
            vi.mocked(apiClient.get).mockResolvedValueOnce({ resolvedIntentKeys: [key] });
            await branch.getOverview("org");
            expect(apiClient.get).toHaveBeenLastCalledWith("/organizations/org/billing?branchId=a", {
                headers: { "X-Billing-Intent-Keys": key },
            });
        }
        vi.mocked(apiClient.patch).mockResolvedValueOnce({ unchanged: true });
        await branch.changePlan("org", "BASIC");
        await expect(branch.changePlan("org", "STANDARD")).rejects.toThrow();
        const nextKey = patchCalls[4][2]?.headers?.["Idempotency-Key"];
        expect(nextKey).not.toBe(key);
        // A late poll for the old change must also preserve the new unresolved key.
        vi.mocked(apiClient.get).mockResolvedValueOnce(settled);
        await branch.getOperation("org", "upgrade");
        await expect(branch.changePlan("org", "STANDARD")).rejects.toThrow();
        await expect(sibling.changePlan("org", "STANDARD")).rejects.toThrow();
        expect(patchCalls[5][2]?.headers?.["Idempotency-Key"]).toBe(nextKey);
        expect(patchCalls[6][2]?.headers?.["Idempotency-Key"]).toBe(siblingKey);
    });
});
