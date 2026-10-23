import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OrganizationBillingChange } from "@/app/generated/prisma/client";
import type { RazorpaySubscription } from "@/lib/razorpay";

type Row = Record<string, unknown>;
const db = vi.hoisted(() => ({ client: {} as Record<string, unknown> }));
vi.mock("@/lib/prisma", () => ({ prisma: new Proxy({}, {
  get: (_target, key) => db.client[String(key)],
}) }));
vi.mock("@/services/billingMutationAudit.service", () => ({
  recordBillingMutationAudit: vi.fn(async () => undefined),
}));

import { BillingMutationService } from "@/services/billingMutation.service";
import { BillingReconciliationService } from "@/services/billingReconciliation.service";
import { executeBillingProviderAction } from "@/services/billingProviderAction.service";
import { buildCommercialIntentSnapshot } from "@/services/billingCommercialEvidence.service";
import { setRazorpayClientForTests, type RazorpayApiClient } from "@/lib/razorpay";

const now = new Date("2026-10-15T12:00:00Z");
const originalUpdatedAt = new Date("2026-10-01T00:00:00Z");
const periodStart = Date.parse("2026-10-01T00:00:00Z") / 1000;
const periodEnd = Date.parse("2026-11-01T00:00:00Z") / 1000;

function matches(row: Row, where: Row = {}): boolean {
  return Object.entries(where).every(([key, expected]) => {
    if (key === "OR") return (expected as Row[]).some(item => matches(row, item));
    if (key === "NOT") return !matches(row, expected as Row);
    const value = row[key];
    if (expected instanceof Date) return value instanceof Date && value.getTime() === expected.getTime();
    if (expected && typeof expected === "object") {
      const filter = expected as Row;
      if ("in" in filter) return (filter.in as unknown[]).includes(value);
      if ("not" in filter) return value !== filter.not;
      if ("gt" in filter) return Number(value) > Number(filter.gt);
      if ("lte" in filter) return Number(value) <= Number(filter.lte);
      return value != null && matches(value as Row, filter);
    }
    return expected === undefined || value === expected;
  });
}

/** An in-memory transaction model, not a replacement implementation of recovery.
 * Actual service, commercial validator and durable executor run against it.
 * Rollback and compare-and-set matching make partial finalization observable. */
