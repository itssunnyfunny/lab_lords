import { expect, test, type Page, type Route } from "@playwright/test";
import { isBillingPlanId, publicBillingPlans } from "../../lib/billingPlans";
import type { BillingCheckoutPayload, BillingOperationDto, BillingOverview, OrganizationSubscriptionDto } from "@/lib/api/billing";
import type { BillingExperience } from "@/types/billingExperience";
import { installSettingsRouteFixture } from "../application-design-pilot/settings-route-closeout-fixture";

const ORG_ID = "org-pilot";
const BRANCH_ID = "pilot";
const billingPath = "/account/billing?organizationId=org-pilot&branchId=pilot&mode=after&lang=en";
const CHANGE_ID = "change-playwright-1";
const TRIAL_END = "2027-09-05T12:00:00.000Z";
const FIRST_CHARGE = "2027-09-05T12:00:00.000Z";

function makeExperience(overrides: Partial<BillingExperience> = {}): BillingExperience {
  return {
    organizationId: ORG_ID,
    accessMode: "FULL",
    effectivePlan: "STANDARD_TRIAL",
    selectedPostTrialPlan: "BASIC",
    providerStatus: null,
    customerState: "TRIAL_ACTIVE",
    customerMessage: "Your 30-day Standard trial is active.",
    trialEndsAt: TRIAL_END,
    trialDaysRemaining: 30,
    paidThrough: null,
    confirmedQuantity: 1,
    projectedQuantity: 1,
    currentUnitAmount: 0,
    currentMonthlyTotal: 0,
    projectedUnitAmount: 99,
    projectedMonthlyTotal: 99,
    authorizationStatus: "NOT_AUTHORIZED",
    planFeeDueToday: 0,
    nextChargeAt: null,
    paymentAction: "AUTHORIZE_CARD",
    entitlements: ["STAFF_MANAGEMENT", "ADVANCED_ANALYTICS", "AI_ACCESS"],
    latestOperation: null,
    activeOperation: null,
    scheduledChanges: [],
    branch: { id: BRANCH_ID, name: "Shanti Study Library", billingStatus: "ACTIVE" },
    independentBilling: true, billingAccessSource: "TRIAL", trialPlan: "STANDARD",
    viewer: { isOwner: true, canManageBilling: true },
    ...overrides,
  };
}

function makeSubscription(
  overrides: Partial<OrganizationSubscriptionDto> = {}
): OrganizationSubscriptionDto {
  return {
    id: "subscription-local-1",
    organizationId: ORG_ID,
    position: "CURRENT",
    replacesSubscriptionId: null,
    plan: "BASIC",
    planName: "Lab Lords Basic",
    shortName: "Basic",
    amount: 99,
    amountSubunits: 9_900,
    currency: "INR",
    period: "monthly",
    interval: 1,
    totalCount: 120,
    quantity: 1,
    unitAmount: 99,
    monthlyTotal: 99,
    status: "CREATED",
    razorpaySubscriptionId: "sub_playwright_1",
    currentStart: null,
    currentEnd: null,
    chargeAt: null,
    endedAt: null,
    providerStartAt: TRIAL_END,
    authorizationExpiresAt: TRIAL_END,
    providerPaymentMethod: "UNKNOWN",
    paidThrough: null,
    cancelAtCycleEnd: false,
    cancellationRequestedAt: null,
    cancellationScheduledAt: null,
    cancelledAt: null,
    createdAt: "2027-08-06T10:00:00.000Z",
    updatedAt: "2027-08-06T10:00:00.000Z",
    ...overrides,
  };
}

function makeOperation(
  operationStatus: BillingOperationDto["operationStatus"] = "CHECKOUT_OPEN",
  overrides: Partial<BillingOperationDto> = {}
): BillingOperationDto {
  return {
    id: CHANGE_ID,
    organizationId: ORG_ID,
    type: "SUBSCRIPTION_AUTHORIZATION",
    queueStatus: operationStatus === "APPLIED" ? "APPLIED" : "AWAITING_PAYMENT",
    operationStatus,
    returnPath: billingPath,
    confirmationDeadlineAt: "2027-08-06T11:00:00.000Z",
    failureCategory: null,
    failureCode: null,
    providerPaymentId: null,
    message: null,
    effectiveAt: null,
    createdAt: "2027-08-06T10:00:00.000Z",
    updatedAt: "2027-08-06T10:00:00.000Z",
    ...overrides,
  };
}

function makeOverview(
  experience: BillingExperience = makeExperience(),
  current: OrganizationSubscriptionDto | null = null
): BillingOverview {
  return {
    experience,
    razorpayTestMode: true,
    multiMethodSubscriptionsEnabled: false,
    checkoutMethodAvailability: {
      mode: "CARD_ONLY",
      potentialMethods: ["CARD"],
      providerControlsVisibility: false,
    },
    plans: publicBillingPlans(),
    current,
    pendingReplacement: null,
    history: [],
    entitlements: {
      organizationId: ORG_ID,
      plan: current?.plan ?? null,
      effectivePlan: isBillingPlanId(experience.effectivePlan) ? experience.effectivePlan : "STANDARD",
      subscriptionStatus: current?.status ?? null,
      fallbackAccess: false,
      entitlements: experience.entitlements,
      limits: { maxBranches: null },
      usage: { branches: 1 },
      accessMode: experience.accessMode,
      canWrite: experience.accessMode !== "READ_ONLY",
      accessReason: experience.customerMessage,
      trial: experience.trialEndsAt
        ? { status: "ACTIVE", endsAt: experience.trialEndsAt }
        : null,
    },
    billingModelVersion: "BRANCH_V3",
    trial: experience.trialEndsAt
      ? {
          status: "ACTIVE",
          source: "ONBOARDING",
          organizationId: ORG_ID,
          startedAt: "2027-08-06T12:00:00.000Z",
          endsAt: experience.trialEndsAt,
        }
      : null,
    ownerTrialEligibility: {
      status: "ACTIVE",
      claimable: false,
      boundOrganizationId: ORG_ID,
    },
    paymentMethod: current?.providerPaymentMethod ?? null,
    invoices: [],
    scheduledChanges: [],
  };
}

