import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RazorpaySubscription } from "@/lib/razorpay";

const mocks = vi.hoisted(() => ({
  subscriptionRead: vi.fn(), subscriptionUpdate: vi.fn(), organizationUpdate: vi.fn(),
  releaseLease: vi.fn(), history: vi.fn(), fetchSubscription: vi.fn(), fetchInvoices: vi.fn(),
  executeAction: vi.fn(), confirmAction: vi.fn(),
}));

vi.mock("@/lib/prisma", () => {
  const tx = {
    $queryRaw: async () => [{ id: "org_test" }],
    organization: {
      findUniqueOrThrow: async () => ({ billingMutationLeaseToken: null, billingMutationLeaseUntil: null }),
      findFirst: async () => ({ id: "org_test" }),
      update: mocks.organizationUpdate,
      updateMany: mocks.releaseLease,
    },
    organizationSubscription: { findUnique: mocks.subscriptionRead, update: mocks.subscriptionUpdate },
    organizationSubscriptionHistory: { upsert: mocks.history },
  };
  return { prisma: { ...tx, $transaction: async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx) } };
});
vi.mock("@/lib/razorpay", async importOriginal => ({
  ...await importOriginal<typeof import("@/lib/razorpay")>(),
  getRazorpayClient: () => ({ fetchSubscription: mocks.fetchSubscription, fetchSubscriptionInvoices: mocks.fetchInvoices }),
}));
vi.mock("@/services/billingProviderAction.service", async importOriginal => ({
  ...await importOriginal<typeof import("@/services/billingProviderAction.service")>(),
  executeBillingProviderAction: mocks.executeAction,
  confirmReconciledBillingProviderAction: mocks.confirmAction,
}));

import { cancelLapsedInitialAuthorization } from "@/services/billing.service";

const now = new Date("2026-10-22T08:00:00.000Z");
const start = new Date("2026-10-15T08:00:00.000Z");

function provider(overrides: Partial<RazorpaySubscription> = {}): RazorpaySubscription {
  return {
    id: "sub_test", entity: "subscription", plan_id: "plan_basic", quantity: 1,
    total_count: 120, paid_count: 0, status: "authenticated",
    current_start: null, current_end: null, payment_method: "emandate",
    ...overrides,
  };
}

function local() {
  return {
    id: "local_test", organizationId: "org_test", currentOrganizationId: "org_test",
    providerMode: "TEST", razorpaySubscriptionId: "sub_test", razorpayPlanId: "plan_basic",
    quantity: 1, amountSubunits: 29900, currency: "INR", plan: "BASIC", status: "AUTHENTICATED",
    paidThrough: null, providerStartAt: start, providerPaymentMethod: "EMANDATE", authorizationExpiresAt: null,
  };
}

