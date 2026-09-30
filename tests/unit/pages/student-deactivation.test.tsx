import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement, ReactNode } from "react";
import type { BranchAccess, StaffAction } from "@/types";
import { buildOwnerPermissions, buildStaffPermissions } from "@/services/branchActionPolicy";
import { StaffRole } from "@/types";

// Drive the actual page and private dialog via their rendered callbacks. Hooks
// and deferred reads are local; this suite requires no DOM, provider or DB.
const hooks = vi.hoisted(() => ({
    current: { cursor: 0, values: [] as unknown[], dirty: false, effects: [] as Array<() => void>, cleanups: new Map<number, () => void>() },
}));
const mocks = vi.hoisted(() => ({
    list: vi.fn(), payments: vi.fn(), fetch: vi.fn(), toast: { show: vi.fn() },
    router: { push: vi.fn(), replace: vi.fn() }, search: new URLSearchParams(),
}));
vi.mock("react", async original => {
    const react = await original<typeof import("react")>();
    const same = (before: unknown[] | undefined, after: unknown[]) =>
        before?.length === after.length && before.every((value, index) => Object.is(value, after[index]));
    return {
        ...react,
        use: () => ({ branchId: "branch" }),
        useState: (initial: unknown) => {
            const state = hooks.current; const index = state.cursor++;
            if (!(index in state.values)) state.values[index] = typeof initial === "function" ? initial() : initial;
            return [state.values[index], (value: unknown) => {
                const next = typeof value === "function" ? value(state.values[index]) : value;
                if (!Object.is(next, state.values[index])) { state.values[index] = next; state.dirty = true; }
            }];
        },
        useRef: (initial: unknown) => {
            const state = hooks.current; const index = state.cursor++;
            if (!(index in state.values)) state.values[index] = { current: initial };
            return state.values[index];
        },
        useMemo: (factory: () => unknown) => factory(),
        useCallback: (callback: unknown, deps: unknown[]) => {
            const state = hooks.current; const index = state.cursor++;
            const previous = state.values[index] as { value: unknown; deps: unknown[] } | undefined;
            if (!same(previous?.deps, deps)) state.values[index] = { value: callback, deps };
            return (state.values[index] as { value: unknown }).value;
        },
        useEffect: (effect: () => void | (() => void), deps: unknown[]) => {
            const state = hooks.current; const index = state.cursor++;
            const previous = state.values[index] as unknown[] | undefined;
            state.values[index] = deps;
            if (!same(previous, deps)) state.effects.push(() => {
                state.cleanups.get(index)?.();
                const cleanup = effect();
                if (cleanup) state.cleanups.set(index, cleanup); else state.cleanups.delete(index);
            });
        },
    };
});
vi.mock("@/components/settings/LocalizedText", () => ({
    useTranslation: () => Object.assign((text: string) => text, { owned: (text: string) => text, error: (text: string) => text }),
}));
vi.mock("@/components/settings/UserPreferencesApplier", () => ({
    useUserPreferences: () => ({ ownerKey: "viewer", formatDate: String, formatNumber: String }),
}));
vi.mock("@/components/ui", async original => ({
    ...await original<typeof import("@/components/ui")>(), useToast: () => mocks.toast,
}));
vi.mock("next/navigation", () => ({ useRouter: () => mocks.router, useSearchParams: () => mocks.search }));
vi.mock("@/hooks/useDataViewMode", () => ({ useDataViewMode: () => ["table", vi.fn()] }));
vi.mock("@/lib/api/students", () => ({ students: { list: mocks.list } }));
vi.mock("@/lib/api/payments", () => ({ payments: { listAll: mocks.payments } }));
vi.mock("@/lib/api/branches", () => ({ branches: { getShifts: async () => [], getMultiShifts: async () => [] } }));

import StudentsPage from "@/app/branch/[branchId]/students/page";

