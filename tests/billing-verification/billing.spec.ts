import { expect, test, type Page } from "@playwright/test";
import { publicBillingPlans } from "../../lib/billingPlans";
import { installSettingsRouteFixture } from "../application-design-pilot/settings-route-closeout-fixture";

async function installBillingFixture(page: Page, plan: "BASIC" | "STANDARD" | "PRO" = "STANDARD") {
  // The real UI runs against explicit synthetic responses. All remaining API
  // paths are held by the design harness, and external requests are blocked.
  await page.route("**/*", route => new URL(route.request().url()).origin === "http://127.0.0.1:4189"
    ? route.fallback() : route.abort("blockedbyclient"));
  await page.addInitScript(() => {
    const opened: Array<Record<string, unknown>> = [];
    Object.assign(window, { __billingTestCheckouts: opened, Razorpay: class {
      options: Record<string, unknown>;
      constructor(options: Record<string, unknown>) { this.options = options; }
      on() {}
      open() { opened.push({ subscriptionId: this.options.subscription_id, rememberCustomer: this.options.remember_customer }); }
    } });
  });
  const fixture = await installSettingsRouteFixture(page);
  const definition = publicBillingPlans().find(item => item.id === plan)!;
  const entitlements = definition.entitlements;
  Object.assign(fixture.billingOverview, { plans: publicBillingPlans() });
  Object.assign(fixture.billingOverview.experience, {
    effectivePlan: plan, selectedPostTrialPlan: plan, customerState: `${plan}_ACTIVE`, entitlements,
    customerMessage: `${definition.shortName} workspace is active.`,
    currentUnitAmount: definition.amount, currentMonthlyTotal: definition.amount,
  });
  Object.assign(fixture.billingOverview.current, {
    plan, planName: definition.name, shortName: definition.shortName,
    amount: definition.amount, amountSubunits: definition.amount! * 100,
    unitAmount: definition.amount, monthlyTotal: definition.amount,
  });
  Object.assign(fixture.billingOverview.entitlements, { plan, effectivePlan: plan, entitlements });
  await page.route("**/api/organizations/org-pilot/billing/invoices*", route => route.fulfill({
    json: { items: [], nextCursor: null },
  }));
  return fixture;
}

function replacementCheckout(current: Record<string, unknown>, plan: "BASIC" | "STANDARD") {
  return {
    purpose: "REPLACEMENT", keyId: "rzp_test_synthetic", subscriptionId: "synthetic-replacement-subscription",
    changeId: "synthetic-replacement-change", processingUrl: "/org/org-pilot/billing/processing/synthetic-replacement-change",
    subscription: { ...current, id: "synthetic-replacement-local", position: "PENDING_REPLACEMENT", plan,
      status: "CREATED", paidThrough: null, shortName: plan === "STANDARD" ? "Standard" : "Basic" },
  };
}

async function assertNoOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
}

const languages = [
  { code: "en", lang: "en-IN", title: "Billing and plans", billedPlan: "Billed plan", methodsTitle: "Card checkout is currently active",
    renewalAction: "Change to Basic at renewal",
    basicDescription: "Core operations billed per active branch.",
    standardDescription: "For growing teams that need staff controls, analytics, and AI assistance.",
    sharedCapability: "Student records and spreadsheet import",
    premiumCapabilities: ["Staff invitations, roles and permission controls", "Branch and cross-branch advanced analytics", "AI reports and message drafting"],
  },
  { code: "hi", lang: "hi-IN", title: "बिलिंग और प्लान", billedPlan: "बिलिंग वाला प्लान", methodsTitle: "अभी कार्ड से पेमेंट चालू है",
    renewalAction: "रिन्यूअल पर Basic में बदलें",
    basicDescription: "हर सक्रिय ब्रांच के हिसाब से शुल्क, रोज़ के ज़रूरी कामों के लिए।",
    standardDescription: "बढ़ती टीमों के लिए स्टाफ नियंत्रण, विस्तृत आँकड़े और AI की मदद।",
    sharedCapability: "छात्रों के रिकॉर्ड और स्प्रेडशीट से इम्पोर्ट",
    premiumCapabilities: ["स्टाफ को निमंत्रण, भूमिकाएँ और अनुमति नियंत्रण", "एक या कई ब्रांच के विस्तृत आँकड़े", "AI रिपोर्ट और संदेश के ड्राफ़्ट"],
  },
  { code: "hinglish", lang: "hi-Latn-IN", title: "Billing aur plans", billedPlan: "Billing wala plan", methodsTitle: "Abhi card checkout active hai",
    renewalAction: "Renewal par Basic mein badlein",
    basicDescription: "Har active branch ke hisaab se billing, roz ke zaroori kaamon ke liye.",
    standardDescription: "Badhti teams ke liye staff controls, analytics aur AI ki madad.",
    sharedCapability: "Student records aur spreadsheet import",
    premiumCapabilities: ["Staff invitations, roles aur permission controls", "Branch aur cross-branch advanced analytics", "AI reports aur message drafting"],
  },
] as const;