describe("lapsed initial authorization race protection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("RAZORPAY_MODE", "TEST");
    vi.stubEnv("RAZORPAY_KEY_ID", "rzp_test_fixture");
    vi.stubEnv("VERCEL_ENV", "development");
    vi.stubEnv("RAZORPAY_BILLING_WRITES_ENABLED", "true");
    mocks.subscriptionRead.mockResolvedValue(local());
    mocks.subscriptionUpdate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ ...local(), ...data }));
    mocks.fetchSubscription.mockResolvedValue(provider());
    mocks.fetchInvoices.mockResolvedValue({ entity: "collection", count: 0, items: [] });
    mocks.executeAction.mockResolvedValue(provider({ status: "cancelled", ended_at: now.getTime() / 1000 }));
  });
  afterEach(() => vi.unstubAllEnvs());

  it.each([
    { status: "active", paid_count: 1 }, { status: "active", paid_count: 0 },
    { status: "pending" }, { status: "halted" }, { status: "paused" },
    { paid_count: undefined }, { paid_count: -1 }, { paid_count: 0.5 }, { paid_count: 1 },
    { current_start: now.getTime() / 1000 }, { current_end: now.getTime() / 1000 + 86400 },
    { plan_id: "plan_other" }, { quantity: 2 },
  ])("does not cancel newly charged, billing, or ambiguous provider state (%j)", async overrides => {
    mocks.fetchSubscription.mockResolvedValue(provider(overrides));
    await expect(cancelLapsedInitialAuthorization("local_test", now)).resolves.toBeNull();
    expect(mocks.executeAction).not.toHaveBeenCalled();
    expect(mocks.subscriptionUpdate).not.toHaveBeenCalled();
    expect(mocks.releaseLease).toHaveBeenCalledTimes(1);
  });

  it.each(["issued", "paid"])("does not cancel when a fresh %s invoice appears", async status => {
    mocks.fetchInvoices.mockResolvedValue({ entity: "collection", count: 1, items: [{ id: "inv_test", status }] });
    await expect(cancelLapsedInitialAuthorization("local_test", now)).resolves.toBeNull();
    expect(mocks.executeAction).not.toHaveBeenCalled();
  });

  it("rechecks subscription state after the invoice read", async () => {
    mocks.fetchSubscription.mockResolvedValueOnce(provider())
      .mockResolvedValueOnce(provider({ status: "active", paid_count: 1 }));
    await expect(cancelLapsedInitialAuthorization("local_test", now)).resolves.toBeNull();
    expect(mocks.fetchSubscription).toHaveBeenCalledTimes(2);
    expect(mocks.executeAction).not.toHaveBeenCalled();
  });

  it("rechecks local paid evidence immediately before dispatch", async () => {
    mocks.subscriptionRead.mockResolvedValueOnce(local()).mockResolvedValueOnce(local())
      .mockResolvedValueOnce({ ...local(), paidThrough: new Date(now.getTime() + 86400000) });
    await expect(cancelLapsedInitialAuthorization("local_test", now)).resolves.toBeNull();
    expect(mocks.executeAction).not.toHaveBeenCalled();
  });

  it("fails closed on incomplete invoice pages and releases the lease", async () => {
    mocks.fetchInvoices.mockResolvedValue({ entity: "collection", count: 1, items: [] });
    await expect(cancelLapsedInitialAuthorization("local_test", now)).rejects.toThrow("invoice evidence is incomplete");
    expect(mocks.executeAction).not.toHaveBeenCalled();
    expect(mocks.releaseLease).toHaveBeenCalledTimes(1);
  });

  it("retains the seven-day eMandate waiting window", async () => {
    await expect(cancelLapsedInitialAuthorization("local_test", new Date(now.getTime() - 1))).resolves.toBeNull();
    expect(mocks.fetchSubscription).not.toHaveBeenCalled();
    expect(mocks.executeAction).not.toHaveBeenCalled();
  });

  it("still expires a confirmed uncharged authorization after the eMandate window", async () => {
    await expect(cancelLapsedInitialAuthorization("local_test", now)).resolves.toMatchObject({
      status: "CANCELLED", authorizationLapsedAt: now,
    });
    expect(mocks.executeAction).toHaveBeenCalledTimes(1);
    expect(mocks.executeAction).toHaveBeenCalledWith(expect.objectContaining({
      purpose: "EXPIRE_INITIAL", subscriptionId: "local_test",
      command: { method: "cancelSubscription", args: ["sub_test", { cancel_at_cycle_end: false }] },
    }));
    expect(mocks.confirmAction).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ purpose: "EXPIRE_INITIAL" }));
    expect(mocks.releaseLease).toHaveBeenCalledTimes(1);
  });

  it("honors explicit provider expiry inside the eMandate window", async () => {
    mocks.subscriptionRead.mockResolvedValue({ ...local(), authorizationExpiresAt: new Date(now.getTime() - 86400000) });
    await expect(cancelLapsedInitialAuthorization("local_test", new Date(now.getTime() - 86400000)))
      .resolves.toMatchObject({ status: "CANCELLED" });
    expect(mocks.executeAction).toHaveBeenCalledTimes(1);
  });

  it("adopts an already-terminal expiry response without cancelling again", async () => {
    mocks.fetchSubscription.mockResolvedValue(provider({ status: "expired" }));
    await expect(cancelLapsedInitialAuthorization("local_test", now)).resolves.toMatchObject({
      status: "EXPIRED", authorizationLapsedAt: now,
    });
    expect(mocks.executeAction).not.toHaveBeenCalled();
    expect(mocks.fetchInvoices).not.toHaveBeenCalled();
    expect(mocks.confirmAction).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      identity: "local_test", purpose: "EXPIRE_INITIAL", provider: expect.objectContaining({ status: "expired" }),
    }));
  });

  it("rejects wrong-mode rows before any provider read", async () => {
    mocks.subscriptionRead.mockResolvedValue({ ...local(), providerMode: "LIVE" });
    await expect(cancelLapsedInitialAuthorization("local_test", now)).rejects.toThrow("cannot be used in TEST mode");
    expect(mocks.fetchSubscription).not.toHaveBeenCalled();
    expect(mocks.executeAction).not.toHaveBeenCalled();
  });
});
