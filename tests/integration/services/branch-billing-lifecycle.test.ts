import { createHmac } from "node:crypto";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BranchService } from "@/services/branch.service";
import { BillingService } from "@/services/billing.service";
import { EntitlementService } from "@/services/entitlement.service";
import { buildCommercialIntentSnapshot } from "@/services/billingCommercialEvidence.service";
import { BillingChangeInProgressError } from "@/lib/billingErrors";
import { setRazorpayClientForTests, type RazorpayPayment, type RazorpayPlanCatalogApiClient, type RazorpaySubscription } from "@/lib/razorpay";
import { createBranch, createOrg, createSaasSubscription, createUser } from "@/tests/factories";
import { disconnectDatabase, resetDatabase, testPrisma } from "@/tests/setup/db";

describe("workspace branch billing lifecycle", () => {
  beforeEach(async () => { await resetDatabase(); });
  afterEach(() => { setRazorpayClientForTests(null); vi.unstubAllEnvs(); vi.restoreAllMocks(); });
  afterAll(async () => { await disconnectDatabase(); });

  async function trialOrganization() {
    const owner = await createUser();
    const organization = await createOrg({ ownerId: owner.id, billingModelVersion: "WORKSPACE_V2" });
    const first = await createBranch({ organizationId: organization.id, name: "First" });
    const trialEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
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
    return { owner, organization, first, trialEndsAt };
  }

  async function cardWorkspace(trial: boolean, quantity = 1) {
    vi.stubEnv("RAZORPAY_MULTI_METHOD_SUBSCRIPTIONS_ENABLED", "false");
    vi.stubEnv("RAZORPAY_BILLING_WRITES_ENABLED", "true");
    vi.stubEnv("RAZORPAY_MODE", "TEST");
    vi.stubEnv("RAZORPAY_KEY_ID", "rzp_test_branchfixture");
    vi.stubEnv("RAZORPAY_KEY_SECRET", "branch-fixture-secret");
    const owner = await createUser();
    const organization = await createOrg({ ownerId: owner.id, billingModelVersion: "WORKSPACE_V2" });
    const branches = [];
    for (let index = 0; index < quantity; index += 1) {
      branches.push(await createBranch({ organizationId: organization.id, name: `Existing ${index + 1}` }));
    }
    const boundary = new Date((Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60) * 1000);
    if (trial) await testPrisma.ownerTrialGrant.create({ data: {
      ownerId: owner.id, organizationId: organization.id, source: "ONBOARDING", status: "ACTIVE",
      trialStartedAt: new Date(), trialEndsAt: boundary, consumedAt: new Date(),
    } });
    const created = await createSaasSubscription({ organizationId: organization.id, plan: "PRO",
      status: trial ? "AUTHENTICATED" : "ACTIVE", confirmedPaidPeriod: !trial, paidThrough: trial ? null : boundary });
    // Scale the complete synthetic paid tuple together, preserving the same
    // evidence requirements as a real previously settled two-branch period.
    if (!trial && quantity !== 1) {
      await testPrisma.organizationBillingChange.updateMany({ where: { organizationSubscriptionId: created.id }, data: {
        fromQuantity: quantity, toQuantity: quantity, authorizedQuantity: quantity,
        authorizedGrossAmountSubunits: created.amountSubunits * quantity,
        authorizedExpectedAmountSubunits: created.amountSubunits * quantity,
      } });
      await testPrisma.organizationSubscriptionInvoice.updateMany({ where: { organizationSubscriptionId: created.id }, data: {
        providerQuantity: quantity, amountSubunits: created.amountSubunits * quantity,
        amountPaidSubunits: created.amountSubunits * quantity, paymentAmountSubunits: created.amountSubunits * quantity,
      } });
    }
    const source = await testPrisma.organizationSubscription.update({ where: { id: created.id }, data: {
      quantity, providerPaymentMethod: "CARD", ...(trial ? { currentStart: null, currentEnd: null, providerStartAt: boundary } : {}),
    } });
    if (trial) {
      const authorization = await testPrisma.organizationBillingChange.create({ data: {
        organizationId: organization.id, organizationSubscriptionId: source.id, sequence: 1,
        idempotencyKey: `trial-source-authorization:${organization.id}`, type: "SUBSCRIPTION_AUTHORIZATION",
        status: "APPLIED", operationStatus: "APPLIED", fromPlan: source.plan, toPlan: source.plan,
        fromQuantity: quantity, toQuantity: quantity, providerConfirmedAt: new Date(), resolvedAt: new Date(),
        authorizedProviderStartAt: boundary, authorizedTotalCount: source.totalCount,
        ...buildCommercialIntentSnapshot({ providerMode: "TEST", sourceRazorpaySubscriptionId: source.razorpaySubscriptionId,
          razorpaySubscriptionId: source.razorpaySubscriptionId, sourceRazorpayPlanId: source.razorpayPlanId,
          razorpayPlanId: source.razorpayPlanId, plan: source.plan, quantity, unitAmountSubunits: source.amountSubunits,
          currency: source.currency, period: source.period, interval: source.interval }),
      } });
      await testPrisma.organizationSubscription.update({ where: { id: source.id }, data: { confirmedCommercialIntentChangeId: authorization.id } });
      await testPrisma.organization.update({ where: { id: organization.id }, data: { billingMutationSequence: 1 } });
    }
    const candidates = new Map<string, RazorpaySubscription>();
    let payment: RazorpayPayment | null = null;
    const provider: RazorpayPlanCatalogApiClient = {
      createOrder: vi.fn(async () => { throw new Error("Unexpected order creation"); }),
      fetchOrderPayments: vi.fn(async () => ({ entity: "collection" as const, count: 0, items: [] })),
      capturePayment: vi.fn(async () => { throw new Error("Unexpected payment capture"); }),
      fetchPayment: vi.fn(async id => { if (!payment || payment.id !== id) throw new Error("Unknown synthetic payment"); return payment; }),
      createPlan: vi.fn(async input => ({ id: source.razorpayPlanId, entity: "plan" as const, period: input.period, interval: input.interval, item: input.item, notes: input.notes })),
      fetchPlan: vi.fn(async id => ({ id, entity: "plan" as const, period: "monthly", interval: 1,
        item: { name: "Lab Lords Standard", amount: 49_900, currency: "INR" } })),
      listPlans: vi.fn(async () => ({ entity: "collection" as const, count: 0, items: [] })),
      listSubscriptions: vi.fn(async () => ({ entity: "collection" as const, count: candidates.size, items: [...candidates.values()] })),
      createSubscription: vi.fn(async input => {
        const candidate: RazorpaySubscription = { id: `sub_branchcandidate${candidates.size + 1}`, entity: "subscription",
          plan_id: input.plan_id, status: "created", quantity: input.quantity, total_count: input.total_count,
          paid_count: 0, offer_id: null, start_at: input.start_at, expire_by: input.expire_by, notes: input.notes };
        candidates.set(candidate.id, candidate);
        return candidate;
      }),
      fetchSubscription: vi.fn(async id => {
        if (candidates.has(id)) return candidates.get(id)!;
        if (id !== source.razorpaySubscriptionId) throw new Error("Unknown synthetic subscription");
        return { id, entity: "subscription" as const, plan_id: source.razorpayPlanId, status: trial ? "authenticated" : "active",
          quantity: source.quantity, total_count: source.totalCount, paid_count: trial ? 0 : 1, offer_id: null,
          start_at: trial ? boundary.getTime() / 1000 : undefined,
          current_start: source.currentStart ? Math.floor(source.currentStart.getTime() / 1000) : undefined,
          current_end: source.currentEnd ? Math.floor(source.currentEnd.getTime() / 1000) : undefined,
          payment_method: "card", has_scheduled_changes: false };
      }),
      fetchSubscriptionInvoices: vi.fn(async () => ({ entity: "collection" as const, count: 0, items: [] })),
      updateSubscription: vi.fn(async () => { throw new Error("Native card update must not be used"); }),
      cancelSubscription: vi.fn(async () => { throw new Error("Source must not be cancelled before the undo cutoff"); }),
      cancelScheduledChanges: vi.fn(async () => { throw new Error("No native change is scheduled"); }),
    };
    setRazorpayClientForTests(provider);
    async function authorize(changeId: string, subscriptionId: string) {
      const candidate = candidates.get(subscriptionId);
      if (!candidate) throw new Error("Replacement candidate missing");
      candidate.status = "authenticated";
      candidate.payment_method = "card";
      const paymentId = "pay_branchauthorization";
      payment = { id: paymentId, entity: "payment", amount: 500, currency: "INR", status: "authorized", captured: false,
        order_id: null, invoice_id: null, subscription_id: subscriptionId, method: "card", created_at: Math.floor(Date.now() / 1000) };
      return BillingService.verifySubscriptionSuccess(owner.id, organization.id, { changeId,
        razorpay_subscription_id: subscriptionId, razorpay_payment_id: paymentId,
        razorpay_signature: createHmac("sha256", "branch-fixture-secret").update(`${paymentId}|${subscriptionId}`).digest("hex"),
      });
    }
    return { owner, organization, branches, source, boundary, provider, authorize };
  }

  it("keeps a future-start CARD trial branch pending until signed replacement authorization without extending trial", async () => {
    const f = await cardWorkspace(true);
    const input = { organizationId: f.organization.id, userId: f.owner.id, name: "Card trial addition",
      contactPhone: "9876543210", idempotencyKey: "card-trial-branch" };
    const branch = await BranchService.createBranchForOrg(input);
    expect(branch).toMatchObject({ billingStatus: "PENDING_ACTIVATION", action: "CHECKOUT_REQUIRED" });
    await expect(EntitlementService.assertBranchWritable(branch.id)).rejects.toThrow("awaiting provider-confirmed billing activation");
    const change = await testPrisma.organizationBillingChange.findUniqueOrThrow({ where: { id: branch.billingChangeId! }, include: { replacementSubscription: true } });
    expect(change).toMatchObject({ type: "TRIAL_SUBSCRIPTION_UPDATE", status: "AWAITING_PAYMENT", effectiveAt: f.boundary,
      replacementSubscription: { status: "CREATED", quantity: 2, providerStartAt: f.boundary, paidThrough: null } });
    expect((await BranchService.createBranchForOrg(input)).billingChangeId).toBe(change.id);
    expect(f.provider.createSubscription).toHaveBeenCalledTimes(1);
    await expect(f.authorize(change.id, change.replacementSubscription!.razorpaySubscriptionId)).resolves.toMatchObject({ verified: true });
    await expect(testPrisma.branch.findUniqueOrThrow({ where: { id: branch.id } })).resolves.toMatchObject({ billingStatus: "ACTIVE" });
    await expect(EntitlementService.assertBranchWritable(branch.id)).resolves.toBeDefined();
    await expect(testPrisma.ownerTrialGrant.findUniqueOrThrow({ where: { ownerId: f.owner.id } })).resolves.toMatchObject({ trialEndsAt: f.boundary });
    await expect(testPrisma.organizationSubscription.findUniqueOrThrow({ where: { id: f.source.id } }))
      .resolves.toMatchObject({ quantity: 1, providerStartAt: f.boundary, paidThrough: null, currentOrganizationId: f.organization.id });
    await expect(testPrisma.organizationSubscription.findUniqueOrThrow({ where: { id: change.replacementSubscriptionId! } }))
      .resolves.toMatchObject({ paidThrough: null, pendingReplacementOrganizationId: f.organization.id });
    expect(f.provider.updateSubscription).not.toHaveBeenCalled();
    expect(f.provider.cancelSubscription).not.toHaveBeenCalled();
  });

  async function pendingCardTrialBranch(key: string) {
    const f = await cardWorkspace(true);
    const branch = await BranchService.createBranchForOrg({ organizationId: f.organization.id, userId: f.owner.id,
      name: "Pending trial branch", contactPhone: "9876543210", idempotencyKey: key });
    const change = await testPrisma.organizationBillingChange.findUniqueOrThrow({
      where: { id: branch.billingChangeId! }, include: { replacementSubscription: true },
    });
    if (!change.replacementSubscription) throw new Error("Trial replacement candidate missing");
    return { ...f, branch, change, candidate: change.replacementSubscription };
  }

  it("retries the same pending trial branch Checkout while rejecting another workspace owner", async () => {
    const f = await pendingCardTrialBranch("trial-branch-retry");
    const foreignOwner = await createUser();
    await createOrg({ ownerId: foreignOwner.id });
    await expect(BranchService.retryPendingActivation(foreignOwner.id, f.branch.id)).rejects.toThrow();
    await expect(BranchService.discardPendingActivation(foreignOwner.id, f.branch.id)).rejects.toThrow();
    for (let retry = 0; retry < 2; retry += 1) {
      await expect(BranchService.retryPendingActivation(f.owner.id, f.branch.id)).resolves.toMatchObject({
        action: "CHECKOUT_REQUIRED", change: { id: f.change.id, type: "TRIAL_SUBSCRIPTION_UPDATE",
          replacementSubscriptionId: f.candidate.id },
      });
    }
    expect(f.provider.createSubscription).toHaveBeenCalledTimes(1);
    expect(f.provider.updateSubscription).not.toHaveBeenCalled();
    expect(f.provider.cancelSubscription).not.toHaveBeenCalled();
    await expect(testPrisma.branch.findUniqueOrThrow({ where: { id: f.branch.id } }))
      .resolves.toMatchObject({ billingStatus: "PENDING_ACTIVATION" });
  });

  it("discards a pending trial branch only after confirmed candidate cancellation", async () => {
    const f = await pendingCardTrialBranch("trial-branch-discard");
    const candidate = await f.provider.fetchSubscription(f.candidate.razorpaySubscriptionId);
    vi.mocked(f.provider.cancelSubscription).mockResolvedValue({ ...candidate, status: "cancelled" });
    await expect(BranchService.discardPendingActivation(f.owner.id, f.branch.id)).resolves.toEqual({ archived: true });
    expect(f.provider.cancelSubscription).toHaveBeenCalledExactlyOnceWith(f.candidate.razorpaySubscriptionId,
      { cancel_at_cycle_end: false });
    await expect(testPrisma.organizationBillingChange.findUniqueOrThrow({ where: { id: f.change.id } }))
      .resolves.toMatchObject({ status: "UNDONE", operationStatus: "ABANDONED" });
    await expect(testPrisma.branch.findUniqueOrThrow({ where: { id: f.branch.id } }))
      .resolves.toMatchObject({ billingStatus: "ARCHIVED" });
    await expect(testPrisma.organizationSubscription.findUniqueOrThrow({ where: { id: f.candidate.id } }))
      .resolves.toMatchObject({ status: "CANCELLED", pendingReplacementOrganizationId: null, paidThrough: null });
    await expect(testPrisma.organizationSubscription.findUniqueOrThrow({ where: { id: f.source.id } }))
      .resolves.toMatchObject({ status: "AUTHENTICATED", quantity: 1, providerStartAt: f.boundary, paidThrough: null });
    await expect(testPrisma.ownerTrialGrant.findUniqueOrThrow({ where: { ownerId: f.owner.id } }))
      .resolves.toMatchObject({ trialEndsAt: f.boundary });
    expect(f.provider.updateSubscription).not.toHaveBeenCalled();
  });

  it.each(["lease", "manual-review"] as const)("holds pending trial branch discard during %s", async state => {
    const f = await pendingCardTrialBranch(`trial-branch-discard-${state}`);
    if (state === "lease") await testPrisma.organization.update({ where: { id: f.organization.id }, data: {
      billingMutationLeaseToken: "another-billing-operation", billingMutationLeaseUntil: new Date(Date.now() + 60_000),
    } });
    else await testPrisma.organizationBillingChange.update({ where: { id: f.change.id }, data: {
      status: "FAILED", failureCategory: "MANUAL_REVIEW_REQUIRED", failureCode: "PROVIDER_MUTATION_OUTCOME_UNKNOWN",
    } });
    await expect(BranchService.discardPendingActivation(f.owner.id, f.branch.id)).rejects.toBeInstanceOf(BillingChangeInProgressError);
    await expect(testPrisma.branch.findUniqueOrThrow({ where: { id: f.branch.id } }))
      .resolves.toMatchObject({ billingStatus: "PENDING_ACTIVATION", billingArchivedAt: null });
    expect(f.provider.cancelSubscription).not.toHaveBeenCalled();
    expect(f.provider.createSubscription).toHaveBeenCalledTimes(1);
  });

  it("holds a pending trial branch when its discard response is lost and never repeats cancellation", async () => {
    const f = await pendingCardTrialBranch("trial-branch-discard-response-loss");
    vi.mocked(f.provider.cancelSubscription).mockRejectedValueOnce(new Error("Candidate cancellation response lost"));
    await expect(BranchService.discardPendingActivation(f.owner.id, f.branch.id)).rejects.toThrow();
    await expect(BranchService.discardPendingActivation(f.owner.id, f.branch.id)).rejects.toBeInstanceOf(BillingChangeInProgressError);
    await expect(testPrisma.organizationBillingChange.findUniqueOrThrow({ where: { id: f.change.id } }))
      .resolves.toMatchObject({ status: "FAILED", failureCategory: "MANUAL_REVIEW_REQUIRED" });
    await expect(testPrisma.branch.findUniqueOrThrow({ where: { id: f.branch.id } }))
      .resolves.toMatchObject({ billingStatus: "PENDING_ACTIVATION", billingArchivedAt: null });
    expect(f.provider.cancelSubscription).toHaveBeenCalledTimes(1);
  });

  it.each(["QUEUED", "REJECTED", "MANUAL_REVIEW", "UNKNOWN_FAILURE", "UNKNOWN_ACTION", "ADMITTED_WITHOUT_RECEIPT"] as const)(
    "discards a pending trial branch without a candidate only when safe (%s)", async state => {
      const f = await cardWorkspace(true);
      const branch = await createBranch({ organizationId: f.organization.id, name: "Unprovisioned trial branch" });
      await testPrisma.branch.update({ where: { id: branch.id }, data: { billingStatus: "PENDING_ACTIVATION" } });
      const change = await testPrisma.organizationBillingChange.create({ data: {
        organizationId: f.organization.id, organizationSubscriptionId: f.source.id, branchId: branch.id,
        sequence: 2, idempotencyKey: `trial-unprovisioned-${state}`, type: "TRIAL_SUBSCRIPTION_UPDATE",
        status: state === "QUEUED" ? "QUEUED" : "FAILED", fromQuantity: 1, toQuantity: 2,
        failureCategory: state === "REJECTED" || state === "UNKNOWN_ACTION" || state === "ADMITTED_WITHOUT_RECEIPT"
          ? "PROVIDER_REJECTED" : state === "MANUAL_REVIEW" ? "MANUAL_REVIEW_REQUIRED" : null,
        providerMutationAdmittedAt: state === "ADMITTED_WITHOUT_RECEIPT" ? new Date() : null,
      } });
      if (state === "REJECTED" || state === "UNKNOWN_ACTION") await testPrisma.billingProviderAction.create({ data: {
        organizationId: f.organization.id, changeId: change.id, actionKey: `${change.id}:CREATE_REPLACEMENT`,
        providerMode: "TEST", purpose: "CREATE_REPLACEMENT", requestHash: "synthetic-request", request: {},
        status: state === "REJECTED" ? "REJECTED" : "UNKNOWN", dispatchToken: `trial-discard-${state}`,
      } });
      const safe = state === "QUEUED" || state === "REJECTED";
      if (safe) await expect(BranchService.discardPendingActivation(f.owner.id, branch.id)).resolves.toEqual({ archived: true });
      else await expect(BranchService.discardPendingActivation(f.owner.id, branch.id)).rejects.toBeInstanceOf(BillingChangeInProgressError);
      await expect(testPrisma.branch.findUniqueOrThrow({ where: { id: branch.id } })).resolves.toMatchObject({
        billingStatus: safe ? "ARCHIVED" : "PENDING_ACTIVATION",
      });
      await expect(testPrisma.organizationBillingChange.findUniqueOrThrow({ where: { id: change.id } })).resolves.toMatchObject({
        status: safe ? "SUPERSEDED" : "FAILED",
      });
      expect(f.provider.createSubscription).not.toHaveBeenCalled();
      expect(f.provider.cancelSubscription).not.toHaveBeenCalled();
      expect(f.provider.updateSubscription).not.toHaveBeenCalled();
    }
  );

  it("requires replacement Checkout for paid CARD branch addition while preserving confirmed paid quantity", async () => {
    const f = await cardWorkspace(false);
    const branch = await BranchService.createBranchForOrg({ organizationId: f.organization.id, userId: f.owner.id,
      name: "Paid card addition", contactPhone: "9876543210", idempotencyKey: "card-paid-addition" });
    expect(branch).toMatchObject({ billingStatus: "PENDING_ACTIVATION", action: "CHECKOUT_REQUIRED" });
    await expect(EntitlementService.assertBranchWritable(branch.id)).rejects.toThrow("awaiting provider-confirmed billing activation");
    const change = await testPrisma.organizationBillingChange.findUniqueOrThrow({ where: { id: branch.billingChangeId! }, include: { replacementSubscription: true } });
    expect(change).toMatchObject({ type: "QUANTITY_INCREASE", status: "AWAITING_PAYMENT", fromQuantity: 1, toQuantity: 2,
      replacementSubscription: { status: "CREATED", quantity: 2, paidThrough: null } });
    await expect(testPrisma.organizationSubscription.findUniqueOrThrow({ where: { id: f.source.id } }))
      .resolves.toMatchObject({ quantity: 1, paidThrough: f.source.paidThrough, lastConfirmedInvoiceId: f.source.lastConfirmedInvoiceId });
    await expect(EntitlementService.assertBranchWritable(f.branches[0].id)).resolves.toBeDefined();
    expect(f.provider.createSubscription).toHaveBeenCalledTimes(1);
    expect(f.provider.updateSubscription).not.toHaveBeenCalled();
    expect(f.provider.cancelSubscription).not.toHaveBeenCalled();
  });

  it("requires replacement Checkout for paid CARD branch removal without reducing the current paid mandate", async () => {
    const f = await cardWorkspace(false, 2);
    const result = await BranchService.scheduleBillingRemoval(f.owner.id, f.branches[1].id, "card-paid-removal");
    expect(result).toMatchObject({ action: "CHECKOUT_REQUIRED", branch: { billingStatus: "REMOVAL_SCHEDULED" },
      change: { type: "BRANCH_REMOVAL", status: "AWAITING_PAYMENT", fromQuantity: 2, toQuantity: 1 } });
    await expect(testPrisma.organizationSubscription.findUniqueOrThrow({ where: { id: result.change.replacementSubscriptionId! } }))
      .resolves.toMatchObject({ status: "CREATED", quantity: 1, paidThrough: null });
    await expect(testPrisma.organizationSubscription.findUniqueOrThrow({ where: { id: f.source.id } }))
      .resolves.toMatchObject({ quantity: 2, paidThrough: f.source.paidThrough, lastConfirmedInvoiceId: f.source.lastConfirmedInvoiceId });
    await expect(EntitlementService.assertBranchWritable(f.branches[0].id)).resolves.toBeDefined();
    expect(f.provider.createSubscription).toHaveBeenCalledTimes(1);
    expect(f.provider.updateSubscription).not.toHaveBeenCalled();
    expect(f.provider.cancelSubscription).not.toHaveBeenCalled();
  });

  it("adds active trial branches without extending the owner trial", async () => {
    const { owner, organization, trialEndsAt } = await trialOrganization();
    const branch = await BranchService.createBranchForOrg({
      organizationId: organization.id,
      userId: owner.id,
      name: "Second",
      contactPhone: "9876543210",
      idempotencyKey: "trial-second-branch",
    });

    expect(branch.billingStatus).toBe("ACTIVE");
    await expect(testPrisma.ownerTrialGrant.findUniqueOrThrow({ where: { ownerId: owner.id } }))
      .resolves.toMatchObject({ trialEndsAt });
  });

  it("replays the same branch-create key to the original branch and change", async () => {
    const { owner, organization } = await trialOrganization();
    const input = {
      organizationId: organization.id,
      userId: owner.id,
      name: "Replay-safe branch",
      contactPhone: "9876543210",
      city: "Delhi",
      defaultFee: 1200,
      idempotencyKey: "create-replay-safe-branch",
    };

    const first = await BranchService.createBranchForOrg(input);
    const replay = await BranchService.createBranchForOrg(input);

    expect(replay.id).toBe(first.id);
    expect(replay.billingChangeId).toBe(first.billingChangeId);
    await expect(testPrisma.branch.count({ where: { organizationId: organization.id } })).resolves.toBe(2);
    await expect(testPrisma.organizationBillingChange.count({
      where: { idempotencyKey: input.idempotencyKey },
    })).resolves.toBe(1);
  });

  it("rejects a reused branch-create key when persisted details differ", async () => {
    const { owner, organization } = await trialOrganization();
    const input = {
      organizationId: organization.id,
      userId: owner.id,
      name: "Original branch",
      contactPhone: "9876543210",
      city: "Delhi",
      defaultFee: 1200,
      idempotencyKey: "create-payload-mismatch",
    };
    await BranchService.createBranchForOrg(input);

    await expect(BranchService.createBranchForOrg({ ...input, name: "Different branch" }))
      .rejects.toThrow("different branch details");
    await expect(testPrisma.branch.count({ where: { organizationId: organization.id } })).resolves.toBe(2);
  });

  it("rolls back branch creation when its atomic billing-change insert fails", async () => {
    const { owner, organization } = await trialOrganization();
    await testPrisma.organization.update({
      where: { id: organization.id },
      data: { billingMutationSequence: 0 },
    });
    await testPrisma.organizationBillingChange.create({
      data: {
        organizationId: organization.id,
        sequence: 1,
        idempotencyKey: "existing-sequence-owner",
        type: "LEGACY_TRANSITION",
        status: "APPLIED",
        operationStatus: "APPLIED",
      },
    });

    await expect(BranchService.createBranchForOrg({
      organizationId: organization.id,
      userId: owner.id,
      name: "Must roll back",
      contactPhone: "9876543210",
      idempotencyKey: "create-sequence-conflict",
    })).rejects.toThrow();

    await expect(testPrisma.branch.count({ where: { organizationId: organization.id } })).resolves.toBe(1);
    await expect(testPrisma.organization.findUniqueOrThrow({ where: { id: organization.id } }))
      .resolves.toMatchObject({ billingMutationSequence: 0 });
  });

  it("makes an unconverted V2 organization read-only", async () => {
    const owner = await createUser();
    const organization = await createOrg({ ownerId: owner.id, billingModelVersion: "WORKSPACE_V2" });
    const branch = await createBranch({ organizationId: organization.id });

    await expect(EntitlementService.assertBranchWritable(branch.id))
      .rejects.toThrow("paid subscription is required");
  });

  it("keeps pending writable but halted read-only", async () => {
    const owner = await createUser();
    const organization = await createOrg({ ownerId: owner.id, billingModelVersion: "WORKSPACE_V2" });
    const branch = await createBranch({ organizationId: organization.id });
    const paidThrough = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const subscription = await createSaasSubscription({
      organizationId: organization.id,
      plan: "BASIC",
      status: "PENDING",
      confirmedPaidPeriod: true,
      paidThrough,
    });
    await testPrisma.organizationSubscription.update({
      where: { id: subscription.id },
      data: { paidThrough: null },
    });

    await expect(EntitlementService.assertBranchWritable(branch.id))
      .rejects.toThrow("paid access period has ended");
    await testPrisma.organizationSubscription.update({
      where: { id: subscription.id },
      data: { paidThrough },
    });
    await expect(EntitlementService.assertBranchWritable(branch.id)).resolves.toBeDefined();
    await testPrisma.organizationSubscription.update({
      where: { id: subscription.id },
      data: { status: "HALTED" },
    });
    await expect(EntitlementService.assertBranchWritable(branch.id))
      .rejects.toThrow("Payment retries are exhausted");
  });

  it("blocks operational writes for a branch awaiting paid activation", async () => {
    const owner = await createUser();
    const organization = await createOrg({ ownerId: owner.id, billingModelVersion: "WORKSPACE_V2" });
    const branch = await createBranch({ organizationId: organization.id });
    await testPrisma.branch.update({ where: { id: branch.id }, data: { billingStatus: "PENDING_ACTIVATION" } });
    await testPrisma.organizationSubscription.create({
      data: {
        organizationId: organization.id,
        providerMode: "TEST",
        plan: "BASIC",
        amount: 99,
        amountSubunits: 9900,
        totalCount: 120,
        quantity: 1,
        razorpayPlanId: "plan_basic",
        currentOrganizationId: organization.id,
        razorpaySubscriptionId: "sub_active",
        status: "ACTIVE",
        providerPaymentMethod: "CARD",
        paidThrough: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    await expect(EntitlementService.assertBranchWritable(branch.id))
      .rejects.toThrow("awaiting provider-confirmed billing activation");
  });

  it("schedules, undoes, and archives a trial branch without deleting data", async () => {
    const { owner, organization, first, trialEndsAt } = await trialOrganization();
    const second = await createBranch({ organizationId: organization.id, name: "Second" });

    const scheduled = await BranchService.scheduleBillingRemoval(owner.id, second.id, "remove-second-1");
    expect(scheduled.change).toMatchObject({ status: "SCHEDULED", effectiveAt: trialEndsAt });
    await BranchService.undoBillingRemoval(owner.id, second.id);
    await expect(testPrisma.branch.findUniqueOrThrow({ where: { id: second.id } }))
      .resolves.toMatchObject({ billingStatus: "ACTIVE" });

    const again = await BranchService.scheduleBillingRemoval(owner.id, second.id, "remove-second-2");
    await BranchService.archiveDueBillingRemovals(new Date(trialEndsAt.getTime() + 1));
    await expect(testPrisma.branch.findUniqueOrThrow({ where: { id: second.id } }))
      .resolves.toMatchObject({ billingStatus: "ARCHIVED" });
    await expect(testPrisma.organizationBillingChange.findUniqueOrThrow({ where: { id: again.change.id } }))
      .resolves.toMatchObject({ status: "APPLIED" });
    await expect(testPrisma.branch.findUnique({ where: { id: first.id } })).resolves.not.toBeNull();
  });

  it.each(["PROCESSING", "AWAITING_PAYMENT", "MANUAL_REVIEW", "UNKNOWN_FAILED"] as const)(
    "does not restore a branch while provider quantity is unresolved (%s)",
    async unresolvedState => {
      const { owner, organization } = await trialOrganization();
      const branch = await createBranch({ organizationId: organization.id, name: "Unresolved removal" });
      await testPrisma.branch.update({
        where: { id: branch.id },
        data: { billingStatus: "REMOVAL_SCHEDULED" },
      });
      const change = await testPrisma.organizationBillingChange.create({
        data: {
          organizationId: organization.id,
          branchId: branch.id,
          sequence: 1,
          idempotencyKey: `unresolved-removal-${unresolvedState}`,
          type: "BRANCH_REMOVAL",
          status: unresolvedState === "MANUAL_REVIEW" || unresolvedState === "UNKNOWN_FAILED"
            ? "FAILED"
            : unresolvedState,
          operationStatus: unresolvedState === "PROCESSING"
            ? "AWAITING_PROVIDER_CONFIRMATION"
            : "FAILED",
          failureCategory: unresolvedState === "MANUAL_REVIEW"
            ? "MANUAL_REVIEW_REQUIRED"
            : null,
          fromQuantity: 2,
          toQuantity: 1,
          effectiveAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      await expect(BranchService.undoBillingRemoval(owner.id, branch.id))
        .rejects.toBeInstanceOf(BillingChangeInProgressError);
      await expect(testPrisma.organizationBillingChange.findUniqueOrThrow({ where: { id: change.id } }))
        .resolves.toMatchObject({ status: change.status });
      await expect(testPrisma.branch.findUniqueOrThrow({ where: { id: branch.id } }))
        .resolves.toMatchObject({ billingStatus: "REMOVAL_SCHEDULED" });
    }
  );

  it("replays branch removal without creating another change", async () => {
    const { owner, organization } = await trialOrganization();
    const second = await createBranch({ organizationId: organization.id, name: "Second" });

    const first = await BranchService.scheduleBillingRemoval(owner.id, second.id, "remove-replay-safe");
    const replay = await BranchService.scheduleBillingRemoval(owner.id, second.id, "remove-replay-safe");

    expect(replay.branch.id).toBe(first.branch.id);
    expect(replay.change.id).toBe(first.change.id);
    await expect(testPrisma.organizationBillingChange.count({
      where: { idempotencyKey: "remove-replay-safe" },
    })).resolves.toBe(1);
  });

  it("rolls back branch removal state when its atomic change insert fails", async () => {
    const { owner, organization } = await trialOrganization();
    const second = await createBranch({ organizationId: organization.id, name: "Second" });
    await testPrisma.organization.update({
      where: { id: organization.id },
      data: { billingMutationSequence: 0 },
    });
    await testPrisma.organizationBillingChange.create({
      data: {
        organizationId: organization.id,
        sequence: 1,
        idempotencyKey: "existing-removal-sequence",
        type: "LEGACY_TRANSITION",
        status: "APPLIED",
        operationStatus: "APPLIED",
      },
    });

    await expect(BranchService.scheduleBillingRemoval(owner.id, second.id, "remove-sequence-conflict"))
      .rejects.toThrow();
    await expect(testPrisma.branch.findUniqueOrThrow({ where: { id: second.id } }))
      .resolves.toMatchObject({ billingStatus: "ACTIVE" });
  });

  it("rolls back archived-branch reactivation when its atomic change insert fails", async () => {
    const owner = await createUser();
    const organization = await createOrg({ ownerId: owner.id, billingModelVersion: "WORKSPACE_V2" });
    await createBranch({ organizationId: organization.id, name: "Active" });
    const archived = await createBranch({ organizationId: organization.id, name: "Archived" });
    await testPrisma.branch.update({
      where: { id: archived.id },
      data: { billingStatus: "ARCHIVED", billingArchivedAt: new Date() },
    });
    await createSaasSubscription({
      organizationId: organization.id,
      plan: "BASIC",
      status: "ACTIVE",
    });
    await testPrisma.organization.update({
      where: { id: organization.id },
      data: { billingMutationSequence: 0 },
    });

    await expect(BranchService.reactivateArchivedBranch(
      owner.id,
      archived.id,
      "reactivate-sequence-conflict"
    )).rejects.toThrow();
    await expect(testPrisma.branch.findUniqueOrThrow({ where: { id: archived.id } }))
      .resolves.toMatchObject({ billingStatus: "ARCHIVED" });
  });
});