function makeCheckoutPayload(planId: "BASIC" | "STANDARD" = "BASIC"): BillingCheckoutPayload {
  const standard = planId === "STANDARD";
  const amount = standard ? 299 : 99;
  const shortName = standard ? "Standard" : "Basic";
  const subscription = makeSubscription({
    plan: planId, planName: `Lab Lords ${shortName}`, shortName, amount, amountSubunits: amount * 100,
    unitAmount: amount, monthlyTotal: amount,
  });
  const operation = makeOperation();
  return {
    purpose: "INITIAL",
    changeId: CHANGE_ID,
    processingUrl: `/account/billing/${ORG_ID}/processing/${CHANGE_ID}?branchId=${BRANCH_ID}`,
    keyId: "rzp_test_playwright",
    testMode: true,
    type: "subscription",
    subscriptionId: subscription.razorpaySubscriptionId,
    amount,
    currency: "INR",
    name: "Lab Lords",
    description: `${shortName} · Shanti Study Library · ₹${amount}/month`,
    config: {
      display: {
        blocks: {
          cards: {
            name: "Pay using card",
            instruments: [{ method: "card" }],
          },
        },
        sequence: ["block.cards"],
        preferences: { show_default_blocks: false },
      },
    },
    plan: {
      id: planId,
      name: subscription.planName,
      shortName,
      amount,
      currency: "INR",
      period: "monthly",
    },
    prefill: {
      name: "Billing Owner",
      email: "billing.owner@lablords.test",
      contact: "+919876543210",
    },
    notes: { organization_id: ORG_ID, branch_agreement_id: BRANCH_ID, billing_change_id: CHANGE_ID },
    summary: {
      plan: planId,
      unitAmount: amount,
      quantity: 1,
      estimatedMonthlyTotal: amount,
      planFeeDueToday: 0,
      trialEndsAt: TRIAL_END,
      firstChargeAt: FIRST_CHARGE,
    },
    subscription,
    operation,
  };
}

function makeReplacementCheckoutPayload(): BillingCheckoutPayload {
  const checkout = makeCheckoutPayload();
  const subscription = makeSubscription({
    id: "subscription-replacement-1",
    position: "PENDING_REPLACEMENT",
    replacesSubscriptionId: "subscription-local-1",
    plan: "STANDARD",
    planName: "Lab Lords Standard",
    shortName: "Standard",
    amount: 299,
    amountSubunits: 29_900,
    unitAmount: 299,
    monthlyTotal: 299,
    status: "CREATED",
    razorpaySubscriptionId: "sub_playwright_replacement",
    providerPaymentMethod: "UNKNOWN",
  });
  return {
    ...checkout,
    purpose: "REPLACEMENT",
    subscriptionId: subscription.razorpaySubscriptionId,
    subscription,
    config: undefined,
    plan: {
      ...checkout.plan,
      id: "STANDARD",
      name: "Lab Lords Standard",
      shortName: "Standard",
      amount: 299,
    },
    summary: {
      ...checkout.summary,
      plan: "STANDARD",
      unitAmount: 299,
      estimatedMonthlyTotal: 299,
      planFeeDueToday: 0,
    },
  };
}

type CheckoutScenario = "hold" | "dismiss" | "decline" | "technical" | "ambiguous" | "success";

type CapturedRazorpayOptions = {
  cardChange?: boolean;
  readonly?: { name: boolean; email: boolean; contact: boolean };
  prefill?: { name?: string; email?: string; contact?: string };
  remember_customer?: boolean;
  config?: Record<string, unknown>;
  subscriptionId?: string;
};

type RazorpayHarness = {
  scenario: CheckoutScenario;
  opens: number;
  lastOptions: CapturedRazorpayOptions | null;
};

