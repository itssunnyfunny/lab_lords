import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { WorkspaceDirectoryOrganization } from "@/types";
import type { BillingOverview } from "@/lib/api/billing";

// Exercise the actual components and action callbacks without provider or DB I/O.
const hooks = vi.hoisted(() => ({ cursor: 0, values: [] as unknown[], effects: [] as Array<() => void>, cleanups: new Map<number, () => void>() }));
const mocks = vi.hoisted(() => ({ search: new URLSearchParams(), push: vi.fn(), ready: true,
  overview: vi.fn(), create: vi.fn(), change: vi.fn(), recovery: vi.fn(), method: vi.fn(), checkout: vi.fn(), directory: vi.fn(), operation: vi.fn() }));
vi.mock("react", async original => {
  const react = await original<typeof import("react")>();
  const same = (a: unknown[] | undefined, b: unknown[]) => a?.length === b.length && a.every((item, index) => Object.is(item, b[index]));
  return { ...react,
    useMemo: (compute: () => unknown) => compute(),
    useState: (initial: unknown) => {
      const index = hooks.cursor++;
      if (!(index in hooks.values)) hooks.values[index] = typeof initial === "function" ? initial() : initial;
      return [hooks.values[index], (next: unknown) => { hooks.values[index] = typeof next === "function" ? next(hooks.values[index]) : next; }];
    },
    useRef: (initial: unknown) => { const index = hooks.cursor++; if (!(index in hooks.values)) hooks.values[index] = { current: initial }; return hooks.values[index]; },
    useCallback: (callback: unknown, deps: unknown[]) => {
      const index = hooks.cursor++, previous = hooks.values[index] as { value: unknown; deps: unknown[] } | undefined;
      if (!same(previous?.deps, deps)) hooks.values[index] = { value: callback, deps };
      return (hooks.values[index] as { value: unknown }).value;
    },
    useEffect: (effect: () => void | (() => void), deps: unknown[]) => {
      const index = hooks.cursor++, previous = hooks.values[index] as unknown[] | undefined;
      hooks.values[index] = deps;
      if (!same(previous, deps)) hooks.effects.push(() => { hooks.cleanups.get(index)?.(); const cleanup = effect(); if (cleanup) hooks.cleanups.set(index, cleanup); });
    },
  };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push, replace: mocks.push }), useSearchParams: () => mocks.search }));
vi.mock("@/components/settings/LocalizedText", () => ({ useTranslation: () => Object.assign((text: string) => text, { owned: (text: string) => text, error: (text: string) => text }) }));
vi.mock("@/components/billing/BillingExperienceProvider", () => ({ BillingExperienceProvider: "billing-provider", useBillingExperience: () => null }));
vi.mock("@/components/settings/UserPreferencesApplier", () => ({ useUserPreferences: () => ({ ownerKey: "fixture-owner" }) }));
vi.mock("@/lib/api/workspaces", () => ({ workspaces: { getDirectory: mocks.directory } }));
vi.mock("@/components/billing/RazorpayCheckoutLauncher", () => ({
  RazorpayCheckoutScript: "checkout-script", isRazorpayCheckoutReady: () => mocks.ready,
  isRazorpayCheckoutPayload: () => false, getRazorpayCheckoutPayload: () => null, openRazorpayCheckout: mocks.checkout,
}));
vi.mock("@/lib/api/billing", () => ({ billing: { getOverview: mocks.overview, createSubscription: mocks.create, changePlan: mocks.change, createRecovery: mocks.recovery, changePaymentMethod: mocks.method, getOperation: mocks.operation } }));

import { AccountBilling } from "@/components/account/AccountBilling";
import { OrganizationBillingContent, BillingPlanCard } from "@/components/billing/OrganizationBillingContent";
import { CheckoutConfirmationDialog } from "@/components/billing/CheckoutConfirmationDialog";
import { BillingPaymentMethodsOverview } from "@/components/billing/BillingPaymentMethodsOverview";
import { SettingsSelect } from "@/components/settings/SettingsWorkspace";
import { publicBillingPlans } from "@/lib/billingPlans";
import BillingProcessingContent from "@/components/billing/BillingProcessingContent";
import { useWorkspaceReturnHref } from "@/hooks/useWorkspaceReturnHref";

