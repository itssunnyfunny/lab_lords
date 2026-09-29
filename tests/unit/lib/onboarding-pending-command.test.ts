import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { onboardingDestination, onboardingStorageKey, readOnboardingCommand, runOnboardingCommand, type OnboardingDraft } from "@/lib/onboardingPendingCommand";

const firstKey = "11111111-1111-4111-8111-111111111111";
const secondKey = "22222222-2222-4222-8222-222222222222";
const result = { org: { id: "org-1" }, branch: { id: "branch-1" } };
const draft: OnboardingDraft = {
    startingPoint: "IMPORT",
    payload: { orgName: "Example", ownerPhone: "9999999999", branchName: "Main", seatCount: 2,
        seatNumbering: { mode: "SIMPLE", count: 2 }, shifts: [], multiShifts: [], selectedPostTrialPlan: "PRO" },
};
let saved: Map<string, string>;
let storage: { getItem: ReturnType<typeof vi.fn>; setItem: ReturnType<typeof vi.fn> };
let fetchMock: ReturnType<typeof vi.fn>;
let uuid: ReturnType<typeof vi.fn>;
function run(options: Partial<Parameters<typeof runOnboardingCommand>[0]> = {}) {
    return runOnboardingCommand({ accountId: "account-A", draft, isCurrent: () => true, ...options });
}
function success(value = result) { return new Response(JSON.stringify(value), { status: 201 }); }
async function flush() { for (let i = 0; i < 15; i++) await Promise.resolve(); }