for (const language of languages) {
  test(`dedicated billing remains navigable without overflow in ${language.code}`, async ({ page }, info) => {
    await installBillingFixture(page);
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`/org/org-pilot/billing?mode=after&lang=${language.code}`);
    await expect(page.getByRole("heading", { level: 1, name: language.title })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", language.lang);
    await expect(page.locator("#billing").getByText(language.billedPlan, { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: language.methodsTitle, exact: true })).toBeVisible();
    if (language.code !== "en") {
      await expect(page.getByText("Billed plan", { exact: true })).toHaveCount(0);
      await expect(page.getByRole("heading", { name: "Card checkout is currently active", exact: true })).toHaveCount(0);
    }
    for (const section of ["billing", "plans", "subscription", "invoices", "history"]) {
      await expect(page.locator(`#${section}`)).toBeAttached();
    }
    const sectionNavigation = page.locator("nav").filter({ has: page.locator('button[aria-current="location"]') });
    await expect(sectionNavigation.getByRole("button")).toHaveCount(5);
    await sectionNavigation.getByRole("button").nth(1).click();
    await expect(page.locator("#billing-plans-title")).toBeInViewport();
    const plans = page.locator("#plans");
    await expect(plans.getByRole("heading", { name: "Basic", exact: true })).toBeVisible();
    await expect(plans.getByRole("heading", { name: "Standard", exact: true })).toBeVisible();
    await expect(plans.getByRole("heading", { name: "Pro", exact: true })).toBeVisible();
    await expect(plans.getByText(language.basicDescription, { exact: true })).toBeVisible();
    await expect(plans.getByText(language.standardDescription, { exact: true })).toBeVisible();
    await expect(plans.getByText(language.sharedCapability, { exact: true })).toHaveCount(3);
    await expect(plans.getByRole("button", { name: language.renewalAction, exact: true })).toBeEnabled();
    for (const label of language.premiumCapabilities) {
      await expect(plans.getByText(label, { exact: true })).toHaveCount(2);
    }
    if (language.code !== "en") {
      await expect(plans.getByText(languages[0].basicDescription, { exact: true })).toHaveCount(0);
      await expect(plans.getByText(languages[0].standardDescription, { exact: true })).toHaveCount(0);
      await expect(plans.getByText(languages[0].sharedCapability, { exact: true })).toHaveCount(0);
    }
    await assertNoOverflow(page);
    await page.evaluate(() => document.fonts.ready);
    await plans.screenshot({ path: info.outputPath(`billing-plans-${language.code}.png`), animations: "disabled" });
    expect(errors).toEqual([]);
  });
}

