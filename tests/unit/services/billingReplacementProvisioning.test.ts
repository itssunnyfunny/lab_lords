import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RazorpaySubscription } from "@/lib/razorpay";

const mocks = vi.hoisted(() => ({
  findChange: vi.fn(), updateChange: vi.fn(), findOwner: vi.fn(),
  fetchSubscription: vi.fn(), executeProviderAction: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: {
  organizationBillingChange: { findUnique: mocks.findChange },
  $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback({
    $queryRaw: vi.fn(),
    organization: { findFirst: mocks.findOwner },
    organizationBillingChange: { updateMany: mocks.updateChange },
  }),
} }));
vi.mock("@/services/billingProviderAction.service", async importOriginal => ({
  ...await importOriginal<typeof import("@/services/billingProviderAction.service")>(),
  getConfirmedBillingProviderResponse: async () => null,
  executeBillingProviderAction: mocks.executeProviderAction,
}));
vi.mock("@/lib/razorpay", async importOriginal => ({
  ...await importOriginal<typeof import("@/lib/razorpay")>(),
  getRazorpayClient: () => ({ fetchSubscription: mocks.fetchSubscription }),
}));

import {
  BillingReplacementService,
  isSameReplacementProvisioningIntent,
} from "@/services/billingReplacement.service";
import { buildCommercialIntentSnapshot } from "@/services/billingCommercialEvidence.service";

const now = new Date("2026-10-22T08:00:00.000Z");
const startAt = new Date("2026-11-22T08:00:00.000Z");
const expireAt = new Date("2026-11-19T08:00:00.000Z");
const intent = {
  organizationId: "org_test", changeId: "change_test", sourceProviderSubscriptionId: "sub_source",
  providerMode: "TEST", providerPlanId: "plan_standard", quantity: 2, totalCount: 120,
  startAt: startAt.getTime() / 1000, expireBy: expireAt.getTime() / 1000,
};

function candidate(overrides: Partial<RazorpaySubscription> = {}): RazorpaySubscription {
  return {
    id: "sub_candidate", entity: "subscription", status: "created", plan_id: intent.providerPlanId,
    quantity: intent.quantity, total_count: intent.totalCount, paid_count: 0,
    start_at: intent.startAt, expire_by: intent.expireBy, offer_id: null,
    notes: {
      organization_id: intent.organizationId, billing_change_id: intent.changeId,
      replacement_source_subscription_id: intent.sourceProviderSubscriptionId,
      provider_mode: intent.providerMode, billing_type: "saas_subscription_replacement",
    },
    ...overrides,
  };
}

describe("replacement provisioning evidence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("RAZORPAY_MODE", "TEST");
    vi.stubEnv("RAZORPAY_KEY_ID", "rzp_test_fixture");
    vi.stubEnv("VERCEL_ENV", "development");
    vi.stubEnv("RAZORPAY_BILLING_WRITES_ENABLED", "true");
    mocks.findOwner.mockResolvedValue({ id: intent.organizationId });
    mocks.updateChange.mockResolvedValue({ count: 1 });
    mocks.findChange.mockResolvedValue({
      id: intent.changeId, organizationId: intent.organizationId,
      status: "PROCESSING", type: "PLAN_UPGRADE", attemptCount: 2,
      processingStartedAt: now, provisioningIntentVersion: 2,
      authorizedProviderStartAt: startAt, authorizedProviderExpireAt: expireAt,
      authorizedTotalCount: intent.totalCount, toPlan: "PRO", toQuantity: intent.quantity,
      replacementSubscription: null,
      organizationSubscription: {
        id: "local_source", currentOrganizationId: intent.organizationId,
        razorpaySubscriptionId: intent.sourceProviderSubscriptionId,
        razorpayPlanId: "plan_basic", plan: "BASIC", quantity: 1,
        providerMode: "TEST", providerPaymentMethod: "UPI", period: "monthly", interval: 1,
      },
      ...buildCommercialIntentSnapshot({
        providerMode: "TEST", sourceRazorpaySubscriptionId: intent.sourceProviderSubscriptionId,
        razorpaySubscriptionId: "sub_candidate", sourceRazorpayPlanId: "plan_basic",
        razorpayPlanId: intent.providerPlanId, plan: "PRO", quantity: intent.quantity,
        unitAmountSubunits: 49900, currency: "INR", period: "monthly", interval: 1, capturedAt: now,
      }),
    });
  });

  afterEach(() => vi.unstubAllEnvs());

  it("accepts the complete frozen replacement tuple", () => {
    expect(isSameReplacementProvisioningIntent(candidate(), intent)).toBe(true);
  });

  it.each([null, undefined])("rejects an absent provider replacement response: %s", provider => {
    expect(isSameReplacementProvisioningIntent(provider, intent)).toBe(false);
  });

  it.each([
    { total_count: 119 }, { total_count: undefined }, { quantity: undefined },
    { quantity: 1 }, { offer_id: "offer_unapproved" }, { plan_id: "plan_other" },
    { start_at: intent.startAt + 1 }, { expire_by: intent.expireBy + 1 }, { id: "" },
  ])("rejects changed or incomplete provider terms (%j)", overrides => {
    expect(isSameReplacementProvisioningIntent(candidate(overrides as Partial<RazorpaySubscription>), intent)).toBe(false);
  });

  it.each([
    ["organization_id", "org_other"], ["provider_mode", "LIVE"],
    ["billing_change_id", "change_other"], ["replacement_source_subscription_id", "sub_other"],
  ])("rejects foreign replacement correlation %s", (field, value) => {
    const provider = candidate();
    expect(isSameReplacementProvisioningIntent({
      ...provider, notes: { ...provider.notes, [field]: value },
    }, intent)).toBe(false);
  });

  it.each([undefined, -1, 0.5, 1])("does not adopt or recreate a recovered candidate with paid_count=%s", async paidCount => {
    mocks.fetchSubscription.mockImplementation(async (id: string) => id === intent.sourceProviderSubscriptionId
      ? { id, current_end: intent.startAt, remaining_count: 120 }
      : candidate({ paid_count: paidCount }));

    await expect(BillingReplacementService.provisionClaimedChange(intent.changeId, "lease_test", now, false))
      .rejects.toThrow("Replacement authorization requires reconciliation");
    expect(mocks.executeProviderAction).not.toHaveBeenCalled();
    // Only the already-frozen request was retained: no provider identity or
    // local candidate was bound from incomplete/charged evidence.
    expect(mocks.updateChange).toHaveBeenCalledTimes(1);
    expect(mocks.updateChange.mock.calls[0][0].data).not.toHaveProperty("authorizedRazorpaySubscriptionId");
  });
});