type Node = ReactElement<Record<string, unknown> & { children?: ReactNode }>;
function nodes(value: ReactNode): Node[] {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap(nodes);
  const node = value as Node;
  return node.props ? [node, ...nodes(node.props.children)] : [];
}
function organizations(count: number) {
  return ["ordinary", "historical"].slice(0, count).map(id => ({ id, name: id, branches: [{ id: `${id}-branch`, name: "Main" }] })) as WorkspaceDirectoryOrganization[];
}
function overview(orgId: string, initial: boolean): BillingOverview {
  return { plans: publicBillingPlans(), current: initial ? null : {
    id: "subscription", organizationId: orgId, plan: "STANDARD", status: "ACTIVE", providerPaymentMethod: "CARD",
    unitAmount: 299, quantity: 1, monthlyTotal: 299, cancelAtCycleEnd: false,
  }, pendingReplacement: null, scheduledChanges: [], invoices: [], history: [], razorpayTestMode: true,
  entitlements: { canWrite: true, effectivePlan: "STANDARD" },
  experience: { effectivePlan: "STANDARD", projectedQuantity: 1, scheduledChanges: [], activeOperation: null,
    paymentAction: "NONE", customerState: "STANDARD_ACTIVE", customerMessage: "Active", },
  } as unknown as BillingOverview;
}
beforeEach(() => {
  vi.clearAllMocks(); hooks.cursor = 0; hooks.values = []; hooks.effects = []; hooks.cleanups = new Map(); mocks.ready = true;
  mocks.search = new URLSearchParams({ returnTo: "/branch/ordinary-branch/students" });
  vi.stubGlobal("window", { location: { pathname: "/account/billing", search: "?organizationId=ordinary", hash: "#invoices" } });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ branches: [], contactEmail: null, contactPhone: null }) }));
  vi.stubGlobal("sessionStorage", { getItem: () => "/branch/ordinary-branch", setItem: vi.fn() });
});
afterEach(() => { hooks.cleanups.forEach(cleanup => cleanup()); vi.unstubAllGlobals(); });

describe.each([1, 2])("actual billing callbacks for %i owned organization(s)", count => {
  it.each(["organization settings", "legacy branch"])("retains the %s entry in operation returns", entry => {
    const orgs = organizations(count), selected = orgs.at(-1)!;
    const returnTo = entry === "organization settings" ? `/org/${selected.id}/settings` : `/branch/${selected.id}-branch/students`;
    mocks.search = new URLSearchParams({ returnTo });
    const account = AccountBilling({ organizations: orgs, organizationId: selected.id, branchId: entry === "organization settings" ? `${selected.id}-branch` : undefined });
    const props = nodes(account).find(node => node.type === OrganizationBillingContent)!.props as { returnPath: string };
    const destination = new URL(props.returnPath, "https://test.invalid");
    expect(destination.searchParams.get("organizationId")).toBe(selected.id);
    expect(destination.searchParams.get("branchId")).toBe(`${selected.id}-branch`);
    expect(destination.searchParams.get("returnTo")).toBe(returnTo);
  });
  it.each(["recovery", "payment method", "plan change", "initial plan"])("preserves the operation scope through %s", async action => {
    const orgs = organizations(count), selected = orgs.at(-1)!;
    const account = AccountBilling({ organizations: orgs, organizationId: selected.id, branchId: `${selected.id}-branch` });
    const props = nodes(account).find(node => node.type === OrganizationBillingContent)!.props as { orgId: string; returnPath: string };
    const expected = new URL(props.returnPath, "https://test.invalid");
    expect(expected.searchParams.get("organizationId")).toBe(selected.id);
    expect(expected.searchParams.get("branchId")).toBe(`${selected.id}-branch`);
    expect(expected.searchParams.get("returnTo")).toBe(count === 1 ? "/branch/ordinary-branch/students" : "/branch/historical-branch");
    mocks.overview.mockResolvedValue(overview(selected.id, action === "initial plan"));
    const processingUrl = `/org/${selected.id}/billing/processing/change`;
    mocks.create.mockResolvedValue({ subscription: {} });
    mocks.change.mockResolvedValue({ processingUrl }); mocks.method.mockResolvedValue({ processingUrl });
    mocks.recovery.mockResolvedValue({ processingUrl });
    if (action === "recovery") mocks.ready = false;
    let view: Node[] = [];
    const render = () => { hooks.cursor = 0; view = nodes(OrganizationBillingContent(props)); hooks.effects.splice(0).forEach(effect => effect()); };
    const settle = async () => { for (let i = 0; i < 6; i++) { await Promise.resolve(); render(); } };
    render(); await settle();
    if (action === "payment method") {
      (view.find(node => node.type === BillingPaymentMethodsOverview)!.props.onChangeMethod as () => void)();
    } else if (action === "recovery") {
      await (view.find(node => node.type === CheckoutConfirmationDialog && node.props.purpose === "RECOVERY")!.props.onConfirm as () => Promise<void>)();
    } else {
      const card = view.find(node => node.type === BillingPlanCard && (node.props.plan as { id: string }).id === "PRO")!;
      (card.props.onStart as (plan: string) => void)("PRO"); render();
      await (view.find(node => node.type === CheckoutConfirmationDialog && node.props.purpose !== "RECOVERY")!.props.onConfirm as () => Promise<void>)();
    }
    await settle();
    const returnPath = props.returnPath + "#invoices";
    const api = action === "recovery" ? mocks.recovery : action === "payment method" ? mocks.method : action === "plan change" ? mocks.change : mocks.create;
    expect(api).toHaveBeenCalledWith(selected.id, ...(action.includes("plan") ? ["PRO", returnPath] : [returnPath]));
    if (action === "initial plan") mocks.checkout.mock.calls[0][0].navigate(processingUrl);
    const navigated = new URL(mocks.push.mock.calls.at(-1)![0], "https://test.invalid");
    expect(navigated.pathname).toBe(`/account/billing/${selected.id}/processing/change`);
    expect(navigated.searchParams.get("branchId")).toBe(`${selected.id}-branch`);
    hooks.cleanups.forEach(cleanup => cleanup());
    hooks.cursor = 0; hooks.values = []; hooks.effects = []; hooks.cleanups = new Map();
    mocks.operation.mockResolvedValue({ operation: { id: "change", operationStatus: "APPLIED", returnPath } });
    const renderProcessing = () => {
      hooks.cursor = 0;
      const result = nodes(BillingProcessingContent({ orgId: selected.id, changeId: "change" }));
      hooks.effects.splice(0).forEach(effect => effect());
      return result;
    };
    renderProcessing(); await Promise.resolve();
    expect(renderProcessing().find(node => node.props.href === returnPath)).toBeDefined();
    expect(mocks.operation).toHaveBeenCalledWith(selected.id, "change");
  });
});

