import type { Page, Route } from "@playwright/test";

/** Synthetic responses for the real Settings pages. The Vite harness blocks all unhandled APIs. */
export async function installSettingsRouteFixture(page: Page) {
    const commands: Array<{ method: string; path: string; body: Record<string, unknown> }> = [];
    const now = "2026-09-22T09:30:00.000Z";
    const account = {
        id: "pilot-owner", name: "Ananya Sharma", email: "owner@example.invalid", phone: "+91 98765 43210",
        timezone: "Asia/Kolkata", locale: "en-IN", dateFormat: "dd MMM yyyy",
        interfaceLanguage: "en", documentLanguage: "en", themePreference: "system",
        densityPreference: "comfortable", defaultMessageLanguage: "en",
        defaultLandingPage: "org", createdAt: "2025-09-01T00:00:00.000Z",
        organizations: [{ id: "org-pilot", name: "Shanti Learning Spaces", businessType: "Library", branches: [{ id: "pilot" }] }],
        staff: [],
    };
    const branch = {
        id: "pilot", name: "Shanti Study Library", city: "Lucknow", address: "Hazratganj, Lucknow",
        contactPhone: "+91 98765 43210", openingTime: "06:00", closingTime: "22:00",
        defaultFee: 1400, defaultAdmissionFee: 200, defaultMessageLanguage: "en", reminderTone: "polite",
        aiEnabled: true, createdAt: "2025-09-01T00:00:00.000Z", lastDataChange: now,
        organization: { id: "org-pilot", name: "Shanti Learning Spaces" },
        _count: { seats: 16, students: 3, shifts: 2, payments: 2, staff: 1 },
        shifts: [{ id: "shift-morning", name: "Morning", startTime: "06:00", endTime: "12:00", price: 1400, isReserved: false }],
        staff: [{ id: "staff-owner", role: "OWNER", user: { id: "pilot-owner", name: "Ananya Sharma", email: "owner@example.invalid" } }],
    };
    const org = {
        id: "org-pilot", name: "Shanti Learning Spaces", businessType: "Library", legalName: "Shanti Learning Spaces",
        contactEmail: "owner@example.invalid", contactPhone: "+91 98765 43210", address: "Hazratganj, Lucknow",
        timezone: "Asia/Kolkata", currency: "INR", weekStartsOn: 1, paymentGraceDays: 5,
        ownerId: "pilot-owner", owner: { id: "pilot-owner", name: "Ananya Sharma", email: "owner@example.invalid" },
        subscription: null, createdAt: "2025-09-01T00:00:00.000Z",
        branches: [{ id: "pilot", name: "Shanti Study Library", city: "Lucknow", createdAt: "2025-09-01T00:00:00.000Z" }],
        _count: { branches: 1 },
    };
    const experience = {
        organizationId: "org-pilot", accessMode: "FULL", effectivePlan: "STANDARD", selectedPostTrialPlan: "STANDARD",
        providerStatus: "active", customerState: "STANDARD_ACTIVE", customerMessage: "Standard workspace is active.",
        trialEndsAt: null, trialDaysRemaining: null, paidThrough: "2026-10-22T00:00:00.000Z",
        confirmedQuantity: 1, projectedQuantity: 1, currentUnitAmount: 499, currentMonthlyTotal: 499,
        projectedUnitAmount: 499, projectedMonthlyTotal: 499, authorizationStatus: "AUTHORIZED",
        planFeeDueToday: 0, nextChargeAt: "2026-10-22T00:00:00.000Z", paymentAction: "NONE",
        entitlements: ["STAFF_MANAGEMENT", "ORG_ANALYTICS"], latestOperation: null, activeOperation: null,
        scheduledChanges: [], branch: null, viewer: { isOwner: true, canManageBilling: true }, hasActiveOperation: false,
    };
    const current = {
        id: "subscription-pilot", organizationId: "org-pilot", position: "CURRENT", replacesSubscriptionId: null,
        plan: "PRO", planName: "Standard", shortName: "Standard", amount: 499, amountSubunits: 49900,
        currency: "INR", period: "monthly", interval: 1, totalCount: 120, quantity: 1, unitAmount: 499,
        monthlyTotal: 499, status: "ACTIVE", razorpaySubscriptionId: "synthetic-subscription",
        currentStart: "2026-09-22T00:00:00.000Z", currentEnd: "2026-10-22T00:00:00.000Z",
        chargeAt: "2026-10-22T00:00:00.000Z", endedAt: null, providerStartAt: null,
        authorizationExpiresAt: null, providerPaymentMethod: "CARD", paidThrough: "2026-10-22T00:00:00.000Z",
        cancelAtCycleEnd: false, cancellationRequestedAt: null, cancellationScheduledAt: null, cancelledAt: null,
        createdAt: now, updatedAt: now,
    };
    const billingOverview = {
        experience, razorpayTestMode: true, multiMethodSubscriptionsEnabled: false,
        plans: [
            { id: "BASIC", name: "Basic", shortName: "Basic", amount: 299, currency: "INR", period: "monthly", interval: 1, active: true, featured: false, comingSoon: false, custom: false, description: "Essentials for one study space.", capabilities: [], entitlements: [], limits: { maxBranches: 1 } },
            { id: "PRO", name: "Standard", shortName: "Standard", amount: 499, currency: "INR", period: "monthly", interval: 1, active: true, featured: true, comingSoon: false, custom: false, description: "The complete workspace toolkit.", capabilities: [], entitlements: [], limits: { maxBranches: null } },
        ],
        current, pendingReplacement: null, history: [],
        entitlements: { organizationId: "org-pilot", plan: "PRO", effectivePlan: "PRO", subscriptionStatus: "ACTIVE", fallbackAccess: false, entitlements: ["STAFF_MANAGEMENT"], limits: { maxBranches: null }, usage: { branches: 1 }, accessMode: "FULL", canWrite: true, accessReason: "" },
        billingModelVersion: "WORKSPACE_V2", trial: null, ownerTrialEligibility: { status: "USED", claimable: false, boundOrganizationId: "org-pilot" },
        paymentMethod: "CARD", invoices: [], scheduledChanges: [],
    };
    const operation = {
        id: "change-pilot", organizationId: "org-pilot", type: "PLAN_UPGRADE", queueStatus: "DONE",
        operationStatus: "APPLIED", returnPath: "/org/org-pilot/settings#billing", confirmationDeadlineAt: null,
        failureCategory: null, failureCode: null, providerPaymentId: "synthetic-payment", message: null,
        effectiveAt: now, createdAt: now, updatedAt: now,
    };

    async function reply(route: Route, value: () => unknown, patch?: (body: Record<string, unknown>) => void) {
        const request = route.request();
        if (request.method() === "PATCH") {
            const body = request.postDataJSON() as Record<string, unknown>;
            commands.push({ method: "PATCH", path: new URL(request.url()).pathname, body });
            patch?.(body);
            return route.fulfill({ json: value() });
        }
        return route.fulfill({ json: value() });
    }

    await page.route("**/api/users/me", route => {
        if (route.request().method() === "GET") {
            const requestedLanguage = new URL(page.url()).searchParams.get("lang");
            const interfaceLanguage = requestedLanguage === "hi" || requestedLanguage === "hinglish" ? requestedLanguage : account.interfaceLanguage;
            return route.fulfill({ json: { ...account, interfaceLanguage } });
        }
        return reply(route, () => account, body => { Object.assign(account, body); });
    });
    await page.route("**/api/branches/pilot", route => reply(route, () => branch, body => { Object.assign(branch, body); }));
    await page.route("**/api/branches/pilot/billing", route => route.fulfill({ json: {
        organizationId: "org-pilot", branchStatus: "ACTIVE", inheritedPlan: "Standard", billingState: "Current",
        accessMode: "FULL", billingUrl: "/org/org-pilot/settings#billing",
    } }));
    await page.route("**/api/organizations/org-pilot", route => reply(route, () => org, body => { Object.assign(org, body); }));
    await page.route("**/api/organizations/org-pilot/billing", route => route.fulfill({ json: billingOverview }));
    await page.route("**/api/organizations/org-pilot/billing/mutations/change-pilot", route => route.fulfill({ json: {
        operation: new URL(page.url()).searchParams.get("outcome") === "declined"
            ? { ...operation, operationStatus: "DECLINED", message: "The provider did not confirm authorization." }
            : operation,
        processingUrl: "/org/org-pilot/billing/processing/change-pilot",
    } }));
    return { commands };
}