function fixture() {
  let state = {
    organizations: [{ id: "org_1", billingMutationSequence: 1,
      billingMutationLeaseToken: null, billingMutationLeaseUntil: null }] as Row[],
    subscriptions: [{ id: "local_sub", organizationId: "org_1", currentOrganizationId: "org_1",
      providerMode: "TEST", razorpaySubscriptionId: "sub_1", razorpayPlanId: "plan_basic",
      quantity: 1, plan: "BASIC", status: "ACTIVE", amountSubunits: 29_900, currency: "INR",
      paidThrough: null, updatedAt: originalUpdatedAt }] as Row[],
    changes: [] as Row[], actions: [] as Row[], invoices: [] as Row[], histories: [] as Row[], audits: [] as Row[],
  };
  const initialChange: Row = {
    id: "change_1", organizationId: "org_1", organizationSubscriptionId: "local_sub",
    replacementSubscriptionId: null, status: "FAILED", operationStatus: "FAILED",
    type: "PLAN_UPGRADE", toPlan: "PRO", toQuantity: 1, sequence: 1, attemptCount: 1,
    updatedAt: originalUpdatedAt, failureCategory: "MANUAL_REVIEW_REQUIRED",
    failureCode: "PROVIDER_MUTATION_OUTCOME_UNKNOWN",
    ...buildCommercialIntentSnapshot({ providerMode: "TEST", razorpaySubscriptionId: "sub_1",
      sourceRazorpayPlanId: "plan_basic", razorpayPlanId: "plan_pro", plan: "PRO", quantity: 1,
      unitAmountSubunits: 49_900, currency: "INR", period: "monthly", interval: 1,
      capturedAt: originalUpdatedAt }),
  };
  state.changes.push(initialChange);
  state.actions.push({ id: "action_1", organizationId: "org_1", changeId: "change_1",
    actionKey: "change_1:MUTATE", providerMode: "TEST", purpose: "MUTATE", status: "UNKNOWN",
    dispatchToken: "original_dispatch", failureKind: "NETWORK",
    request: { method: "updateSubscription", args: ["sub_1", { plan_id: "plan_pro", schedule_change_at: "now" }] },
  });
  const provider: RazorpaySubscription = { id: "sub_1", entity: "subscription", plan_id: "plan_pro",
    status: "active", quantity: 1, total_count: 120, paid_count: 1, has_scheduled_changes: false,
    current_start: periodStart, current_end: periodEnd, offer_id: null };
  const invoice = { id: "inv_1", entity: "invoice" as const, subscription_id: "sub_1", payment_id: "pay_1",
    status: "paid", amount: 49_900, amount_paid: 49_900, amount_due: 0, currency: "INR",
    billing_start: periodStart, billing_end: periodEnd, issued_at: periodStart, paid_at: periodStart + 60 };
  const payment = { id: "pay_1", entity: "payment" as const, invoice_id: "inv_1", subscription_id: "sub_1",
    amount: 49_900, currency: "INR", status: "captured", captured: true, method: "card", order_id: null };
  let failReceiptWrite = false;
  let beforeReceiptWrite = () => {};
  function model(key: keyof typeof state) {
    function find(where: Row) {
      const normalized = "organizationId_actionKey" in where ? where.organizationId_actionKey as Row : where;
      return state[key].find(row => matches(row, normalized));
    }
    function project(row: Row | undefined, include?: Row) {
      if (!row) return null;
      return structuredClone({ ...row, ...(include?.organizationSubscription ? {
        organizationSubscription: state.subscriptions.find(sub => sub.id === row.organizationSubscriptionId),
      } : {}) });
    }
    const read = async ({ where = {}, include }: { where?: Row; include?: Row } = {}) => project(find(where), include);
    return {
      findUnique: vi.fn(read), findFirst: vi.fn(read),
      findUniqueOrThrow: vi.fn(async ({ where, include }: { where: Row; include?: Row }) => {
        const result = project(find(where), include);
        if (!result) throw new Error(`Missing test ${key}`);
        return result;
      }),
      update: vi.fn(async ({ where, data }: { where: Row; data: Row }) => {
        const row = find(where);
        if (!row) throw new Error(`Missing test ${key}`);
        Object.assign(row, data);
        return structuredClone(row);
      }),
      updateMany: vi.fn(async ({ where, data }: { where: Row; data: Row }) => {
        if (key === "actions" && failReceiptWrite) throw new Error("Simulated receipt persistence failure");
        if (key === "actions") beforeReceiptWrite();
        const rows = state[key].filter(row => matches(row, where));
        for (const row of rows) Object.assign(row, data);
        return { count: rows.length };
      }),
      create: vi.fn(async ({ data }: { data: Row }) => {
        const row = { id: `created_${state[key].length}`, ...data };
        state[key].push(row);
        return structuredClone(row);
      }),
      upsert: vi.fn(async ({ where, create, update }: { where: Row; create: Row; update: Row }) => {
        const row = find(where);
        if (row) { Object.assign(row, update); return structuredClone(row); }
        state[key].push({ ...create });
        return structuredClone(create);
      }),
    };
  }
  const actions = model("actions");
  const tx = {
    $queryRaw: vi.fn(async () => [{ id: "org_1" }]),
    organization: model("organizations"), organizationSubscription: model("subscriptions"),
    organizationBillingChange: model("changes"), billingProviderAction: actions,
    organizationSubscriptionInvoice: model("invoices"), organizationSubscriptionHistory: model("histories"),
    organizationBillingChangeAudit: model("audits"),
  };
  db.client = { ...tx, $transaction: async (run: (client: typeof tx) => Promise<unknown>) => {
    const previous = structuredClone(state);
    try { return await run(tx); } catch (error) { state = previous; throw error; }
  } };
  const updateSubscription = vi.fn(async (_id: string, input: { plan_id?: string; quantity?: number }) => ({
    ...provider, plan_id: input.plan_id ?? provider.plan_id, quantity: input.quantity ?? provider.quantity,
  }));
  const cancelScheduledChanges = vi.fn(async () => provider);
  const cancelSubscription = vi.fn(async () => provider);
  const fetchSubscription = vi.fn(async () => ({ ...provider }));
  const fetchSubscriptionInvoices = vi.fn(async () => ({ entity: "collection" as const, count: 1, items: [invoice] }));
  setRazorpayClientForTests({ fetchSubscription, fetchSubscriptionInvoices,
    fetchPayment: vi.fn(async () => payment), fetchPlan: vi.fn(async () => ({ id: "plan_pro", entity: "plan",
      period: "monthly", interval: 1, item: { amount: 49_900, currency: "INR", name: "Standard" } })),
    updateSubscription, cancelScheduledChanges, cancelSubscription,
  } as unknown as RazorpayApiClient);
  vi.spyOn(BillingMutationService, "processNext").mockResolvedValue(null);
  return {
    get state() { return state; }, provider, invoice, payment, actions, updateSubscription,
    cancelScheduledChanges, cancelSubscription, fetchSubscription, fetchSubscriptionInvoices,
    failReceipt() { failReceiptWrite = true; },
    raceReceipt(nextStatus: string, replaceDispatch = false) {
      beforeReceiptWrite = () => {
        state.actions[0].status = nextStatus;
        if (replaceDispatch) state.actions[0].dispatchToken = "different_dispatch";
        beforeReceiptWrite = () => {};
      };
    },
    scheduledUndo() {
      Object.assign(state.changes[0], { type: "PLAN_DOWNGRADE", failureCode: "SCHEDULED_UNDO_OUTCOME_UNKNOWN" });
      Object.assign(state.actions[0], { actionKey: "change_1:UNDO_SCHEDULE", purpose: "UNDO_SCHEDULE",
        request: { method: "cancelScheduledChanges", args: ["sub_1"] } });
      provider.plan_id = "plan_basic";
    },
    async dispatchNext() {
      Object.assign(state.organizations[0], { billingMutationLeaseToken: "next_lease",
        billingMutationLeaseUntil: new Date(Date.now() + 120_000) });
      const change = { id: "change_2", organizationId: "org_1", organizationSubscriptionId: "local_sub",
        status: "PROCESSING", attemptCount: 1, processingStartedAt: now,
        authorizedProviderMode: "TEST", authorizedRazorpayPlanId: "plan_basic", authorizedQuantity: 1 };
      state.changes.push(change);
      return executeBillingProviderAction({ organizationId: "org_1", leaseToken: "next_lease",
        change: change as unknown as OrganizationBillingChange, purpose: "MUTATE",
        command: { method: "updateSubscription", args: ["sub_1", { plan_id: "plan_basic", schedule_change_at: "cycle_end" }] },
      });
    },
    reconcile() { return BillingReconciliationService.reconcileProviderSubscription("sub_1", {
      commercialIntentChangeId: "change_1", now,
    }); },
  };
}

