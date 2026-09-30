import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement, ReactNode } from "react";
import { buildOwnerPermissions } from "@/services/branchActionPolicy";
import type { BranchAccess } from "@/types";

const hooks = vi.hoisted(() => ({ cursor: 0, values: [] as unknown[], dirty: false,
    effects: [] as Array<() => void>, cleanups: new Map<number, () => void>() }));
const mocks = vi.hoisted(() => ({ fetch: vi.fn(), query: "section=terms" }));
vi.mock("react", async original => {
    const react = await original<typeof import("react")>();
    const same = (before: unknown[] | undefined, after: unknown[]) => before?.length === after.length && before.every((value, index) => Object.is(value, after[index]));
    return {
        ...react,
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
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(mocks.query), useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("@/components/settings/LocalizedText", () => ({
    useTranslation: () => Object.assign((value: string) => value, { owned: (value: string) => value, error: (value: string) => value }),
}));
vi.mock("@/components/settings/UserPreferencesApplier", () => ({ useUserPreferences: () => ({ formatDate: String, formatNumber: String }) }));
vi.mock("@/components/dashboard-features/shared", async original => {
    const actual = await original<typeof import("@/components/dashboard-features/shared")>();
    return { ...actual, useDashboardResource: (url: string) => url.endsWith("/dashboard")
        ? { data: null, loading: false, error: null, reload: vi.fn() } : actual.useDashboardResource(url) };
});

import { DashboardSettingsContent } from "@/components/dashboard-features/DashboardSettingsContent";
import { SetupPager } from "@/components/dashboard-features/setupPaging";

type Node = ReactElement<Record<string, unknown> & { children?: ReactNode }>;
function nodes(value: ReactNode): Node[] {
    if (!value || typeof value !== "object") return [];
    if (Array.isArray(value)) return value.flatMap(nodes);
    const node = value as Node;
    if (!node.props) return [];
    if (node.type === SetupPager) return [node, ...nodes(SetupPager(node.props as unknown as Parameters<typeof SetupPager>[0]))];
    return [node, ...nodes(node.props.children)];
}
const options = Array.from({ length: 501 }, (_, i) => ({ id: `student-${String(i).padStart(3, "0")}`, name: `Student ${i}` }));
const rows = options.map((student, i) => ({
    id: `record-${String(i).padStart(3, "0")}`, studentId: student.id, studentName: student.name,
    weekdays: [1, 3], expectedBy: "08:15", enabled: false,
    label: "Saved membership", startDate: "2026-01-01", endDate: "2026-09-30", daysLeft: 1,
}));
function response(url: string) {
    const query = new URL(url, "http://test.local").searchParams;
    const studentId = query.get("studentId");
    const filtered = studentId ? rows.filter(row => row.studentId === studentId) : rows;
    const itemStart = query.has("cursor") ? filtered.findIndex(row => row.id === query.get("cursor")) + 1 : 0;
    const studentStart = query.has("studentCursor") ? options.findIndex(row => row.id === query.get("studentCursor")) + 1 : 0;
    const limit = Number(query.get("limit") ?? 50);
    const items = filtered.slice(itemStart, itemStart + limit); const students = options.slice(studentStart, studentStart + limit);
    return { items, students, total: filtered.length, studentTotal: options.length,
        nextCursor: itemStart + items.length < filtered.length ? items.at(-1)!.id : null,
        studentNextCursor: studentStart + students.length < options.length ? students.at(-1)!.id : null,
        selectedStudent: options.find(row => row.id === studentId) ?? null,
        selectedItem: rows.find(row => row.studentId === studentId) ?? null };
}
function mount(kind: "terms" | "expectations", writable = true, target = "") {
    mocks.query = `section=${kind}${target ? `&studentId=${target}` : ""}`;
    const access = { branchId: "branch", branchName: "Main", organizationId: "org", isOwner: true, role: "OWNER",
        permissions: { ...buildOwnerPermissions(), manage_branch: writable }, effectivePlan: "PRO", entitlements: [] } as BranchAccess;
    const component = nodes(DashboardSettingsContent({ branchId: "branch", access }))
        .find(node => typeof node.type === "function" && node.type.name === (kind === "terms" ? "Terms" : "Expectations"))!;
    const render = () => {
        for (let attempt = 0; attempt < 10; attempt++) {
            hooks.cursor = 0; hooks.dirty = false;
            const view = (component.type as (props: Record<string, unknown>) => ReactElement)(component.props);
            hooks.effects.splice(0).forEach(effect => effect());
            if (!hooks.dirty) return nodes(view);
        }
        throw new Error("Unstable setup render");
    };
    render();
    return {
        render,
        page: (label: string) => render().find(node => node.type === SetupPager && node.props.label === label)!,
        click: (label: string) => { (render().find(node => node.props["aria-label"] === label)!.props.onClick as () => void)(); render(); },
        select: (id: string) => { (render().find(node => Array.isArray(node.props.options))!.props.onValueChange as (id: string) => void)(id); render(); },
        selected: () => render().find(node => Array.isArray(node.props.options))!,
        table: () => render().find(node => Array.isArray(node.props.data))!,
        rowActions: () => {
            const table = render().find(node => Array.isArray(node.props.data))!;
            const row = (table.props.data as unknown[])[0];
            return ["actions", "renderGridCard"].flatMap(key => nodes((table.props[key] as (row: unknown) => ReactNode)(row)))
                .filter(node => node.props.children === (kind === "terms" ? "Renew term" : "Edit"));
        },
        save: () => { const button = render().find(node => node.props.children === (kind === "terms" ? "Save membership term" : "Save expectation"))!;
            expect(button.props.disabled).toBe(false); (button.props.onClick as () => void)(); render(); },
    };
}
async function flush() { for (let i = 0; i < 20; i++) await Promise.resolve(); }
beforeEach(() => {
    vi.resetAllMocks(); hooks.cursor = 0; hooks.values = []; hooks.dirty = false; hooks.effects = []; hooks.cleanups.clear();
    vi.stubGlobal("requestAnimationFrame", vi.fn()); vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.stubGlobal("fetch", mocks.fetch);
    mocks.fetch.mockImplementation(async (url: string, init?: RequestInit) => new Response(JSON.stringify(init?.method === "POST" ? {} : response(url))));
});
afterEach(() => { hooks.cleanups.forEach(cleanup => cleanup()); vi.unstubAllGlobals(); });

describe.each(["expectations", "terms"] as const)("dashboard %s setup controls", kind => {
    const title = kind === "terms" ? "Membership terms" : "Attendance expectations";
    it("reaches student and record 501 with independent paging and honest totals", async () => {
        const page = mount(kind); await flush();
        expect(page.page("Students").props).toMatchObject({ count: 50, total: 501 });
        expect(page.page(title).props).toMatchObject({ count: 50, total: 501 });
        for (let i = 0; i < 10; i++) { page.click("Next Students"); await flush(); }
        expect(page.selected().props.options).toContainEqual({ value: "student-500", label: "Student 500" });
        expect(page.page("Students").props).toMatchObject({ count: 1, total: 501 });
        expect(page.page(title).props).toMatchObject({ count: 50, total: 501 });
        for (let i = 0; i < 10; i++) { page.click(`Next ${title}`); await flush(); }
        expect((page.table().props.data as { id: string }[])[0].id).toBe(kind === "terms" ? "record-500" : "student-500");
        expect(page.page(title).props).toMatchObject({ count: 1, total: 501 });
        page.click(`Previous ${title}`); await flush();
        expect(page.page(title).props.count).toBe(50);
        expect(mocks.fetch.mock.calls.every(([url]) => new URL(url, "http://test.local").searchParams.get("limit") === "50")).toBe(true);
    });

    it("resolves a focused student outside page one and preserves saved defaults", async () => {
        const page = mount(kind, true, "student-500"); await flush();
        expect(page.selected().props).toMatchObject({ value: "student-500" });
        expect(page.selected().props.options).toContainEqual({ value: "student-500", label: "Student 500" });
        expect(page.page(title).props).toMatchObject({ count: 1, total: 1 });
        if (kind === "expectations") {
            expect(page.render().find(node => node.props.type === "time")?.props.value).toBe("08:15");
            page.save(); await flush();
            const write = mocks.fetch.mock.calls.find(([, init]) => init.method === "POST")!;
            expect(JSON.parse(write[1].body)).toEqual({ studentId: "student-500", weekdays: [1, 3], expectedBy: "08:15", enabled: false });
        } else {
            expect(page.render().filter(node => node.props.type === "date")[0].props.value).toBe("2026-10-01");
        }
    });

    it("resets history paging when a student is selected", async () => {
        const page = mount(kind); await flush(); page.click(`Next ${title}`); await flush();
        page.select("student-005"); await flush();
        const query = new URL(mocks.fetch.mock.calls.at(-1)![0], "http://test.local").searchParams;
        expect(query.get("studentId")).toBe("student-005"); expect(query.has("cursor")).toBe(false);
        expect(page.page(title).props).toMatchObject({ count: 1, total: 1 });
    });

    it("keeps Previous available after a failed page without presenting unknown totals as zero", async () => {
        const page = mount(kind); await flush();
        mocks.fetch.mockResolvedValueOnce(new Response(JSON.stringify({ error: "This page is no longer available." }), { status: 400 }));
        page.click(`Next ${title}`); await flush();
        expect(page.page(title).props.total).toBeNull();
        expect(page.render().find(node => node.props["aria-label"] === `Previous ${title}`)!.props.disabled).toBe(false);
        page.click(`Previous ${title}`); await flush();
        expect(page.page(title).props).toMatchObject({ total: 501, count: 50 });
    });

    it.each(["success", "failure"] as const)("locks paging and row selection through a deferred save and recovers after %s", async outcome => {
        let finishPost!: (response: Response) => void;
        let finishReload!: (response: Response) => void;
        let reloading = false;
        mocks.fetch.mockImplementation((url: string, init?: RequestInit) => {
            if (init?.method === "POST") return new Promise<Response>(resolve => { finishPost = resolve; });
            if (reloading) return new Promise<Response>(resolve => { finishReload = resolve; });
            return Promise.resolve(new Response(JSON.stringify(response(url))));
        });
        const page = mount(kind, true, "student-005"); await flush();
        const draftInput = () => page.render().find(node => kind === "terms" ? node.props.maxLength === 80 : node.props.type === "time")!;
        const draft = kind === "terms" ? "Draft membership" : "10:30";
        (draftInput().props.onChange as (event: unknown) => void)({ target: { value: draft } });
        if (kind === "terms") (page.render().filter(node => node.props.type === "date")[1].props.onChange as (event: unknown) => void)({ target: { value: "2026-12-31" } });
        expect(page.render().find(node => node.props["aria-label"] === "Next Students")!.props.disabled).toBe(false);
        page.save();
        const requestsAtSave = mocks.fetch.mock.calls.length;
        const expectLocked = () => {
            expect(page.selected().props.disabled).toBe(true);
            for (const label of ["Students", title]) for (const direction of ["Previous", "Next"]) {
                expect(page.render().find(node => node.props["aria-label"] === `${direction} ${label}`)!.props.disabled).toBe(true);
                page.click(`${direction} ${label}`);
            }
            const actions = page.rowActions();
            expect(actions).toHaveLength(2);
            for (const action of actions) {
                expect(action.props.disabled).toBe(true);
                (action.props.onClick as () => void)();
            }
            page.select("student-006");
            expect(page.selected().props.value).toBe("student-005");
            expect(draftInput().props.value).toBe(draft);
        };
        expectLocked();
        expect(mocks.fetch).toHaveBeenCalledTimes(requestsAtSave);
        reloading = outcome === "success";
        finishPost(new Response(JSON.stringify(outcome === "success" ? {} : { error: "Save failed" }), { status: outcome === "success" ? 200 : 400 }));
        await flush();
        if (outcome === "success") {
            expectLocked();
            const reloadUrl = mocks.fetch.mock.calls.at(-1)![0];
            expect(reloadUrl).toBe(mocks.fetch.mock.calls[0][0]);
            reloading = false;
            finishReload(new Response(JSON.stringify(response(reloadUrl))));
            await flush();
        }
        expect(page.selected().props.disabled).toBe(false);
        expect(page.rowActions().every(action => action.props.disabled === false)).toBe(true);
        expect(page.render().find(node => node.props["aria-label"] === "Next Students")!.props.disabled).toBe(false);
        page.click("Next Students"); await flush();
        expect(page.page("Students").props).toMatchObject({ count: 50, total: 501 });
        expect((page.page("Students").props.page as { index: number; loading: boolean })).toMatchObject({ index: 1, loading: false });
    });
});

it("allows a readonly term reader to page history without enabling a save", async () => {
    const page = mount("terms", false); await flush(); page.click("Next Membership terms"); await flush();
    expect(page.page("Membership terms").props.count).toBe(50);
    expect(page.render().find(node => node.props.children === "Save membership term")!.props.disabled).toBe(true);
    expect(mocks.fetch.mock.calls.some(([, init]) => init.method === "POST")).toBe(false);
});
