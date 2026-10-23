import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { createHash } from "node:crypto";
import { buildCommercialIntentSnapshot } from "@/services/billingCommercialEvidence.service";
import { BillingMutationService } from "@/services/billingMutation.service";
import { BillingReconciliationService } from "@/services/billingReconciliation.service";
import { BillingExperienceService } from "@/services/billingExperience.service";
import { BranchService } from "@/services/branch.service";
import { BillingReplacementService } from "@/services/billingReplacement.service";
import { BillingDeadlineService, recoverExpiredBillingMutationLease } from "@/services/billingDeadline.service";
import { BillingService } from "@/services/billing.service";
import {
  getReplacementUndoCutoffAt,
  getSafeReplacementCycleBoundary,
} from "@/services/billingReplacementPolicy";
import {
  RazorpayApiError,
  setRazorpayClientForTests,
  type RazorpayPlanCatalogApiClient,
} from "@/lib/razorpay";
import {
  BillingChangeInProgressError,
  BillingManualReviewRequiredError,
} from "@/lib/billingErrors";
import { createBranch, createOrg, createUser } from "@/tests/factories";
import { disconnectDatabase, resetDatabase, testPrisma } from "@/tests/setup/db";

function fakeRazorpay(options: {
  paidAt?: number;
  providerStatus?: "active" | "authenticated";
  providerQuantity?: number;
  includePaidInvoice?: boolean;
  providerMethod?: "card" | "upi" | "emandate";
  adoptReplacement?: boolean;
  futureStartAt?: number;
  omitCurrentPeriod?: boolean;
  undoQuantity?: number;
  providerPlanId?: string;
  providerOfferId?: string | null;
  paymentAmountSubunits?: number;
} = {}): RazorpayPlanCatalogApiClient {
  const periodStart = Math.floor(Date.now() / 1000) - 60;
  const periodEnd = periodStart + 30 * 24 * 60 * 60;
  const providerStatus = options.providerStatus ?? "active";
  const providerQuantity = options.providerQuantity ?? 2;
  const providerPlanId = options.providerPlanId ?? "plan_pro";
  const providerUnitAmountSubunits = providerPlanId.includes("basic") ? 9900 : providerPlanId.includes("standard") ? 29900 : 49900;
  const paymentAmountSubunits = options.paymentAmountSubunits
    ?? providerUnitAmountSubunits * providerQuantity;
  let candidateSequence = 0;
  const client: RazorpayPlanCatalogApiClient = {
    createOrder: vi.fn(async () => { throw new Error("unused"); }),
    fetchPayment: vi.fn(async paymentId => ({
      id: paymentId,
      entity: "payment" as const,
      amount: paymentAmountSubunits,
      currency: "INR",
      status: "captured",
      order_id: null,
      invoice_id: "inv_paid",
      subscription_id: "sub_workspace",
      method: "card",
      captured: true,
    })),
    fetchOrderPayments: vi.fn(async () => ({ entity: "collection" as const, count: 0, items: [] })),
    capturePayment: vi.fn(async () => { throw new Error("unused"); }),
    createPlan: vi.fn(async input => ({
      id: `plan_${input.notes.plan.toLowerCase()}`,
      entity: "plan" as const,
      interval: input.interval,
      period: input.period,
      item: { ...input.item },
      notes: input.notes,
    })),
    fetchPlan: vi.fn(async planId => ({
      id: planId,
      entity: "plan" as const,
      interval: 1,
      period: "monthly",
      item: {
        amount: planId.includes("basic") ? 9900 : planId.includes("standard") ? 29900 : 49900,
        currency: "INR",
        name: planId.includes("basic") ? "Lab Lords Basic" : "Lab Lords Standard",
      },
    })),
    listPlans: vi.fn(async () => ({ entity: "collection" as const, count: 0, items: [] })),
    createSubscription: vi.fn(async input => ({
      id: ++candidateSequence === 1 ? "sub_candidate" : `sub_candidate_${candidateSequence}`,
      entity: "subscription" as const,
      plan_id: input.plan_id,
      status: "created",
      total_count: input.total_count,
      paid_count: 0,
      quantity: input.quantity,
      start_at: input.start_at,
      expire_by: input.expire_by,
      notes: input.notes,
    })),
    fetchSubscription: vi.fn(async () => ({
      id: "sub_workspace",
      entity: "subscription" as const,
      plan_id: providerPlanId,
      status: providerStatus,
      total_count: 120,
      quantity: providerQuantity,
      paid_count: 1,
      offer_id: options.providerOfferId ?? null,
      start_at: options.futureStartAt,
      current_start: options.omitCurrentPeriod ? undefined : periodStart,
      current_end: options.omitCurrentPeriod ? undefined : periodEnd,
      charge_at: options.omitCurrentPeriod ? undefined : periodEnd,
      payment_method: options.providerMethod ?? "card",
    })),
    updateSubscription: vi.fn(async (_id, input) => ({
      id: "sub_workspace",
      entity: "subscription" as const,
      plan_id: input.plan_id ?? providerPlanId,
      status: providerStatus,
      total_count: 120,
      quantity: input.quantity ?? 1,
      current_start: periodStart,
      current_end: periodEnd,
      charge_at: periodEnd,
      payment_method: "card",
    })),
    cancelScheduledChanges: vi.fn(async () => ({
      id: "sub_workspace",
      entity: "subscription" as const,
      plan_id: "plan_pro",
      status: "active",
      total_count: 120,
      quantity: options.undoQuantity ?? 1,
      has_scheduled_changes: false,
    })),
    fetchSubscriptionInvoices: vi.fn(async () => ({
      entity: "collection" as const,
      count: options.includePaidInvoice === false ? 0 : 1,
      items: options.includePaidInvoice === false ? [] : [{
        id: "inv_paid",
        entity: "invoice" as const,
        subscription_id: "sub_workspace",
        payment_id: "pay_paid",
        status: "paid",
        amount: paymentAmountSubunits,
        amount_paid: paymentAmountSubunits,
        amount_due: 0,
        currency: "INR",
        billing_start: periodStart,
        billing_end: periodEnd,
        issued_at: periodStart,
        paid_at: options.paidAt ?? Math.floor(Date.now() / 1000),
      }],
    })),
    cancelSubscription: vi.fn(async (_id, input) => ({
      id: "sub_workspace",
      entity: "subscription" as const,
      plan_id: "plan_pro",
      status: input.cancel_at_cycle_end ? "active" : "cancelled",
      total_count: 120,
      quantity: 1,
      has_scheduled_changes: input.cancel_at_cycle_end,
    })),
  };
  client.listSubscriptions = vi.fn(async () => ({
    entity: "collection" as const,
    count: options.adoptReplacement ? 1 : 0,
    items: options.adoptReplacement ? [{
      id: "sub_candidate",
      entity: "subscription" as const,
      plan_id: "plan_pro",
      status: "created",
      total_count: 120,
      paid_count: 0,
      quantity: 2,
      start_at: periodEnd,
      expire_by: periodEnd - 72 * 60 * 60,
      created_at: periodStart,
      notes: {
        app: "lab_lords",
        billing_type: "saas_subscription_replacement",
        organization_id: "filled-by-test",
        provider_mode: "TEST",
        billing_change_id: "filled-by-test",
        replacement_source_subscription_id: "sub_workspace",
        plan: "PRO",
      },
    }] : [],
  }));
  return client;
}