it.each(["/branch/ordinary-branch/students", "/org/historical/settings", "/branch/historical-branch/students"])("resets context when selectors change after entry from %s", returnTo => {
  mocks.search = new URLSearchParams({ returnTo });
  const orgs = organizations(2);
  const account = AccountBilling({ organizations: orgs, organizationId: "historical", branchId: "historical-branch" });
  const selectors = nodes(account).filter(node => node.type === SettingsSelect);
  (selectors[0].props.onValueChange as (value: string) => void)("ordinary");
  expect(new URL(mocks.push.mock.calls.at(-1)![0], "https://test.invalid").searchParams.get("returnTo")).toBe("/org/ordinary");
  (selectors[1].props.onValueChange as (value: string) => void)("historical-branch");
  expect(new URL(mocks.push.mock.calls.at(-1)![0], "https://test.invalid").searchParams.get("returnTo")).toBe("/branch/historical-branch");
  (selectors[1].props.onValueChange as (value: string) => void)("all");
  const all = new URL(mocks.push.mock.calls.at(-1)![0], "https://test.invalid");
  expect(all.searchParams.get("returnTo")).toBe("/org/historical");
  expect(all.searchParams.has("branchId")).toBe(false);
});

it("updates the header for query-only scope changes and ignores a stale directory response", async () => {
  const directory = { organizations: organizations(2), staffBranches: [] };
  let finishOld!: (value: typeof directory) => void;
  mocks.directory.mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve; })).mockResolvedValue(directory);
  function ReturnProbe() { return useWorkspaceReturnHref("/account/billing"); }
  const render = () => {
    hooks.cursor = 0;
    const href = renderToStaticMarkup(<ReturnProbe />) || null;
    hooks.effects.splice(0).forEach(effect => effect());
    return href;
  };
  mocks.search = new URLSearchParams({ organizationId: "ordinary", branchId: "ordinary-branch" });
  expect(render()).toBeNull();
  mocks.search = new URLSearchParams({ organizationId: "historical", branchId: "historical-branch" });
  expect(render()).toBeNull();
  await Promise.resolve();
  expect(render()).toBe("/branch/historical-branch");
  finishOld(directory); await Promise.resolve();
  expect(render()).toBe("/branch/historical-branch");
  mocks.search = new URLSearchParams({ organizationId: "historical", returnTo: "/org/historical" });
  expect(render()).toBeNull();
  await Promise.resolve();
  expect(render()).toBe("/org/historical");
});