async function installRazorpayMock(page: Page) {
  await page.addInitScript(() => {
    type FailureResponse = {
      error: {
        code: string;
        description: string;
        reason: string;
        source: string;
        step: string;
        metadata: { payment_id: string };
      };
    };
    type MockOptions = {
      subscription_id: string;
      subscription_card_change?: boolean;
      remember_customer?: boolean;
      readonly?: { name: boolean; email: boolean; contact: boolean };
      prefill?: { name?: string; email?: string; contact?: string };
      config?: Record<string, unknown>;
      modal?: { ondismiss: () => void | Promise<void> };
      handler?: (response: {
        razorpay_payment_id: string;
        razorpay_subscription_id: string;
        razorpay_signature: string;
      }) => void | Promise<void>;
    };
    type TestWindow = Window & {
      __billingCheckoutHarness: RazorpayHarness;
      Razorpay: new (options: MockOptions) => {
        open: () => void;
        on: (event: string, handler: (response: FailureResponse) => void) => void;
      };
    };

    const testWindow = window as unknown as TestWindow;
    testWindow.__billingCheckoutHarness = {
      scenario: "hold",
      opens: 0,
      lastOptions: null,
    };

    class MockRazorpay {
      private readonly options: MockOptions;
      private failureHandler: ((response: FailureResponse) => void) | null = null;

      constructor(options: MockOptions) {
        this.options = options;
      }

      on(_event: string, handler: (response: FailureResponse) => void) {
        this.failureHandler = handler;
      }

      open() {
        const harness = testWindow.__billingCheckoutHarness;
        harness.opens += 1;
        harness.lastOptions = {
          readonly: this.options.readonly,
          prefill: this.options.prefill,
          remember_customer: this.options.remember_customer,
          config: this.options.config,
          subscriptionId: this.options.subscription_id,
          cardChange: this.options.subscription_card_change,
        };

        window.setTimeout(() => {
          if (harness.scenario === "hold") return;
          if (harness.scenario === "success") {
            void this.options.handler?.({
              razorpay_payment_id: "pay_success_playwright",
              razorpay_subscription_id: this.options.subscription_id,
              razorpay_signature: "signature_playwright",
            });
            return;
          }
          if (harness.scenario !== "dismiss") {
            const technical = harness.scenario === "technical";
            const ambiguous = harness.scenario === "ambiguous";
            this.failureHandler?.({
              error: {
                code: technical ? "GATEWAY_ERROR" : "BAD_REQUEST_ERROR",
                description: technical
                  ? "The payment network could not respond"
                  : ambiguous
                    ? "The authorization result is unavailable"
                    : "The bank declined the card authorization",
                reason: technical ? "network_error" : ambiguous ? "unknown_error" : "card_declined",
                source: technical ? "network" : ambiguous ? "customer" : "bank",
                step: "payment_authentication",
                metadata: {
                  payment_id: technical
                    ? "pay_network_playwright"
                    : ambiguous
                      ? "pay_unknown_playwright"
                      : "pay_declined_playwright",
                },
              },
            });
          }
          void this.options.modal?.ondismiss();
        }, 0);
      }
    }

    testWindow.Razorpay = MockRazorpay;
  });

  await page.route("https://checkout.razorpay.com/v1/checkout.js*", async route => {
    await route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: "window.__razorpayCheckoutScriptLoaded = true;",
    });
  });
}

async function setCheckoutScenario(page: Page, scenario: CheckoutScenario) {
  await page.evaluate(nextScenario => {
    const testWindow = window as unknown as Window & { __billingCheckoutHarness: RazorpayHarness };
    testWindow.__billingCheckoutHarness.scenario = nextScenario;
  }, scenario);
}

async function getCheckoutHarness(page: Page): Promise<RazorpayHarness> {
  return page.evaluate(() => {
    const testWindow = window as unknown as Window & { __billingCheckoutHarness: RazorpayHarness };
    return testWindow.__billingCheckoutHarness;
  });
}

type BillingMockController = {
  overview: BillingOverview;
  operation: BillingOperationDto;
  checkoutEvents: Array<Record<string, unknown>>;
  createRequests: Array<Record<string, unknown>>;
  verifyRequests: Array<Record<string, unknown>>;
  retryRequests: number;
};

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

async function mockBillingPage(
  page: Page,
  overview = makeOverview(),
  operation = makeOperation()
): Promise<BillingMockController> {
  await page.clock.setFixedTime(new Date("2027-08-06T12:00:00Z"));
  const controller: BillingMockController = {
    overview,
    operation,
    checkoutEvents: [],
    createRequests: [],
    verifyRequests: [],
    retryRequests: 0,
  };
  let checkout = makeCheckoutPayload();
  const fixtureOrigin = new URL(test.info().project.use.baseURL!).origin;

  await page.route("**/*", route => new URL(route.request().url()).origin === fixtureOrigin
    ? route.fallback() : route.abort("blockedbyclient"));
  await installSettingsRouteFixture(page);
  await installRazorpayMock(page);

  await page.route(`**/api/organizations/${ORG_ID}/billing?branchId=${BRANCH_ID}`, route =>
    json(route, controller.overview)
  );

  await page.route(`**/api/organizations/${ORG_ID}/billing/subscription?branchId=${BRANCH_ID}`, route => {
    const request = route.request().postDataJSON() as { plan: "BASIC" | "STANDARD" };
    controller.createRequests.push(request);
    checkout = makeCheckoutPayload(request.plan);
    return json(route, checkout);
  });

  await page.route(`**/api/organizations/${ORG_ID}/billing/subscription/verify?branchId=${BRANCH_ID}`, route => {
    controller.verifyRequests.push(route.request().postDataJSON() as Record<string, unknown>);
    controller.operation = makeOperation("APPLIED", {
      providerPaymentId: "pay_success_playwright",
    });
    return json(route, {
      verified: true,
      operation: controller.operation,
      processingUrl: checkout.processingUrl,
      subscription: makeSubscription({
        status: "AUTHENTICATED",
        providerPaymentMethod: "CARD",
        chargeAt: FIRST_CHARGE,
      }),
    });
  });

  await page.route(
    `**/api/organizations/${ORG_ID}/billing/mutations/${CHANGE_ID}/checkout-event?branchId=${BRANCH_ID}`,
    route => {
      const event = route.request().postDataJSON() as Record<string, unknown>;
      controller.checkoutEvents.push(event);
      const status = event.event;
      if (
        status === "ABANDONED"
        || status === "DECLINED"
        || status === "FAILED"
        || status === "AWAITING_PROVIDER_CONFIRMATION"
      ) {
        controller.operation = makeOperation(status, {
          failureCategory: typeof event.failureCategory === "string" ? event.failureCategory : null,
          failureCode: typeof event.failureCode === "string" ? event.failureCode : null,
          providerPaymentId: typeof event.paymentId === "string" ? event.paymentId : null,
        });
      }
      return json(route, { operation: controller.operation });
    }
  );

  await page.route(
    `**/api/organizations/${ORG_ID}/billing/mutations/${CHANGE_ID}/retry?branchId=${BRANCH_ID}`,
    route => {
      controller.retryRequests += 1;
      return json(route, checkout);
    }
  );

  await page.route(
    `**/api/organizations/${ORG_ID}/billing/mutations/${CHANGE_ID}?branchId=${BRANCH_ID}`,
    route => {
      if (route.request().method() === "GET") {
        return json(route, {
          operation: controller.operation,
          processingUrl: checkout.processingUrl,
        });
      }
      return json(route, {
        operation: controller.operation,
        processingUrl: checkout.processingUrl,
      });
    }
  );

  return controller;
}

