import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement, ReactNode } from "react";

// Controlled page hooks, real recovery storage/API helpers, and a deferred
// fetch. This does not claim browser/Clerk or database integration coverage.
const hooks = vi.hoisted(() => ({ cursor: 0, values: [] as unknown[], dirty: false,
    effects: [] as Array<() => void>, cleanups: new Map<number, () => void>() }));
const mocks = vi.hoisted(() => ({ accountId: "account-A", loaded: true, signedIn: true, push: vi.fn() }));
vi.mock("react", async original => {
    const react = await original<typeof import("react")>();
    const same = (before: unknown[] | undefined, after: unknown[]) => before?.length === after.length && before.every((value, index) => Object.is(value, after[index]));
    return {
        ...react,
        use: () => ({}),
        useState: (initial: unknown) => {
            const index = hooks.cursor++;
            if (!(index in hooks.values)) hooks.values[index] = typeof initial === "function" ? initial() : initial;
            return [hooks.values[index], (value: unknown) => {
                const next = typeof value === "function" ? value(hooks.values[index]) : value;
                if (!Object.is(next, hooks.values[index])) { hooks.values[index] = next; hooks.dirty = true; }
            }];
        },
        useRef: (initial: unknown) => {
            const index = hooks.cursor++;
            if (!(index in hooks.values)) hooks.values[index] = { current: initial };
            return hooks.values[index];
        },
        useCallback: (callback: unknown, deps: unknown[]) => {
            const index = hooks.cursor++;
            const previous = hooks.values[index] as { value: unknown; deps: unknown[] } | undefined;
            if (!same(previous?.deps, deps)) hooks.values[index] = { value: callback, deps };
            return (hooks.values[index] as { value: unknown }).value;
        },
        useEffect: (effect: () => void | (() => void), deps: unknown[]) => {
            const index = hooks.cursor++;
            const previous = hooks.values[index] as unknown[] | undefined; hooks.values[index] = deps;
            if (!same(previous, deps)) hooks.effects.push(() => {
                hooks.cleanups.get(index)?.(); const cleanup = effect();
                if (cleanup) hooks.cleanups.set(index, cleanup); else hooks.cleanups.delete(index);
            });
        },
    };
});
vi.mock("@clerk/nextjs", () => ({ useUser: () => ({ isLoaded: mocks.loaded, isSignedIn: mocks.signedIn, user: { id: mocks.accountId } }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/components/settings/LocalizedText", () => ({
    useTranslation: () => Object.assign((text: string) => text, { error: (text: string) => text, owned: (text: string) => text }),
    LocalizedError: "localized-error",
}));
vi.mock("@/components/ui", () => ({ AppButton: "app-button", AppSelect: "app-select" }));

import OnboardingPage from "@/app/onboarding/page";
import { onboardingStorageKey, readOnboardingCommand } from "@/lib/onboardingPendingCommand";

type Node = ReactElement<Record<string, unknown> & { children?: ReactNode }>;
const key = "11111111-1111-4111-8111-111111111111";
const result = { org: { id: "org-1" }, branch: { id: "branch-1" } };
const body = JSON.stringify({ orgName: "Saved organization", ownerPhone: "9999999999", branchName: "Main", seatCount: 2,
    seatNumbering: { mode: "SIMPLE", count: 2 }, shifts: [], multiShifts: [], selectedPostTrialPlan: "PRO" });
let saved: Map<string, string>;
let fetchMock: ReturnType<typeof vi.fn>;
let storage: { getItem: ReturnType<typeof vi.fn>; setItem: ReturnType<typeof vi.fn> };
function seed(status: "pending" | "completed" = "pending") {
    saved.set(onboardingStorageKey("account-A"), JSON.stringify({ version: 1, accountId: "account-A",
        pending: status === "pending" ? { status, commandId: key, startingPoint: "IMPORT", body } : null,
        completed: status === "completed" ? [{ status, commandId: key, startingPoint: "IMPORT", result }] : [] }));
}
function nodes(value: ReactNode): Node[] {
    if (!value || typeof value !== "object") return [];
    if (Array.isArray(value)) return value.flatMap(nodes);
    const element = value as Node;
    if (!element.props) return [];
    return [element, ...nodes(element.props.children)];
}
function unmount() { hooks.cleanups.forEach(cleanup => cleanup()); hooks.cleanups.clear(); }
function mount() {
    hooks.cursor = 0; hooks.values = []; hooks.effects = []; hooks.dirty = false;
    const outer = OnboardingPage({ searchParams: Promise.resolve({}) });
    expect(outer.key).toBe(mocks.accountId);
    const render = () => {
        for (let attempt = 0; attempt < 10; attempt++) {
            hooks.cursor = 0; hooks.dirty = false;
            const view = (outer.type as (props: Record<string, unknown>) => ReactElement)(outer.props);
            hooks.effects.splice(0).forEach(effect => effect());
            if (!hooks.dirty) return nodes(view);
        }
        throw new Error("Unstable onboarding render");
    };
    render();
    return {
        render,
        button: (label: string) => render().find(node => node.props.children === label && node.props.onClick)!,
        click: (label: string) => { const control = render().find(node => node.props.children === label && node.props.onClick)!;
            expect(control).toBeDefined(); expect(control.props.disabled).not.toBe(true);
            return (control.props.onClick as () => Promise<void> | void)(); },
        choose: (label: string) => {
            const control = render().find(node => node.type === "button" && nodes(node).some(child => child.props.children === label))!;
            expect(control).toBeDefined(); (control.props.onClick as () => void)(); render();
        },
        has: (label: string) => render().some(node => node.props.children === label),
        input: (name: string, value: string) => {
            const input = render().find(node => node.props.name === name)!;
            (input.props.onChange as (event: unknown) => void)({ target: { name, value } });
            render();
        },
    };
}
async function flush() { for (let i = 0; i < 15; i++) await Promise.resolve(); }

beforeEach(() => {
    vi.resetAllMocks();
    mocks.accountId = "account-A"; mocks.loaded = true; mocks.signedIn = true;
    saved = new Map();
    storage = { getItem: vi.fn((key: string) => saved.get(key) ?? null), setItem: vi.fn((key: string, value: string) => saved.set(key, value)) };
    const events = new EventTarget();
    vi.stubGlobal("window", Object.assign(events, { localStorage: storage }));
    vi.stubGlobal("navigator", { locks: { request: (_name: string, work: () => Promise<unknown>) => work() } });
    vi.stubGlobal("crypto", { randomUUID: vi.fn(() => key) });
    fetchMock = vi.fn(() => Promise.resolve(new Response(JSON.stringify(result), { status: 201 })));
    vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { unmount(); vi.unstubAllGlobals(); });

describe("onboarding page recovery", () => {
    it("submits the validated wizard only after durable persistence and freezes it while waiting", async () => {
        let finish!: (response: Response) => void;
        fetchMock.mockImplementationOnce((_url, init) => {
            expect(readOnboardingCommand("account-A")).toMatchObject({ status: "pending", commandId: key, body: init.body });
            expect(JSON.parse(init.body)).toMatchObject({ orgName: "New organization", branchName: "Main", seatCount: 2, selectedPostTrialPlan: "PRO" });
            return new Promise(resolve => { finish = resolve; });
        });
        const page = mount();
        page.input("orgName", "New organization"); page.input("ownerPhone", "9999999999");
        page.click("Continue");
        page.input("branchName", "Main"); page.input("seatCount", "2");
        page.click("Choose plan"); page.choose("Standard"); page.click("Continue");
        page.choose("Begin with a clean workspace");
        const submit = page.click("Start Standard trial");
        await flush();
        expect(page.render().find(node => node.type === "fieldset")?.props.disabled).toBe(true);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        finish(new Response(JSON.stringify(result), { status: 201 })); await submit;
        expect(mocks.push).toHaveBeenCalledWith("/branch/branch-1");
        expect(page.has("Your workspace is ready")).toBe(true);
    });

    it("waits for account identity and never exposes a form while signed out", () => {
        mocks.loaded = false;
        expect(nodes(OnboardingPage({ searchParams: Promise.resolve({}) })).some(node => node.props.children === "Loading setup...")).toBe(true);
        mocks.loaded = true; mocks.signedIn = false;
        expect(nodes(OnboardingPage({ searchParams: Promise.resolve({}) })).some(node => node.props.children === "Sign in to continue setup.")).toBe(true);
        expect(fetchMock).not.toHaveBeenCalled();
        expect(storage.getItem).not.toHaveBeenCalled();
    });

    it("offers explicit reload recovery using the saved request, with no automatic POST", async () => {
        seed(); const page = mount();
        expect(page.has("Recover your saved setup")).toBe(true);
        expect(page.render().some(node => node.props.name === "orgName")).toBe(false);
        expect(fetchMock).not.toHaveBeenCalled();
        await page.click("Retry saved setup");
        expect(fetchMock.mock.calls[0][1]).toMatchObject({ body, headers: { "Idempotency-Key": key, "X-Onboarding-Account": "account-A" } });
        expect(mocks.push).toHaveBeenCalledWith("/branch/branch-1/onboarding/import");
        expect(readOnboardingCommand("account-A")).toMatchObject({ status: "completed" });
    });

    it("keeps recovery visible after uncertainty and guards rapid double clicks", async () => {
        seed(); let fail!: (error: Error) => void;
        fetchMock.mockImplementationOnce(() => new Promise((_resolve, reject) => { fail = reject; }));
        const page = mount();
        const click = page.button("Retry saved setup").props.onClick as () => Promise<void>;
        const first = click(); const second = click();
        await flush();
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(page.button("Retry saved setup").props.disabled).toBe(true);
        fail(new Error("response lost")); await first; await second;
        expect(page.has("Recover your saved setup")).toBe(true);
        expect(page.has("Set up another organization")).toBe(false);
        expect(page.button("Retry saved setup").props.disabled).toBe(false);
        expect(mocks.push).not.toHaveBeenCalled();
        await page.click("Retry saved setup");
        expect(fetchMock.mock.calls[1][1].body).toBe(body);
    });

    it("retains successful results on reload and starts a new form only by explicit choice", async () => {
        seed("completed"); const page = mount();
        expect(page.has("Your workspace is ready")).toBe(true);
        expect(fetchMock).not.toHaveBeenCalled();
        await page.click("Continue to workspace");
        expect(fetchMock).not.toHaveBeenCalled();
        expect(mocks.push).toHaveBeenCalledWith("/branch/branch-1/onboarding/import");
        page.click("Set up another organization");
        expect(page.render().some(node => node.props.name === "orgName" && node.props.value === "")).toBe(true);
        expect(readOnboardingCommand("account-A")).toMatchObject({ status: "completed", commandId: key });
    });

    it("does not navigate the new account when the old account's response completes", async () => {
        seed(); let finish!: (response: Response) => void;
        fetchMock.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
        const oldPage = mount(); const pending = oldPage.click("Retry saved setup");
        await flush(); unmount(); mocks.accountId = "account-B";
        const newPage = mount();
        expect(newPage.has("Recover your saved setup")).toBe(false);
        finish(new Response(JSON.stringify(result), { status: 201 }));
        await pending;
        expect(mocks.push).not.toHaveBeenCalled();
        expect(readOnboardingCommand("account-A")).toMatchObject({ status: "completed" });
        expect(readOnboardingCommand("account-B")).toBeNull();
    });

    it("blocks setup when storage is unavailable and recovers without dispatch when it returns", () => {
        seed(); storage.getItem.mockImplementation(() => { throw new Error("blocked"); });
        const page = mount();
        expect(page.has("Retry saved setup check")).toBe(true);
        expect(page.render().some(node => node.props.name === "orgName")).toBe(false);
        storage.getItem.mockImplementation((key: string) => saved.get(key) ?? null);
        page.click("Retry saved setup check");
        expect(page.has("Recover your saved setup")).toBe(true);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("does not navigate until the successful result has been saved", async () => {
        seed(); storage.setItem.mockImplementationOnce((key, value) => saved.set(key, value))
            .mockImplementationOnce(() => { throw new Error("quota"); });
        const page = mount(); await page.click("Retry saved setup");
        expect(mocks.push).not.toHaveBeenCalled();
        expect(page.has("Recover your saved setup")).toBe(true);
        expect(readOnboardingCommand("account-A")).toMatchObject({ status: "pending", commandId: key });
    });
});
