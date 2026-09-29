import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement, ReactNode } from "react";
import type { PaymentListItem, PaymentListParams } from "@/lib/api/payments";
import type { PagedResult } from "@/types/ui";

// Run the actual page's hooks and event callbacks with controlled promise
// completion. No DOM, Clerk, database, provider, or network is involved.
const hooks = vi.hoisted(() => ({
  cursor: 0, values: [] as unknown[], dirty: false, writes: 0,
  pendingEffects: [] as Array<() => void>,
  cleanups: new Map<number, () => void>(),
}));
const mocks = vi.hoisted(() => ({
  list: vi.fn(), listAll: vi.fn(), toast: { show: vi.fn() },
  search: new URLSearchParams(),
}));
vi.mock("react", async original => {
  const react = await original<typeof import("react")>();
  const unchanged = (before: unknown[] | undefined, after: unknown[]) =>
    before?.length === after.length && before.every((item, index) => Object.is(item, after[index]));
  return {
    ...react,
    use: () => ({ branchId: "branch" }),
    useState: (initial: unknown) => {
      const index = hooks.cursor++;
      if (!(index in hooks.values)) hooks.values[index] = typeof initial === "function" ? initial() : initial;
      return [hooks.values[index], (value: unknown) => {
        const next = typeof value === "function" ? value(hooks.values[index]) : value;
        hooks.writes++;
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
      if (!unchanged(previous?.deps, deps)) hooks.values[index] = { value: callback, deps };
      return (hooks.values[index] as { value: unknown }).value;
    },
    useEffect: (effect: () => void | (() => void), deps: unknown[]) => {
      const index = hooks.cursor++;
      const previous = hooks.values[index] as unknown[] | undefined;
      hooks.values[index] = deps;
      if (!unchanged(previous, deps)) hooks.pendingEffects.push(() => {
        hooks.cleanups.get(index)?.();
        const cleanup = effect();
        if (cleanup) hooks.cleanups.set(index, cleanup); else hooks.cleanups.delete(index);
      });
    },
  };
});
vi.mock("@/lib/api/payments", () => ({ payments: { list: mocks.list, listAll: mocks.listAll } }));
vi.mock("@/components/settings/LocalizedText", () => ({
  useTranslation: () => Object.assign((text: string) => text, { error: (text: string) => text, owned: (text: string) => text }),
}));
vi.mock("@/components/settings/UserPreferencesApplier", () => ({
  useUserPreferences: () => ({ formatDate: (date: Date | string) => String(date), formatNumber: (number: number) => String(number) }),
}));
vi.mock("@/components/ui", () => ({ AppButton: "app-button", useToast: () => mocks.toast }));
vi.mock("@/hooks/useDataViewMode", () => ({ useDataViewMode: () => ["table", vi.fn()] }));
vi.mock("next/navigation", () => ({ useSearchParams: () => mocks.search }));
vi.mock("@/lib/branchCapabilities", () => ({ getBranchCapabilityDecision: () => ({ allowed: true }) }));

import PaymentsPage from "@/app/branch/[branchId]/payments/page";

type PageResult = PagedResult<PaymentListItem>;
type Pending = { options: PaymentListParams; resolve: (value: PageResult) => void; reject: (error: Error) => void };
let pending: Pending[];
let events: EventTarget;
function row(id: string): PaymentListItem { return { id } as PaymentListItem; }
function response(id: string, total = 10, nextCursor: string | null = null): PageResult {
  return { items: [row(id)], total, nextCursor };
}
type Node = ReactElement<{
  children?: ReactNode; actions?: ReactNode; toolbar?: ReactNode; footer?: ReactNode;
  label?: string; count?: number; busy?: boolean; kind?: string; title?: string;
  data?: PaymentListItem[]; isLoading?: boolean; "aria-label"?: string;
  onClick?: () => void;
}>;
function nodes(node: ReactNode): Node[] {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  const element = node as Node;
  if (!element.props) return [];
  return [element, ...[element.props.children, element.props.actions, element.props.toolbar, element.props.footer].flatMap(nodes)];
}
function mount() {
  const outer = PaymentsPage({ params: Promise.resolve({ branchId: "branch" }) });
  const content = (outer.props.children as (access: unknown) => ReactElement<Record<string, unknown>>)({ isOwner: true });
  const Component = content.type as (props: Record<string, unknown>) => ReactElement;
  let view: ReactElement;
  const render = () => {
    for (let attempts = 0; attempts < 10; attempts++) {
      hooks.cursor = 0; hooks.dirty = false;
      view = Component(content.props);
      hooks.pendingEffects.splice(0).forEach(effect => effect());
      if (!hooks.dirty) return view;
    }
    throw new Error("Unstable hook render");
  };
  const control = (predicate: (node: Node) => boolean) => {
    const result = nodes(render()).find(predicate);
    if (!result) throw new Error("Control not found");
    return result;
  };
  render();
  return {
    tab: (label: string) => { control(node => node.props.label === label).props.onClick!(); render(); },
    previousMonth: () => { control(node => node.props["aria-label"] === "Previous month").props.onClick!(); render(); },
    moreCallback: () => control(node => node.props.children === "Load more payments").props.onClick!,
    more: () => { control(node => node.props.children === "Load more payments").props.onClick!(); render(); },
    refresh: () => { events.dispatchEvent(new Event("focus")); render(); },
    read: () => {
      const all = nodes(render());
      return {
        ids: all.find(node => node.props.data)?.props.data?.map(item => item.id) ?? [],
        busy: all.find(node => node.props.label === "Payments")?.props.busy,
        error: all.some(node => node.props.kind === "error"),
        counts: Object.fromEntries(all.filter(node => ["Due", "Paid", "Waived"].includes(node.props.label ?? ""))
          .map(node => [node.props.label, node.props.count])),
        hasMore: all.some(node => node.props.children === "Load more payments"),
        loadingMore: all.find(node => node.props.children === "Load more payments")?.props.isLoading,
      };
    },
    unmount: () => { hooks.cleanups.forEach(cleanup => cleanup()); hooks.cleanups.clear(); },
  };
}
async function flush() { for (let i = 0; i < 10; i++) await Promise.resolve(); }
async function settle(group: Pending[], id: string, total = 10, nextCursor: string | null = null) {
  group.forEach(request => request.resolve(response(id, total, nextCursor)));
  await flush();
}

beforeEach(() => {
  vi.resetAllMocks();
  hooks.cursor = 0; hooks.values = []; hooks.dirty = false; hooks.writes = 0;
  hooks.pendingEffects = []; hooks.cleanups.clear();
  mocks.search = new URLSearchParams();
  pending = [];
  events = new EventTarget();
  vi.stubGlobal("window", events);
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.list.mockImplementation((_branch: string, options: PaymentListParams) =>
    new Promise<PageResult>((resolve, reject) => pending.push({ options, resolve, reject })));
});
afterEach(() => {
  hooks.cleanups.forEach(cleanup => cleanup()); hooks.cleanups.clear();
  vi.restoreAllMocks(); vi.unstubAllGlobals();
});

describe("payment request ordering", () => {
  it.each(["tab", "month"] as const)("ignores an older %s response after the new selection loaded", async selection => {
    const page = mount(); const older = pending.slice();
    if (selection === "tab") page.tab("Paid"); else page.previousMonth();
    const latest = pending.slice(older.length);
    expect(latest).toHaveLength(3);
    await settle(latest, "current", 20, "current-cursor");
    await settle(older, "stale", 90, null);
    expect(page.read()).toMatchObject({ ids: ["current"], counts: { Due: 20, Paid: 20, Waived: 20 }, hasMore: true, busy: false });
  });

  it("does not publish an obsolete error or clear the newer request's loading state", async () => {
    const page = mount(); const older = pending.slice();
    page.tab("Paid"); const latest = pending.slice(older.length);
    older[0].reject(new Error("obsolete failure"));
    older.slice(1).forEach(request => request.resolve(response("unused")));
    await flush();
    expect(page.read()).toMatchObject({ busy: true, error: false });
    await settle(latest, "current");
    expect(page.read()).toMatchObject({ ids: ["current"], busy: false, error: false });
  });

  it.each(["selection", "refresh"] as const)("drops stale pagination after a %s", async cause => {
    const page = mount(); await settle(pending.slice(), "first", 30, "old-cursor");
    page.more(); const append = pending.at(-1)!;
    expect(append.options.cursor).toBe("old-cursor");
    const start = pending.length;
    if (cause === "selection") page.tab("Paid"); else page.refresh();
    await settle(pending.slice(start), "fresh", 40, "fresh-cursor");
    append.resolve(response("stale-append", 99, null)); await flush();
    expect(page.read()).toMatchObject({ ids: ["fresh"], counts: { Due: 40, Paid: 40, Waived: 40 }, hasMore: true, loadingMore: false });
    page.more();
    expect(pending.at(-1)!.options.cursor).toBe("fresh-cursor");
  });

  it("suppresses a stale pagination error toast", async () => {
    const page = mount(); await settle(pending.slice(), "first", 30, "cursor");
    page.more(); const append = pending.at(-1)!;
    const start = pending.length; page.tab("Paid");
    await settle(pending.slice(start), "fresh");
    append.reject(new Error("obsolete pagination failure")); await flush();
    expect(mocks.toast.show).not.toHaveBeenCalled();
    expect(page.read()).toMatchObject({ ids: ["fresh"], error: false });
  });

  it("appends the current cursor exactly once and retains updated pagination", async () => {
    const page = mount(); await settle(pending.slice(), "first", 30, "cursor");
    const loadMore = page.moreCallback();
    const start = pending.length;
    loadMore(); loadMore();
    expect(pending).toHaveLength(start + 1);
    const append = pending.at(-1)!;
    append.resolve(response("second", 31, "next")); await flush();
    expect(page.read()).toMatchObject({ ids: ["first", "second"], counts: { Due: 31 }, hasMore: true, loadingMore: false });
  });

  it("does not start an obsolete query from a retained callback", async () => {
    const page = mount(); await settle(pending.slice(), "first", 30, "cursor");
    const obsolete = page.moreCallback();
    page.tab("Paid");
    const requests = pending.length;
    obsolete();
    expect(pending).toHaveLength(requests);
    await settle(pending.slice(-3), "current");
    expect(page.read()).toMatchObject({ ids: ["current"], error: false });
  });

  it("keeps the current pagination cursor retryable after an error", async () => {
    const page = mount(); await settle(pending.slice(), "first", 30, "cursor");
    page.more(); pending.at(-1)!.reject(new Error("current failure")); await flush();
    expect(mocks.toast.show).toHaveBeenCalledOnce();
    expect(page.read()).toMatchObject({ ids: ["first"], loadingMore: false, hasMore: true });
    page.more();
    expect(pending.at(-1)!.options.cursor).toBe("cursor");
    pending.at(-1)!.resolve(response("second", 30, null)); await flush();
    expect(page.read()).toMatchObject({ ids: ["first", "second"], hasMore: false });
  });

  it("does not publish any pending request state after unmount", async () => {
    const page = mount(); page.unmount(); const writes = hooks.writes;
    await settle(pending.slice(), "too-late");
    expect(hooks.writes).toBe(writes);
  });
});