async function gotoBilling(page: Page, query = "") {
  await page.goto(billingPath + (query ? "&" + query.slice(1) : ""), { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Billing and plans", exact: true })).toBeVisible();
}

async function startBasicAuthorization(page: Page, scenario: CheckoutScenario) {
  await setCheckoutScenario(page, scenario);
  await page.getByRole("button", { name: "Authorize Basic", exact: true }).click();
  const confirmation = page.getByRole("dialog", { name: /Authorize Basic after your trial/i });
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole("button", { name: "Continue to Razorpay" }).click();
}

for (const surface of ["Account Billing", "processing"] as const) {
  test(`resumes payment recovery from ${surface} after leaving hosted checkout past its deadline`, async ({ page }) => {
    const subscription = makeSubscription({
      status: "HALTED", providerPaymentMethod: surface === "processing" ? "CARD" : "UPI",
    });
    const overview = makeOverview(makeExperience({
      accessMode: "READ_ONLY", effectivePlan: "NONE", billingAccessSource: "NONE", trialEndsAt: null,
      trialDaysRemaining: 0, customerState: "PAYMENT_HALTED", providerStatus: "HALTED",
      entitlements: [], paymentAction: "UPDATE_CARD",
    }), subscription);
    const controller = await mockBillingPage(page, overview);
    const checkout = { ...makeCheckoutPayload(), purpose: "RECOVERY", subscription };
    const firstLink = "https://rzp.io/i/synthetic-recovery";
    const resumedLink = "https://rzp.io/i/synthetic-resumed-recovery";
    const apiPath = `**/api/organizations/${ORG_ID}/billing`;
    const scope = `?branchId=${BRANCH_ID}`;
    let starts = 0;
    let resumes = 0;
    await page.route("https://rzp.io/i/synthetic-*", route => route.fulfill({
      contentType: "text/html", body: "<title>Simulated hosted recovery</title>",
    }));
    await page.route(`${apiPath}/subscription/recovery${scope}`, route => {
      expect(route.request().method()).toBe("POST");
      starts++;
      return json(route, { ...checkout, hostedRecoveryUrl: firstLink });
    });
    await page.route(`${apiPath}/mutations/${CHANGE_ID}/retry${scope}`, route => {
      expect(route.request().method()).toBe("POST");
      resumes++;
      return json(route, surface === "processing"
        ? { ...checkout, subscription_card_change: true }
        : { ...checkout, hostedRecoveryUrl: resumedLink });
    });

    await gotoBilling(page);
    await page.getByRole("button", { name: "Update payment method and retry", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Continue to Razorpay" }).click();
    await expect(page).toHaveURL(firstLink);
    const started = await page.evaluate(() => Date.now());
    const deadline = new Date(started + 15 * 60_000).toISOString();
    await page.clock.setFixedTime(new Date(started + 16 * 60_000));
    expect(await page.evaluate(() => Date.now())).toBeGreaterThan(Date.parse(deadline));

    // The overdue overview and operation GET both describe the original unpaid receipt.
    controller.operation = makeOperation("AWAITING_PROVIDER_CONFIRMATION", {
      confirmationDeadlineAt: deadline, canResumePaymentRecovery: true,
    });
    const receipt = {
      ...controller.operation, status: "AWAITING_PAYMENT", lastError: null,
      branchId: BRANCH_ID, toPlan: subscription.plan, toQuantity: 1,
    };
    Object.assign(overview.experience, {
      paymentAction: "RESUME_PAYMENT_RECOVERY", activeOperation: receipt, latestOperation: receipt,
    });
    if (surface === "processing") await page.goto(checkout.processingUrl);
    else await gotoBilling(page);
    await page.getByRole("button", { name: "Resume payment recovery", exact: true }).click();
    if (surface === "processing") {
      await expect.poll(async () => (await getCheckoutHarness(page)).lastOptions)
        .toMatchObject({ subscriptionId: subscription.razorpaySubscriptionId, cardChange: true });
    } else {
      await expect(page).toHaveURL(resumedLink);
    }
    expect({ starts, resumes }).toEqual({ starts: 1, resumes: 1 });
    expect(controller.createRequests).toHaveLength(0);
    expect(controller.verifyRequests).toHaveLength(0);
    expect(controller.checkoutEvents).toHaveLength(0);
  });
}

test("shows exact current-trial and post-trial pricing without inventing a charge date", async ({ page }) => {
  const controller = await mockBillingPage(page);
  await gotoBilling(page);

  const summary = page.getByRole("region", { name: "Trial and post-trial billing summary" });
  await expect(summary.getByRole("heading", { name: "Current access" })).toBeVisible();
  await expect(summary.getByText("Standard trial", { exact: true })).toBeVisible();
  await expect(summary.getByText("₹0", { exact: true })).toBeVisible();
  await expect(summary.getByText("5 September 2027", { exact: true })).toBeVisible();
  await expect(summary.getByText("Full Standard features", { exact: true })).toBeVisible();

  await expect(summary.getByRole("heading", { name: "After the trial" })).toBeVisible();
  await expect(summary.getByText("Basic", { exact: true })).toBeVisible();
  await expect(summary.getByText("Not authorized", { exact: true })).toBeVisible();
  await expect(summary.getByText("₹99/month", { exact: true })).toBeVisible();
  await expect(summary.getByText(/1 branch(?:\(s\))? × ₹99/)).toBeVisible();
  await expect(summary.getByText("Not scheduled — authorize a payment method first", { exact: true })).toBeVisible();
  await expect(summary.getByText(/No plan fee is charged during your trial/i)).toBeVisible();

  await expect(page.getByRole("button", { name: "Authorize Basic", exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Authorize Standard", exact: true })).toBeEnabled();
  await expect(page.getByText("Selected after trial", { exact: true })).toBeVisible();

  controller.overview = makeOverview(makeExperience({
    selectedPostTrialPlan: null,
    projectedUnitAmount: 0,
    projectedMonthlyTotal: 0,
    paymentAction: "CHOOSE_PLAN",
  }));
  await page.reload();
  await expect(page.getByText("Choose a plan", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Not scheduled — authorize a payment method first", { exact: true })).toBeVisible();
});

test("labels future authorization separately from a provider-confirmed current plan", async ({ page }) => {
  const authenticated = makeSubscription({
    status: "AUTHENTICATED",
    providerPaymentMethod: "CARD",
    chargeAt: FIRST_CHARGE,
  });
  const controller = await mockBillingPage(
    page,
    makeOverview(
      makeExperience({
        providerStatus: "AUTHENTICATED",
        authorizationStatus: "AUTHORIZED",
        nextChargeAt: FIRST_CHARGE,
      }),
      authenticated
    )
  );
  await gotoBilling(page);

  await expect(page.getByRole("button", { name: "Authorized for after trial" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Change to Standard after trial" })).toBeEnabled();
  await expect(page.getByText("Authorized after trial", { exact: true })).toBeVisible();
  const firstCharge = page.locator("div").filter({ has: page.getByText("First plan charge", { exact: true }) });
  await expect(firstCharge.last().getByText("5 September 2027", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Current plan" })).toHaveCount(0);

  const paidStandard = makeSubscription({
    plan: "STANDARD",
    planName: "Lab Lords Standard",
    shortName: "Standard",
    amount: 299,
    amountSubunits: 29_900,
    unitAmount: 299,
    monthlyTotal: 299,
    status: "ACTIVE",
    providerPaymentMethod: "CARD",
    paidThrough: "2027-10-05T12:00:00.000Z",
    currentEnd: "2027-10-05T12:00:00.000Z",
    chargeAt: "2027-10-05T12:00:00.000Z",
  });
  controller.overview = makeOverview(
    makeExperience({
      effectivePlan: "STANDARD", billingAccessSource: "PAID", monthlyCommitmentSubunits: 29900,
      selectedPostTrialPlan: "STANDARD",
      providerStatus: "ACTIVE",
      customerState: "STANDARD_ACTIVE",
      customerMessage: "Standard is active.",
      trialEndsAt: null,
      trialDaysRemaining: null,
      paidThrough: paidStandard.paidThrough,
      currentUnitAmount: 299,
      currentMonthlyTotal: 299,
      projectedUnitAmount: 299,
      projectedMonthlyTotal: 299,
      authorizationStatus: "AUTHORIZED",
      nextChargeAt: paidStandard.chargeAt,
      paymentAction: "NONE",
    }),
    paidStandard
  );
  await page.reload();

  await expect(page.getByRole("region", { name: "Current subscription" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Current plan" })).toBeDisabled();
  await expect(page.getByText("Standard trial", { exact: true })).toHaveCount(0);
});

test("billingPlan query opens review first and passes editable payer defaults to card-only Checkout", async ({ page }) => {
  const controller = await mockBillingPage(page);
  await gotoBilling(page, "?billingPlan=STANDARD");

  const confirmation = page.getByRole("dialog", { name: /Authorize Standard after your trial/i });
  await expect(confirmation).toBeVisible();
  expect(controller.createRequests).toHaveLength(0);
  expect((await getCheckoutHarness(page)).opens).toBe(0);

  await expect(confirmation.getByText("₹0", { exact: true })).toBeVisible();
  await expect(confirmation.getByText("₹299/month", { exact: true })).toBeVisible();
  await expect(confirmation.getByText(/1 branch(?:\(s\))? × ₹299 per branch/)).toBeVisible();
  await expect(confirmation.getByText(/payment mandate authorization succeeds.*5 September 2027/i)).toBeVisible();
  await expect(confirmation.getByText(/temporary ₹5 verification payment/i)).toBeVisible();
  await expect(confirmation.getByText(/editable phone and email are billing-contact defaults.*do not determine the account, app, number, or device/i)).toBeVisible();
  await expect(confirmation.getByText(/bank or 3-D Secure OTP is controlled by the card issuer.*mobile number, email, or device registered with that issuer/i)).toBeVisible();
  await expect(confirmation.getByText(/does not ask Razorpay to remember it for one-click payments/i)).toBeVisible();
  await expect(confirmation.getByText(/Test Mode simulates bank authentication.*No real card OTP, SMS, or email is sent/i)).toBeVisible();

  await confirmation.getByRole("button", { name: "Continue to Razorpay" }).click();
  await expect.poll(async () => (await getCheckoutHarness(page)).opens).toBe(1);
  expect(controller.createRequests).toEqual([
    expect.objectContaining({ plan: "STANDARD" }),
  ]);

  const harness = await getCheckoutHarness(page);
  expect(harness.lastOptions).toEqual(expect.objectContaining({
    remember_customer: false,
    readonly: { name: false, email: false, contact: false },
    prefill: {
      name: "Billing Owner",
      email: "billing.owner@lablords.test",
      contact: "+919876543210",
    },
    subscriptionId: "sub_playwright_1",
  }));
  expect(harness.lastOptions?.config).toEqual(expect.objectContaining({
    display: expect.objectContaining({
      sequence: ["block.cards"],
      preferences: { show_default_blocks: false },
    }),
  }));
});

async function gotoBranchWithBillingBanner(page: Page, experience: BillingExperience) {
  const base = await (await page.request.get("/api/branches/pilot/access")).json();
  await page.route("**/api/branches/pilot/access", route => route.fulfill({ json: {
    ...base, billingExperience: experience, effectivePlan: experience.effectivePlan, accessMode: experience.accessMode,
  } }));
  await page.goto("/branch/pilot/settings?mode=after&lang=en");
}

test("trial banner dismissal lasts for reloads in this session only", async ({ page }) => {
  const controller = await mockBillingPage(page);
  await gotoBranchWithBillingBanner(page, controller.overview.experience);

  const trialStatus = page.getByRole("status").filter({
    hasText: "Your 30-day Standard trial is active.",
  });
  await expect(trialStatus).toBeVisible();
  await trialStatus.getByRole("button", {
    name: "Dismiss trial reminder for this session",
  }).click();
  await expect(trialStatus).toHaveCount(0);

  expect(await page.evaluate(orgId =>
    window.sessionStorage.getItem(`lablords:billing-banner:trial:${orgId}`), ORG_ID
  )).toBe("dismissed");
  expect(await page.evaluate(orgId =>
    window.localStorage.getItem(`lablords:billing-banner:trial:${orgId}`), ORG_ID
  )).toBeNull();

  await page.reload();
  await expect(page.getByRole("status").filter({
    hasText: "Your 30-day Standard trial is active.",
  })).toHaveCount(0);
});

test("critical payment warnings cannot be dismissed", async ({ page }) => {
  const pending = makeSubscription({
    status: "PENDING",
    providerPaymentMethod: "CARD",
    paidThrough: "2027-08-05T12:00:00.000Z",
  });
  const warningMessage = "Your renewal payment is retrying. Update the card if needed.";
  const controller = await mockBillingPage(
    page,
    makeOverview(
      makeExperience({
        accessMode: "WARNING", billingAccessSource: "PAYMENT_RETRY",
        effectivePlan: "STANDARD",
        selectedPostTrialPlan: "STANDARD",
        providerStatus: "PENDING",
        customerState: "PAYMENT_RETRYING",
        customerMessage: warningMessage,
        trialEndsAt: null,
        trialDaysRemaining: null,
        paidThrough: pending.paidThrough,
        authorizationStatus: "AUTHORIZED",
        paymentAction: "UPDATE_CARD",
      }),
      pending
    )
  );
  await gotoBranchWithBillingBanner(page, controller.overview.experience);

  const warning = page.getByRole("status").filter({ hasText: warningMessage });
  await expect(warning).toBeVisible();
  await expect(warning.getByRole("button", {
    name: "Dismiss trial reminder for this session",
  })).toHaveCount(0);
  await expect(warning.getByRole("link", { name: "Update payment method", exact: true })).toHaveAttribute("href", /organizationId=org-pilot&branchId=pilot/);
});

test("dismissed Checkout is recorded as abandoned with a retryable result", async ({ page }) => {
  const controller = await mockBillingPage(page);
  await gotoBilling(page);
  await startBasicAuthorization(page, "dismiss");

  const result = page.getByRole("alertdialog", { name: "Authorization was not completed" });
  await expect(result).toBeVisible();
  await expect(result.getByText(/trial or current confirmed plan remains unchanged/i)).toBeVisible();
  await expect(result.getByRole("button", { name: "Retry authorization" })).toBeVisible();
  await expect(result.getByRole("button", { name: "Continue" })).toBeVisible();
  expect(controller.checkoutEvents).toEqual([
    expect.objectContaining({ event: "ABANDONED" }),
  ]);
});

test("a declined attempt can be retried successfully without preserving the old failure", async ({ page }) => {
  const controller = await mockBillingPage(page);
  await gotoBilling(page);
  await startBasicAuthorization(page, "decline");

  const result = page.getByRole("alertdialog", { name: "The payment authorization was declined" });
  await expect(result).toBeVisible();
  await expect(result.getByText(/try another supported recurring payment method/i)).toBeVisible();
  await expect(result.getByText(/current confirmed plan remains unchanged/i)).toBeVisible();
  expect(controller.checkoutEvents).toEqual([
    expect.objectContaining({
      event: "DECLINED",
      failureCategory: "card_declined",
      failureCode: "BAD_REQUEST_ERROR",
      reason: "card_declined",
      source: "bank",
      step: "payment_authentication",
      paymentId: "pay_declined_playwright",
    }),
  ]);

  await setCheckoutScenario(page, "success");
  await result.getByRole("button", { name: "Try another payment method" }).click();

  await expect.poll(async () => (await getCheckoutHarness(page)).opens).toBe(2);
  await expect(page).toHaveURL(new RegExp(`/account/billing/${ORG_ID}/processing/${CHANGE_ID}.*branchId=${BRANCH_ID}`));
  await expect(page.getByRole("heading", { name: "Billing update confirmed" })).toBeVisible();
  expect(controller.retryRequests).toBe(1);
  expect(controller.verifyRequests).toEqual([
    expect.objectContaining({
      changeId: CHANGE_ID,
      razorpay_payment_id: "pay_success_playwright",
      razorpay_subscription_id: "sub_playwright_1",
      razorpay_signature: "signature_playwright",
    }),
  ]);
  expect(controller.checkoutEvents).toHaveLength(1);
});

test("technical Checkout errors show a non-destructive failure result", async ({ page }) => {
  const controller = await mockBillingPage(page);
  await gotoBilling(page);
  await startBasicAuthorization(page, "technical");

  const result = page.getByRole("alertdialog", {
    name: "Razorpay could not complete the authorization",
  });
  await expect(result).toBeVisible();
  await expect(result.getByText(/bank, network, or provider error/i)).toBeVisible();
  await expect(result.getByText(/No confirmed billing change was applied/i)).toBeVisible();
  expect(controller.checkoutEvents).toEqual([
    expect.objectContaining({
      event: "FAILED",
      failureCategory: "network_error",
      failureCode: "GATEWAY_ERROR",
      source: "network",
      paymentId: "pay_network_playwright",
    }),
  ]);
});

test("unknown payment.failed metadata resolves to a retryable failure instead of verification", async ({ page }) => {
  const controller = await mockBillingPage(page);
  await gotoBilling(page);
  await startBasicAuthorization(page, "ambiguous");

  const result = page.getByRole("alertdialog", {
    name: "Razorpay could not complete the authorization",
  });
  await expect(result).toBeVisible();
  await expect(page).not.toHaveURL(new RegExp(`/account/billing/${ORG_ID}/processing/${CHANGE_ID}.*branchId=${BRANCH_ID}`));
  expect(controller.checkoutEvents).toEqual([
    expect.objectContaining({
      event: "FAILED",
      failureCategory: "unknown_error",
      paymentId: "pay_unknown_playwright",
    }),
  ]);
});

test("successful Checkout is verified server-side before confirmation is shown", async ({ page }) => {
  const controller = await mockBillingPage(page);
  let releaseVerification!: () => void;
  const verificationGate = new Promise<void>(resolve => { releaseVerification = resolve; });
  const verificationRequest = page.waitForRequest(request =>
    request.method() === "POST" && new URL(request.url()).pathname.endsWith("/subscription/verify"));
  await page.route(`**/api/organizations/${ORG_ID}/billing/subscription/verify?branchId=${BRANCH_ID}`, async route => {
    await verificationGate;
    await route.fallback();
  });
  await gotoBilling(page);
  await startBasicAuthorization(page, "success");
  await verificationRequest;
  await expect(page.getByRole("heading", { name: "Billing update confirmed" })).toHaveCount(0);
  releaseVerification();

  await expect(page).toHaveURL(new RegExp(`/account/billing/${ORG_ID}/processing/${CHANGE_ID}.*branchId=${BRANCH_ID}`));
  await expect(page.getByRole("heading", { name: "Billing update confirmed" })).toBeVisible();
  expect(controller.verifyRequests).toEqual([
    expect.objectContaining({
      changeId: CHANGE_ID,
      razorpay_payment_id: "pay_success_playwright",
      razorpay_subscription_id: "sub_playwright_1",
      razorpay_signature: "signature_playwright",
    }),
  ]);
  expect(controller.checkoutEvents).toHaveLength(0);
});

test("processing retry reopens Razorpay only after the explicit retry click", async ({ page }) => {
  const controller = await mockBillingPage(
    page,
    makeOverview(),
    makeOperation("FAILED", {
      failureCategory: "network_error",
      failureCode: "GATEWAY_ERROR",
      message: "The provider network did not confirm the authorization.",
    })
  );
  await page.goto(`/account/billing/${ORG_ID}/processing/${CHANGE_ID}?branchId=${BRANCH_ID}`);

  await expect(page.getByRole("heading", { name: "We could not apply the billing update" })).toBeVisible();
  expect((await getCheckoutHarness(page)).opens).toBe(0);

  await page.getByRole("button", { name: "Retry safely" }).click();
  await expect.poll(async () => (await getCheckoutHarness(page)).opens).toBe(1);
  expect(controller.retryRequests).toBe(1);
  expect((await getCheckoutHarness(page)).lastOptions).toEqual(expect.objectContaining({
    remember_customer: false,
    readonly: { name: false, email: false, contact: false },
    subscriptionId: "sub_playwright_1",
  }));
});

test("UPI plan replacement opens provider-managed Checkout", async ({ page }) => {
    const current = makeSubscription({
      status: "ACTIVE",
      providerPaymentMethod: "UPI",
      paidThrough: "2027-09-05T12:00:00.000Z",
      currentEnd: "2027-09-05T12:00:00.000Z",
      chargeAt: "2027-09-05T12:00:00.000Z",
    });
    const controller = await mockBillingPage(
      page,
      makeOverview(
        makeExperience({
          effectivePlan: "BASIC", billingAccessSource: "PAID", monthlyCommitmentSubunits: 9900,
          planChangeEffectiveAt: FIRST_CHARGE,
          selectedPostTrialPlan: "BASIC",
          providerStatus: "ACTIVE",
          customerState: "BASIC_ACTIVE",
          customerMessage: "Basic is active.",
          trialEndsAt: null,
          trialDaysRemaining: null,
          paidThrough: current.paidThrough,
          currentUnitAmount: 99,
          currentMonthlyTotal: 99,
          projectedUnitAmount: 99,
          projectedMonthlyTotal: 99,
          authorizationStatus: "AUTHORIZED",
          nextChargeAt: current.chargeAt,
          paymentAction: "NONE",
        }),
        current
      )
    );
    controller.overview.multiMethodSubscriptionsEnabled = true;
    controller.overview.checkoutMethodAvailability = {
      mode: "PROVIDER_MANAGED",
      potentialMethods: ["CARD", "UPI", "EMANDATE"],
      providerControlsVisibility: true,
    };
    const replacement = makeReplacementCheckoutPayload();
    const replacementRequests: Array<Record<string, unknown>> = [];
    await page.route(`**/api/organizations/${ORG_ID}/billing/subscription?branchId=${BRANCH_ID}`, route => {
      if (route.request().method() !== "PATCH") return route.fallback();
      replacementRequests.push(route.request().postDataJSON() as Record<string, unknown>);
      return json(route, replacement, 202);
    });

    await gotoBilling(page);
    await expect(page.getByRole("heading", { name: "Choose securely in Razorpay Checkout" })).toBeVisible();
    const supportedMethods = page.getByRole("list", { name: "Supported recurring payment methods" });
    await expect(supportedMethods.getByText("Card", { exact: true })).toBeVisible();
    await expect(supportedMethods.getByText("UPI AutoPay", { exact: true })).toBeVisible();
    await expect(supportedMethods.getByText("eMandate", { exact: true })).toBeVisible();
    await expect(page.getByText("UPI AutoPay", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Change payment method" })).toBeVisible();
    await setCheckoutScenario(page, "hold");
    await page.getByRole("button", { name: "Upgrade to Standard" }).click();
    const confirmation = page.getByRole("dialog").filter({ hasText: "Standard" });
    await expect(confirmation).toBeVisible();
    await expect(confirmation.getByText(/UPI AutoPay authorization opens a supported UPI app.*Razorpay QR flow/i)).toBeVisible();
    await expect(confirmation.getByText(/An upgrade unlocks features after confirmation/i)).toBeVisible();
    await expect(confirmation.getByText("Lab Lords charge today", { exact: true })).toBeVisible();
    await expect(confirmation.getByRole("region", { name: "Selected branch" })).toContainText("Shanti Study Library");
    await confirmation.getByRole("button", { name: /Continue to Razorpay|Confirm plan change/ }).click();

    await expect.poll(async () => (await getCheckoutHarness(page)).opens).toBe(1);
    expect(replacementRequests).toEqual([expect.objectContaining({ plan: "STANDARD" })]);
    const harness = await getCheckoutHarness(page);
    expect(harness.lastOptions?.subscriptionId).toBe("sub_playwright_replacement");
    expect(harness.lastOptions?.config).toBeUndefined();
});

test("shows pending eMandate cutover and complimentary access without replacing canonical billing", async ({ page }) => {
  const current = makeSubscription({
    status: "ACTIVE",
    providerPaymentMethod: "UPI",
    paidThrough: "2027-09-05T12:00:00.000Z",
    currentEnd: "2027-09-05T12:00:00.000Z",
  });
  const pending = makeReplacementCheckoutPayload().subscription;
  pending.status = "AUTHENTICATED";
  pending.providerPaymentMethod = "EMANDATE";
  pending.providerStartAt = "2027-09-12T12:00:00.000Z";
  const overview = makeOverview(
    makeExperience({
      effectivePlan: "STANDARD", billingAccessSource: "PAID", monthlyCommitmentSubunits: 9900,
      selectedPostTrialPlan: "STANDARD",
      providerStatus: "ACTIVE",
      customerState: "STANDARD_ACTIVE",
      customerMessage: "Standard access is active while current billing continues.",
      trialEndsAt: null,
      trialDaysRemaining: null,
      paidThrough: current.paidThrough,
      authorizationStatus: "AUTHORIZED",
      paymentAction: "NONE",
    }),
    current
  );
  overview.pendingReplacement = pending;
  overview.scheduledChanges = [{
    id: "change-replacement-pending",
    type: "PLAN_UPGRADE",
    status: "SCHEDULED",
    effectiveAt: "2027-09-12T12:00:00.000Z",
    undoCutoffAt: "2027-09-10T12:00:00.000Z",
    toPlan: "STANDARD",
    organizationSubscriptionId: current.id, replacementSubscriptionId: pending.id,
    toQuantity: 1,
    lastError: null,
    accessGrantedAt: "2027-08-05T12:00:00.000Z",
  }];
  await mockBillingPage(page, overview);

  await gotoBilling(page);
  const billed = page.getByRole("region", { name: "Current subscription" });
  await expect(billed.locator("div").filter({ has: page.getByText("Billed plan", { exact: true }) }).last()).toContainText("Basic");
  await expect(billed.getByText(/₹99(?:\.00)?\/month/)).toBeVisible();
  const replacement = page.getByRole("region", { name: "Scheduled subscription change" });
  await expect(replacement.getByText("Change to Standard")).toBeVisible();
  await expect(replacement.getByText(/eMandate.*starts Sep 12, 2027/i)).toBeVisible();
  await expect(replacement.getByText(/Complimentary upgrade access is active/)).toBeVisible();
  await expect(replacement.getByRole("button", { name: "Undo" })).toBeVisible();
  await expect(page.getByText(/charges and invoices follow your current subscription/)).toBeVisible();
});