test("owner navigation and legacy billing links reach the dedicated page", async ({ page }) => {
  await installBillingFixture(page);
  await page.goto("/org/org-pilot/settings?mode=after&lang=en");
  await expect(page.getByRole("heading", { name: "Organization Settings", exact: true })).toBeVisible();
  const billingLink = page.getByRole("link", { name: "Manage billing", exact: true });
  await expect(billingLink).toHaveAttribute("href", "/org/org-pilot/billing");
  await billingLink.click();
  await expect(page.getByRole("heading", { name: "Billing and plans", exact: true })).toBeVisible();
  await page.goto("/org/org-pilot/settings?mode=after&lang=en#billing");
  await expect(page).toHaveURL(/\/org\/org-pilot\/billing\?mode=after&lang=en#billing$/);
  await expect(page.getByRole("heading", { name: "Billing and plans", exact: true })).toBeVisible();
  await page.goto("/org/org-pilot/settings?mode=after&lang=en&billingPlan=BASIC&returnTo=%2Fbranch%2Fpilot#billing");
  await expect(page).toHaveURL(/\/org\/org-pilot\/billing\?.*billingPlan=BASIC.*returnTo=%2Fbranch%2Fpilot#billing$/);
  await expect(page.getByRole("dialog", { name: "Authorize a replacement mandate for Basic", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await assertNoOverflow(page);
});

test("Basic reviews a card replacement and launches only the returned checkout without granting Standard access", async ({ page }) => {
  const fixture = await installBillingFixture(page, "BASIC");
  const mutations: string[] = [];
  page.on("request", request => {
    if (request.method() !== "GET" && new URL(request.url()).pathname.includes("/billing/")) mutations.push(request.url());
  });
  await page.route("**/api/organizations/org-pilot/billing/subscription", route => {
    expect(route.request().method()).toBe("PATCH");
    expect(route.request().postDataJSON()).toMatchObject({ plan: "STANDARD" });
    return route.fulfill({ json: replacementCheckout(fixture.billingOverview.current, "STANDARD") });
  });
  await page.goto("/org/org-pilot/billing?mode=after&lang=en");
  const plans = page.locator("#plans");
  await expect(plans.getByText(/— Standard or Pro/)).toHaveCount(3);
  await expect(plans.getByText("Staff invitations, roles and permission controls", { exact: true })).toHaveCount(2);
  await expect(plans.getByText("Branch and cross-branch advanced analytics", { exact: true })).toHaveCount(2);
  await expect(plans.getByText("AI reports and message drafting", { exact: true })).toHaveCount(2);
  await expect(plans.getByRole("button", { name: "Current plan", exact: true })).toBeDisabled();
  await plans.getByRole("button", { name: "Upgrade to Standard", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Authorize a replacement mandate for Standard", exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("This subscription change requires a new recurring payment authorization in Razorpay.");
  await expect(dialog).toContainText("Lab Lords charge today");
  await expect(dialog).toContainText("Downgrades wait until cutover.");
  const confirm = dialog.getByRole("button", { name: "Continue to Razorpay", exact: true });
  await expect(confirm).toBeEnabled();
  expect(mutations).toEqual([]);
  await confirm.click();
  await expect.poll(() => page.evaluate(() => Reflect.get(window, "__billingTestCheckouts"))).toEqual([
    { subscriptionId: "synthetic-replacement-subscription", rememberCustomer: false },
  ]);
  expect(mutations).toHaveLength(1);
  await expect(dialog).toHaveCount(0);
  await expect(plans.getByRole("button", { name: "Current plan", exact: true })).toBeDisabled();
  expect(fixture.billingOverview.experience.effectivePlan).toBe("BASIC");
  await assertNoOverflow(page);
});

test("invoices retain earlier rows and retry the same cursor after a failed page", async ({ page }) => {
  await installBillingFixture(page);
  const first = { id: "synthetic-invoice-001", status: "paid", amountSubunits: 29_900, currency: "INR",
    paidAt: "2026-09-22T09:30:00.000Z", createdAt: "2026-09-22T09:30:00.000Z", providerMode: "TEST" };
  const second = { ...first, id: "synthetic-invoice-002" };
  const cursors: Array<string | null> = [];
  let failed = false;
  await page.route("**/api/organizations/org-pilot/billing/invoices*", async route => {
    const cursor = new URL(route.request().url()).searchParams.get("cursor");
    cursors.push(cursor);
    if (cursor && !failed) {
      failed = true;
      return route.fulfill({ status: 503, json: { error: "Unable to load invoices." } });
    }
    return route.fulfill({ json: cursor ? { items: [first, second], nextCursor: null }
      : { items: [first], nextCursor: "synthetic-cursor-1" } });
  });
  await page.goto("/org/org-pilot/billing?mode=after&lang=en");
  const invoices = page.locator("#invoices");
  await expect(invoices.locator("article")).toHaveCount(1);
  await invoices.getByRole("button", { name: "Load more invoices", exact: true }).click();
  await expect(invoices.getByRole("alert")).toBeVisible();
  await expect(invoices.locator("article")).toHaveCount(1);
  await invoices.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(invoices.locator("article")).toHaveCount(2);
  await expect(invoices.getByRole("alert")).toHaveCount(0);
  await expect(invoices.getByRole("button", { name: "Load more invoices", exact: true })).toHaveCount(0);
  expect(cursors.slice(-2)).toEqual(["synthetic-cursor-1", "synthetic-cursor-1"]);
  await expect(invoices).toContainText("Test mode");
  await assertNoOverflow(page);
});

test("successful recovery refresh permits a later plan change through replacement Checkout", async ({ page }) => {
  const fixture = await installBillingFixture(page);
  const recoveredExperience = { ...fixture.billingOverview.experience };
  const operation = {
    id: "recover-change", type: "PLAN_DOWNGRADE", status: "FAILED", returnPath: null,
    confirmationDeadlineAt: null, effectiveAt: null, failureCategory: "MANUAL_REVIEW_REQUIRED",
    failureCode: "SCHEDULED_UNDO_OUTCOME_UNKNOWN", providerPaymentId: null, branchId: null,
    toPlan: "BASIC", toQuantity: 1, lastError: "A billing change needs recovery.",
  };
  Object.assign(fixture.billingOverview.experience, {
    customerState: "PAYMENT_FAILED", customerMessage: "A billing change needs recovery.",
    paymentAction: "RETRY_BILLING_CHANGE", activeOperation: operation,
    latestOperation: operation, hasActiveOperation: true,
  });
  let recoveryCalls = 0;
  const planCommands: unknown[] = [];
  await page.route("**/api/organizations/org-pilot/billing/mutations/recover-change/retry", route => {
    expect(route.request().method()).toBe("POST");
    recoveryCalls += 1;
    Object.assign(fixture.billingOverview.experience, recoveredExperience);
    return route.fulfill({ json: { recovered: true } });
  });
  await page.route("**/api/organizations/org-pilot/billing/subscription", route => {
    expect(route.request().method()).toBe("PATCH");
    expect(route.request().headers()["idempotency-key"]).toBeTruthy();
    planCommands.push(route.request().postDataJSON());
    return route.fulfill({ json: replacementCheckout(fixture.billingOverview.current, "BASIC") });
  });
  await page.goto("/org/org-pilot/billing?mode=after&lang=en");
  const pendingPlanButtons = page.locator("#plans").getByRole("button", { name: "Authorization in progress", exact: true });
  await expect(pendingPlanButtons).toHaveCount(2);
  for (const button of await pendingPlanButtons.all()) await expect(button).toBeDisabled();
  await page.locator("#billing").getByRole("button", { name: "Retry billing change", exact: true }).click();
  const change = page.locator("#plans").getByRole("button", { name: "Change to Basic at renewal", exact: true });
  await expect(change).toBeEnabled();
  await change.click();
  await page.getByRole("dialog").getByRole("button", { name: "Continue to Razorpay", exact: true }).click();
  await expect.poll(() => planCommands.length).toBe(1);
  expect(planCommands[0]).toMatchObject({ plan: "BASIC" });
  expect(recoveryCalls).toBe(1);
  await expect.poll(() => page.evaluate(() => Reflect.get(window, "__billingTestCheckouts"))).toEqual([
    { subscriptionId: "synthetic-replacement-subscription", rememberCustomer: false },
  ]);
  expect(fixture.billingOverview.experience.effectivePlan).toBe("STANDARD");
  await assertNoOverflow(page);
});

for (const surface of ["overview", "processing"] as const) {
  test(`replacement retry on ${surface} reopens the nested existing Checkout without a new plan request`, async ({ page }) => {
    const fixture = await installBillingFixture(page, "BASIC");
    const checkout = replacementCheckout(fixture.billingOverview.current, "STANDARD");
    const operation = {
      id: checkout.changeId, organizationId: "org-pilot", type: "PLAN_UPGRADE", status: "AWAITING_PAYMENT",
      queueStatus: "AWAITING_PAYMENT", operationStatus: "DECLINED", returnPath: null,
      confirmationDeadlineAt: null, effectiveAt: null, failureCategory: null, failureCode: null,
      providerPaymentId: null, branchId: null, toPlan: "STANDARD", toQuantity: 1, lastError: null, message: null,
      createdAt: "2026-10-22T00:00:00Z", updatedAt: "2026-10-22T00:00:00Z",
    };
    Object.assign(fixture.billingOverview.experience, { paymentAction: "RETRY_AUTHORIZATION",
      customerState: "PAYMENT_DECLINED", activeOperation: operation, latestOperation: operation, hasActiveOperation: true });
    const requests: string[] = [];
    page.on("request", request => {
      if (request.method() !== "GET" && new URL(request.url()).pathname.includes("/billing/")) requests.push(new URL(request.url()).pathname);
    });
    await page.route(`**/api/organizations/org-pilot/billing/mutations/${checkout.changeId}`, route => route.fulfill({ json: { operation, processingUrl: checkout.processingUrl } }));
    await page.route(`**/api/organizations/org-pilot/billing/mutations/${checkout.changeId}/retry`, route => {
      expect(route.request().method()).toBe("POST");
      return route.fulfill({ json: { operation: { ...operation, operationStatus: "CHECKOUT_OPEN" }, processingUrl: checkout.processingUrl, checkout } });
    });
    const path = surface === "overview" ? "/org/org-pilot/billing" : checkout.processingUrl;
    await page.goto(`${path}?mode=after&lang=en`);
    await page.getByRole("button", { name: surface === "overview" ? "Retry authorization" : "Retry safely", exact: true }).click();
    await expect.poll(() => page.evaluate(() => Reflect.get(window, "__billingTestCheckouts"))).toEqual([
      { subscriptionId: checkout.subscriptionId, rememberCustomer: false },
    ]);
    expect(requests).toEqual([`/api/organizations/org-pilot/billing/mutations/${checkout.changeId}/retry`]);
    expect(new URL(page.url()).pathname).toBe(path);
    if (surface === "processing") {
      await expect(page.getByRole("heading", { name: "Verifying with Razorpay", exact: true })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Authorization was not confirmed", exact: true })).toHaveCount(0);
    }
    expect(fixture.billingOverview.experience.effectivePlan).toBe("BASIC");
    await assertNoOverflow(page);
  });
}

test("revoking a recorded replacement grant removes the complimentary access notice", async ({ page }) => {
  const fixture = await installBillingFixture(page, "BASIC");
  const candidate = replacementCheckout(fixture.billingOverview.current, "STANDARD").subscription;
  Object.assign(candidate, { status: "AUTHENTICATED" });
  const change = { id: "upgrade-notice", type: "PLAN_UPGRADE", status: "SCHEDULED",
    organizationSubscriptionId: fixture.billingOverview.current.id, replacementSubscriptionId: candidate.id,
    effectiveAt: "2027-01-22T00:00:00Z", undoCutoffAt: "2027-01-19T00:00:00Z",
    accessGrantedAt: "2026-10-22T00:00:00Z", accessRevokedAt: null as string | null, failureCategory: null };
  Object.assign(fixture.billingOverview, { pendingReplacement: candidate, scheduledChanges: [change] });
  Object.assign(fixture.billingOverview.entitlements, { effectivePlan: "STANDARD" });
  Object.assign(fixture.billingOverview.experience, { effectivePlan: "STANDARD" });
  await page.goto("/org/org-pilot/billing?mode=after&lang=en");
  const notice = page.getByText("Complimentary upgrade access is active while billing remains on the current subscription.", { exact: true });
  await expect(notice).toBeVisible();
  const summary = page.getByRole("region", { name: "Current subscription", exact: true });
  await expect(summary.locator("dl > div").filter({ has: page.locator("dt", { hasText: /^Billed plan$/ }) })).toContainText("Basic");
  await expect(summary.locator("dl > div").filter({ has: page.locator("dt", { hasText: /^Current access$/ }) })).toContainText("Standard");
  await expect(summary).toContainText("₹99/month");
  await expect(summary).not.toContainText("₹299/month");
  change.accessRevokedAt = "2026-10-23T00:00:00Z";
  Object.assign(fixture.billingOverview.entitlements, { effectivePlan: "BASIC" });
  Object.assign(fixture.billingOverview.experience, { effectivePlan: "BASIC" });
  await page.reload();
  await expect(page.getByRole("region", { name: "Pending subscription replacement" })).toBeVisible();
  await expect(notice).toHaveCount(0);
});


test("authenticated trial cancellation requires confirmation and preserves trial dates", async ({ page }) => {
  const fixture = await installBillingFixture(page, "BASIC");
  const trialEndsAt = "2027-01-22T00:00:00.000Z";
  Object.assign(fixture.billingOverview, { trial: { status: "ACTIVE", source: "OWNER", organizationId: "org-pilot", startedAt: "2026-12-23T00:00:00Z", endsAt: trialEndsAt } });
  Object.assign(fixture.billingOverview.current, { status: "AUTHENTICATED", currentStart: null, currentEnd: null, paidThrough: null, providerStartAt: trialEndsAt, chargeAt: trialEndsAt });
  Object.assign(fixture.billingOverview.experience, { effectivePlan: "STANDARD_TRIAL", customerState: "TRIAL_ACTIVE", paidThrough: null, trialEndsAt, authorizationStatus: "AUTHORIZED", nextChargeAt: trialEndsAt });
  const calls: string[] = [];
  await page.route("**/api/organizations/org-pilot/billing/subscription/cancel", route => {
    expect(route.request().method()).toBe("POST");
    expect(route.request().headers()["idempotency-key"]).toBeTruthy();
    calls.push(route.request().url());
    Object.assign(fixture.billingOverview.experience, { scheduledChanges: [{ id: "trial-cancel", type: "CANCELLATION", status: "SCHEDULED", effectiveAt: trialEndsAt }] });
    return route.fulfill({ json: { cancelled: false, scheduled: true, subscription: fixture.billingOverview.current } });
  });
  await page.goto("/org/org-pilot/billing?mode=after&lang=en");
  const controls = page.locator("#subscription");
  await controls.getByRole("button", { name: "Cancel before first charge", exact: true }).click();
  const confirmation = page.getByRole("alertdialog", { name: "Cancel the authorized subscription?", exact: true });
  await expect(confirmation).toContainText("Your Standard trial keeps its original end date.");
  expect(calls).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(confirmation).toHaveCount(0);
  expect(calls).toEqual([]);
  await controls.getByRole("button", { name: "Cancel before first charge", exact: true }).click();
  await confirmation.getByRole("button", { name: "Schedule cancellation", exact: true }).click();
  await expect(controls.getByRole("button", { name: "Undo cancellation", exact: true })).toBeVisible();
  await expect(controls.getByRole("button", { name: "Cancel before first charge", exact: true })).toHaveCount(0);
  expect(calls).toHaveLength(1);
  expect(fixture.billingOverview.experience.trialEndsAt).toBe(trialEndsAt);
  expect(fixture.billingOverview.current.providerStartAt).toBe(trialEndsAt);
  await assertNoOverflow(page);
});

test("Pro shows its billed identity, WhatsApp conditions and both downgrade destinations", async ({ page }) => {
  await installBillingFixture(page, "PRO");
  await page.goto("/org/org-pilot/billing?mode=after&lang=en");
  const plans = page.locator("#plans");
  await expect(plans.getByRole("button", { name: "Current plan", exact: true })).toBeDisabled();
  await expect(plans.getByRole("button", { name: "Change to Standard at renewal", exact: true })).toBeEnabled();
  await expect(plans.getByRole("button", { name: "Change to Basic at renewal", exact: true })).toBeEnabled();
  await expect(plans.getByText(/unlimited messages are not included/)).toBeVisible();
  await expect(page.locator("#billing")).toContainText("₹499/month");
  await assertNoOverflow(page);
});