const student = { id: "student", name: "Asha", status: "ACTIVE", joinedAt: new Date(), monthlyFee: 1200, seatAllocations: [] };
const due = { id: "due", studentId: student.id, amount: 1200, status: "DUE", ledgerBacked: true, collectedAmount: 400, waivedAmount: 0 };
function access(overrides: Partial<Record<StaffAction, boolean>> = {}, owner = false): BranchAccess {
    return {
        branchId: "branch", branchName: "Main", organizationId: "org", isOwner: owner, role: owner ? "OWNER" : "STAFF",
        permissions: { ...(owner ? buildOwnerPermissions() : buildStaffPermissions(StaffRole.STAFF, [])), ...overrides },
        effectivePlan: "PRO", entitlements: [],
    };
}
type Node = ReactElement<Record<string, unknown> & { children?: ReactNode; footer?: ReactNode; actions?: ReactNode }>;
function nodes(value: ReactNode): Node[] {
    if (!value || typeof value !== "object") return [];
    if (Array.isArray(value)) return value.flatMap(nodes);
    const element = value as Node;
    if (!element.props) return [];
    return [element, ...nodes(element.props.children), ...nodes(element.props.footer),
        ...(typeof element.props.actions === "function" ? [] : nodes(element.props.actions))];
}
function state() { return { cursor: 0, values: [] as unknown[], dirty: false, effects: [] as Array<() => void>, cleanups: new Map<number, () => void>() }; }
let states: ReturnType<typeof state>[];
function mount(initialAccess: BranchAccess) {
    let currentAccess = initialAccess;
    const pageState = state(); let dialogState = state(); let dialogKey: string | null | undefined;
    states.push(pageState, dialogState);
    const render = () => {
        hooks.current = pageState;
        const outer = StudentsPage({ params: Promise.resolve({ branchId: "branch" }) });
        const content = (outer.props.children as (value: BranchAccess) => Node)(currentAccess);
        const Component = content.type as (props: Record<string, unknown>) => ReactElement;
        for (let count = 0; count < 10; count++) {
            pageState.cursor = 0; pageState.dirty = false;
            const view = Component(content.props);
            pageState.effects.splice(0).forEach(effect => effect());
            if (!pageState.dirty) return nodes(view);
        }
        throw new Error("Unstable page render");
    };
    const dialog = () => {
        const element = render().find(node => "duePayments" in node.props)!;
        if (element.key !== dialogKey) { dialogKey = element.key; dialogState = state(); states.push(dialogState); }
        hooks.current = dialogState; dialogState.cursor = 0;
        return nodes((element.type as (props: Record<string, unknown>) => ReactElement)(element.props));
    };
    render();
    return {
        open: () => {
            const table = render().find(node => Array.isArray(node.props.data))!;
            const actionView = (table.props.actions as unknown as (value: typeof student) => Node)(student);
            const actions = actionView.props.actions as unknown as Array<{ label: string; onClick: () => void }>;
            actions.find(action => action.label === "Deactivate")!.onClick();
        },
        cancel: () => { (dialog().find(node => node.props.children === "Cancel")!.props.onClick as () => void)(); dialog(); },
        choices: () => dialog().filter(node => node.props.type === "radio").map(node => ({ value: node.props.value, checked: node.props.checked })),
        choose: (value: string) => { (dialog().find(node => node.props.value === value)!.props.onChange as () => void)(); },
        confirm: () => (dialog().find(node => node.props.children === "Confirm deactivate")!.props.onClick as () => Promise<void>)(),
        setAccess: (next: BranchAccess) => { currentAccess = next; },
        isOpen: () => Boolean(render().find(node => "duePayments" in node.props)!.props.student),
    };
}
async function flush() { for (let i = 0; i < 15; i++) await Promise.resolve(); }
beforeEach(() => {
    vi.resetAllMocks(); states = [];
    mocks.list.mockResolvedValue({ items: [student], total: 1, nextCursor: null });
    mocks.payments.mockImplementation(async (_branch: string, options?: { status: string }) => options?.status === "WAIVED" ? [] : [due]);
    mocks.fetch.mockResolvedValue(new Response("{}"));
    vi.stubGlobal("fetch", mocks.fetch);
    vi.stubGlobal("window", Object.assign(new EventTarget(), { setTimeout: vi.fn(), clearTimeout: vi.fn() }));
});
afterEach(() => { states.forEach(item => item.cleanups.forEach(cleanup => cleanup())); vi.unstubAllGlobals(); });

