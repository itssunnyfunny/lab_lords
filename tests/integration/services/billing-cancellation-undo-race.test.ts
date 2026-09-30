import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BillingService } from "@/services/billing.service";
import { BillingMutationService } from "@/services/billingMutation.service";
import { BillingChangeInProgressError } from "@/lib/billingErrors";
import { setRazorpayClientForTests, type RazorpayApiClient } from "@/lib/razorpay";
import { createBranch, createOrg, createSaasSubscription, createUser } from "@/tests/factories";
import { disconnectDatabase, resetDatabase, testPrisma } from "@/tests/setup/db";

// Real PostgreSQL row locks and application services; only the provider response
// is controlled. The default integration setup verifies the disposable target
// before resetting it, so this file must never run against a shared database.
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

function outcome<T>(promise: Promise<T>) {
  return promise.then(value => ({ value, error: null as unknown }), error => ({ value: null, error: error as unknown }));
}

async function waitForBlockedReaders(blocker: Client, holderPid: number, minimum: number) {
  for (let attempt = 0; attempt < 120; attempt++) {
    // pg_stat_activity is snapshot-cached for the holder's open transaction.
    // Refresh it before observing newly queued PostgreSQL lock waiters.
    await blocker.query("SELECT pg_stat_clear_snapshot()");
    const { rows } = await blocker.query<{ waiting: number; held: number }>(`
      SELECT count(*)::int AS waiting,
        count(*) FILTER (WHERE $1::int = ANY(pg_blocking_pids(activity.pid)))::int AS held
      FROM pg_stat_activity AS activity
      WHERE activity.datname = current_database()
        AND activity.wait_event_type = 'Lock'
        AND activity.query LIKE '%Organization%'
        AND activity.query LIKE '%FOR UPDATE%'
    `, [holderPid]);
    // The second waiter may queue behind the first rather than list the
    // holder directly in pg_blocking_pids(). Require both waiting requests
    // plus at least one direct edge to our held row.
    if (rows[0]?.waiting >= minimum && rows[0].held >= 1) return;
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  throw new Error(`Expected ${minimum} application transaction(s) blocked by the controlled Organization row lock`);
}

async function holdOrganizationRow(organizationId: string) {
  const blocker = new Client({ connectionString: process.env.DATABASE_URL });
  await blocker.connect();
  try {
    await blocker.query("BEGIN");
    const locked = await blocker.query('SELECT id FROM "Organization" WHERE id = $1 FOR UPDATE', [organizationId]);
    if (locked.rowCount !== 1) throw new Error("Synthetic organization lock was not acquired");
    const pid = (await blocker.query<{ pid: number }>("SELECT pg_backend_pid() AS pid")).rows[0].pid;
    let held = true;
    return {
      blocker,
      pid,
      async release() {
        if (held) {
          held = false;
          await blocker.query("COMMIT");
        }
      },
      async close() {
        if (held) await blocker.query("ROLLBACK");
        await blocker.end();
      },
    };
  } catch (error) {
    await blocker.query("ROLLBACK").catch(() => {});
    await blocker.end();
    throw error;
  }
}

type Entry = "direct" | "generic";

describe("MONEY-05 cancellation Undo and worker admission on PostgreSQL", () => {
  beforeEach(async () => {
    vi.stubEnv("RAZORPAY_MODE", "TEST");
    vi.stubEnv("RAZORPAY_BILLING_WRITES_ENABLED", "true");
    await resetDatabase();
  });
  afterEach(() => {
    setRazorpayClientForTests(null);
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });
  afterAll(disconnectDatabase);

  async function fixture(entry: Entry) {
    const owner = await createUser();
    const organization = await createOrg({ ownerId: owner.id, billingModelVersion: "WORKSPACE_V2" });
    await createBranch({ organizationId: organization.id });
    const subscription = await createSaasSubscription({ organizationId: organization.id });
    const cutoff = new Date(Date.now() + 60 * 60_000);
    const workerAt = new Date(cutoff.getTime() + 1_000);
    const change = await BillingMutationService.enqueue({
      organizationId: organization.id,
      subscriptionId: subscription.id,
      type: "CANCELLATION",
      idempotencyKey: randomUUID(),
      operationStatus: "SCHEDULED",
      undoCutoffAt: cutoff,
      effectiveAt: new Date(cutoff.getTime() + 24 * 60 * 60_000),
      createdByUserId: owner.id,
    });
    // Generic Undo must address this exact ID, even when a newer queued
    // cancellation exists. The newer cutoff keeps the worker focused on the
    // original intent after a successful Undo.
    const newer = entry === "generic" ? await BillingMutationService.enqueue({
      organizationId: organization.id,
      subscriptionId: subscription.id,
      type: "CANCELLATION",
      idempotencyKey: randomUUID(),
      operationStatus: "SCHEDULED",
      undoCutoffAt: new Date(cutoff.getTime() + 60 * 60_000),
      effectiveAt: new Date(cutoff.getTime() + 48 * 60 * 60_000),
      createdByUserId: owner.id,
    }) : null;
    const undo = () => entry === "direct"
      ? BillingService.undoWorkspaceCancellation(owner.id, organization.id, new Date(cutoff.getTime() - 1_000))
      : BillingService.undoWorkspaceChange(owner.id, organization.id, change.id);
    return { owner, organization, subscription, change, newer, cutoff, workerAt, undo };
  }

  function fakeProvider(subscriptionId: string, planId: string) {
    const entered = deferred<void>();
    const continueProvider = deferred<void>();
    const cancelSubscription = vi.fn(async (actualId: string, options: { cancel_at_cycle_end: boolean }) => {
      entered.resolve();
      await continueProvider.promise;
      return {
        id: actualId,
        entity: "subscription" as const,
        plan_id: planId,
        status: "active",
        total_count: 120,
        quantity: 1,
        has_scheduled_changes: options.cancel_at_cycle_end,
      };
    });
    setRazorpayClientForTests({ cancelSubscription } as unknown as RazorpayApiClient);
    return { entered: entered.promise, continueProvider: () => continueProvider.resolve(), cancelSubscription, subscriptionId };
  }

  it.each(["direct", "generic"] as const)("%s Undo wins the Organization lock before worker admission", async entry => {
    const f = await fixture(entry);
    const provider = fakeProvider(f.subscription.razorpaySubscriptionId, f.subscription.razorpayPlanId);
    const lock = await holdOrganizationRow(f.organization.id);
    let undoRun: ReturnType<typeof outcome<Awaited<ReturnType<typeof f.undo>>>> | undefined;
    let workerRun: ReturnType<typeof outcome<Awaited<ReturnType<typeof BillingMutationService.processNext>>>> | undefined;
    try {
      undoRun = outcome(f.undo());
      await waitForBlockedReaders(lock.blocker, lock.pid, 1);
      workerRun = outcome(BillingMutationService.processNext(f.organization.id, f.workerAt));
      await waitForBlockedReaders(lock.blocker, lock.pid, 2);
      await lock.release();
      expect((await undoRun).error).toBeNull();
      expect((await undoRun).value).toMatchObject({ undone: true });
      expect((await workerRun).error).toBeNull();
      expect((await workerRun).value).toBeNull();
      expect(await testPrisma.organizationBillingChange.findUniqueOrThrow({ where: { id: f.change.id } }))
        .toMatchObject({ status: "UNDONE", operationStatus: "ABANDONED", attemptCount: 0 });
      expect(await testPrisma.billingProviderAction.count({ where: { changeId: f.change.id } })).toBe(0);
      expect(await testPrisma.organizationSubscriptionHistory.count({ where: { organizationId: f.organization.id, event: "cancel_at_cycle_end" } })).toBe(0);
      expect(await testPrisma.organization.findUniqueOrThrow({ where: { id: f.organization.id } }))
        .toMatchObject({ billingMutationLeaseToken: null });
      if (f.newer) {
        expect(await testPrisma.organizationBillingChange.findUniqueOrThrow({ where: { id: f.newer.id } }))
          .toMatchObject({ status: "QUEUED", attemptCount: 0 });
      }
      expect(provider.cancelSubscription).not.toHaveBeenCalled();
    } finally {
      provider.continueProvider();
      await lock.close();
      await Promise.allSettled([undoRun, workerRun].filter(Boolean));
    }
  }, 30_000);

  it.each(["direct", "generic"] as const)("%s Undo loses after worker admission and cannot undo its provider action", async entry => {
    const f = await fixture(entry);
    const provider = fakeProvider(f.subscription.razorpaySubscriptionId, f.subscription.razorpayPlanId);
    const lock = await holdOrganizationRow(f.organization.id);
    let undoRun: ReturnType<typeof outcome<Awaited<ReturnType<typeof f.undo>>>> | undefined;
    let workerRun: ReturnType<typeof outcome<Awaited<ReturnType<typeof BillingMutationService.processNext>>>> | undefined;
    try {
      workerRun = outcome(BillingMutationService.processNext(f.organization.id, f.workerAt));
      await waitForBlockedReaders(lock.blocker, lock.pid, 1);
      undoRun = outcome(f.undo());
      await waitForBlockedReaders(lock.blocker, lock.pid, 2);
      await lock.release();
      await provider.entered;
      expect((await undoRun).error).toBeInstanceOf(BillingChangeInProgressError);
      expect(await testPrisma.organizationBillingChange.findUniqueOrThrow({ where: { id: f.change.id } }))
        .toMatchObject({ status: "PROCESSING", undoneAt: null, attemptCount: 1 });
      expect(await testPrisma.billingProviderAction.findUniqueOrThrow({
        where: { organizationId_actionKey: { organizationId: f.organization.id, actionKey: `${f.change.id}:MUTATE` } },
      })).toMatchObject({ status: "ADMITTED", changeId: f.change.id });
      provider.continueProvider();
      expect((await workerRun).error).toBeNull();
      expect((await workerRun).value).toMatchObject({ id: f.change.id, status: "SCHEDULED" });
      expect(await testPrisma.organizationBillingChange.findUniqueOrThrow({ where: { id: f.change.id } }))
        .toMatchObject({ status: "SCHEDULED", undoneAt: null, attemptCount: 1 });
      expect(await testPrisma.billingProviderAction.findUniqueOrThrow({
        where: { organizationId_actionKey: { organizationId: f.organization.id, actionKey: `${f.change.id}:MUTATE` } },
      })).toMatchObject({ status: "CONFIRMED", changeId: f.change.id });
      expect(await testPrisma.organizationSubscriptionHistory.count({ where: {
        organizationId: f.organization.id, event: "cancel_at_cycle_end",
      } })).toBe(1);
      expect(await testPrisma.organization.findUniqueOrThrow({ where: { id: f.organization.id } }))
        .toMatchObject({ billingMutationLeaseToken: null });
      if (f.newer) {
        expect(await testPrisma.organizationBillingChange.findUniqueOrThrow({ where: { id: f.newer.id } }))
          .toMatchObject({ status: "QUEUED", attemptCount: 0 });
      }
      expect(provider.cancelSubscription).toHaveBeenCalledExactlyOnceWith(f.subscription.razorpaySubscriptionId, { cancel_at_cycle_end: true });
    } finally {
      provider.continueProvider();
      await lock.close();
      await Promise.allSettled([undoRun, workerRun].filter(Boolean));
    }
  }, 30_000);
});