beforeEach(() => {
    saved = new Map();
    storage = { getItem: vi.fn((key: string) => saved.get(key) ?? null), setItem: vi.fn((key: string, value: string) => saved.set(key, value)) };
    const tails = new Map<string, Promise<unknown>>();
    vi.stubGlobal("window", { localStorage: storage });
    vi.stubGlobal("navigator", { locks: { request: (name: string, action: () => Promise<unknown>) => {
        const next = (tails.get(name) ?? Promise.resolve()).catch(() => {}).then(action);
        tails.set(name, next);
        return next;
    } } });
    uuid = vi.fn().mockReturnValueOnce(firstKey).mockReturnValue(secondKey);
    vi.stubGlobal("crypto", { randomUUID: uuid });
    fetchMock = vi.fn().mockImplementation(() => Promise.resolve(success()));
    vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("durable onboarding commands", () => {
    it("persists and reads back the exact account-scoped request before dispatch", async () => {
        fetchMock.mockImplementation(async (_url, init) => {
            const pending = readOnboardingCommand("account-A");
            expect(pending).toMatchObject({ status: "pending", commandId: firstKey, body: init.body });
            expect(init.headers).toMatchObject({ "Idempotency-Key": firstKey, "X-Onboarding-Account": "account-A" });
            expect(storage.getItem).toHaveBeenCalledWith(onboardingStorageKey("account-A"));
            expect(readOnboardingCommand("account-B")).toBeNull();
            return success();
        });
        const receipt = await run();
        expect(receipt.status).toBe("completed");
        expect(onboardingDestination(receipt)).toBe("/branch/branch-1/onboarding/import");
        expect(saved.get(onboardingStorageKey("account-A"))).not.toContain("9999999999");
    });

    it("retries a lost response after reload with the frozen body and same key", async () => {
        fetchMock.mockRejectedValueOnce(new Error("connection lost after commit"));
        await expect(run()).rejects.toThrow("could not be confirmed");
        expect(readOnboardingCommand("account-A")).toMatchObject({ status: "pending", commandId: firstKey });
        await run({ draft: { ...draft, payload: { ...draft.payload, orgName: "Changed after failure" } } });
        const calls = fetchMock.mock.calls;
        expect(calls[1][1].body).toBe(calls[0][1].body);
        expect(calls[1][1].headers["Idempotency-Key"]).toBe(firstKey);
        expect(uuid).toHaveBeenCalledTimes(1);
    });

    it.each([
        [400, "ONBOARDING_INVALID_REQUEST"], [401, "UNAUTHORIZED"], [409, "ONBOARDING_KEY_CONFLICT"],
        [404, "ONBOARDING_RESULT_NOT_FOUND"], [409, "ONBOARDING_ACCOUNT_CHANGED"], [503, "ONBOARDING_UNAVAILABLE"], [500, "ONBOARDING_FAILED"],
    ])("keeps the pending identity after %s %s", async (status, code) => {
        fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: "private implementation detail", code }), { status: Number(status) }));
        await expect(run()).rejects.not.toThrow("private implementation detail");
        expect(readOnboardingCommand("account-A")).toMatchObject({ status: "pending", commandId: firstKey });
        await run({ draft: undefined });
        expect(fetchMock.mock.calls[1][1].headers["Idempotency-Key"]).toBe(firstKey);
    });

    it("treats malformed success and malformed JSON as uncertain", async () => {
        fetchMock.mockResolvedValueOnce(new Response("{}", { status: 201 }));
        await expect(run()).rejects.toThrow("could not be confirmed");
        fetchMock.mockResolvedValueOnce(new Response("<html>error</html>", { status: 502 }));
        await expect(run()).rejects.toThrow("could not be confirmed");
        expect(readOnboardingCommand("account-A")).toMatchObject({ status: "pending", commandId: firstKey });
        expect(uuid).toHaveBeenCalledTimes(1);
    });

    it("does not allocate a new key or automatically retry after timeout", async () => {
        vi.useFakeTimers();
        fetchMock.mockImplementationOnce((_url, init) => new Promise((_resolve, reject) => {
            init.signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
        }));
        const assertion = expect(run()).rejects.toThrow("could not be confirmed");
        await flush();
        await vi.advanceTimersByTimeAsync(30_001);
        await assertion;
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(uuid).toHaveBeenCalledTimes(1);
        expect(readOnboardingCommand("account-A")).toMatchObject({ status: "pending", commandId: firstKey });
        await run({ draft: undefined });
        expect(fetchMock.mock.calls[1][1].headers["Idempotency-Key"]).toBe(firstKey);
    });

    it.each(["read", "write", "readback", "corrupt", "locks"])("fails before network when %s storage support is unsafe", async failure => {
        if (failure === "read") storage.getItem.mockImplementation(() => { throw new Error("denied"); });
        if (failure === "write") storage.setItem.mockImplementation(() => { throw new Error("quota"); });
        if (failure === "readback") storage.setItem.mockImplementation(() => {});
        if (failure === "corrupt") saved.set(onboardingStorageKey("account-A"), "bad JSON");
        if (failure === "locks") vi.stubGlobal("navigator", {});
        await expect(run()).rejects.toThrow("saved setup could not be accessed safely");
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("preserves the original pending request when saving the successful receipt fails", async () => {
        storage.setItem.mockImplementationOnce((key, value) => saved.set(key, value))
            .mockImplementationOnce(() => { throw new Error("quota"); });
        await expect(run()).rejects.toThrow("saved setup could not be accessed safely");
        expect(readOnboardingCommand("account-A")).toMatchObject({ status: "pending", commandId: firstKey });
        await run({ draft: undefined });
        expect(fetchMock.mock.calls[1][1].headers["Idempotency-Key"]).toBe(firstKey);
        expect(readOnboardingCommand("account-A")).toMatchObject({ status: "completed", result });
    });

    it("retains a confirmed result on reload without creating or posting again", async () => {
        const receipt = await run();
        expect(readOnboardingCommand("account-A")).toEqual(receipt);
        expect(await run()).toEqual(receipt);
        expect(await run({ draft: undefined })).toEqual(receipt);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(uuid).toHaveBeenCalledTimes(1);
    });

    it("allows a deliberate new setup after success and retains both receipts", async () => {
        await run();
        fetchMock.mockResolvedValueOnce(success({ org: { id: "org-2" }, branch: { id: "branch-2" } }));
        await run({ newAfterCommandId: firstKey, draft: { ...draft, startingPoint: "CLEAN" } });
        const ledger = JSON.parse(saved.get(onboardingStorageKey("account-A"))!);
        expect(ledger.completed.map((item: { commandId: string }) => item.commandId)).toEqual([firstKey, secondKey]);
        expect(ledger.pending).toBeNull();
    });

    it("serializes concurrent tabs so a queued duplicate reuses the completed result", async () => {
        let finish!: (response: Response) => void;
        fetchMock.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
        const first = run(); const second = run();
        await flush();
        expect(fetchMock).toHaveBeenCalledTimes(1);
        finish(success());
        expect(await second).toEqual(await first);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(uuid).toHaveBeenCalledTimes(1);
    });

    it("lets a queued tab recover a lost response without replacing the pending key", async () => {
        let fail!: (error: Error) => void;
        fetchMock.mockImplementationOnce(() => new Promise((_resolve, reject) => { fail = reject; }));
        const first = expect(run()).rejects.toThrow("could not be confirmed");
        const second = run({ draft: { ...draft, startingPoint: "CLEAN" } });
        await flush(); fail(new Error("response lost"));
        await first;
        expect(await second).toMatchObject({ commandId: firstKey, startingPoint: "IMPORT", result });
        expect(fetchMock.mock.calls[1][1].body).toBe(fetchMock.mock.calls[0][1].body);
        expect(uuid).toHaveBeenCalledTimes(1);
    });

    it("does not turn a stale new-setup action into a third workspace", async () => {
        await run();
        const second = await run({ newAfterCommandId: firstKey });
        expect(await run({ newAfterCommandId: firstKey })).toEqual(second);
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(uuid).toHaveBeenCalledTimes(2);
    });

    it("rejects storage belonging to another account instead of recovering or replacing it", async () => {
        await run();
        saved.set(onboardingStorageKey("account-B"), saved.get(onboardingStorageKey("account-A"))!);
        await expect(run({ accountId: "account-B" })).rejects.toThrow("saved setup could not be accessed safely");
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(uuid).toHaveBeenCalledTimes(1);
    });

    it("rejects an account change while queued and does not dispatch its draft", async () => {
        let finish!: (response: Response) => void;
        fetchMock.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
        const first = run(); let current = true;
        const second = run({ isCurrent: () => current });
        const rejection = expect(second).rejects.toThrow("account changed");
        await flush(); current = false; finish(success());
        await first; await rejection;
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("does not reuse another account's pending or successful receipt", async () => {
        await run();
        await run({ accountId: "account-B" });
        expect(fetchMock.mock.calls[1][1].headers).toMatchObject({ "Idempotency-Key": secondKey, "X-Onboarding-Account": "account-B" });
        expect(readOnboardingCommand("account-A")).toMatchObject({ commandId: firstKey });
        expect(readOnboardingCommand("account-B")).toMatchObject({ commandId: secondKey });
    });
});