describe("student deactivation payment choices", () => {
    it.each([
        ["default STAFF", {}, ["PAID", "KEEP"], false],
        ["collect denied", { mark_payment_paid: false, waive_payments: true }, ["WAIVED", "KEEP"], false],
        ["both denied", { mark_payment_paid: false, waive_payments: false }, ["KEEP"], false],
        ["owner", {}, ["PAID", "WAIVED", "KEEP"], true],
    ] as const)("defaults to keeping debt for %s and shows only authorized resolutions", async (_label, overrides, choices, owner) => {
        const page = mount(access(overrides, owner)); await flush(); page.open();
        expect(page.choices().map(choice => choice.value)).toEqual(choices);
        expect(page.choices().filter(choice => choice.checked).map(choice => choice.value)).toEqual(["KEEP"]);
        await page.confirm();
        expect(JSON.parse(mocks.fetch.mock.calls[0][1].body).dueResolution).toBe("KEEP");
    });

    it.each(["PAID", "WAIVED"])("requires an explicit permitted %s choice", async resolution => {
        const page = mount(access({}, true)); await flush(); page.open(); page.choose(resolution);
        await page.confirm();
        expect(JSON.parse(mocks.fetch.mock.calls[0][1].body).dueResolution).toBe(resolution);
    });

    it("falls back to KEEP if the selected payment permission is revoked while open", async () => {
        const page = mount(access({ waive_payments: true })); await flush(); page.open(); page.choose("WAIVED");
        page.setAccess(access({ waive_payments: false }));
        await page.confirm();
        expect(JSON.parse(mocks.fetch.mock.calls[0][1].body).dueResolution).toBe("KEEP");
    });

    it("resets a previously chosen waiver after the dialog is closed", async () => {
        const page = mount(access({}, true)); await flush(); page.open(); page.choose("WAIVED");
        page.cancel(); page.open();
        expect(page.choices().filter(choice => choice.checked).map(choice => choice.value)).toEqual(["KEEP"]);
    });

    it("keeps the dialog open and exposes an actionable server permission rejection", async () => {
        const page = mount(access()); await flush(); page.open(); page.choose("PAID");
        mocks.fetch.mockResolvedValue(new Response(JSON.stringify({ error: "Unauthorized: Permission 'mark_payment_paid' is disabled for this staff member" }), { status: 403 }));
        await page.confirm();
        expect(page.isOpen()).toBe(true);
        expect(mocks.toast.show).toHaveBeenCalledWith(expect.objectContaining({
            title: "Student was not deactivated", description: "Unauthorized: Permission 'mark_payment_paid' is disabled for this staff member",
        }));
    });

    it.each(["hidden", "none"])("submits KEEP when payment rows are %s", async mode => {
        if (mode === "none") mocks.payments.mockResolvedValue([]);
        const page = mount(access({ view_payments: mode !== "hidden" })); await flush(); page.open();
        expect(page.choices()).toEqual([]);
        await page.confirm();
        expect(JSON.parse(mocks.fetch.mock.calls[0][1].body).dueResolution).toBe("KEEP");
        if (mode === "hidden") expect(mocks.payments).not.toHaveBeenCalled();
    });

    it("keeps a safe fallback message for a malformed failure response", async () => {
        const page = mount(access()); await flush(); page.open();
        mocks.fetch.mockResolvedValue(new Response("null", { status: 500 }));
        await page.confirm();
        expect(mocks.toast.show).toHaveBeenCalledWith(expect.objectContaining({ description: "Failed to update status." }));
    });
});