beforeEach(() => {
  vi.stubEnv("RAZORPAY_MODE", "TEST");
  vi.stubEnv("RAZORPAY_KEY_ID", "rzp_test_recovery_fixture");
  vi.stubEnv("VERCEL_ENV", "development");
  vi.stubEnv("RAZORPAY_BILLING_WRITES_ENABLED", "true");
});
afterEach(() => { setRazorpayClientForTests(null); vi.restoreAllMocks(); vi.unstubAllEnvs(); });

describe("recovered billing actions permit future changes", () => {
  it.each([
    "SCHEDULED_UNDO_OUTCOME_UNKNOWN", "SCHEDULED_UNDO_RECONCILIATION_FAILED", "SCHEDULED_UNDO_LEASE_EXPIRED",
  ])("read-only recovery confirms %s with billing writes held and never replays the queue", async failureCode => {
    const f = fixture(); f.scheduledUndo(); f.state.changes[0].failureCode = failureCode;
    vi.stubEnv("RAZORPAY_BILLING_WRITES_ENABLED", "false");
    await expect(BillingMutationService.reconcileScheduledUndo("change_1"))
      .resolves.toMatchObject({ status: "UNDONE", operationStatus: "ABANDONED" });
    expect(f.state.actions[0]).toMatchObject({ status: "CONFIRMED", dispatchToken: "original_dispatch" });
    expect(f.fetchSubscription).toHaveBeenCalledExactlyOnceWith("sub_1");
    expect(BillingMutationService.processNext).not.toHaveBeenCalled();
    expect(f.updateSubscription).not.toHaveBeenCalled();
    expect(f.cancelScheduledChanges).not.toHaveBeenCalled();
    expect(f.cancelSubscription).not.toHaveBeenCalled();
  });

  it.each(["mutation", "replacement"])("rejects %s through the read-only scheduled-undo route before provider access", async kind => {
    const f = fixture();
    if (kind === "replacement") {
      f.scheduledUndo(); f.state.changes[0].replacementSubscriptionId = "candidate_sub";
    }
    await expect(BillingMutationService.reconcileScheduledUndo("change_1"))
      .rejects.toMatchObject({ code: "BILLING_MANUAL_REVIEW_REQUIRED" });
    expect(f.fetchSubscription).not.toHaveBeenCalled();
    expect(f.state.actions[0].status).toBe("UNKNOWN");
    expect(BillingMutationService.processNext).not.toHaveBeenCalled();
  });

  it("retains ambiguous undo evidence with writes held and never replays a provider action", async () => {
    const f = fixture(); f.scheduledUndo(); f.provider.has_scheduled_changes = true;
    vi.stubEnv("RAZORPAY_BILLING_WRITES_ENABLED", "false");
    await expect(BillingMutationService.reconcileScheduledUndo("change_1"))
      .rejects.toMatchObject({ code: "BILLING_MANUAL_REVIEW_REQUIRED" });
    expect(f.state.changes[0].status).toBe("FAILED");
    expect(f.state.actions[0].status).toBe("UNKNOWN");
    expect(BillingMutationService.processNext).not.toHaveBeenCalled();
    expect(f.updateSubscription).not.toHaveBeenCalled();
    expect(f.cancelScheduledChanges).not.toHaveBeenCalled();
    expect(f.cancelSubscription).not.toHaveBeenCalled();
  });

  it.each(["UNKNOWN", "ADMITTED"])("resolves a %s scheduled undo before dispatching a later plan change", async status => {
    const f = fixture(); f.scheduledUndo(); f.state.actions[0].status = status;
    const recovered = await BillingMutationService.retry("change_1");
    if (!recovered) throw new Error("Scheduled undo recovery must return the recovered operation");
    expect(recovered.status).toBe("UNDONE");
    expect(f.state.actions[0]).toMatchObject({ status: "CONFIRMED", dispatchToken: "original_dispatch", failureKind: null });
    expect(f.cancelScheduledChanges).not.toHaveBeenCalled();
    expect(f.updateSubscription).not.toHaveBeenCalled();
    await expect(f.dispatchNext()).resolves.toMatchObject({ id: "sub_1", plan_id: "plan_basic" });
    expect(f.updateSubscription).toHaveBeenCalledExactlyOnceWith("sub_1", { plan_id: "plan_basic", schedule_change_at: "cycle_end" });
    expect(f.state.actions[1]).toMatchObject({ actionKey: "change_2:MUTATE", status: "CONFIRMED" });
  });

  it.each(["FAILED", "APPLIED"])("resolves exact-settlement recovery for a %s intent before a later plan change", async status => {
    const f = fixture(); f.state.changes[0].status = status;
    const recovered = await f.reconcile();
    expect(recovered).toMatchObject({ confirmedPaidPeriod: true, evidenceKind: "EXACT_SETTLEMENT" });
    expect(f.state.changes[0]).toMatchObject({ status: "APPLIED" });
    expect(f.state.subscriptions[0]).toMatchObject({ plan: "PRO", paidThrough: new Date(periodEnd * 1000), confirmedCommercialIntentChangeId: "change_1" });
    expect(f.state.actions[0]).toMatchObject({ status: "CONFIRMED", dispatchToken: "original_dispatch" });
    expect(f.updateSubscription).not.toHaveBeenCalled();
    await f.dispatchNext();
    expect(f.updateSubscription).toHaveBeenCalledTimes(1);
  });

  it.each([
    { id: "sub_foreign" }, { plan_id: "plan_wrong" }, { quantity: 2 }, { has_scheduled_changes: true },
  ])("retains unresolved scheduled undo for mismatched provider evidence %j", async override => {
    const f = fixture(); f.scheduledUndo(); Object.assign(f.provider, override);
    await expect(BillingMutationService.retry("change_1")).rejects.toMatchObject({ code: "BILLING_MANUAL_REVIEW_REQUIRED" });
    expect(f.state.changes[0].status).toBe("FAILED");
    expect(f.state.actions[0].status).toBe("UNKNOWN");
    await expect(f.dispatchNext()).rejects.toMatchObject({ code: "BILLING_MANUAL_REVIEW_REQUIRED" });
    expect(f.cancelScheduledChanges).not.toHaveBeenCalled();
    expect(f.updateSubscription).not.toHaveBeenCalled();
  });

  it.each(["provider", "mode", "unpaid", "duplicate"])("retains the mutation receipt for %s evidence mismatch", async mismatch => {
    const f = fixture();
    if (mismatch === "provider") f.provider.plan_id = "plan_wrong";
    if (mismatch === "mode") f.state.changes[0].authorizedProviderMode = "LIVE";
    if (mismatch === "unpaid") f.invoice.amount_due = 1;
    if (mismatch === "duplicate") f.fetchSubscriptionInvoices.mockResolvedValue({ entity: "collection", count: 2,
      items: [f.invoice, { ...f.invoice, id: "inv_duplicate", payment_id: "pay_duplicate" }] });
    await expect(f.reconcile()).rejects.toMatchObject({ code: "BILLING_MANUAL_REVIEW_REQUIRED" });
    expect(f.state.actions[0].status).toBe("UNKNOWN");
    expect(f.state.subscriptions[0]).toMatchObject({ plan: "BASIC", paidThrough: null });
    await expect(f.dispatchNext()).rejects.toMatchObject({ code: "BILLING_MANUAL_REVIEW_REQUIRED" });
    expect(f.updateSubscription).not.toHaveBeenCalled();
  });

  it("preserves independent cancellation outcomes when settlement resolves the update", async () => {
    const f = fixture();
    f.state.actions.push({ ...f.state.actions[0], id: "source_action", actionKey: "change_1:CANCEL_SOURCE",
      purpose: "CANCEL_SOURCE", request: { method: "cancelSubscription", args: ["sub_1", { cancel_at_cycle_end: true }] } });
    await f.reconcile();
    expect(f.state.actions[0].status).toBe("CONFIRMED");
    expect(f.state.actions[1].status).toBe("UNKNOWN");
    await expect(f.dispatchNext()).rejects.toMatchObject({ code: "BILLING_MANUAL_REVIEW_REQUIRED" });
    expect(f.updateSubscription).not.toHaveBeenCalled();
    expect(f.cancelSubscription).not.toHaveBeenCalled();
  });

  it.each(["undo", "settlement"])("resolves %s when a delayed timeout races ADMITTED to UNKNOWN", async kind => {
    const f = fixture();
    if (kind === "undo") f.scheduledUndo();
    f.state.actions[0].status = "ADMITTED";
    f.raceReceipt("UNKNOWN");
    await (kind === "undo" ? BillingMutationService.retry("change_1") : f.reconcile());
    expect(f.state.actions[0].status).toBe("CONFIRMED");
    await f.dispatchNext();
    expect(f.updateSubscription).toHaveBeenCalledTimes(1);
  });

  it("accepts an independently confirmed response for the same dispatch", async () => {
    const f = fixture(); f.raceReceipt("CONFIRMED");
    await f.reconcile();
    expect(f.state.changes[0].status).toBe("APPLIED");
    expect(f.state.actions[0].status).toBe("CONFIRMED");
    await f.dispatchNext();
    expect(f.updateSubscription).toHaveBeenCalledTimes(1);
  });

  it("rolls back adoption when the receipt dispatch changed during confirmation", async () => {
    const f = fixture(); f.raceReceipt("CONFIRMED", true);
    await expect(f.reconcile()).rejects.toMatchObject({ code: "BILLING_MANUAL_REVIEW_REQUIRED" });
    expect(f.state.changes[0].status).toBe("FAILED");
    expect(f.state.subscriptions[0]).toMatchObject({ plan: "BASIC", paidThrough: null });
    expect(f.updateSubscription).not.toHaveBeenCalled();
  });

  it.each(["mode", "subscription"])("rolls back domain recovery for a mismatched receipt %s", async mismatch => {
    const f = fixture();
    if (mismatch === "mode") f.state.actions[0].providerMode = "LIVE";
    else f.state.actions[0].request = { method: "updateSubscription", args: ["sub_foreign", { plan_id: "plan_pro" }] };
    await expect(f.reconcile()).rejects.toMatchObject({ code: "BILLING_MANUAL_REVIEW_REQUIRED" });
    expect(f.state.actions[0].status).toBe("UNKNOWN");
    expect(f.state.changes[0].status).toBe("FAILED");
    expect(f.state.subscriptions[0]).toMatchObject({ plan: "BASIC", paidThrough: null });
  });

  it("does not treat a paid period as confirmation of a cancellation action", async () => {
    const f = fixture(); f.state.changes[0].type = "CANCELLATION";
    f.state.actions[0].request = { method: "cancelSubscription", args: ["sub_1", { cancel_at_cycle_end: true }] };
    await f.reconcile();
    expect(f.state.actions[0].status).toBe("UNKNOWN");
    expect(f.cancelSubscription).not.toHaveBeenCalled();
  });

  it.each(["undo", "settlement"])("rolls back %s adoption when receipt persistence fails", async kind => {
    const f = fixture(); f.failReceipt();
    if (kind === "undo") f.scheduledUndo();
    await expect(kind === "undo" ? BillingMutationService.retry("change_1") : f.reconcile())
      .rejects.toMatchObject({ code: "BILLING_MANUAL_REVIEW_REQUIRED" });
    expect(f.state.changes[0].status).toBe("FAILED");
    expect(f.state.actions[0].status).toBe("UNKNOWN");
    expect(f.state.subscriptions[0]).toMatchObject({ plan: "BASIC", paidThrough: null });
    expect(f.updateSubscription).not.toHaveBeenCalled();
  });
});