describe("serialized workspace billing mutations", () => {
  beforeEach(async () => { await resetDatabase(); });
  afterEach(() => {
    setRazorpayClientForTests(null);
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });
  afterAll(async () => { await disconnectDatabase(); });

  async function setup(options: { paymentMethod?: "CARD" | "UPI" | "EMANDATE"; plan?: "BASIC" | "STANDARD" | "PRO" } = {}) {
    const plan = options.plan ?? "PRO";
    const amount = plan === "BASIC" ? 99 : plan === "STANDARD" ? 299 : 499;
    const providerPlanId = `plan_${plan.toLowerCase()}`;
    const owner = await createUser();
    const organization = await createOrg({ ownerId: owner.id, billingModelVersion: "WORKSPACE_V2" });
    const first = await createBranch({ organizationId: organization.id });
    await testPrisma.saasRazorpayPlan.create({
      data: {
        providerMode: "TEST",
        catalogKey: `razorpay-plan:v2:TEST:${plan}:INR:${amount * 100}:monthly:1`,
        plan, amount, amountSubunits: amount * 100, razorpayPlanId: providerPlanId, active: true,
      },
    });
    const subscription = await testPrisma.organizationSubscription.create({
      data: {
        organizationId: organization.id,
        providerMode: "TEST",
        plan,
        amount,
        amountSubunits: amount * 100,
        totalCount: 120,
        quantity: 1,
        razorpayPlanId: providerPlanId,
        currentOrganizationId: organization.id,
        razorpaySubscriptionId: "sub_workspace",
        status: "ACTIVE",
        providerPaymentMethod: options.paymentMethod ?? "CARD",
      },
    });
    const commercialIntent = await testPrisma.organizationBillingChange.create({
      data: {
        organizationId: organization.id,
        organizationSubscriptionId: subscription.id,
        sequence: 1,
        idempotencyKey: `baseline-commercial-intent:${organization.id}`,
        type: "SUBSCRIPTION_AUTHORIZATION",
        status: "APPLIED",
        operationStatus: "APPLIED",
        fromPlan: plan,
        toPlan: plan,
        fromQuantity: 1,
        toQuantity: 1,
        commercialIntentVersion: 1,
        commercialIntentCapturedAt: new Date(Date.now() - 60_000),
        authorizedProviderMode: "TEST",
        authorizedSourceRazorpaySubscriptionId: "sub_workspace",
        authorizedRazorpaySubscriptionId: "sub_workspace",
        authorizedSourceRazorpayPlanId: providerPlanId,
        authorizedRazorpayPlanId: providerPlanId,
        authorizedPlan: plan,
        authorizedQuantity: 1,
        authorizedRazorpayOfferId: null,
        authorizedUnitAmountSubunits: amount * 100,
        authorizedGrossAmountSubunits: amount * 100,
        authorizedExpectedAmountSubunits: amount * 100,
        authorizedOfferValidThroughPaidCount: null,
        authorizedCurrency: "INR",
        authorizedPeriod: "monthly",
        authorizedInterval: 1,
        providerConfirmedAt: new Date(Date.now() - 60_000),
        appliedAt: new Date(Date.now() - 60_000),
        resolvedAt: new Date(Date.now() - 60_000),
      },
    });
    await Promise.all([
      testPrisma.organization.update({
        where: { id: organization.id },
        data: { billingMutationSequence: 1 },
      }),
      testPrisma.organizationSubscription.update({
        where: { id: subscription.id },
        data: { confirmedCommercialIntentChangeId: commercialIntent.id },
      }),
    ]);
    return { owner, organization, first, subscription, commercialIntent };
  }

  it.each([
    ["BASIC", "STANDARD", "PLAN_UPGRADE"], ["BASIC", "PRO", "PLAN_UPGRADE"],
    ["STANDARD", "PRO", "PLAN_UPGRADE"], ["STANDARD", "BASIC", "PLAN_DOWNGRADE"],
    ["PRO", "STANDARD", "PLAN_DOWNGRADE"], ["PRO", "BASIC", "PLAN_DOWNGRADE"],
  ] as const)("prepares %s to %s once with exact quantity and preserves the source", async (sourcePlan, targetPlan, type) => {
    const { owner, organization, subscription, first } = await setup({ plan: sourcePlan });
    const razorpay = fakeRazorpay({ providerQuantity: 1, providerPlanId: subscription.razorpayPlanId });
    setRazorpayClientForTests(razorpay);
    const key = `three-plan-${sourcePlan}-${targetPlan}`;
    const firstResult = await BillingService.changeWorkspacePlan(owner.id, organization.id, targetPlan, key);
    const candidate = await testPrisma.organizationSubscription.findUniqueOrThrow({ where: { pendingReplacementOrganizationId: organization.id } });
    const change = await testPrisma.organizationBillingChange.findFirstOrThrow({ where: { organizationId: organization.id, idempotencyKey: key } });
    expect(firstResult).toMatchObject({ purpose: "REPLACEMENT", changeId: change.id });
    expect(change).toMatchObject({ type, status: "AWAITING_PAYMENT", fromPlan: sourcePlan, toPlan: targetPlan, toQuantity: 1, accessGrantedAt: null });
    expect(change.effectiveAt!.getTime()).toBeGreaterThan(Date.now());
    expect(candidate).toMatchObject({ plan: targetPlan, quantity: 1, paidThrough: null,
      amountSubunits: targetPlan === "BASIC" ? 9900 : targetPlan === "STANDARD" ? 29900 : 49900 });
    await BillingService.changeWorkspacePlan(owner.id, organization.id, targetPlan, key);
    expect(razorpay.createSubscription).toHaveBeenCalledTimes(1);
    expect(razorpay.updateSubscription).not.toHaveBeenCalled();
    expect(razorpay.cancelSubscription).not.toHaveBeenCalled();
    await expect(testPrisma.organizationSubscription.findUniqueOrThrow({ where: { id: subscription.id } })).resolves.toMatchObject({ plan: sourcePlan, currentOrganizationId: organization.id });
    await expect(testPrisma.branch.findUniqueOrThrow({ where: { id: first.id } })).resolves.toMatchObject({ organizationId: organization.id });
  });

  it.each([
    ["PLAN_UPGRADE", "PRO", 1],
    ["PLAN_DOWNGRADE", "BASIC", 1],
    ["QUANTITY_INCREASE", "PRO", 2],
    ["BRANCH_REMOVAL", "PRO", 1],
    ["BRANCH_REACTIVATION", "PRO", 2],
    ["TRIAL_SUBSCRIPTION_UPDATE", "BASIC", 1],
  ] as const)("routes CARD %s through a separate authorization with multi-method Checkout disabled", async (type, plan, quantity) => {
    vi.stubEnv("RAZORPAY_MULTI_METHOD_SUBSCRIPTIONS_ENABLED", "false");
    const { owner, organization, subscription } = await setup();
    const razorpay = fakeRazorpay({ providerQuantity: 1 });
    setRazorpayClientForTests(razorpay);
    const queued = await BillingMutationService.enqueue({
      organizationId: organization.id, subscriptionId: subscription.id, type,
      idempotencyKey: `card-replacement-${type}`, fromPlan: "PRO", toPlan: plan,
      fromQuantity: 1, toQuantity: quantity, createdByUserId: owner.id,
    });
    await expect(BillingMutationService.processNext(organization.id))
      .resolves.toMatchObject({ id: queued.id, status: "AWAITING_PAYMENT" });
    const change = await testPrisma.organizationBillingChange.findUniqueOrThrow({
      where: { id: queued.id }, include: { replacementSubscription: true },
    });
    expect(change).toMatchObject({ provisioningIntentVersion: 2, authorizedQuantity: quantity,
      authorizedPlan: plan, authorizedRazorpaySubscriptionId: "sub_candidate" });
    expect(change.replacementSubscription).toMatchObject({ status: "CREATED", quantity, plan,
      currentOrganizationId: null, paidThrough: null });
    await expect(testPrisma.organizationSubscription.findUniqueOrThrow({ where: { id: subscription.id } }))
      .resolves.toMatchObject({ providerPaymentMethod: "CARD", quantity: 1, plan: "PRO",
        currentOrganizationId: organization.id });
    expect(razorpay.createSubscription).toHaveBeenCalledTimes(1);
    expect(razorpay.updateSubscription).not.toHaveBeenCalled();
    expect(razorpay.cancelSubscription).not.toHaveBeenCalled();
  });

  it.each(["UPI", "EMANDATE"] as const)("holds %s replacement before any provider call while multi-method Checkout is disabled", async paymentMethod => {
    vi.stubEnv("RAZORPAY_MULTI_METHOD_SUBSCRIPTIONS_ENABLED", "false");
    const { organization, subscription } = await setup({ paymentMethod });
    const razorpay = fakeRazorpay();
    setRazorpayClientForTests(razorpay);
    await BillingMutationService.enqueue({ organizationId: organization.id, subscriptionId: subscription.id,
      type: "QUANTITY_INCREASE", fromQuantity: 1, toQuantity: 2, idempotencyKey: `disabled-${paymentMethod}` });
    await expect(BillingMutationService.processNext(organization.id)).rejects.toThrow(/requires the multi-method replacement rollout/);
    expect(razorpay.fetchSubscription).not.toHaveBeenCalled();
    expect(razorpay.createSubscription).not.toHaveBeenCalled();
    expect(razorpay.updateSubscription).not.toHaveBeenCalled();
  });

  it("does not convert a bound historical CARD update into a new replacement", async () => {
    const { organization, subscription } = await setup();
    const razorpay = fakeRazorpay();
    setRazorpayClientForTests(razorpay);
    const change = await BillingMutationService.enqueue({ organizationId: organization.id, subscriptionId: subscription.id,
      type: "QUANTITY_INCREASE", fromQuantity: 1, toQuantity: 2, idempotencyKey: "historical-card-intent" });
    await stageHistoricalNativeChange(change.id, "FAILED", "REJECTED");
    await testPrisma.organizationBillingChange.update({ where: { id: change.id }, data: { status: "QUEUED" } });
    await expect(BillingMutationService.processNext(organization.id)).rejects.toThrow(/earlier in-place billing change/);
    expect(razorpay.fetchSubscription).not.toHaveBeenCalled();
    expect(razorpay.createSubscription).not.toHaveBeenCalled();
    expect(razorpay.updateSubscription).not.toHaveBeenCalled();
  });

  it("holds an uncharged CARD replacement before creating a second mandate when the first charge is too close", async () => {
    const { organization, subscription } = await setup();
    const startAt = Math.floor(Date.now() / 1000) + 3 * 86400;
    const razorpay = fakeRazorpay({ providerStatus: "authenticated", providerQuantity: 1,
      futureStartAt: startAt, omitCurrentPeriod: true, includePaidInvoice: false });
    setRazorpayClientForTests(razorpay);
    await testPrisma.organizationSubscription.update({ where: { id: subscription.id }, data: {
      status: "AUTHENTICATED", providerStartAt: new Date(startAt * 1000),
    } });
    await BillingMutationService.enqueue({ organizationId: organization.id, subscriptionId: subscription.id,
      type: "TRIAL_SUBSCRIPTION_UPDATE", fromQuantity: 1, toQuantity: 2, idempotencyKey: "card-close-first-charge" });
    await expect(BillingMutationService.processNext(organization.id)).rejects.toThrow(/first charge is too close/);
    expect(razorpay.createSubscription).not.toHaveBeenCalled();
    expect(razorpay.updateSubscription).not.toHaveBeenCalled();
    expect(razorpay.cancelSubscription).not.toHaveBeenCalled();
  });

  // Seed an operation admitted by the earlier native-update implementation.
  // Recovery tests must not dispatch a new unsupported card update to recreate it.
  async function stageHistoricalNativeChange(changeId: string,
    status: "SCHEDULED" | "AWAITING_PAYMENT" | "FAILED" = "AWAITING_PAYMENT",
    receiptStatus: "CONFIRMED" | "UNKNOWN" | "REJECTED" = "CONFIRMED") {
    const change = await testPrisma.organizationBillingChange.findUniqueOrThrow({
      where: { id: changeId }, include: { organizationSubscription: true },
    });
    const source = change.organizationSubscription!;
    const plan = change.toPlan ?? source.plan;
    const quantity = change.toQuantity ?? source.quantity;
    const targetPlan = plan === "BASIC" ? "plan_basic" : "plan_pro";
    await testPrisma.saasRazorpayPlan.upsert({ where: { razorpayPlanId: targetPlan }, update: {}, create: {
      providerMode: source.providerMode, catalogKey: `razorpay-plan:v2:${source.providerMode}:${plan}:INR:${plan === "BASIC" ? 9900 : 49900}:monthly:1`,
      plan, amount: plan === "BASIC" ? 99 : 499, amountSubunits: plan === "BASIC" ? 9900 : 49900,
      razorpayPlanId: targetPlan, active: true,
    } });
    const capturedAt = new Date(Date.now() - 1000);
    const data = buildCommercialIntentSnapshot({ providerMode: source.providerMode,
      sourceRazorpaySubscriptionId: source.razorpaySubscriptionId,
      razorpaySubscriptionId: source.razorpaySubscriptionId,
      sourceRazorpayPlanId: source.razorpayPlanId, razorpayPlanId: targetPlan,
      plan, quantity, unitAmountSubunits: plan === "BASIC" ? 9900 : 49900,
      currency: "INR", period: "monthly", interval: 1, capturedAt });
    const request = { args: [source.razorpaySubscriptionId, {
      customer_notify: true, ...(change.toPlan ? { plan_id: targetPlan } : {}),
      quantity, schedule_change_at: status === "SCHEDULED" ? "cycle_end" : "now",
    }], method: "updateSubscription" };
    await testPrisma.billingProviderAction.create({ data: {
      organizationId: change.organizationId, changeId, actionKey: `${changeId}:MUTATE`,
      providerMode: source.providerMode, purpose: "MUTATE", request,
      requestHash: createHash("sha256").update(JSON.stringify(request)).digest("hex"),
      status: receiptStatus, dispatchToken: `historical-${changeId}`, admittedAt: capturedAt,
      ...(receiptStatus === "CONFIRMED" ? { respondedAt: capturedAt, response: {
        id: source.razorpaySubscriptionId, entity: "subscription", status: "active",
        plan_id: status === "SCHEDULED" ? source.razorpayPlanId : targetPlan,
        quantity: status === "SCHEDULED" ? source.quantity : quantity,
        has_scheduled_changes: status === "SCHEDULED", total_count: 120,
      } } : {}),
    } });
    return testPrisma.organizationBillingChange.update({ where: { id: changeId }, data: {
      ...data, status, operationStatus: status === "AWAITING_PAYMENT" ? "AWAITING_PROVIDER_CONFIRMATION" : status,
      attemptCount: 1, providerConfirmedAt: receiptStatus === "CONFIRMED" ? capturedAt : null,
      providerMutationAdmittedAt: receiptStatus === "UNKNOWN" ? capturedAt : null,
      ...(status === "FAILED" ? { failedAt: capturedAt,
        failureCategory: receiptStatus === "REJECTED" ? "PROVIDER_REJECTED" : "MANUAL_REVIEW_REQUIRED",
        failureCode: receiptStatus === "REJECTED" ? "PROVIDER_MUTATION_REJECTED" : "PROVIDER_MUTATION_OUTCOME_UNKNOWN" } : {}),
    } });
  }

  async function setupPendingUpiReplacement(idempotencyKey: string) {
    vi.stubEnv("RAZORPAY_MULTI_METHOD_SUBSCRIPTIONS_ENABLED", "true");
    vi.stubEnv("RAZORPAY_BILLING_WRITES_ENABLED", "true");
    const razorpay = fakeRazorpay({ providerMethod: "upi" });
    setRazorpayClientForTests(razorpay);
    const context = await setup({ paymentMethod: "UPI" });
    const branch = await testPrisma.branch.create({
      data: {
        organizationId: context.organization.id,
        name: `Replacement ${idempotencyKey}`,
        billingStatus: "PENDING_ACTIVATION",
      },
    });
    const queued = await BillingMutationService.enqueue({
      organizationId: context.organization.id,
      subscriptionId: context.subscription.id,
      branchId: branch.id,
      type: "QUANTITY_INCREASE",
      idempotencyKey,
      fromQuantity: 1,
      toQuantity: 2,
      createdByUserId: context.owner.id,
    });
    await BillingMutationService.processNext(context.organization.id);
    const change = await testPrisma.organizationBillingChange.findUniqueOrThrow({
      where: { id: queued.id },
      include: { replacementSubscription: true },
    });
    if (!change.replacementSubscription) throw new Error("Replacement candidate was not provisioned");
    return { ...context, branch, change, candidate: change.replacementSubscription, razorpay };
  }

  async function queuedReplacement(key: string) {
    vi.stubEnv("RAZORPAY_MULTI_METHOD_SUBSCRIPTIONS_ENABLED", "true");
    const razorpay = fakeRazorpay({ providerMethod: "upi" });
    setRazorpayClientForTests(razorpay);
    const context = await setup({ paymentMethod: "UPI" });
    const change = await BillingMutationService.enqueue({
      organizationId: context.organization.id, subscriptionId: context.subscription.id,
      type: "QUANTITY_INCREASE", idempotencyKey: key, fromQuantity: 1, toQuantity: 2,
      createdByUserId: context.owner.id,
    });
    return { ...context, razorpay, change };
  }

  it("never recreates a response-lost replacement during delayed discovery or a later cycle", async () => {
    const { razorpay, organization, subscription, change } = await queuedReplacement("replacement-response-loss");
    const create = vi.mocked(razorpay.createSubscription).getMockImplementation()!;
    let accepted: Awaited<ReturnType<typeof create>> | undefined;
    vi.mocked(razorpay.createSubscription).mockImplementation(async input => {
      accepted = await create(input);
      throw new Error("response lost after provider acceptance");
    });
    await expect(BillingMutationService.processNext(organization.id)).rejects.toThrow(/response lost/);
    const failed = await testPrisma.organizationBillingChange.findUniqueOrThrow({ where: { id: change.id } });
    expect(failed).toMatchObject({ status: "FAILED", failureCategory: "MANUAL_REVIEW_REQUIRED", resolvedAt: null });
    expect(failed.providerMutationAdmittedAt).not.toBeNull();
    await expect(BillingMutationService.retry(change.id)).rejects.toThrow(/no new create/);
    await expect(BillingMutationService.enqueue({ organizationId: organization.id, subscriptionId: subscription.id,
      type: "QUANTITY_INCREASE", idempotencyKey: "different-key", fromQuantity: 1, toQuantity: 3 }))
      .rejects.toBeInstanceOf(BillingChangeInProgressError);
    vi.mocked(razorpay.listSubscriptions!).mockResolvedValue({ entity: "collection", count: 1, items: [accepted!] });
    const fetch = vi.mocked(razorpay.fetchSubscription).getMockImplementation()!;
    vi.mocked(razorpay.fetchSubscription).mockImplementation(async id => ({
      ...await fetch(id), current_end: Math.floor(Date.now() / 1000) + 90 * 86400,
    }));
    const recovered = await BillingMutationService.retry(change.id);
    expect(recovered?.status).toBe("AWAITING_PAYMENT");
    expect(recovered?.authorizedProviderStartAt).toEqual(failed.authorizedProviderStartAt);
    expect(recovered?.authorizedProviderExpireAt).toEqual(failed.authorizedProviderExpireAt);
    expect(razorpay.createSubscription).toHaveBeenCalledTimes(1);
    expect(razorpay.cancelSubscription).not.toHaveBeenCalled();
  });

  it("retains the confirmed replacement ID across local-finalization failure", async () => {
    const { razorpay, owner, organization, change } = await queuedReplacement("replacement-local-failure");
    const finalization = vi.spyOn(BillingReplacementService, "assertNoOpenReplacement")
      .mockRejectedValueOnce(new Error("local finalization unavailable"));
    await expect(BillingMutationService.processNext(organization.id)).rejects.toThrow(/local finalization/);
    finalization.mockRestore();
    const failed = await testPrisma.organizationBillingChange.findUniqueOrThrow({ where: { id: change.id } });
    expect(failed.authorizedRazorpaySubscriptionId).toBe("sub_candidate");
    expect(failed.failureCategory).toBe("MANUAL_REVIEW_REQUIRED");
    const accepted = await vi.mocked(razorpay.createSubscription).mock.results[0].value;
    const fetch = vi.mocked(razorpay.fetchSubscription).getMockImplementation()!;
    vi.mocked(razorpay.fetchSubscription).mockImplementation(id => id === "sub_candidate" ? Promise.resolve(accepted) : fetch(id));
    const recovered = await BillingService.retryBillingOperation(owner.id, organization.id, change.id);
    expect(recovered.operation?.queueStatus).toBe("AWAITING_PAYMENT");
    expect(await testPrisma.organizationBillingChangeAudit.findFirst({ where: {
      changeId: change.id, outcome: "PROVIDER_STATE_ADOPTED", providerSubscriptionId: "sub_candidate",
    } })).not.toBeNull();
    expect(razorpay.createSubscription).toHaveBeenCalledTimes(1);
    expect(razorpay.cancelSubscription).not.toHaveBeenCalled();
  });

  it("retries a known pre-dispatch replacement read failure", async () => {
    const { razorpay, organization, change } = await queuedReplacement("replacement-read-failure");
    const fetch = vi.mocked(razorpay.fetchSubscription).getMockImplementation()!;
    vi.mocked(razorpay.fetchSubscription).mockImplementation(async id => ({
      ...await fetch(id), quantity: 1, has_scheduled_changes: false,
    }));
    vi.mocked(razorpay.fetchSubscription).mockRejectedValueOnce(new Error("source read unavailable"));
    await expect(BillingMutationService.processNext(organization.id)).rejects.toThrow(/source read/);
    expect(await testPrisma.organizationBillingChange.findUniqueOrThrow({ where: { id: change.id } }))
      .toMatchObject({ failureCategory: "PRE_PROVIDER_FAILURE", providerMutationAdmittedAt: null });
    const retried = await BillingMutationService.retry(change.id);
    expect(retried?.status).toBe("AWAITING_PAYMENT");
    expect(razorpay.createSubscription).toHaveBeenCalledTimes(1);
  });

  it("quarantines multiple replacement matches without cancelling any provider object", async () => {
    const { razorpay, organization, change } = await queuedReplacement("replacement-duplicates");
    const create = vi.mocked(razorpay.createSubscription).getMockImplementation()!;
    let accepted: Awaited<ReturnType<typeof create>> | undefined;
    vi.mocked(razorpay.createSubscription).mockImplementation(async input => {
      accepted = await create(input);
      throw new Error("response lost");
    });
    await expect(BillingMutationService.processNext(organization.id)).rejects.toThrow(/response lost/);
    vi.mocked(razorpay.listSubscriptions!).mockResolvedValue({ entity: "collection", count: 2,
      items: [accepted!, { ...accepted!, id: "sub_duplicate" }] });
    await expect(BillingMutationService.retry(change.id)).rejects.toThrow(/manual review/);
    expect(razorpay.createSubscription).toHaveBeenCalledTimes(1);
    expect(razorpay.cancelSubscription).not.toHaveBeenCalled();
  });

  it("fences an expired replacement worker after dispatch and recovers only by provider reads", async () => {
    const { razorpay, organization, change } = await queuedReplacement("replacement-expired-worker");
    const create = vi.mocked(razorpay.createSubscription).getMockImplementation()!;
    let accepted: Awaited<ReturnType<typeof create>> | undefined;
    vi.mocked(razorpay.createSubscription).mockImplementation(async input => {
      accepted = await create(input);
      const leased = await testPrisma.organization.findUniqueOrThrow({ where: { id: organization.id } });
      await recoverExpiredBillingMutationLease(leased, new Date(leased.billingMutationLeaseUntil!.getTime() + 1));
      return accepted;
    });
    await expect(BillingMutationService.processNext(organization.id)).rejects.toThrow(/lease was lost/);
    expect(await testPrisma.organizationBillingChange.findUnique({ where: { id: change.id } }))
      .toMatchObject({ status: "FAILED", failureCategory: "MANUAL_REVIEW_REQUIRED", replacementSubscriptionId: null });
    vi.mocked(razorpay.listSubscriptions!).mockResolvedValue({ entity: "collection", count: 1, items: [accepted!] });
    expect((await BillingMutationService.retry(change.id))?.status).toBe("AWAITING_PAYMENT");
    expect(razorpay.createSubscription).toHaveBeenCalledTimes(1);
  });

  it.each(["response-loss", "local-finalization", "lease-expiry"] as const)(
    "never repeats source cancellation after %s", async fault => {
      const { razorpay, owner, organization, change, candidate, subscription } = await setupPendingUpiReplacement(`source-${fault}`);
      const now = new Date(change.undoCutoffAt!.getTime() + 1);
      await testPrisma.organizationBillingChange.update({ where: { id: change.id }, data: {
        status: "SCHEDULED", operationStatus: "SCHEDULED", providerConfirmedAt: new Date(),
      } });
      await testPrisma.organizationSubscription.update({ where: { id: candidate.id }, data: {
        status: "AUTHENTICATED", providerPaymentMethod: "UPI",
      } });
      await testPrisma.organizationSubscription.update({ where: { id: subscription.id }, data: {
        currentEnd: change.effectiveAt,
      } });
      // Source commercial reconciliation has separate integration coverage;
      // this fixture isolates the real durable cancellation transaction.
      vi.spyOn(BillingReconciliationService, "reconcileProviderSubscription").mockImplementation(async id => ({
        subscription: await testPrisma.organizationSubscription.findUniqueOrThrow({ where: { razorpaySubscriptionId: id } }),
        evidenceKind: "AUTHORIZATION_ONLY",
      }) as never);
      vi.mocked(razorpay.cancelSubscription).mockImplementation(async id => {
        await testPrisma.organizationBillingChange.update({ where: { id: change.id }, data: {
          operationStatus: "VERIFYING",
        } });
        await BillingReplacementService.syncAuthorizedAccess(change.id, now, { resolveManualReview: true });
        expect(await testPrisma.organizationBillingChange.findUniqueOrThrow({ where: { id: change.id } }))
          .toMatchObject({ status: "PROCESSING", failureCode: "SOURCE_CANCELLATION_PROCESSING" });
        if (fault === "response-loss") throw new Error("accepted cancellation response lost");
        if (fault === "local-finalization") {
          vi.spyOn(prisma, "$transaction").mockRejectedValueOnce(new Error("local finalization unavailable"));
        } else {
          const leased = await testPrisma.organization.findUniqueOrThrow({ where: { id: organization.id } });
          await recoverExpiredBillingMutationLease(leased, new Date(leased.billingMutationLeaseUntil!.getTime() + 1));
        }
        return { id, entity: "subscription", plan_id: subscription.razorpayPlanId,
          status: "active", quantity: subscription.quantity, total_count: 120,
          has_scheduled_changes: true, change_scheduled_at: Math.floor(change.effectiveAt!.getTime() / 1000) };
      });
      await expect(BillingReplacementService.scheduleSourceCancellation(change.id, now)).rejects.toThrow();
      const failed = await testPrisma.organizationBillingChange.findUniqueOrThrow({ where: { id: change.id } });
      expect(failed).toMatchObject({ status: "FAILED", failureCategory: "MANUAL_REVIEW_REQUIRED", resolvedAt: null });
      expect(failed.failureCode).toMatch(/^SOURCE_CANCELLATION_/);
      await BillingReplacementService.scheduleSourceCancellation(change.id, now);
      await expect(BillingMutationService.retry(change.id)).rejects.toBeInstanceOf(BillingManualReviewRequiredError);
      await expect(BillingService.retryBillingOperation(owner.id, organization.id, change.id))
        .rejects.toBeInstanceOf(BillingManualReviewRequiredError);
      await BillingReplacementService.syncAuthorizedAccess(change.id, now, { resolveManualReview: true });
      // An unrelated projection/error must not erase the immutable dispatch fence.
      await testPrisma.organizationBillingChange.update({ where: { id: change.id }, data: {
        status: "SCHEDULED", operationStatus: "SCHEDULED", failureCode: null, failureCategory: null,
      } });
      expect(await BillingReplacementService.scheduleSourceCancellation(change.id, now))
        .toMatchObject({ scheduled: false, reason: "MANUAL_REVIEW_REQUIRED" });
      expect(razorpay.cancelSubscription).toHaveBeenCalledTimes(1);
      expect(razorpay.cancelScheduledChanges).not.toHaveBeenCalled();
    }
  );

  it("finalizes one confirmed source cancellation and preserves its scheduled result", async () => {
    const { razorpay, change, candidate, subscription } = await setupPendingUpiReplacement("source-success");
    const now = new Date(change.undoCutoffAt!.getTime() + 1);
    await testPrisma.organizationBillingChange.update({ where: { id: change.id }, data: {
      status: "SCHEDULED", operationStatus: "SCHEDULED",
    } });
    await testPrisma.organizationSubscription.update({ where: { id: candidate.id }, data: {
      status: "AUTHENTICATED", providerPaymentMethod: "UPI",
    } });
    await testPrisma.organizationSubscription.update({ where: { id: subscription.id }, data: {
      currentEnd: change.effectiveAt,
    } });
    vi.spyOn(BillingReconciliationService, "reconcileProviderSubscription").mockImplementation(async id => ({
        subscription: await testPrisma.organizationSubscription.findUniqueOrThrow({ where: { razorpaySubscriptionId: id } }),
        evidenceKind: "AUTHORIZATION_ONLY",
      }) as never);
    vi.mocked(razorpay.cancelSubscription).mockResolvedValue({
      id: subscription.razorpaySubscriptionId, entity: "subscription", plan_id: subscription.razorpayPlanId,
      status: "active", quantity: subscription.quantity, total_count: 120,
      has_scheduled_changes: true, change_scheduled_at: Math.floor(change.effectiveAt!.getTime() / 1000),
    });
    expect(await BillingReplacementService.scheduleSourceCancellation(change.id, now)).toMatchObject({ scheduled: true });
    expect(await BillingReplacementService.scheduleSourceCancellation(change.id, now))
      .toMatchObject({ scheduled: true, reason: "ALREADY_SCHEDULED" });
    expect(await testPrisma.organizationSubscription.findUniqueOrThrow({ where: { id: subscription.id } }))
      .toMatchObject({ cancelAtCycleEnd: true, cancellationScheduledAt: change.effectiveAt });
    expect(razorpay.cancelSubscription).toHaveBeenCalledTimes(1);
  });

  it("preserves the healthy source when a cached authorized candidate is no longer viable", async () => {
    const { razorpay, change, candidate, subscription } = await setupPendingUpiReplacement("fresh-negative-candidate");
    const now = new Date(change.undoCutoffAt!.getTime() + 1);
    await testPrisma.organizationBillingChange.update({ where: { id: change.id }, data: { status: "SCHEDULED", operationStatus: "SCHEDULED" } });
    await testPrisma.organizationSubscription.update({ where: { id: candidate.id }, data: { status: "AUTHENTICATED", providerPaymentMethod: "UPI" } });
    await testPrisma.organizationSubscription.update({ where: { id: subscription.id }, data: { currentEnd: change.effectiveAt } });
    vi.spyOn(BillingReconciliationService, "reconcileProviderSubscription").mockImplementation(async id => ({
      subscription: id === candidate.razorpaySubscriptionId
        ? await testPrisma.organizationSubscription.update({ where: { id: candidate.id }, data: { status: "HALTED" } })
        : await testPrisma.organizationSubscription.findUniqueOrThrow({ where: { id: subscription.id } }),
      evidenceKind: "AUTHORIZATION_ONLY",
    }) as never);
    await expect(BillingReplacementService.scheduleSourceCancellation(change.id, now)).rejects.toThrow();
    expect(razorpay.cancelSubscription).not.toHaveBeenCalled();
    expect(await testPrisma.organizationSubscription.findUniqueOrThrow({ where: { id: subscription.id } }))
      .toMatchObject({ status: "ACTIVE", cancelAtCycleEnd: false, currentOrganizationId: subscription.organizationId });
  });

  async function setupPreStartSourceRetirement(key: string) {
    const context = await setupPendingUpiReplacement(key);
    const { change, candidate, subscription, razorpay } = context;
    const effectiveAt = change.effectiveAt!;
    const now = new Date(change.undoCutoffAt!.getTime() + 1);
    await testPrisma.organizationBillingChange.update({ where: { id: change.id }, data: {
      status: "SCHEDULED", operationStatus: "SCHEDULED",
    } });
    await testPrisma.organizationSubscription.update({ where: { id: subscription.id }, data: {
      status: "AUTHENTICATED", providerStartAt: effectiveAt,
      currentStart: null, currentEnd: null, paidThrough: null,
    } });
    await testPrisma.organizationSubscription.update({ where: { id: candidate.id }, data: {
      status: "AUTHENTICATED", providerPaymentMethod: "UPI", confirmedCommercialIntentChangeId: change.id,
    } });
    // Commercial authorization itself is covered by signed callback tests. These
    // cases exercise the real lease, durable cancellation, and recovery writes.
    vi.spyOn(BillingReconciliationService, "reconcileProviderSubscription").mockImplementation(async id => ({
      subscription: await testPrisma.organizationSubscription.findUniqueOrThrow({ where: { razorpaySubscriptionId: id } }),
      evidenceKind: "AUTHORIZATION_ONLY",
    }) as never);
    const provider = { id: subscription.razorpaySubscriptionId, entity: "subscription" as const,
      plan_id: subscription.razorpayPlanId, quantity: subscription.quantity, total_count: subscription.totalCount,
      status: "authenticated", paid_count: 0, start_at: Math.floor(effectiveAt.getTime() / 1000),
      offer_id: null, current_start: null, current_end: null, has_scheduled_changes: false };
    vi.mocked(razorpay.fetchSubscription).mockResolvedValue(provider);
    vi.mocked(razorpay.fetchSubscriptionInvoices).mockResolvedValue({ entity: "collection", count: 0, items: [] });
    vi.mocked(razorpay.cancelSubscription).mockResolvedValue({ ...provider, status: "cancelled" });
    return { ...context, now, effectiveAt, provider };
  }

  it.each(["CARD", "UPI", "EMANDATE"] as const)(
    "retires an uncharged pre-start %s source without changing the trial or granting paid access", async method => {
      const { owner, organization, branch, subscription, candidate, change, razorpay, now, effectiveAt }
        = await setupPreStartSourceRetirement(`pre-start-${method}`);
      await testPrisma.organizationSubscription.updateMany({ where: { id: { in: [subscription.id, candidate.id] } },
        data: { providerPaymentMethod: method } });
      const trial = await testPrisma.ownerTrialGrant.create({ data: {
        ownerId: owner.id, organizationId: organization.id, source: "ONBOARDING", status: "ACTIVE",
        trialStartedAt: new Date(effectiveAt.getTime() - 30 * 24 * 60 * 60 * 1000),
        trialEndsAt: effectiveAt, consumedAt: new Date(),
      } });
      expect(await BillingReplacementService.syncAuthorizedAccess(change.id, now)).toMatchObject({ action: "GRANT" });
      expect(await BillingReplacementService.scheduleSourceCancellation(change.id, now)).toMatchObject({ scheduled: true });
      // The next authorization reconciliation must recognize completed immediate
      // retirement rather than revoke the already activated branch.
      expect(await BillingReplacementService.syncAuthorizedAccess(change.id, new Date(now.getTime() + 1)))
        .toMatchObject({ action: "NONE" });
      expect(await testPrisma.branch.findUniqueOrThrow({ where: { id: branch.id } }))
        .toMatchObject({ billingStatus: "ACTIVE" });
      expect(await testPrisma.organizationBillingChange.findUniqueOrThrow({ where: { id: change.id } }))
        .toMatchObject({ status: "SCHEDULED", accessRevokedAt: null, failureCategory: null });
      expect(razorpay.cancelSubscription).toHaveBeenCalledExactlyOnceWith(subscription.razorpaySubscriptionId,
        { cancel_at_cycle_end: false });
      expect(await testPrisma.organizationSubscription.findUniqueOrThrow({ where: { id: subscription.id } }))
        .toMatchObject({ status: "CANCELLED", cancelAtCycleEnd: false, cancellationScheduledAt: null,
          paidThrough: null, lastConfirmedPaymentId: null, currentOrganizationId: organization.id });
      expect(await testPrisma.organizationSubscription.findUniqueOrThrow({ where: { id: candidate.id } }))
        .toMatchObject({ providerStartAt: effectiveAt, paidThrough: null, currentOrganizationId: null,
          pendingReplacementOrganizationId: organization.id });
      expect(await testPrisma.ownerTrialGrant.findUniqueOrThrow({ where: { id: trial.id } }))
        .toMatchObject({ trialStartedAt: trial.trialStartedAt, trialEndsAt: trial.trialEndsAt });
      expect(await BillingReplacementService.promoteIfReady(change.id, now)).toMatchObject({ promoted: false });
      expect(await BillingReplacementService.scheduleSourceCancellation(change.id, now))
        .toMatchObject({ scheduled: true, reason: "SOURCE_ALREADY_ENDED" });
      expect(razorpay.cancelSubscription).toHaveBeenCalledTimes(1);
      expect(razorpay.createSubscription).toHaveBeenCalledTimes(1);
    }
  );

  it("does not treat terminal source state without cancellation confirmation as resolved", async () => {
    const { organization, subscription, branch, change, now } = await setupPreStartSourceRetirement("unconfirmed-terminal-source");
    expect(await BillingReplacementService.syncAuthorizedAccess(change.id, now)).toMatchObject({ action: "GRANT" });
    await testPrisma.organizationBillingChangeAudit.create({ data: {
      organizationId: organization.id, changeId: change.id, providerSubscriptionId: subscription.razorpaySubscriptionId,
      attemptCount: change.attemptCount, dedupeKey: "unconfirmed-source-admission",
      outcome: "PROVIDER_MUTATION_ADMITTED", failureCode: "SOURCE_CANCELLATION_PROCESSING",
    } });
    await testPrisma.organizationSubscription.update({ where: { id: subscription.id }, data: {
      status: "CANCELLED", endedAt: now, cancellationRequestedAt: now, cancelAtCycleEnd: false,
    } });
    expect(await BillingReplacementService.syncAuthorizedAccess(change.id, now)).toMatchObject({ action: "REVOKE" });
    expect(await testPrisma.branch.findUniqueOrThrow({ where: { id: branch.id } }))
      .toMatchObject({ billingStatus: "PENDING_ACTIVATION" });
  });

  it.each(["unknown-paid-count", "paid", "period", "wrong-id", "wrong-plan", "wrong-quantity", "wrong-start",
    "wrong-total", "wrong-offer", "incomplete-invoices", "issued-invoice", "changed-during-read", "local-invoice",
    "local-paid", "candidate-start"] as const)(
    "holds pre-start source retirement for %s evidence", async fault => {
      const { organization, subscription, change, razorpay, now, provider }
        = await setupPreStartSourceRetirement(`pre-start-hold-${fault}`);
      if (fault === "unknown-paid-count") vi.mocked(razorpay.fetchSubscription).mockResolvedValue({ ...provider, paid_count: undefined });
      if (fault === "paid") vi.mocked(razorpay.fetchSubscription).mockResolvedValue({ ...provider, paid_count: 1 });
      if (fault === "period") vi.mocked(razorpay.fetchSubscription).mockResolvedValue({ ...provider, current_start: provider.start_at });
      if (fault === "wrong-id") vi.mocked(razorpay.fetchSubscription).mockResolvedValue({ ...provider, id: "other-subscription" });
      if (fault === "wrong-plan") vi.mocked(razorpay.fetchSubscription).mockResolvedValue({ ...provider, plan_id: "other-plan" });
      if (fault === "wrong-quantity") vi.mocked(razorpay.fetchSubscription).mockResolvedValue({ ...provider, quantity: 2 });
      if (fault === "wrong-start") vi.mocked(razorpay.fetchSubscription).mockResolvedValue({ ...provider, start_at: provider.start_at + 1 });
      if (fault === "wrong-total") vi.mocked(razorpay.fetchSubscription).mockResolvedValue({ ...provider, total_count: 119 });
      if (fault === "wrong-offer") vi.mocked(razorpay.fetchSubscription).mockResolvedValue({ ...provider, offer_id: "other-offer" });
      if (fault === "incomplete-invoices") vi.mocked(razorpay.fetchSubscriptionInvoices).mockResolvedValue({ entity: "collection", count: 1, items: [] });
      if (fault === "issued-invoice") vi.mocked(razorpay.fetchSubscriptionInvoices).mockResolvedValue({ entity: "collection", count: 1,
        items: [{ id: "inv_issued", entity: "invoice", subscription_id: subscription.razorpaySubscriptionId,
          status: "issued", amount: 49900, amount_paid: 0, amount_due: 49900, currency: "INR" }] });
      if (fault === "changed-during-read") vi.mocked(razorpay.fetchSubscription)
        .mockResolvedValueOnce(provider).mockResolvedValue({ ...provider, status: "active", paid_count: 1 });
      if (fault === "local-invoice") await testPrisma.organizationSubscriptionInvoice.create({ data: {
        organizationId: organization.id, organizationSubscriptionId: subscription.id,
        razorpayInvoiceId: "inv_local_issued", status: "issued", amountSubunits: 49900,
      } });
      if (fault === "local-paid") await testPrisma.organizationSubscription.update({ where: { id: subscription.id },
        data: { paidThrough: new Date(provider.start_at * 1000) } });
      if (fault === "candidate-start") await testPrisma.organizationSubscription.update({ where: { id: change.replacementSubscriptionId! },
        data: { providerStartAt: new Date(provider.start_at * 1000 + 1000) } });
      await expect(BillingReplacementService.scheduleSourceCancellation(change.id, now))
        .rejects.toBeInstanceOf(BillingManualReviewRequiredError);
      expect(await testPrisma.organizationBillingChange.findUniqueOrThrow({ where: { id: change.id } }))
        .toMatchObject({ status: "FAILED", failureCategory: "MANUAL_REVIEW_REQUIRED" });
      expect(razorpay.cancelSubscription).not.toHaveBeenCalled();
      expect(razorpay.createSubscription).toHaveBeenCalledTimes(1);
    }
  );

  it("recovers a lost pre-start source cancellation response without replay or unpaid promotion", async () => {
    const { owner, organization, subscription, change, razorpay, now, provider }
      = await setupPreStartSourceRetirement("pre-start-response-loss");
    vi.mocked(razorpay.cancelSubscription).mockRejectedValueOnce(new Error("Accepted cancellation response lost"));
    await expect(BillingReplacementService.scheduleSourceCancellation(change.id, now)).rejects.toThrow("response lost");
    expect(await testPrisma.billingProviderAction.findFirstOrThrow({ where: { changeId: change.id, purpose: "CANCEL_SOURCE" } }))
      .toMatchObject({ status: "UNKNOWN" });
    vi.stubEnv("RAZORPAY_BILLING_WRITES_ENABLED", "false");
    vi.mocked(razorpay.fetchSubscription).mockResolvedValue({ ...provider, status: "cancelled", paid_count: 1 });
    await expect(BillingService.retryBillingOperation(owner.id, organization.id, change.id))
      .rejects.toBeInstanceOf(BillingManualReviewRequiredError);
    expect(await testPrisma.billingProviderAction.findFirstOrThrow({ where: { changeId: change.id, purpose: "CANCEL_SOURCE" } }))
      .toMatchObject({ status: "UNKNOWN" });
    vi.mocked(razorpay.fetchSubscription).mockResolvedValue({ ...provider, status: "cancelled" });
    await BillingService.retryBillingOperation(owner.id, organization.id, change.id);
    expect(await testPrisma.billingProviderAction.findFirstOrThrow({ where: { changeId: change.id, purpose: "CANCEL_SOURCE" } }))
      .toMatchObject({ status: "CONFIRMED" });
    expect(await testPrisma.organizationSubscription.findUniqueOrThrow({ where: { id: subscription.id } }))
      .toMatchObject({ status: "CANCELLED", cancelAtCycleEnd: false, paidThrough: null });
    expect(await BillingReplacementService.promoteIfReady(change.id, now)).toMatchObject({ promoted: false });
    expect(razorpay.cancelSubscription).toHaveBeenCalledTimes(1);
    expect(razorpay.createSubscription).toHaveBeenCalledTimes(1);
  });

  it.each(["terminal", "confirmed"])("recovers a %s source after response loss using reads only", async evidence => {
    const { razorpay, owner, organization, change, subscription } = await setupPendingUpiReplacement("source-terminal-recovery");
    await testPrisma.organizationBillingChangeAudit.create({ data: {
      changeId: change.id, organizationId: organization.id, attemptCount: 2, dedupeKey: "source-admission",
      outcome: "PROVIDER_MUTATION_ADMITTED", failureCode: "SOURCE_CANCELLATION_PROCESSING",
    } });
    if (evidence === "confirmed") await testPrisma.organizationBillingChangeAudit.create({ data: {
      changeId: change.id, organizationId: organization.id, attemptCount: 2, dedupeKey: "source-confirmed",
      outcome: "PROVIDER_STATE_ADOPTED", failureCode: "SOURCE_CANCELLATION_CONFIRMED",
      providerSubscriptionId: subscription.razorpaySubscriptionId,
    } });
    await testPrisma.organizationBillingChange.update({ where: { id: change.id }, data: {
      status: "FAILED", operationStatus: "FAILED", failureCategory: "MANUAL_REVIEW_REQUIRED",
      failureCode: "SOURCE_CANCELLATION_OUTCOME_UNKNOWN",
    } });
    vi.mocked(razorpay.fetchSubscription).mockResolvedValue({ id: subscription.razorpaySubscriptionId,
      entity: "subscription", plan_id: subscription.razorpayPlanId, quantity: subscription.quantity,
      total_count: 120, status: evidence === "terminal" ? "cancelled" : "active",
      has_scheduled_changes: true, change_scheduled_at: Math.floor(change.effectiveAt!.getTime() / 1000) });
    const result = await BillingService.retryBillingOperation(owner.id, organization.id, change.id);
    expect(result.operation?.queueStatus).toBe("SCHEDULED");
    expect(razorpay.cancelSubscription).not.toHaveBeenCalled();
    expect(razorpay.cancelScheduledChanges).not.toHaveBeenCalled();
  });

  it.each(["halted", "pending", "paused", "cancelled", "expired"])(
    "projects current %s replacement state even without paid evidence", async status => {
      const { razorpay, change, candidate } = await setupPendingUpiReplacement(`negative-${status}`);
      await testPrisma.organizationSubscription.update({ where: { id: candidate.id }, data: { status: "AUTHENTICATED" } });
      vi.mocked(razorpay.fetchSubscription).mockResolvedValue({ id: candidate.razorpaySubscriptionId,
        entity: "subscription", plan_id: candidate.razorpayPlanId, quantity: candidate.quantity,
        total_count: candidate.totalCount, status, offer_id: null,
        start_at: Math.floor(candidate.providerStartAt!.getTime() / 1000),
        expire_by: Math.floor(candidate.authorizationExpiresAt!.getTime() / 1000) });
      vi.mocked(razorpay.fetchSubscriptionInvoices).mockResolvedValue({ entity: "collection", count: 0, items: [] });
      const result = await BillingReconciliationService.reconcileProviderSubscription(candidate.razorpaySubscriptionId,
        { commercialIntentChangeId: change.id });
      expect(result.subscription.status).toBe(status.toUpperCase());
      expect(result.confirmedPaidPeriod).toBe(false);
      expect(result.subscription.paidThrough).toEqual(candidate.paidThrough);
      if (status === "halted") {
        await BillingDeadlineService.run(new Date());
        expect(await testPrisma.organizationSubscription.findUniqueOrThrow({ where: { id: candidate.id } }))
          .toMatchObject({ status: "HALTED", pendingReplacementOrganizationId: candidate.organizationId });
      }
      expect(razorpay.cancelSubscription).not.toHaveBeenCalled();
    }
  );

  it("preserves the legacy cancellation key and never compensates an uncertain cancellation", async () => {
    const { owner, organization, subscription } = await setup({ paymentMethod: "CARD" });
    await testPrisma.organization.update({ where: { id: organization.id }, data: { billingModelVersion: "LEGACY" } });
    const razorpay = fakeRazorpay({ providerQuantity: 1 });
    setRazorpayClientForTests(razorpay);
    vi.mocked(razorpay.cancelSubscription).mockRejectedValueOnce(new Error("accepted but response lost"));
    await expect(BillingService.requestCancellation(owner.id, organization.id, "legacy-key"))
      .rejects.toThrow("response lost");
    expect(await testPrisma.organizationBillingChange.findUnique({ where: { idempotencyKey: "legacy-key" } }))
      .toMatchObject({ status: "FAILED", failureCategory: "MANUAL_REVIEW_REQUIRED" });
    vi.mocked(razorpay.fetchSubscription).mockResolvedValue({ id: subscription.razorpaySubscriptionId,
      entity: "subscription", plan_id: subscription.razorpayPlanId, quantity: 1, total_count: 120, status: "cancelled" });
    await BillingService.requestCancellation(owner.id, organization.id, "legacy-key");
    expect(razorpay.cancelSubscription).toHaveBeenCalledTimes(1);
    expect(razorpay.cancelScheduledChanges).not.toHaveBeenCalled();
  });

  it("provisions one checkout-backed candidate for a UPI quantity increase", async () => {
    vi.stubEnv("RAZORPAY_MULTI_METHOD_SUBSCRIPTIONS_ENABLED", "true");
    vi.stubEnv("RAZORPAY_BILLING_WRITES_ENABLED", "true");
    const razorpay = fakeRazorpay({ providerMethod: "upi" });
    setRazorpayClientForTests(razorpay);
    const { owner, organization, subscription } = await setup({ paymentMethod: "UPI" });
    const secondBranch = await testPrisma.branch.create({
      data: {
        organizationId: organization.id,
        name: "Second",
        billingStatus: "PENDING_ACTIVATION",
      },
    });
    const change = await BillingMutationService.enqueue({
      organizationId: organization.id,
      subscriptionId: subscription.id,
      branchId: secondBranch.id,
      type: "QUANTITY_INCREASE",
      idempotencyKey: "upi-add-second",
      fromQuantity: 1,
      toQuantity: 2,
      createdByUserId: owner.id,
    });

    const processed = await BillingMutationService.processNext(organization.id);
    const [source, candidate, storedChange] = await Promise.all([
      testPrisma.organizationSubscription.findUniqueOrThrow({ where: { id: subscription.id } }),
      testPrisma.organizationSubscription.findUniqueOrThrow({
        where: { pendingReplacementOrganizationId: organization.id },
      }),
      testPrisma.organizationBillingChange.findUniqueOrThrow({ where: { id: change.id } }),
    ]);

    expect(processed).toMatchObject({ status: "AWAITING_PAYMENT", operationStatus: "CHECKOUT_OPEN" });
    expect(source.currentOrganizationId).toBe(organization.id);
    expect(source.quantity).toBe(1);
    expect(candidate).toMatchObject({
      replacesSubscriptionId: source.id,
      quantity: 2,
      razorpaySubscriptionId: "sub_candidate",
    });
    expect(storedChange.replacementSubscriptionId).toBe(candidate.id);
    expect(storedChange.undoCutoffAt?.getTime()).toBe(
      storedChange.effectiveAt!.getTime() - 72 * 60 * 60 * 1000
    );
    expect(razorpay.updateSubscription).not.toHaveBeenCalled();
  });

  it.each(["created", "authenticated"])("adopts exact replacement payment authorization with provider status %s without another mutation", async providerStatus => {
    const { owner, organization, subscription, branch, change, candidate, razorpay }
      = await setupPendingUpiReplacement("manual-replacement-exact-authorization");
    const paymentId = "pay_replacement_authorized";
    await testPrisma.organizationBillingChange.update({
      where: { id: change.id },
      data: {
        status: "FAILED",
        operationStatus: "FAILED",
        failureCategory: "MANUAL_REVIEW_REQUIRED",
        failureCode: "PROVIDER_EVIDENCE_UNCERTAIN",
        lastError: "Awaiting exact provider evidence",
        providerPaymentId: paymentId,
        failedAt: new Date(),
      },
    });
    vi.mocked(razorpay.fetchSubscription).mockResolvedValue({
      id: candidate.razorpaySubscriptionId,
      entity: "subscription",
      plan_id: candidate.razorpayPlanId,
      status: providerStatus,
      total_count: candidate.totalCount,
      quantity: candidate.quantity,
      offer_id: null,
      start_at: candidate.providerStartAt
        ? Math.floor(candidate.providerStartAt.getTime() / 1000)
        : undefined,
      expire_by: candidate.authorizationExpiresAt
        ? Math.floor(candidate.authorizationExpiresAt.getTime() / 1000)
        : undefined,
      payment_method: "upi",
    });
    vi.mocked(razorpay.fetchSubscriptionInvoices).mockResolvedValue({
      entity: "collection",
      count: 0,
      items: [],
    });
    vi.mocked(razorpay.fetchPayment).mockResolvedValue({
      id: paymentId,
      entity: "payment",
      amount: candidate.amountSubunits * candidate.quantity,
      currency: candidate.currency,
      status: "authorized",
      order_id: null,
      invoice_id: null,
      subscription_id: candidate.razorpaySubscriptionId,
      method: "upi",
      captured: false,
      created_at: Math.floor(Date.now() / 1000),
    });
    const providerMutationCounts = {
      create: vi.mocked(razorpay.createSubscription).mock.calls.length,
      update: vi.mocked(razorpay.updateSubscription).mock.calls.length,
      cancel: vi.mocked(razorpay.cancelSubscription).mock.calls.length,
      undo: vi.mocked(razorpay.cancelScheduledChanges).mock.calls.length,
    };

    await expect(BillingService.retryBillingOperation(owner.id, organization.id, change.id))
      .resolves.toMatchObject({
        resolutionOutcome: "PROVIDER_STATE_ADOPTED",
        operation: {
          id: change.id,
          queueStatus: "SCHEDULED",
          operationStatus: "SCHEDULED",
        },
      });

    expect(vi.mocked(razorpay.createSubscription)).toHaveBeenCalledTimes(providerMutationCounts.create);
    expect(vi.mocked(razorpay.updateSubscription)).toHaveBeenCalledTimes(providerMutationCounts.update);
    expect(vi.mocked(razorpay.cancelSubscription)).toHaveBeenCalledTimes(providerMutationCounts.cancel);
    expect(vi.mocked(razorpay.cancelScheduledChanges)).toHaveBeenCalledTimes(providerMutationCounts.undo);
    await expect(testPrisma.organizationBillingChange.findUniqueOrThrow({ where: { id: change.id } }))
      .resolves.toMatchObject({
        status: "SCHEDULED",
        operationStatus: "SCHEDULED",
        failureCategory: null,
        failureCode: null,
        accessGrantedAt: expect.any(Date),
      });
    await expect(testPrisma.organizationSubscription.findUniqueOrThrow({ where: { id: candidate.id } }))
      .resolves.toMatchObject({
        confirmedCommercialIntentChangeId: change.id,
        authPaymentId: paymentId,
        quantity: 2,
      });
    await expect(testPrisma.organizationSubscription.findUniqueOrThrow({ where: { id: subscription.id } }))
      .resolves.toMatchObject({ currentOrganizationId: organization.id, quantity: 1 });
    await expect(testPrisma.branch.findUniqueOrThrow({ where: { id: branch.id } }))
      .resolves.toMatchObject({ billingStatus: "ACTIVE" });
  });

  it("retains manual review for pending replacement evidence without promotion or provider mutation", async () => {
    const { owner, organization, subscription, branch, change, candidate, razorpay }
      = await setupPendingUpiReplacement("manual-replacement-pending-evidence");
    await testPrisma.organizationBillingChange.update({
      where: { id: change.id },
      data: {
        status: "FAILED",
        operationStatus: "FAILED",
        failureCategory: "MANUAL_REVIEW_REQUIRED",
        failureCode: "PROVIDER_EVIDENCE_UNCERTAIN",
        lastError: "Awaiting exact provider evidence",
        providerPaymentId: null,
        failedAt: new Date(),
      },
    });
    vi.mocked(razorpay.fetchSubscription).mockResolvedValue({
      id: candidate.razorpaySubscriptionId,
      entity: "subscription",
      plan_id: candidate.razorpayPlanId,
      status: "created",
      total_count: candidate.totalCount,
      paid_count: 0,
      quantity: candidate.quantity,
      offer_id: null,
      payment_method: null,
    });
    vi.mocked(razorpay.fetchSubscriptionInvoices).mockResolvedValue({
      entity: "collection",
      count: 0,
      items: [],
    });
    const providerMutationCounts = {
      create: vi.mocked(razorpay.createSubscription).mock.calls.length,
      update: vi.mocked(razorpay.updateSubscription).mock.calls.length,
      cancel: vi.mocked(razorpay.cancelSubscription).mock.calls.length,
      undo: vi.mocked(razorpay.cancelScheduledChanges).mock.calls.length,
    };

    await expect(BillingService.retryBillingOperation(owner.id, organization.id, change.id))
      .rejects.toMatchObject({
        name: "BillingManualReviewRequiredError",
        code: "BILLING_MANUAL_REVIEW_REQUIRED",
        changeId: change.id,
      });

    expect(vi.mocked(razorpay.createSubscription)).toHaveBeenCalledTimes(providerMutationCounts.create);
    expect(vi.mocked(razorpay.updateSubscription)).toHaveBeenCalledTimes(providerMutationCounts.update);
    expect(vi.mocked(razorpay.cancelSubscription)).toHaveBeenCalledTimes(providerMutationCounts.cancel);
    expect(vi.mocked(razorpay.cancelScheduledChanges)).toHaveBeenCalledTimes(providerMutationCounts.undo);
    await expect(testPrisma.organizationBillingChange.findUniqueOrThrow({ where: { id: change.id } }))
      .resolves.toMatchObject({
        status: "FAILED",
        operationStatus: "FAILED",
        failureCategory: "MANUAL_REVIEW_REQUIRED",
        failureCode: "PROVIDER_EVIDENCE_UNCERTAIN",
        accessGrantedAt: null,
      });
    await expect(testPrisma.organizationSubscription.findUniqueOrThrow({ where: { id: candidate.id } }))
      .resolves.toMatchObject({
        pendingReplacementOrganizationId: organization.id,
        confirmedCommercialIntentChangeId: null,
      });
    await expect(testPrisma.organizationSubscription.findUniqueOrThrow({ where: { id: subscription.id } }))
      .resolves.toMatchObject({ currentOrganizationId: organization.id, quantity: 1 });
    await expect(testPrisma.branch.findUniqueOrThrow({ where: { id: branch.id } }))
      .resolves.toMatchObject({ billingStatus: "PENDING_ACTIVATION" });
  });

  it.each(["CARD", "EMANDATE"] as const)("keeps a future-start %s trial branch pending until its replacement is authorized", async paymentMethod => {
    vi.stubEnv("RAZORPAY_MULTI_METHOD_SUBSCRIPTIONS_ENABLED", paymentMethod === "CARD" ? "false" : "true");
    vi.stubEnv("RAZORPAY_BILLING_WRITES_ENABLED", "true");
    const { owner, organization, subscription } = await setup({ paymentMethod });
    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    const futureStartAt = Math.floor(trialEndsAt.getTime() / 1000);
    await testPrisma.ownerTrialGrant.create({
      data: {
        ownerId: owner.id,
        organizationId: organization.id,
        source: "ONBOARDING",
        status: "ACTIVE",
        trialStartedAt: new Date(),
        trialEndsAt,
        consumedAt: new Date(),
      },
    });
    await testPrisma.organizationSubscription.update({
      where: { id: subscription.id },
      data: {
        status: "AUTHENTICATED",
        providerStartAt: new Date(futureStartAt * 1000),
        currentStart: null,
        currentEnd: null,
        paidThrough: null,
      },
    });
    const razorpay = fakeRazorpay({
      providerMethod: paymentMethod === "CARD" ? "card" : "emandate",
      providerStatus: "authenticated",
      providerQuantity: 1,
      includePaidInvoice: false,
      futureStartAt,
      omitCurrentPeriod: true,
    });
    setRazorpayClientForTests(razorpay);

    const result = await BranchService.createBranchForOrg({
      organizationId: organization.id,
      userId: owner.id,
      name: "Future trial branch",
      contactPhone: "9876543210",
      idempotencyKey: "future-trial-emandate-branch",
    });

    expect(result).toMatchObject({
      billingStatus: "PENDING_ACTIVATION",
      action: "CHECKOUT_REQUIRED",
    });
    expect(razorpay.createSubscription).toHaveBeenCalledWith(expect.objectContaining({
      quantity: 2,
      start_at: futureStartAt,
    }));
    expect(razorpay.updateSubscription).not.toHaveBeenCalled();
    const change = await testPrisma.organizationBillingChange.findUniqueOrThrow({
      where: { id: result.billingChangeId! },
      include: { replacementSubscription: true },
    });
    expect(change).toMatchObject({
      type: "TRIAL_SUBSCRIPTION_UPDATE",
      status: "AWAITING_PAYMENT",
      effectiveAt: new Date(futureStartAt * 1000),
      replacementSubscription: {
        quantity: 2,
        providerStartAt: new Date(futureStartAt * 1000),
      },
    });

    await testPrisma.organizationSubscription.update({
      where: { id: change.replacementSubscriptionId! },
      data: {
        status: "AUTHENTICATED",
        providerPaymentMethod: paymentMethod,
        confirmedCommercialIntentChangeId: change.id,
      },
    });
    await expect(BillingReplacementService.syncAuthorizedAccess(change.id))
      .resolves.toMatchObject({ action: "GRANT" });
    await expect(testPrisma.branch.findUniqueOrThrow({ where: { id: result.id } }))
      .resolves.toMatchObject({ billingStatus: "ACTIVE" });
    await expect(testPrisma.organizationSubscription.findUniqueOrThrow({ where: { id: subscription.id } }))
      .resolves.toMatchObject({ currentOrganizationId: organization.id, quantity: 1 });
  });

  it("returns 409 semantics for a second unrelated billable intent while a candidate is open", async () => {
    vi.stubEnv("RAZORPAY_MULTI_METHOD_SUBSCRIPTIONS_ENABLED", "true");
    vi.stubEnv("RAZORPAY_BILLING_WRITES_ENABLED", "true");
    setRazorpayClientForTests(fakeRazorpay({ providerMethod: "upi" }));
    const { owner, organization, subscription } = await setup({ paymentMethod: "UPI" });
    const firstChange = await BillingMutationService.enqueue({
      organizationId: organization.id,
      subscriptionId: subscription.id,
      type: "PLAN_DOWNGRADE",
      idempotencyKey: "first-replacement",
      fromPlan: "PRO",
      toPlan: "BASIC",
      fromQuantity: 1,
      toQuantity: 1,
      createdByUserId: owner.id,
    });
    await BillingMutationService.processNext(organization.id);

    await expect(BillingMutationService.enqueue({
      organizationId: organization.id,
      subscriptionId: subscription.id,
      type: "QUANTITY_INCREASE",
      idempotencyKey: "second-replacement",
      fromQuantity: 1,
      toQuantity: 2,
      createdByUserId: owner.id,
    })).rejects.toMatchObject({
      code: "BILLING_CHANGE_IN_PROGRESS",
      existingChangeId: firstChange.id,
    });
    await expect(BillingMutationService.enqueue({
      organizationId: organization.id,
      subscriptionId: subscription.id,
      type: "PLAN_DOWNGRADE",
      idempotencyKey: "first-replacement",
      fromPlan: "PRO",
      toPlan: "BASIC",
      fromQuantity: 1,
      toQuantity: 1,
      createdByUserId: owner.id,
    })).resolves.toMatchObject({ id: firstChange.id });
  });

  it("adopts a response-lost provider candidate by exact durable notes", async () => {
    vi.stubEnv("RAZORPAY_MULTI_METHOD_SUBSCRIPTIONS_ENABLED", "true");
    vi.stubEnv("RAZORPAY_BILLING_WRITES_ENABLED", "true");
    const razorpay = fakeRazorpay({ providerMethod: "emandate" });
    setRazorpayClientForTests(razorpay);
    const { owner, organization, subscription } = await setup({ paymentMethod: "EMANDATE" });
    const change = await BillingMutationService.enqueue({
      organizationId: organization.id,
      subscriptionId: subscription.id,
      type: "QUANTITY_INCREASE",
      idempotencyKey: "adopt-response-lost",
      fromQuantity: 1,
      toQuantity: 2,
      createdByUserId: owner.id,
    });
    const now = new Date();
    const providerSource = await razorpay.fetchSubscription(subscription.razorpaySubscriptionId);
    const effectiveAt = getSafeReplacementCycleBoundary({
      now,
      currentCycleEnd: new Date(providerSource.current_end! * 1000),
      intervalMonths: 1,
    });
    const undoCutoffAt = getReplacementUndoCutoffAt(effectiveAt);
    vi.mocked(razorpay.listSubscriptions!).mockResolvedValueOnce({
      entity: "collection",
      count: 1,
      items: [{
        id: "sub_adopted",
        entity: "subscription",
        plan_id: "plan_pro",
        status: "created",
        total_count: 120,
        paid_count: 0,
        quantity: 2,
        start_at: Math.floor(effectiveAt.getTime() / 1000),
        expire_by: Math.floor(undoCutoffAt.getTime() / 1000),
        created_at: Math.floor(Date.now() / 1000),
        notes: {
          app: "lab_lords",
          billing_type: "saas_subscription_replacement",
          organization_id: organization.id,
          provider_mode: "TEST",
          billing_change_id: change.id,
          replacement_source_subscription_id: subscription.razorpaySubscriptionId,
          plan: "PRO",
        },
      }],
    });

    await BillingMutationService.processNext(organization.id, now);

    expect(razorpay.createSubscription).not.toHaveBeenCalled();
    await expect(testPrisma.organizationSubscription.findUnique({
      where: { razorpaySubscriptionId: "sub_adopted" },
    })).resolves.toMatchObject({ pendingReplacementOrganizationId: organization.id });
  });

  it("admits one CARD branch addition and keeps its retry idempotent while another intent is held", async () => {
    const { owner, organization, subscription } = await setup();
    const branch = await testPrisma.branch.create({ data: {
      organizationId: organization.id, name: "Second", billingStatus: "PENDING_ACTIVATION",
    } });
    const input = { organizationId: organization.id, subscriptionId: subscription.id, branchId: branch.id,
      type: "QUANTITY_INCREASE" as const, idempotencyKey: "add-second", createdByUserId: owner.id };
    const first = await BillingMutationService.enqueue(input);
    expect([first.sequence, first.toQuantity]).toEqual([2, 2]);
    await expect(BillingMutationService.enqueue(input)).resolves.toMatchObject({ id: first.id });
    await expect(BillingMutationService.enqueue({ ...input, idempotencyKey: "add-third" }))
      .rejects.toMatchObject({ code: "BILLING_CHANGE_IN_PROGRESS", existingChangeId: first.id });
    await expect(BillingMutationService.enqueue({ ...input, toQuantity: 99 }))
      .rejects.toThrow("Idempotency key was already used for another billing operation");
  });

  it("does not submit a later mutation while the earlier provider payment is unresolved", async () => {
    const { owner, organization, subscription } = await setup();
    const razorpay = fakeRazorpay();
    setRazorpayClientForTests(razorpay);
    const branch2 = await testPrisma.branch.create({
      data: { organizationId: organization.id, name: "Second", billingStatus: "PENDING_ACTIVATION" },
    });
    const first = await BillingMutationService.enqueue({
      organizationId: organization.id,
      subscriptionId: subscription.id,
      branchId: branch2.id,
      type: "QUANTITY_INCREASE",
      idempotencyKey: "fifo-awaiting-second",
      createdByUserId: owner.id,
    });
    await stageHistoricalNativeChange(first.id);
    const branch3 = await testPrisma.branch.create({
      data: { organizationId: organization.id, name: "Third", billingStatus: "PENDING_ACTIVATION" },
    });
    const second = await seedHistoricalQueuedSuccessor({
      organizationId: organization.id,
      subscriptionId: subscription.id,
      branchId: branch3.id,
      type: "QUANTITY_INCREASE",
      idempotencyKey: "fifo-awaiting-third", fromQuantity: 2, toQuantity: 3,
      createdByUserId: owner.id,
    });

    await expect(BillingMutationService.processNext(organization.id)).resolves.toBeNull();
    expect(razorpay.createSubscription).not.toHaveBeenCalled();
    await expect(testPrisma.organizationBillingChange.findUniqueOrThrow({ where: { id: second.id } }))
      .resolves.toMatchObject({ status: "QUEUED", attemptCount: 0 });

    await testPrisma.organizationBillingChange.update({
      where: { id: first.id },
      data: { status: "APPLIED", operationStatus: "APPLIED", resolvedAt: new Date() },
    });
    await testPrisma.organizationSubscription.update({ where: { id: subscription.id }, data: { quantity: 2 } });
    await expect(BillingMutationService.processNext(organization.id))
      .resolves.toMatchObject({ id: second.id, status: "AWAITING_PAYMENT" });
    expect(razorpay.createSubscription).toHaveBeenCalledTimes(1);
  });

  it("keeps later intent queued until an earlier scheduled provider change is resolved", async () => {
    const { owner, organization, subscription } = await setup();
    const razorpay = fakeRazorpay();
    setRazorpayClientForTests(razorpay);
    const scheduled = await BillingMutationService.enqueue({
      organizationId: organization.id,
      subscriptionId: subscription.id,
      type: "PLAN_DOWNGRADE",
      idempotencyKey: "fifo-scheduled-downgrade",
      fromPlan: "PRO",
      toPlan: "BASIC",
      fromQuantity: 1,
      toQuantity: 1,
      effectiveAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      createdByUserId: owner.id,
    });
    const branch = await testPrisma.branch.create({
      data: { organizationId: organization.id, name: "Later branch", billingStatus: "PENDING_ACTIVATION" },
    });
    const later = await seedHistoricalQueuedSuccessor({
      organizationId: organization.id,
      subscriptionId: subscription.id,
      branchId: branch.id,
      type: "QUANTITY_INCREASE",
      idempotencyKey: "fifo-after-scheduled",
      fromQuantity: 1,
      toQuantity: 2,
      createdByUserId: owner.id,
    });

    await stageHistoricalNativeChange(scheduled.id, "SCHEDULED");
    await expect(BillingMutationService.processNext(organization.id)).resolves.toBeNull();
    expect(razorpay.updateSubscription).not.toHaveBeenCalled();
    await expect(testPrisma.organizationBillingChange.findUniqueOrThrow({ where: { id: later.id } }))
      .resolves.toMatchObject({ status: "QUEUED", attemptCount: 0 });

    await testPrisma.organizationBillingChange.update({
      where: { id: scheduled.id },
      data: { status: "UNDONE", operationStatus: "ABANDONED", resolvedAt: new Date() },
    });
    await expect(BillingMutationService.processNext(organization.id))
      .resolves.toMatchObject({ id: later.id, status: "AWAITING_PAYMENT" });
    expect(razorpay.createSubscription).toHaveBeenCalledTimes(1);
  });

  it("does not submit a locally scheduled cancellation before its undo cutoff", async () => {
    const { owner, organization, subscription } = await setup();
    const razorpay = fakeRazorpay();
    setRazorpayClientForTests(razorpay);
    const now = new Date();
    const cutoff = new Date(now.getTime() + 60 * 60 * 1000);
    const cancellation = await BillingMutationService.enqueue({
      organizationId: organization.id,
      subscriptionId: subscription.id,
      type: "CANCELLATION",
      idempotencyKey: "future-cancellation-cutoff",
      operationStatus: "SCHEDULED",
      effectiveAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      undoCutoffAt: cutoff,
      createdByUserId: owner.id,
    });
    const branch = await testPrisma.branch.create({
      data: { organizationId: organization.id, name: "After cancellation", billingStatus: "PENDING_ACTIVATION" },
    });
    const later = await seedHistoricalQueuedSuccessor({
      organizationId: organization.id,
      subscriptionId: subscription.id,
      branchId: branch.id,
      type: "QUANTITY_INCREASE",
      idempotencyKey: "after-future-cancellation",
      fromQuantity: 1,
      toQuantity: 2,
      createdByUserId: owner.id,
    });

    await expect(BillingMutationService.processNext(organization.id, now)).resolves.toBeNull();
    expect(razorpay.cancelSubscription).not.toHaveBeenCalled();
    expect(razorpay.updateSubscription).not.toHaveBeenCalled();
    await expect(testPrisma.organizationBillingChange.findUniqueOrThrow({ where: { id: later.id } }))
      .resolves.toMatchObject({ status: "QUEUED", attemptCount: 0 });

    await expect(BillingMutationService.processNext(
      organization.id,
      new Date(cutoff.getTime() + 1)
    )).resolves.toMatchObject({ id: cancellation.id, status: "SCHEDULED" });
    expect(razorpay.cancelSubscription).toHaveBeenCalledTimes(1);
    await expect(BillingMutationService.processNext(organization.id)).resolves.toBeNull();
    await expect(testPrisma.organizationBillingChange.findUniqueOrThrow({ where: { id: later.id } }))
      .resolves.toMatchObject({ status: "QUEUED", attemptCount: 0 });
  });

  it("does not claim or count an attempt while provider writes are held", async () => {
    const { owner, organization, subscription } = await setup();
    const razorpay = fakeRazorpay();
    setRazorpayClientForTests(razorpay);
    vi.stubEnv("RAZORPAY_BILLING_WRITES_ENABLED", "false");
    const change = await BillingMutationService.enqueue({
      organizationId: organization.id,
      subscriptionId: subscription.id,
      type: "QUANTITY_INCREASE",
      idempotencyKey: "held-quantity-change",
      fromQuantity: 1,
      toQuantity: 2,
      createdByUserId: owner.id,
    });

    await expect(BillingMutationService.processNext(organization.id)).resolves.toBeNull();
    expect(razorpay.updateSubscription).not.toHaveBeenCalled();
    await expect(testPrisma.organizationBillingChange.findUniqueOrThrow({ where: { id: change.id } }))
      .resolves.toMatchObject({ status: "QUEUED", attemptCount: 0 });
    await expect(testPrisma.organization.findUniqueOrThrow({ where: { id: organization.id } }))
      .resolves.toMatchObject({ billingMutationLeaseToken: null, billingMutationLeaseUntil: null });
  });

  it.each([
    ["network timeout", new RazorpayApiError("provider response was lost", { kind: "NETWORK" })],
    ["provider 5xx", new RazorpayApiError("provider failed after accepting the request", {
      kind: "PROVIDER",
      status: 503,
    })],
    ["HTTP 408 timeout", new RazorpayApiError("provider request timed out", {
      kind: "REQUEST",
      status: 408,
    })],
  ])("quarantines an ambiguous %s without resubmitting it", async (_label, providerError) => {
    const { owner, organization, subscription } = await setup();
    const razorpay = fakeRazorpay();
    vi.mocked(razorpay.createSubscription).mockRejectedValueOnce(providerError);
    setRazorpayClientForTests(razorpay);
    const change = await BillingMutationService.enqueue({
      organizationId: organization.id,
      subscriptionId: subscription.id,
      type: "QUANTITY_INCREASE",
      idempotencyKey: `ambiguous-${providerError.kind}`,
      fromQuantity: 1,
      toQuantity: 2,
      createdByUserId: owner.id,
    });

    await expect(BillingMutationService.processNext(organization.id)).rejects.toBe(providerError);
    await expect(BillingMutationService.processNext(organization.id)).resolves.toBeNull();

    expect(razorpay.createSubscription).toHaveBeenCalledTimes(1);
    await expect(testPrisma.organizationBillingChange.findUniqueOrThrow({ where: { id: change.id } }))
      .resolves.toMatchObject({
        status: "FAILED",
        operationStatus: "FAILED",
        attemptCount: 1,
        failureCategory: "MANUAL_REVIEW_REQUIRED",
        failureCode: "PROVIDER_MUTATION_OUTCOME_UNKNOWN",
        resolvedAt: null,
      });
  });

  it("quarantines a malformed success response after exactly one provider mutation", async () => {
    const { owner, organization, subscription } = await setup();
    const razorpay = fakeRazorpay();
    vi.mocked(razorpay.createSubscription).mockResolvedValueOnce(null as never);
    setRazorpayClientForTests(razorpay);
    const change = await BillingMutationService.enqueue({
      organizationId: organization.id,
      subscriptionId: subscription.id,
      type: "QUANTITY_INCREASE",
      idempotencyKey: "malformed-provider-success",
      fromQuantity: 1,
      toQuantity: 2,
      createdByUserId: owner.id,
    });

    await expect(BillingMutationService.processNext(organization.id))
      .rejects.toThrow("does not match the expected plan and branch quantity");

    expect(razorpay.createSubscription).toHaveBeenCalledTimes(1);
    await expect(testPrisma.organizationBillingChange.findUniqueOrThrow({ where: { id: change.id } }))
      .resolves.toMatchObject({
        status: "FAILED",
        failureCategory: "MANUAL_REVIEW_REQUIRED",
        failureCode: "PROVIDER_MUTATION_OUTCOME_UNKNOWN",
      });
  });

  it("quarantines a well-formed success response that does not match the requested target", async () => {
    const { owner, organization, subscription } = await setup();
    const razorpay = fakeRazorpay();
    vi.mocked(razorpay.createSubscription).mockResolvedValueOnce({
      id: "sub_workspace",
      entity: "subscription",
      plan_id: "plan_pro",
      status: "active",
      total_count: 120,
      quantity: 9,
    });
    setRazorpayClientForTests(razorpay);
    const change = await BillingMutationService.enqueue({
      organizationId: organization.id,
      subscriptionId: subscription.id,
      type: "QUANTITY_INCREASE",
      idempotencyKey: "mismatched-provider-success",
      fromQuantity: 1,
      toQuantity: 2,
      createdByUserId: owner.id,
    });

    await expect(BillingMutationService.processNext(organization.id))
      .rejects.toThrow("does not match the expected plan and branch quantity");

    expect(razorpay.createSubscription).toHaveBeenCalledTimes(1);
    await expect(testPrisma.organizationBillingChange.findUniqueOrThrow({ where: { id: change.id } }))
      .resolves.toMatchObject({
        status: "FAILED",
        failureCategory: "MANUAL_REVIEW_REQUIRED",
        failureCode: "PROVIDER_MUTATION_OUTCOME_UNKNOWN",
      });
  });

  it("requires explicit undo of a rejected historical CARD update before a new replacement", async () => {
    const { owner, organization, subscription } = await setup();
    const razorpay = fakeRazorpay({ providerQuantity: 1 });
    setRazorpayClientForTests(razorpay);
    const change = await BillingMutationService.enqueue({ organizationId: organization.id, subscriptionId: subscription.id,
      type: "QUANTITY_INCREASE", fromQuantity: 1, toQuantity: 2, idempotencyKey: "historical-rejected-card" });
    await stageHistoricalNativeChange(change.id, "FAILED", "REJECTED");
    await expect(BillingMutationService.retry(change.id)).rejects.toThrow(/earlier in-place billing change/);
    expect(razorpay.updateSubscription).not.toHaveBeenCalled();
    expect(razorpay.createSubscription).not.toHaveBeenCalled();
    await BillingService.undoWorkspaceChange(owner.id, organization.id, change.id);
    const next = await BillingMutationService.enqueue({ organizationId: organization.id, subscriptionId: subscription.id,
      type: "QUANTITY_INCREASE", fromQuantity: 1, toQuantity: 2, idempotencyKey: "new-card-replacement" });
    await expect(BillingMutationService.processNext(organization.id))
      .resolves.toMatchObject({ id: next.id, status: "AWAITING_PAYMENT" });
    expect(razorpay.createSubscription).toHaveBeenCalledTimes(1);
    expect(razorpay.updateSubscription).not.toHaveBeenCalled();
  });

  it("adopts an exact provider target but never resubmits an ambiguous provider mutation", async () => {
    const { owner, organization, subscription } = await setup();
    const razorpay = fakeRazorpay({ providerQuantity: 2 });
    setRazorpayClientForTests(razorpay);
    const change = await BillingMutationService.enqueue({
      organizationId: organization.id,
      subscriptionId: subscription.id,
      type: "QUANTITY_INCREASE",
      idempotencyKey: "ambiguous-retry-reconciles-first",
      fromQuantity: 1,
      toQuantity: 2,
      createdByUserId: owner.id,
    });
    await stageHistoricalNativeChange(change.id, "FAILED", "UNKNOWN");

    await expect(BillingService.retryBillingOperation(owner.id, organization.id, change.id))
      .resolves.toMatchObject({
        resolutionOutcome: "PROVIDER_STATE_ADOPTED",
        operation: {
          id: change.id,
          queueStatus: "APPLIED",
          operationStatus: "APPLIED",
        },
      });

    expect(razorpay.fetchSubscription).toHaveBeenCalledTimes(1);
    expect(razorpay.updateSubscription).not.toHaveBeenCalled();
    await expect(testPrisma.organizationBillingChange.findUniqueOrThrow({ where: { id: change.id } }))
      .resolves.toMatchObject({
        status: "APPLIED",
        failureCategory: null,
        failureCode: null,
      });
    await expect(testPrisma.organizationSubscription.findUniqueOrThrow({ where: { id: subscription.id } }))
      .resolves.toMatchObject({ quantity: 2 });
    await expect(testPrisma.organizationSubscriptionHistory.findMany({
      where: { organizationSubscriptionId: subscription.id },
      orderBy: { createdAt: "asc" },
      select: { event: true },
    })).resolves.toEqual(expect.arrayContaining([
      { event: "billing_change:PROVIDER_STATE_ADOPTED:NONE" },
    ]));
  });

  it("retains manual review with a typed outcome when provider state still matches the source", async () => {
    const { owner, organization, subscription } = await setup();
    const razorpay = fakeRazorpay({ providerQuantity: 1 });
    setRazorpayClientForTests(razorpay);
    const change = await BillingMutationService.enqueue({
      organizationId: organization.id,
      subscriptionId: subscription.id,
      type: "QUANTITY_INCREASE",
      idempotencyKey: "ambiguous-source-unchanged",
      fromQuantity: 1,
      toQuantity: 2,
      createdByUserId: owner.id,
    });
    await stageHistoricalNativeChange(change.id, "FAILED", "UNKNOWN");

    await expect(BillingService.retryBillingOperation(owner.id, organization.id, change.id))
      .rejects.toMatchObject({
        name: "BillingManualReviewRequiredError",
        code: "BILLING_MANUAL_REVIEW_REQUIRED",
        changeId: change.id,
      });

    expect(razorpay.fetchSubscription).toHaveBeenCalledTimes(1);
    expect(razorpay.updateSubscription).not.toHaveBeenCalled();
    await expect(testPrisma.organizationBillingChange.findUniqueOrThrow({ where: { id: change.id } }))
      .resolves.toMatchObject({
        status: "FAILED",
        failureCategory: "MANUAL_REVIEW_REQUIRED",
        failureCode: "QUANTITY_MISMATCH",
      });
    await expect(testPrisma.organizationSubscriptionHistory.findMany({
      where: { organizationSubscriptionId: subscription.id },
      orderBy: { createdAt: "asc" },
      select: { event: true },
    })).resolves.toEqual(expect.arrayContaining([
      { event: "billing_change:MANUAL_REVIEW_RETAINED:QUANTITY_MISMATCH" },
    ]));
  });

  it("atomically discards a pending card branch before its quantity mutation is claimed", async () => {
    const { owner, organization, subscription } = await setup();
    const razorpay = fakeRazorpay({ providerQuantity: 1, includePaidInvoice: false });
    setRazorpayClientForTests(razorpay);
    const branch = await testPrisma.branch.create({
      data: { organizationId: organization.id, name: "Discard before claim", billingStatus: "PENDING_ACTIVATION" },
    });
    const change = await BillingMutationService.enqueue({
      organizationId: organization.id,
      subscriptionId: subscription.id,
      branchId: branch.id,
      type: "QUANTITY_INCREASE",
      idempotencyKey: "discard-card-before-claim",
      fromQuantity: 1,
      toQuantity: 2,
      createdByUserId: owner.id,
    });

    await expect(BranchService.discardPendingActivation(owner.id, branch.id))
      .resolves.toEqual({ archived: true });
    await expect(BillingMutationService.processNext(organization.id)).resolves.toBeNull();

    expect(razorpay.updateSubscription).not.toHaveBeenCalled();
    await expect(testPrisma.branch.findUniqueOrThrow({ where: { id: branch.id } }))
      .resolves.toMatchObject({ billingStatus: "ARCHIVED" });
    await expect(testPrisma.organizationBillingChange.findUniqueOrThrow({ where: { id: change.id } }))
      .resolves.toMatchObject({ status: "SUPERSEDED", operationStatus: "ABANDONED" });
  });

  it("rejects pending-branch discard while a card quantity provider mutation is in flight", async () => {
    const { owner, organization, subscription } = await setup();
    const razorpay = fakeRazorpay({ providerQuantity: 1, includePaidInvoice: false });
    let providerStarted!: () => void;
    let releaseProvider!: () => void;
    const started = new Promise<void>(resolve => { providerStarted = resolve; });
    const providerRelease = new Promise<void>(resolve => { releaseProvider = resolve; });
    const create = vi.mocked(razorpay.createSubscription).getMockImplementation()!;
    vi.mocked(razorpay.createSubscription).mockImplementationOnce(async input => {
      providerStarted();
      await providerRelease;
      return create(input);
    });
    setRazorpayClientForTests(razorpay);
    const branch = await testPrisma.branch.create({
      data: { organizationId: organization.id, name: "Discard during provider call", billingStatus: "PENDING_ACTIVATION" },
    });
    const change = await BillingMutationService.enqueue({
      organizationId: organization.id,
      subscriptionId: subscription.id,
      branchId: branch.id,
      type: "QUANTITY_INCREASE",
      idempotencyKey: "discard-card-during-provider-call",
      fromQuantity: 1,
      toQuantity: 2,
      createdByUserId: owner.id,
    });

    const processing = BillingMutationService.processNext(organization.id);
    await started;
    const discardError = await BranchService.discardPendingActivation(owner.id, branch.id)
      .then(() => null, error => error as Error);
    releaseProvider();
    await expect(processing).resolves.toMatchObject({ id: change.id, status: "AWAITING_PAYMENT" });

    expect(discardError).toBeInstanceOf(Error);
    expect(discardError?.message).toContain("Another billing operation is still processing");
    await expect(testPrisma.branch.findUniqueOrThrow({ where: { id: branch.id } }))
      .resolves.toMatchObject({ billingStatus: "PENDING_ACTIVATION", billingArchivedAt: null });
    await expect(testPrisma.organizationBillingChange.findUniqueOrThrow({ where: { id: change.id } }))
      .resolves.toMatchObject({ status: "AWAITING_PAYMENT", operationStatus: "CHECKOUT_OPEN" });
  });

  it("rejects general undo while the provider mutation is in flight", async () => {
    const { owner, organization, subscription } = await setup();
    const razorpay = fakeRazorpay({ providerQuantity: 1, includePaidInvoice: false });
    let providerStarted!: () => void;
    let releaseProvider!: () => void;
    const started = new Promise<void>(resolve => { providerStarted = resolve; });
    const providerRelease = new Promise<void>(resolve => { releaseProvider = resolve; });
    const create = vi.mocked(razorpay.createSubscription).getMockImplementation()!;
    vi.mocked(razorpay.createSubscription).mockImplementationOnce(async input => {
      providerStarted();
      await providerRelease;
      return create(input);
    });
    setRazorpayClientForTests(razorpay);
    const change = await BillingMutationService.enqueue({
      organizationId: organization.id,
      subscriptionId: subscription.id,
      type: "QUANTITY_INCREASE",
      idempotencyKey: "undo-during-provider-mutation",
      fromQuantity: 1,
      toQuantity: 2,
      createdByUserId: owner.id,
    });

    const processing = BillingMutationService.processNext(organization.id);
    await started;
    await expect(BillingService.undoWorkspaceChange(owner.id, organization.id, change.id))
      .rejects.toMatchObject({ code: "BILLING_CHANGE_IN_PROGRESS" });
    await expect(testPrisma.organizationBillingChange.findUniqueOrThrow({ where: { id: change.id } }))
      .resolves.toMatchObject({ status: "PROCESSING" });
    releaseProvider();
    await expect(processing).resolves.toMatchObject({ status: "AWAITING_PAYMENT" });
  });

  it("blocks every replacement undo entry point while provider state requires manual review", async () => {
    const { owner, organization, change, candidate, razorpay } = await setupPendingUpiReplacement(
      "manual-review-replacement-undo"
    );
    vi.mocked(razorpay.cancelSubscription).mockClear();
    await testPrisma.organizationBillingChange.update({
      where: { id: change.id },
      data: {
        status: "FAILED",
        operationStatus: "FAILED",
        failureCategory: "MANUAL_REVIEW_REQUIRED",
        failureCode: "MALFORMED_PROVIDER_EVIDENCE",
        resolvedAt: null,
      },
    });

    await expect(BillingService.undoWorkspaceChange(owner.id, organization.id, change.id))
      .rejects.toBeInstanceOf(BillingChangeInProgressError);
    await expect(BillingReplacementService.undoReplacement(change.id))
      .rejects.toBeInstanceOf(BillingChangeInProgressError);

    expect(razorpay.cancelSubscription).not.toHaveBeenCalled();
    await expect(testPrisma.organizationSubscription.findUniqueOrThrow({
      where: { id: candidate.id },
    })).resolves.toMatchObject({ pendingReplacementOrganizationId: organization.id });
    await expect(testPrisma.branch.findUniqueOrThrow({ where: { id: change.branchId! } }))
      .resolves.toMatchObject({ billingStatus: "PENDING_ACTIVATION" });
  });

  it("does not restore a replacement-backed branch removal under manual review", async () => {
    const { owner, organization, branch, change, candidate, razorpay } = await setupPendingUpiReplacement(
      "manual-review-replacement-removal"
    );
    vi.mocked(razorpay.cancelSubscription).mockClear();
    await Promise.all([
      testPrisma.branch.update({
        where: { id: branch.id },
        data: { billingStatus: "REMOVAL_SCHEDULED" },
      }),
      testPrisma.organizationBillingChange.update({
        where: { id: change.id },
        data: {
          type: "BRANCH_REMOVAL",
          status: "FAILED",
          operationStatus: "FAILED",
          failureCategory: "MANUAL_REVIEW_REQUIRED",
          failureCode: "MALFORMED_PROVIDER_EVIDENCE",
          resolvedAt: null,
        },
      }),
    ]);

    await expect(BranchService.undoBillingRemoval(owner.id, branch.id))
      .rejects.toBeInstanceOf(BillingChangeInProgressError);

    expect(razorpay.cancelSubscription).not.toHaveBeenCalled();
    await expect(testPrisma.organizationSubscription.findUniqueOrThrow({
      where: { id: candidate.id },
    })).resolves.toMatchObject({ pendingReplacementOrganizationId: organization.id });
    await expect(testPrisma.branch.findUniqueOrThrow({ where: { id: branch.id } }))
      .resolves.toMatchObject({ billingStatus: "REMOVAL_SCHEDULED" });
  });

  it("atomically restores a normal replacement-backed branch removal after exact cancellation", async () => {
    const { owner, organization, branch, change, candidate, razorpay } = await setupPendingUpiReplacement(
      "exact-replacement-removal-undo"
    );
    await Promise.all([
      testPrisma.branch.update({
        where: { id: branch.id },
        data: { billingStatus: "REMOVAL_SCHEDULED" },
      }),
      testPrisma.organizationBillingChange.update({
        where: { id: change.id },
        data: { type: "BRANCH_REMOVAL" },
      }),
    ]);
    vi.mocked(razorpay.cancelSubscription).mockReset();
    vi.mocked(razorpay.cancelSubscription).mockResolvedValue({
      id: candidate.razorpaySubscriptionId,
      entity: "subscription",
      plan_id: candidate.razorpayPlanId,
      status: "cancelled",
      total_count: candidate.totalCount,
      quantity: candidate.quantity,
      ended_at: Math.floor(Date.now() / 1000),
    });

    await expect(BranchService.undoBillingRemoval(owner.id, branch.id))
      .resolves.toEqual({ undone: true });

    expect(razorpay.cancelSubscription).toHaveBeenCalledTimes(1);
    await expect(testPrisma.organizationBillingChange.findUniqueOrThrow({ where: { id: change.id } }))
      .resolves.toMatchObject({ status: "UNDONE", operationStatus: "ABANDONED" });
    await expect(testPrisma.organizationSubscription.findUniqueOrThrow({ where: { id: candidate.id } }))
      .resolves.toMatchObject({ pendingReplacementOrganizationId: null, status: "CANCELLED" });
    await expect(testPrisma.branch.findUniqueOrThrow({ where: { id: branch.id } }))
      .resolves.toMatchObject({
        organizationId: organization.id,
        billingStatus: "ACTIVE",
        billingArchivedAt: null,
      });
  });

  it("never resubmits a response-lost replacement cancellation and adopts it read-only", async () => {
    const { owner, organization, branch, subscription, change, candidate, razorpay } = await setupPendingUpiReplacement(
      "response-lost-replacement-cancellation"
    );
    vi.mocked(razorpay.cancelSubscription).mockReset();
    vi.mocked(razorpay.cancelSubscription).mockRejectedValueOnce(
      new Error("connection closed after Razorpay accepted cancellation")
    );

    await expect(BillingReplacementService.undoReplacement(change.id))
      .rejects.toBeInstanceOf(BillingManualReviewRequiredError);

    expect(razorpay.cancelSubscription).toHaveBeenCalledTimes(1);
    await expect(testPrisma.organizationBillingChange.findUniqueOrThrow({ where: { id: change.id } }))
      .resolves.toMatchObject({
        status: "FAILED",
        operationStatus: "ABANDONED",
        failureCategory: "MANUAL_REVIEW_REQUIRED",
        failureCode: "REPLACEMENT_UNDO_CANCELLATION_OUTCOME_UNKNOWN_RESTORE",
        resolvedAt: null,
      });
    await expect(BillingService.undoWorkspaceChange(owner.id, organization.id, change.id))
      .rejects.toBeInstanceOf(BillingChangeInProgressError);
    expect(razorpay.cancelSubscription).toHaveBeenCalledTimes(1);

    vi.mocked(razorpay.fetchSubscription).mockResolvedValue({
      id: candidate.razorpaySubscriptionId,
      entity: "subscription",
      plan_id: candidate.razorpayPlanId,
      status: "cancelled",
      total_count: candidate.totalCount,
      quantity: candidate.quantity,
      ended_at: Math.floor(Date.now() / 1000),
    });
    const deadlineNow = new Date();
    await testPrisma.organizationSubscription.update({
      where: { id: subscription.id },
      data: { lastReconciledAt: deadlineNow },
    });
    const deadline = await BillingDeadlineService.run(deadlineNow);

    expect(deadline.retriedReplacementCancellations).toBe(1);
    expect(deadline.errors).toEqual([]);
    expect(razorpay.cancelSubscription).toHaveBeenCalledTimes(1);
    await expect(testPrisma.organizationBillingChange.findUniqueOrThrow({ where: { id: change.id } }))
      .resolves.toMatchObject({
        status: "UNDONE",
        operationStatus: "ABANDONED",
        failureCategory: null,
        failureCode: null,
      });
    await expect(testPrisma.organizationSubscription.findUniqueOrThrow({ where: { id: candidate.id } }))
      .resolves.toMatchObject({
        status: "CANCELLED",
        pendingReplacementOrganizationId: null,
      });
    await expect(testPrisma.branch.findUniqueOrThrow({ where: { id: branch.id } }))
      .resolves.toMatchObject({ billingStatus: "PENDING_ACTIVATION" });
  });

  it("quarantines response-lost failed-checkout cleanup and lets the deadline read provider truth", async () => {
    const { subscription, change, candidate, razorpay } = await setupPendingUpiReplacement(
      "response-lost-failed-checkout-cleanup"
    );
    vi.mocked(razorpay.cancelSubscription).mockReset();
    vi.mocked(razorpay.cancelSubscription).mockRejectedValueOnce(
      new Error("timeout after replacement cleanup was accepted")
    );

    await expect(BillingReplacementService.failReplacementCheckout(
      change.id,
      "FAILED",
      new Date(),
      "Mandate authorization failed"
    )).rejects.toBeInstanceOf(BillingManualReviewRequiredError);
    await expect(BillingReplacementService.failReplacementCheckout(change.id, "FAILED"))
      .rejects.toBeInstanceOf(BillingManualReviewRequiredError);

    expect(razorpay.cancelSubscription).toHaveBeenCalledTimes(1);
    await expect(testPrisma.organizationBillingChange.findUniqueOrThrow({ where: { id: change.id } }))
      .resolves.toMatchObject({
        status: "FAILED",
        operationStatus: "FAILED",
        failureCategory: "MANUAL_REVIEW_REQUIRED",
        failureCode: "CANDIDATE_CANCELLATION_OUTCOME_UNKNOWN",
        resolvedAt: null,
      });

    vi.mocked(razorpay.fetchSubscription).mockResolvedValue({
      id: candidate.razorpaySubscriptionId,
      entity: "subscription",
      plan_id: candidate.razorpayPlanId,
      status: "cancelled",
      total_count: candidate.totalCount,
      quantity: candidate.quantity,
      ended_at: Math.floor(Date.now() / 1000),
    });
    const deadlineNow = new Date();
    await testPrisma.organizationSubscription.update({
      where: { id: subscription.id },
      data: { lastReconciledAt: deadlineNow },
    });
    const deadline = await BillingDeadlineService.run(deadlineNow);

    expect(deadline.retriedReplacementCancellations).toBe(1);
    expect(deadline.errors).toEqual([]);
    expect(razorpay.cancelSubscription).toHaveBeenCalledTimes(1);
    await expect(testPrisma.organizationBillingChange.findUniqueOrThrow({ where: { id: change.id } }))
      .resolves.toMatchObject({
        status: "FAILED",
        operationStatus: "FAILED",
        failureCategory: "PROVIDER_AUTHORIZATION_FAILED",
        failureCode: null,
      });
    await expect(testPrisma.organizationSubscription.findUniqueOrThrow({ where: { id: candidate.id } }))
      .resolves.toMatchObject({ pendingReplacementOrganizationId: null, status: "CANCELLED" });
  });

  it("reads provider state before retrying a definitely rejected replacement cancellation", async () => {
    const { owner, organization, branch, change, candidate, razorpay } = await setupPendingUpiReplacement(
      "definitely-rejected-replacement-cancellation"
    );
    vi.mocked(razorpay.cancelSubscription).mockReset();
    vi.mocked(razorpay.cancelSubscription).mockRejectedValueOnce(new RazorpayApiError(
      "cancellation request was rejected",
      { kind: "REQUEST", status: 400 }
    ));

    await expect(BillingReplacementService.undoReplacement(change.id, new Date(), {
      branchDisposition: "ARCHIVE",
    }))
      .rejects.toBeInstanceOf(RazorpayApiError);
    expect(razorpay.cancelSubscription).toHaveBeenCalledTimes(1);
    await expect(testPrisma.organizationBillingChange.findUniqueOrThrow({ where: { id: change.id } }))
      .resolves.toMatchObject({
        status: "FAILED",
        failureCategory: "PROVIDER_REJECTED",
        failureCode: "REPLACEMENT_UNDO_CANCELLATION_PROVIDER_REJECTED_ARCHIVE",
      });

    vi.mocked(razorpay.fetchSubscription).mockResolvedValue({
      id: candidate.razorpaySubscriptionId,
      entity: "subscription",
      plan_id: candidate.razorpayPlanId,
      status: "authenticated",
      total_count: candidate.totalCount,
      quantity: candidate.quantity,
    });
    await expect(BillingService.retryBillingOperation(owner.id, organization.id, change.id))
      .resolves.toMatchObject({ resolutionOutcome: "PROVIDER_STATE_ADOPTED" });
    expect(razorpay.fetchSubscription).toHaveBeenCalledWith(candidate.razorpaySubscriptionId);
    expect(razorpay.cancelSubscription).toHaveBeenCalledTimes(1);
    await expect(testPrisma.organizationBillingChange.findUniqueOrThrow({ where: { id: change.id } }))
      .resolves.toMatchObject({
        failureCategory: "PROVIDER_REJECTED",
        failureCode: "REPLACEMENT_UNDO_CANCELLATION_RETRY_SAFE_ARCHIVE",
      });

    vi.mocked(razorpay.cancelSubscription).mockResolvedValueOnce({
      id: candidate.razorpaySubscriptionId,
      entity: "subscription",
      plan_id: candidate.razorpayPlanId,
      status: "cancelled",
      total_count: candidate.totalCount,
      quantity: candidate.quantity,
    });
    await expect(BillingService.retryBillingOperation(owner.id, organization.id, change.id))
      .resolves.toMatchObject({
        operation: { queueStatus: "UNDONE", operationStatus: "ABANDONED" },
        resolutionOutcome: "SAFE_RETRY_SUBMITTED",
      });
    expect(razorpay.cancelSubscription).toHaveBeenCalledTimes(2);
    await expect(testPrisma.branch.findUniqueOrThrow({ where: { id: branch.id } }))
      .resolves.toMatchObject({ billingStatus: "ARCHIVED" });
  });

  it("does not let an expired worker fail or release a successor lease", async () => {
    const { owner, organization, subscription } = await setup();
    const razorpay = fakeRazorpay();
    let providerStarted!: () => void;
    let releaseProvider!: () => void;
    const started = new Promise<void>(resolve => { providerStarted = resolve; });
    const providerRelease = new Promise<void>(resolve => { releaseProvider = resolve; });
    const create = vi.mocked(razorpay.createSubscription).getMockImplementation()!;
    vi.mocked(razorpay.createSubscription).mockImplementationOnce(async input => {
      providerStarted();
      await providerRelease;
      return create(input);
    });
    setRazorpayClientForTests(razorpay);
    const change = await BillingMutationService.enqueue({
      organizationId: organization.id,
      subscriptionId: subscription.id,
      type: "QUANTITY_INCREASE",
      idempotencyKey: "lost-worker-lease",
      fromQuantity: 1,
      toQuantity: 2,
      createdByUserId: owner.id,
    });

    const processing = BillingMutationService.processNext(organization.id);
    await started;
    await testPrisma.organization.update({
      where: { id: organization.id },
      data: {
        billingMutationLeaseToken: "successor-lease",
        billingMutationLeaseUntil: new Date(Date.now() + 60_000),
      },
    });
    releaseProvider();

    await expect(processing).rejects.toThrow("Replacement provisioning lease was lost after dispatch");
    await expect(testPrisma.organization.findUniqueOrThrow({ where: { id: organization.id } }))
      .resolves.toMatchObject({ billingMutationLeaseToken: "successor-lease" });
    await expect(testPrisma.organizationBillingChange.findUniqueOrThrow({ where: { id: change.id } }))
      .resolves.toMatchObject({ status: "PROCESSING", attemptCount: 1, failedAt: null });
  });

  it("does not let a stale success overwrite a manual-review owner-visible state", async () => {
    const { owner, organization, subscription } = await setup();
    const razorpay = fakeRazorpay();
    let providerStarted!: () => void;
    let releaseProvider!: () => void;
    const started = new Promise<void>(resolve => { providerStarted = resolve; });
    const providerRelease = new Promise<void>(resolve => { releaseProvider = resolve; });
    const create = vi.mocked(razorpay.createSubscription).getMockImplementation()!;
    vi.mocked(razorpay.createSubscription).mockImplementationOnce(async input => {
      providerStarted();
      await providerRelease;
      return create(input);
    });
    setRazorpayClientForTests(razorpay);
    const change = await BillingMutationService.enqueue({
      organizationId: organization.id,
      subscriptionId: subscription.id,
      type: "QUANTITY_INCREASE",
      idempotencyKey: "manual-review-wins-over-stale-success",
      fromQuantity: 1,
      toQuantity: 2,
      createdByUserId: owner.id,
    });

    const processing = BillingMutationService.processNext(organization.id);
    await started;
    await testPrisma.organizationBillingChange.update({
      where: { id: change.id },
      data: {
        status: "FAILED",
        operationStatus: "FAILED",
        failureCategory: "MANUAL_REVIEW_REQUIRED",
        failureCode: "OWNER_VISIBLE_REVIEW",
        lastError: "Awaiting billing review",
      },
    });
    releaseProvider();

    await expect(processing).rejects.toThrow("Replacement provider identity could not be retained");
    await expect(testPrisma.organizationBillingChange.findUniqueOrThrow({ where: { id: change.id } }))
      .resolves.toMatchObject({
        status: "FAILED",
        operationStatus: "FAILED",
        failureCategory: "MANUAL_REVIEW_REQUIRED",
        failureCode: "OWNER_VISIBLE_REVIEW",
        lastError: "Awaiting billing review",
      });
  });

  it("quarantines an old provider response after the current subscription is swapped", async () => {
    const { owner, organization, subscription } = await setup();
    const razorpay = fakeRazorpay();
    let providerStarted!: () => void;
    let releaseProvider!: () => void;
    const started = new Promise<void>(resolve => { providerStarted = resolve; });
    const providerRelease = new Promise<void>(resolve => { releaseProvider = resolve; });
    const create = vi.mocked(razorpay.createSubscription).getMockImplementation()!;
    vi.mocked(razorpay.createSubscription).mockImplementationOnce(async input => {
      providerStarted();
      await providerRelease;
      return create(input);
    });
    setRazorpayClientForTests(razorpay);
    const replacement = await testPrisma.organizationSubscription.create({
      data: {
        organizationId: organization.id,
        providerMode: "TEST",
        plan: "PRO",
        amount: 499,
        amountSubunits: 49900,
        totalCount: 120,
        quantity: 7,
        razorpayPlanId: "plan_pro",
        pendingReplacementOrganizationId: null,
        replacesSubscriptionId: subscription.id,
        razorpaySubscriptionId: "sub_promoted_during_mutation",
        status: "AUTHENTICATED",
        providerPaymentMethod: "CARD",
      },
    });
    const change = await BillingMutationService.enqueue({
      organizationId: organization.id,
      subscriptionId: subscription.id,
      type: "QUANTITY_INCREASE",
      idempotencyKey: "current-slot-swapped-during-provider-call",
      fromQuantity: 1,
      toQuantity: 2,
      createdByUserId: owner.id,
    });

    const processing = BillingMutationService.processNext(organization.id);
    await started;
    await testPrisma.$transaction(async tx => {
      await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "Organization" WHERE "id" = ${organization.id} FOR UPDATE
      `;
      await tx.organizationSubscription.update({
        where: { id: subscription.id },
        data: { currentOrganizationId: null },
      });
      await tx.organizationSubscription.update({
        where: { id: replacement.id },
        data: {
          pendingReplacementOrganizationId: null,
          currentOrganizationId: organization.id,
        },
      });
    });
    releaseProvider();

    await expect(processing).rejects.toThrow("Current subscription changed while replacement was being created");
    expect(razorpay.createSubscription).toHaveBeenCalledWith(expect.objectContaining({
      quantity: 2,
    }));
    await expect(testPrisma.organizationSubscription.findUniqueOrThrow({ where: { id: replacement.id } }))
      .resolves.toMatchObject({
        currentOrganizationId: organization.id,
        razorpaySubscriptionId: "sub_promoted_during_mutation",
        status: "AUTHENTICATED",
        quantity: 7,
      });
    await expect(testPrisma.organizationBillingChange.findUniqueOrThrow({ where: { id: change.id } }))
      .resolves.toMatchObject({
        status: "FAILED",
        operationStatus: "FAILED",
        failureCategory: "MANUAL_REVIEW_REQUIRED",
        failureCode: "PROVIDER_MUTATION_OUTCOME_UNKNOWN",
      });
  });

  // These successors were already queued before card changes required a fresh
  // mandate. Reproduce durable history without bypassing the new API queue fence.
  async function seedHistoricalQueuedSuccessor(input: Parameters<typeof BillingMutationService.enqueue>[0]) {
    return testPrisma.$transaction(async tx => {
      const org = await tx.organization.update({ where: { id: input.organizationId },
        data: { billingMutationSequence: { increment: 1 } } });
      const { subscriptionId, ...fields } = input;
      return tx.organizationBillingChange.create({ data: {
        ...fields, organizationSubscriptionId: subscriptionId, sequence: org.billingMutationSequence,
        status: "QUEUED", operationStatus: "AWAITING_PROVIDER_CONFIRMATION",
      } });
    });
  }

  it("serializes scheduled-change undo and replays the next queued intent", async () => {
    const { owner, organization, subscription } = await setup();
    const razorpay = fakeRazorpay();
    setRazorpayClientForTests(razorpay);
    const scheduled = await BillingMutationService.enqueue({
      organizationId: organization.id,
      subscriptionId: subscription.id,
      type: "PLAN_DOWNGRADE",
      idempotencyKey: "undo-serialized-downgrade",
      fromPlan: "PRO",
      toPlan: "BASIC",
      fromQuantity: 1,
      toQuantity: 1,
      effectiveAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      createdByUserId: owner.id,
    });
    await stageHistoricalNativeChange(scheduled.id, "SCHEDULED");
    const branch = await testPrisma.branch.create({
      data: { organizationId: organization.id, name: "Queued after undo", billingStatus: "PENDING_ACTIVATION" },
    });
    const later = await seedHistoricalQueuedSuccessor({
      organizationId: organization.id,
      subscriptionId: subscription.id,
      branchId: branch.id,
      type: "QUANTITY_INCREASE",
      idempotencyKey: "replay-after-undo",
      fromQuantity: 1,
      toQuantity: 2,
      createdByUserId: owner.id,
    });

    let undoProviderStarted!: () => void;
    let releaseUndoProvider!: () => void;
    const undoStarted = new Promise<void>(resolve => { undoProviderStarted = resolve; });
    const undoRelease = new Promise<void>(resolve => { releaseUndoProvider = resolve; });
    vi.mocked(razorpay.cancelScheduledChanges).mockImplementationOnce(async () => {
      undoProviderStarted();
      await undoRelease;
      return {
        id: "sub_workspace",
        entity: "subscription",
        plan_id: "plan_pro",
        status: "active",
        total_count: 120,
        quantity: 1,
        has_scheduled_changes: false,
      };
    });

    const undoing = BillingMutationService.undoScheduledProviderChange(scheduled.id);
    await undoStarted;
    // The provider call is outside a DB transaction, but the organization
    // lease prevents a concurrent provider mutation from overtaking it.
    await expect(testPrisma.organization.findUniqueOrThrow({ where: { id: organization.id } }))
      .resolves.toMatchObject({ id: organization.id });
    await expect(testPrisma.organizationBillingChange.findUniqueOrThrow({ where: { id: scheduled.id } }))
      .resolves.toMatchObject({
        status: "PROCESSING",
        failureCode: "SCHEDULED_UNDO_PROCESSING",
      });
    await expect(BillingMutationService.undoScheduledProviderChange(scheduled.id))
      .rejects.toBeInstanceOf(BillingChangeInProgressError);
    await expect(BillingMutationService.processNext(organization.id)).resolves.toBeNull();
    expect(razorpay.updateSubscription).not.toHaveBeenCalled();
    releaseUndoProvider();

    await expect(undoing).resolves.toMatchObject({
      change: { id: scheduled.id, status: "UNDONE", operationStatus: "ABANDONED" },
      replayed: { id: later.id, status: "AWAITING_PAYMENT" },
    });
    expect(razorpay.cancelScheduledChanges).toHaveBeenCalledTimes(1);
    expect(razorpay.updateSubscription).not.toHaveBeenCalled();
    expect(razorpay.createSubscription).toHaveBeenCalledTimes(1);
    await expect(testPrisma.organization.findUniqueOrThrow({ where: { id: organization.id } }))
      .resolves.toMatchObject({ billingMutationLeaseToken: null, billingMutationLeaseUntil: null });
  });

  it("quarantines an accepted scheduled-change undo whose response is lost and adopts it by reconciliation", async () => {
    const { owner, organization, subscription } = await setup();
    const razorpay = fakeRazorpay();
    setRazorpayClientForTests(razorpay);
    const scheduled = await BillingMutationService.enqueue({
      organizationId: organization.id,
      subscriptionId: subscription.id,
      type: "PLAN_DOWNGRADE",
      idempotencyKey: "undo-timeout-downgrade",
      fromPlan: "PRO",
      toPlan: "BASIC",
      fromQuantity: 1,
      toQuantity: 1,
      effectiveAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      createdByUserId: owner.id,
    });
    await stageHistoricalNativeChange(scheduled.id, "SCHEDULED");
    const timeout = new RazorpayApiError("scheduled undo response was lost", { kind: "NETWORK" });
    vi.mocked(razorpay.cancelScheduledChanges).mockRejectedValueOnce(timeout);

    await expect(BillingMutationService.undoScheduledProviderChange(scheduled.id)).rejects.toBe(timeout);

    expect(razorpay.cancelScheduledChanges).toHaveBeenCalledTimes(1);
    await expect(testPrisma.organizationBillingChange.findUniqueOrThrow({ where: { id: scheduled.id } }))
      .resolves.toMatchObject({
        status: "FAILED",
        operationStatus: "FAILED",
        failureCategory: "MANUAL_REVIEW_REQUIRED",
        failureCode: "SCHEDULED_UNDO_OUTCOME_UNKNOWN",
        resolvedAt: null,
      });

    await expect(testPrisma.billingProviderAction.findUniqueOrThrow({ where: {
      organizationId_actionKey: { organizationId: organization.id, actionKey: `${scheduled.id}:UNDO_SCHEDULE` },
    } })).resolves.toMatchObject({ status: "UNKNOWN" });
    const later = await seedHistoricalQueuedSuccessor({
      organizationId: organization.id,
      subscriptionId: subscription.id,
      type: "QUANTITY_INCREASE",
      idempotencyKey: "quantity-after-recovered-undo",
      fromQuantity: 1,
      toQuantity: 2,
      createdByUserId: owner.id,
    });

    vi.mocked(razorpay.fetchSubscription).mockResolvedValueOnce({
      id: "sub_workspace",
      entity: "subscription",
      plan_id: "plan_pro",
      status: "active",
      total_count: 120,
      quantity: 1,
      has_scheduled_changes: false,
    });
    await expect(BillingMutationService.retry(scheduled.id))
      .resolves.toMatchObject({ id: scheduled.id, status: "UNDONE", operationStatus: "ABANDONED" });
    expect(razorpay.fetchSubscription).toHaveBeenCalledTimes(2);
    expect(razorpay.cancelScheduledChanges).toHaveBeenCalledTimes(1);
    await expect(testPrisma.billingProviderAction.findUniqueOrThrow({ where: {
      organizationId_actionKey: { organizationId: organization.id, actionKey: `${scheduled.id}:UNDO_SCHEDULE` },
    } })).resolves.toMatchObject({ status: "CONFIRMED", failureKind: null });
    await expect(testPrisma.organizationBillingChange.findUniqueOrThrow({ where: { id: later.id } }))
      .resolves.toMatchObject({ status: "AWAITING_PAYMENT" });
    expect(razorpay.updateSubscription).not.toHaveBeenCalled();
    expect(razorpay.createSubscription).toHaveBeenCalledTimes(1);
    expect(razorpay.createSubscription).toHaveBeenLastCalledWith(expect.objectContaining({
      quantity: 2, start_at: expect.any(Number),
    }));
    await expect(testPrisma.billingProviderAction.findUniqueOrThrow({ where: {
      organizationId_actionKey: { organizationId: organization.id, actionKey: `${later.id}:CREATE` },
    } })).resolves.toMatchObject({ status: "CONFIRMED" });
  });

  it("owner scheduled-undo retry is read-only before a separately requested plan change", async () => {
    const { owner, organization, subscription } = await setup();
    const razorpay = fakeRazorpay({ providerQuantity: 1 });
    setRazorpayClientForTests(razorpay);
    const scheduled = await BillingMutationService.enqueue({
      organizationId: organization.id,
      subscriptionId: subscription.id,
      type: "PLAN_DOWNGRADE",
      idempotencyKey: "owner-undo-lost-response",
      fromPlan: "PRO", toPlan: "BASIC", fromQuantity: 1, toQuantity: 1,
      effectiveAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      createdByUserId: owner.id,
    });
    await stageHistoricalNativeChange(scheduled.id, "SCHEDULED");
    const timeout = new RazorpayApiError("scheduled undo response was lost", { kind: "NETWORK" });
    vi.mocked(razorpay.cancelScheduledChanges).mockRejectedValueOnce(timeout);
    await expect(BillingMutationService.undoScheduledProviderChange(scheduled.id)).rejects.toBe(timeout);
    const later = await seedHistoricalQueuedSuccessor({
      organizationId: organization.id,
      subscriptionId: subscription.id,
      type: "PLAN_DOWNGRADE",
      idempotencyKey: "owner-plan-after-recovery",
      fromPlan: "PRO", toPlan: "BASIC", fromQuantity: 1, toQuantity: 1,
      createdByUserId: owner.id,
    });
    const receiptWhere = { organizationId_actionKey: {
      organizationId: organization.id, actionKey: `${scheduled.id}:UNDO_SCHEDULE`,
    } };
    const originalReceipt = await testPrisma.billingProviderAction.findUniqueOrThrow({ where: receiptWhere });
    expect(originalReceipt.status).toBe("UNKNOWN");
    vi.stubEnv("RAZORPAY_BILLING_WRITES_ENABLED", "false");

    // Owner authorization and operation scope precede any provider read.
    const otherOwner = await createUser();
    const otherOrganization = await createOrg({ ownerId: owner.id });
    await expect(BillingService.retryBillingOperation(otherOwner.id, organization.id, scheduled.id))
      .rejects.toThrow("Organization not found");
    await expect(BillingService.retryBillingOperation(owner.id, otherOrganization.id, scheduled.id))
      .rejects.toThrow("Billing operation not found");
    await expect(BillingService.retryBillingOperation(owner.id, otherOrganization.id, "nonexistent-change"))
      .rejects.toThrow("Billing operation not found");
    expect(razorpay.fetchSubscription).not.toHaveBeenCalled();

    vi.mocked(razorpay.fetchSubscription).mockResolvedValue({
      id: "sub_workspace", entity: "subscription", plan_id: "plan_pro",
      status: "active", total_count: 120, quantity: 1, has_scheduled_changes: false,
      current_start: Math.floor(Date.now() / 1000) - 60,
      current_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
      charge_at: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
    });
    await expect(BillingService.retryBillingOperation(owner.id, organization.id, scheduled.id))
      .resolves.toMatchObject({
        pending: false, resolutionOutcome: "PROVIDER_STATE_ADOPTED",
        operation: { id: scheduled.id, queueStatus: "UNDONE", operationStatus: "ABANDONED" },
      });
    await expect(testPrisma.billingProviderAction.findUniqueOrThrow({ where: receiptWhere }))
      .resolves.toMatchObject({ status: "CONFIRMED", dispatchToken: originalReceipt.dispatchToken, failureKind: null });
    await expect(testPrisma.organizationBillingChange.findUniqueOrThrow({ where: { id: later.id } }))
      .resolves.toMatchObject({ status: "QUEUED" });
    expect(razorpay.fetchSubscription).toHaveBeenCalledExactlyOnceWith("sub_workspace");
    expect(razorpay.updateSubscription).not.toHaveBeenCalled();
    expect(razorpay.cancelScheduledChanges).toHaveBeenCalledTimes(1);
    expect(razorpay.cancelSubscription).not.toHaveBeenCalled();
    expect(razorpay.createSubscription).not.toHaveBeenCalled();

    // Recovery itself did not replay the queued command. A new owner request
    // with its original idempotency key can now dispatch that command once.
    vi.stubEnv("RAZORPAY_BILLING_WRITES_ENABLED", "true");
    await expect(BillingService.changeWorkspacePlan(owner.id, organization.id, "BASIC", "owner-plan-after-recovery"))
      .resolves.toMatchObject({ purpose: "REPLACEMENT", changeId: later.id, subscriptionId: "sub_candidate",
        operation: { operationStatus: "CHECKOUT_OPEN" } });
    expect(razorpay.updateSubscription).not.toHaveBeenCalled();
    expect(razorpay.createSubscription).toHaveBeenCalledTimes(1);
    expect(razorpay.createSubscription).toHaveBeenLastCalledWith(expect.objectContaining({
      plan_id: "plan_basic", quantity: 1, start_at: expect.any(Number),
    }));
    expect(razorpay.cancelScheduledChanges).toHaveBeenCalledTimes(1);
    await expect(testPrisma.billingProviderAction.findUniqueOrThrow({ where: {
      organizationId_actionKey: { organizationId: organization.id, actionKey: `${later.id}:CREATE` },
    } })).resolves.toMatchObject({ status: "CONFIRMED" });
  }, 60_000);

  it("reconciles a definitely rejected scheduled undo before its second provider mutation", async () => {
    const { owner, organization, subscription } = await setup();
    const razorpay = fakeRazorpay();
    setRazorpayClientForTests(razorpay);
    const scheduled = await BillingMutationService.enqueue({
      organizationId: organization.id,
      subscriptionId: subscription.id,
      type: "PLAN_DOWNGRADE",
      idempotencyKey: "undo-rejected-downgrade",
      fromPlan: "PRO",
      toPlan: "BASIC",
      fromQuantity: 1,
      toQuantity: 1,
      effectiveAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      createdByUserId: owner.id,
    });
    await stageHistoricalNativeChange(scheduled.id, "SCHEDULED");
    const rejected = new RazorpayApiError("scheduled undo was rejected", {
      kind: "REQUEST",
      status: 400,
    });
    vi.mocked(razorpay.cancelScheduledChanges).mockRejectedValueOnce(rejected);

    await expect(BillingMutationService.undoScheduledProviderChange(scheduled.id)).rejects.toBe(rejected);
    await expect(testPrisma.organizationBillingChange.findUniqueOrThrow({ where: { id: scheduled.id } }))
      .resolves.toMatchObject({
        status: "SCHEDULED",
        operationStatus: "SCHEDULED",
        failureCategory: "PROVIDER_REJECTED",
        failureCode: "SCHEDULED_UNDO_PROVIDER_REJECTED",
      });

    vi.mocked(razorpay.fetchSubscription).mockResolvedValueOnce({
      id: "sub_workspace",
      entity: "subscription",
      plan_id: "plan_pro",
      status: "active",
      total_count: 120,
      quantity: 1,
      has_scheduled_changes: true,
    });
    await expect(BillingMutationService.undoScheduledProviderChange(scheduled.id))
      .resolves.toMatchObject({ change: { id: scheduled.id, status: "UNDONE" } });

    expect(razorpay.fetchSubscription).toHaveBeenCalledTimes(1);
    expect(razorpay.cancelScheduledChanges).toHaveBeenCalledTimes(2);
    expect(vi.mocked(razorpay.fetchSubscription).mock.invocationCallOrder[0])
      .toBeLessThan(vi.mocked(razorpay.cancelScheduledChanges).mock.invocationCallOrder[1]!);
  });

  it("quarantines a malformed scheduled-change undo success response", async () => {
    const { owner, organization, subscription } = await setup();
    const razorpay = fakeRazorpay();
    setRazorpayClientForTests(razorpay);
    const scheduled = await BillingMutationService.enqueue({
      organizationId: organization.id,
      subscriptionId: subscription.id,
      type: "PLAN_DOWNGRADE",
      idempotencyKey: "undo-malformed-downgrade",
      fromPlan: "PRO",
      toPlan: "BASIC",
      fromQuantity: 1,
      toQuantity: 1,
      effectiveAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      createdByUserId: owner.id,
    });
    await stageHistoricalNativeChange(scheduled.id, "SCHEDULED");
    vi.mocked(razorpay.cancelScheduledChanges).mockResolvedValueOnce(null as never);

    await expect(BillingMutationService.undoScheduledProviderChange(scheduled.id))
      .rejects.toThrow("malformed subscription mutation response");

    expect(razorpay.cancelScheduledChanges).toHaveBeenCalledTimes(1);
    await expect(testPrisma.organizationBillingChange.findUniqueOrThrow({ where: { id: scheduled.id } }))
      .resolves.toMatchObject({
        status: "FAILED",
        failureCategory: "MANUAL_REVIEW_REQUIRED",
        failureCode: "SCHEDULED_UNDO_OUTCOME_UNKNOWN",
      });
  });

  it("prioritizes unsupported-method cancellation over unresolved non-processing intent", async () => {
    const { organization, subscription } = await setup();
    const razorpay = fakeRazorpay();
    setRazorpayClientForTests(razorpay);
    await testPrisma.organizationBillingChange.create({
      data: {
        organizationId: organization.id,
        organizationSubscriptionId: subscription.id,
        sequence: 2,
        idempotencyKey: "unresolved-before-safety",
        type: "QUANTITY_INCREASE",
        status: "AWAITING_PAYMENT",
        fromQuantity: 1,
        toQuantity: 2,
      },
    });
    const safety = await testPrisma.organizationBillingChange.create({
      data: {
        organizationId: organization.id,
        organizationSubscriptionId: subscription.id,
        sequence: 3,
        idempotencyKey: "unsupported-method-safety",
        type: "UNSUPPORTED_METHOD_CANCELLATION",
        status: "QUEUED",
        fromPlan: "PRO",
        toPlan: "PRO",
        fromQuantity: 1,
        toQuantity: 1,
      },
    });

    await expect(BillingMutationService.processNext(organization.id))
      .resolves.toMatchObject({ id: safety.id, status: "APPLIED" });
    expect(razorpay.cancelSubscription).toHaveBeenCalledWith("sub_workspace", {
      cancel_at_cycle_end: false,
    });
    expect(razorpay.updateSubscription).not.toHaveBeenCalled();
  });

  it("fails closed before provider mutation or reconciliation for a wrong-mode subscription", async () => {
    const { owner, organization, subscription } = await setup();
    const razorpay = fakeRazorpay();
    setRazorpayClientForTests(razorpay);
    const change = await BillingMutationService.enqueue({
      organizationId: organization.id,
      subscriptionId: subscription.id,
      idempotencyKey: "wrong-mode-quantity",
      type: "QUANTITY_INCREASE",
      fromQuantity: 1,
      toQuantity: 2,
      createdByUserId: owner.id,
    });
    vi.stubEnv("RAZORPAY_MODE", "LIVE");
    vi.stubEnv("RAZORPAY_KEY_ID", "rzp_live_wrong_mode");
    // Exercise stored TEST rows in a valid LIVE runtime, with the injected
    // adapter and disposable database unchanged. Local LIVE is rejected earlier.
    vi.stubEnv("VERCEL_ENV", "production");

    await expect(BillingMutationService.processNext(organization.id))
      .rejects.toThrow("Subscription provider mode TEST cannot be replaced in LIVE mode");
    expect(razorpay.createSubscription).not.toHaveBeenCalled();
    expect(razorpay.updateSubscription).not.toHaveBeenCalled();
    await expect(BillingReconciliationService.reconcileByOrganization(organization.id))
      .rejects.toThrow("cannot be reconciled in LIVE mode");
    expect(razorpay.fetchSubscription).not.toHaveBeenCalled();
    await expect(testPrisma.organizationBillingChange.findUniqueOrThrow({ where: { id: change.id } }))
      .resolves.toMatchObject({ status: "FAILED", operationStatus: "FAILED" });
  });

  it("keeps the confirmed paid quantity unchanged while a prorated branch charge is unresolved", async () => {
    const { owner, organization, subscription } = await setup();
    await testPrisma.organizationSubscription.update({
      where: { id: subscription.id },
      data: { paidThrough: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
    });
    const branch = await testPrisma.branch.create({
      data: { organizationId: organization.id, name: "Pending paid branch", billingStatus: "PENDING_ACTIVATION" },
    });
    const change = await BillingMutationService.enqueue({
      organizationId: organization.id,
      subscriptionId: subscription.id,
      branchId: branch.id,
      type: "QUANTITY_INCREASE",
      idempotencyKey: "pending-paid-quantity",
      createdByUserId: owner.id,
    });
    setRazorpayClientForTests(fakeRazorpay());

    await expect(BillingMutationService.processNext(organization.id))
      .resolves.toMatchObject({ id: change.id, status: "AWAITING_PAYMENT" });
    await expect(testPrisma.organizationSubscription.findUniqueOrThrow({ where: { id: subscription.id } }))
      .resolves.toMatchObject({ quantity: 1 });
    await expect(testPrisma.branch.findUniqueOrThrow({ where: { id: branch.id } }))
      .resolves.toMatchObject({ billingStatus: "PENDING_ACTIVATION" });
    await expect(BillingExperienceService.getBillingExperience(organization.id, owner.id))
      .resolves.toMatchObject({ confirmedQuantity: 1, projectedQuantity: 2 });
  });

  it("keeps future CARD trial quantity unchanged until replacement authorization", async () => {
    const { owner, organization, subscription } = await setup();
    await testPrisma.organizationSubscription.update({
      where: { id: subscription.id },
      data: { status: "AUTHENTICATED", paidThrough: null },
    });
    const branch = await testPrisma.branch.create({
      data: { organizationId: organization.id, name: "Trial branch", billingStatus: "PENDING_ACTIVATION" },
    });
    const change = await BillingMutationService.enqueue({
      organizationId: organization.id,
      subscriptionId: subscription.id,
      branchId: branch.id,
      type: "TRIAL_SUBSCRIPTION_UPDATE",
      idempotencyKey: "future-trial-quantity",
      createdByUserId: owner.id,
    });
    setRazorpayClientForTests(fakeRazorpay({
      providerStatus: "authenticated",
      providerQuantity: 2,
      includePaidInvoice: false,
    }));

    await expect(BillingMutationService.processNext(organization.id))
      .resolves.toMatchObject({ id: change.id, status: "AWAITING_PAYMENT" });
    await expect(testPrisma.organizationSubscription.findUniqueOrThrow({ where: { id: subscription.id } }))
      .resolves.toMatchObject({ quantity: 1, paidThrough: null, status: "AUTHENTICATED" });
  });

  it("keeps the current paid quantity while a branch reduction is scheduled for cycle end", async () => {
    const { owner, organization, subscription } = await setup();
    const secondBranch = await testPrisma.branch.create({
      data: { organizationId: organization.id, name: "Scheduled removal", billingStatus: "REMOVAL_SCHEDULED" },
    });
    await testPrisma.organizationSubscription.update({
      where: { id: subscription.id },
      data: {
        quantity: 2,
        paidThrough: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    const change = await BillingMutationService.enqueue({
      organizationId: organization.id,
      subscriptionId: subscription.id,
      branchId: secondBranch.id,
      type: "BRANCH_REMOVAL",
      fromQuantity: 2,
      toQuantity: 1,
      effectiveAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      idempotencyKey: "scheduled-paid-reduction",
      createdByUserId: owner.id,
    });
    const razorpay = fakeRazorpay({ undoQuantity: 2 });
    setRazorpayClientForTests(razorpay);

    await stageHistoricalNativeChange(change.id, "SCHEDULED");
    await expect(testPrisma.organizationSubscription.findUniqueOrThrow({ where: { id: subscription.id } }))
      .resolves.toMatchObject({ quantity: 2 });
    await expect(BranchService.undoBillingRemoval(owner.id, secondBranch.id))
      .resolves.toEqual({ undone: true });
    await expect(testPrisma.organizationBillingChange.findUniqueOrThrow({ where: { id: change.id } }))
      .resolves.toMatchObject({ status: "UNDONE", operationStatus: "ABANDONED" });
    await expect(testPrisma.branch.findUniqueOrThrow({ where: { id: secondBranch.id } }))
      .resolves.toMatchObject({ billingStatus: "ACTIVE" });
    expect(razorpay.cancelScheduledChanges).toHaveBeenCalledTimes(1);
  });

  it("quarantines a paid quantity increase backed only by an older paid invoice", async () => {
    const { owner, organization, subscription } = await setup();
    const paidThroughBefore = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await testPrisma.organizationSubscription.update({
      where: { id: subscription.id },
      data: { paidThrough: paidThroughBefore },
    });
    const branch = await testPrisma.branch.create({
      data: { organizationId: organization.id, name: "Unconfirmed branch", billingStatus: "PENDING_ACTIVATION" },
    });
    const razorpay = fakeRazorpay({
      paidAt: Math.floor(Date.now() / 1000) - 60 * 60,
      providerQuantity: 2,
    });
    setRazorpayClientForTests(razorpay);
    const change = await BillingMutationService.enqueue({
      organizationId: organization.id,
      subscriptionId: subscription.id,
      branchId: branch.id,
      idempotencyKey: "stale-invoice-quantity",
      type: "QUANTITY_INCREASE",
      fromQuantity: 1,
      toQuantity: 2,
      createdByUserId: owner.id,
    });
    await stageHistoricalNativeChange(change.id);

    await expect(BillingReconciliationService.reconcileByOrganization(organization.id, {
      paymentId: "pay_paid",
    })).rejects.toBeInstanceOf(BillingManualReviewRequiredError);

    await expect(testPrisma.organizationSubscription.findUniqueOrThrow({ where: { id: subscription.id } }))
      .resolves.toMatchObject({ quantity: 1, paidThrough: paidThroughBefore });
    await expect(testPrisma.branch.findUniqueOrThrow({ where: { id: branch.id } }))
      .resolves.toMatchObject({ billingStatus: "PENDING_ACTIVATION" });
    await expect(testPrisma.organizationBillingChange.findUniqueOrThrow({ where: { id: change.id } }))
      .resolves.toMatchObject({
        status: "FAILED",
        failureCategory: "MANUAL_REVIEW_REQUIRED",
        failureCode: "STALE_SETTLEMENT",
      });
    expect(razorpay.updateSubscription).not.toHaveBeenCalled();
  });

  it("does not activate a pending branch until payment reconciliation", async () => {
    const { owner, organization, subscription } = await setup();
    const branch = await testPrisma.branch.create({
      data: { organizationId: organization.id, name: "Paid Branch", billingStatus: "PENDING_ACTIVATION" },
    });
    setRazorpayClientForTests(fakeRazorpay({ providerQuantity: 2 }));
    const change = await BillingMutationService.enqueue({
      organizationId: organization.id,
      subscriptionId: subscription.id,
      branchId: branch.id,
      idempotencyKey: "paid-branch",
      type: "QUANTITY_INCREASE",
      fromQuantity: 1,
      toQuantity: 2,
      createdByUserId: owner.id,
    });
    await stageHistoricalNativeChange(change.id);

    const before = await testPrisma.branch.findUniqueOrThrow({ where: { id: branch.id } });
    expect(before.billingStatus).toBe("PENDING_ACTIVATION");
    const result = await BillingReconciliationService.reconcileByOrganization(organization.id, {
      paymentId: "pay_paid",
    });

    expect(result.confirmedPaidPeriod).toBe(true);
    await expect(testPrisma.branch.findUniqueOrThrow({ where: { id: branch.id } }))
      .resolves.toMatchObject({ billingStatus: "ACTIVE" });
    await expect(testPrisma.organizationBillingChange.findUniqueOrThrow({ where: { id: change.id } }))
      .resolves.toMatchObject({ status: "APPLIED", providerPaymentId: "pay_paid" });
    expect(result.subscription.paidThrough).not.toBeNull();
  });

  it("keeps Standard until a scheduled Basic downgrade is confirmed at the provider", async () => {
    const { owner, organization, subscription } = await setup();
    const razorpay = fakeRazorpay({ providerPlanId: "plan_basic", providerQuantity: 1 });
    setRazorpayClientForTests(razorpay);
    const now = new Date();
    const change = await BillingMutationService.enqueue({
      organizationId: organization.id,
      subscriptionId: subscription.id,
      idempotencyKey: "downgrade-basic",
      type: "PLAN_DOWNGRADE",
      fromPlan: "PRO",
      toPlan: "BASIC",
      fromQuantity: 1,
      toQuantity: 1,
      effectiveAt: now,
      createdByUserId: owner.id,
    });

    await stageHistoricalNativeChange(change.id, "SCHEDULED");
    expect(razorpay.createPlan).not.toHaveBeenCalled();
    await expect(testPrisma.saasRazorpayPlan.findFirst({
      where: { providerMode: "TEST", plan: "BASIC", active: true },
    })).resolves.toMatchObject({ razorpayPlanId: "plan_basic", amountSubunits: 9900 });
    await expect(testPrisma.organizationSubscription.findUniqueOrThrow({ where: { id: subscription.id } }))
      .resolves.toMatchObject({ plan: "PRO" });
    await expect(testPrisma.organizationBillingChange.findUniqueOrThrow({ where: { id: change.id } }))
      .resolves.toMatchObject({ status: "SCHEDULED" });

    await BillingReconciliationService.reconcileByOrganization(organization.id, { paymentId: "pay_paid", now });

    await expect(testPrisma.organizationSubscription.findUniqueOrThrow({ where: { id: subscription.id } }))
      .resolves.toMatchObject({ plan: "BASIC", amount: 99, razorpayPlanId: "plan_basic" });
    await expect(testPrisma.organizationBillingChange.findUniqueOrThrow({ where: { id: change.id } }))
      .resolves.toMatchObject({ status: "APPLIED" });
  });

  it("redeems one offer and records one paid period across duplicate reconciliation", async () => {
    const { organization, subscription, commercialIntent } = await setup();
    const offer = await testPrisma.billingOffer.create({
      data: {
        providerMode: "TEST",
        name: "Launch offer",
        plan: "PRO",
        razorpayOfferId: "offer_launch",
        discountType: "PERCENTAGE",
        discountValue: 20,
        durationType: "LIMITED_CYCLES",
        durationCycles: 3,
      },
    });
    await testPrisma.organizationOfferGrant.create({
      data: {
        organizationId: organization.id,
        billingOfferId: offer.id,
        status: "RESERVED",
        subscriptionId: subscription.razorpaySubscriptionId,
      },
    });
    await testPrisma.organizationSubscription.update({
      where: { id: subscription.id },
      data: { billingOfferId: offer.id },
    });
    await testPrisma.organizationBillingChange.update({
      where: { id: commercialIntent.id },
      data: {
        authorizedRazorpayOfferId: "offer_launch",
        authorizedExpectedAmountSubunits: 39920,
        authorizedOfferValidThroughPaidCount: 3,
      },
    });
    setRazorpayClientForTests(fakeRazorpay({
      providerQuantity: 1,
      providerOfferId: "offer_launch",
      paymentAmountSubunits: 39920,
    }));

    await BillingReconciliationService.reconcileByOrganization(organization.id, { paymentId: "pay_paid" });
    await BillingReconciliationService.reconcileByOrganization(organization.id, { paymentId: "pay_paid" });

    await expect(testPrisma.organizationOfferGrant.findUniqueOrThrow({
      where: { organizationId_billingOfferId: { organizationId: organization.id, billingOfferId: offer.id } },
    })).resolves.toMatchObject({ status: "REDEEMED" });
    await expect(testPrisma.organizationSubscriptionInvoice.count({ where: { organizationId: organization.id } }))
      .resolves.toBe(1);
    await expect(testPrisma.organizationSubscriptionHistory.count({
      where: { organizationId: organization.id, event: "provider_paid_period_confirmed" },
    })).resolves.toBe(1);
  });
});
