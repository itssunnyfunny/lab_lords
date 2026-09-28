import fs from "node:fs";
import { expect, test, type Page, type Route } from "@playwright/test";

const evidence = "test-results/workspace-entry-evidence";
const closeoutEvidence = "docs/redesign/application-closeout-evidence";
function screenshotPath(name: string) {
    fs.mkdirSync(evidence, { recursive: true });
    return `${evidence}/${name}`;
}

const organizations = [
    { id: "org-pilot", name: "Shanti Learning Spaces" },
    { id: "org-second", name: "Second Reading Room" },
];

const branches = [{
    id: "pilot",
    organizationId: "org-pilot",
    name: "Shanti Study Library",
    city: "Indore",
    defaultFee: 1400,
    _count: { students: 3, seats: 8, shifts: 2 },
}];

const snapshot = {
    asOf: "2026-09-28T06:00:00.000Z",
    organization: { totalBranches: 1 },
    seats: { totalSeats: 16, occupiedSeats: 2, utilizationRatio: 0.125, physicalSeats: 8, totalSlots: 16, usedSlots: 2 },
    students: { active: 3, inactive: 0, total: 3 },
    payments: { dueCount: 2, paidCount: 2, overdueCount: 2, dueAmount: 2400, paidAmount: 1900 },
    branches: [{ branchId: "pilot", branchName: "Shanti Study Library", snapshot: {
        seats: { overall: { totalSeats: 16, occupiedSeats: 2, utilizationRatio: 0.125 } },
        students: { status: { active: 3, inactive: 0, total: 3 }, seating: { seated: 2, notSeated: 1, activeStudents: 3 } },
        payments: { dueCount: 2, paidCount: 2, overdueCount: 2, dueAmount: 2400, paidAmount: 1900 },
    } }],
};

const billing = { experience: {
    organizationId: "org-pilot", accessMode: "FULL", effectivePlan: "STANDARD", selectedPostTrialPlan: "STANDARD",
    providerStatus: "active", customerState: "STANDARD_ACTIVE", customerMessage: "Standard workspace is active.",
    trialEndsAt: null, trialDaysRemaining: null, paidThrough: "2026-10-01T00:00:00.000Z",
    confirmedQuantity: 1, projectedQuantity: 1, currentUnitAmount: 499, currentMonthlyTotal: 499,
    projectedUnitAmount: 499, projectedMonthlyTotal: 499, authorizationStatus: "AUTHORIZED",
    planFeeDueToday: 0, nextChargeAt: "2026-10-01T00:00:00.000Z", paymentAction: "NONE",
    entitlements: ["STAFF_MANAGEMENT", "ORG_ANALYTICS"], latestOperation: null, activeOperation: null,
    scheduledChanges: [], branch: null, viewer: { isOwner: true, canManageBilling: true }, hasActiveOperation: false,
} };

type FixtureState = { organizations: typeof organizations; branchesFail: boolean; snapshotFail: boolean };

async function fulfillGet(route: Route, data: unknown, status = 200) {
    if (route.request().method() !== "GET") {
        await route.fulfill({ status: 405, json: { error: "Fixture is read-only" } });
        return;
    }
    await route.fulfill({ status, json: data });
}

async function installOrgFixtures(page: Page) {
    const state: FixtureState = { organizations: [...organizations], branchesFail: false, snapshotFail: false };
    await page.route(/\/api\/organizations(?:\?.*)?$/, route => fulfillGet(route, state.organizations));
    await page.route(/\/api\/organizations\/org-pilot\/branches(?:\?.*)?$/, route => fulfillGet(
        route, state.branchesFail ? { error: "Synthetic branch read failure" } : branches, state.branchesFail ? 503 : 200,
    ));
    await page.route(/\/api\/organizations\/org-pilot\/billing(?:\?.*)?$/, route => fulfillGet(route, billing));
    await page.route(/\/api\/analytics\/org\/org-pilot\/snapshot(?:\?.*)?$/, route => fulfillGet(
        route, state.snapshotFail ? { error: "Synthetic analytics read failure" } : snapshot, state.snapshotFail ? 503 : 200,
    ));
    return state;
}

function expectNoHorizontalOverflow(page: Page) {
    return expect(page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) <= innerWidth + 1)).resolves.toBe(true);
}

test("real organization selection enters the selected overview and preserves branch navigation", async ({ page }, info) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await installOrgFixtures(page);

    await page.goto("/org?mode=after&lang=en");
    await expect(page.locator('[data-app-design-pilot="workspace"]').last()).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Select workspace" })).toBeVisible();
    await expect(page.locator('[data-app-design-pilot="workspace"] svg[viewBox="0 0 180 116"]').last()).toBeVisible();
    const organization = page.getByRole("button", { name: /Shanti Learning Spaces/ });
    await expect(organization).toBeVisible();
    await expect(page.getByRole("button", { name: /Second Reading Room/ })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    if (info.project.name === "desktop-1440") {
        fs.mkdirSync(closeoutEvidence, { recursive: true });
        await page.screenshot({ path: `${closeoutEvidence}/org-selection-desktop-1440.png`, fullPage: true, animations: "disabled" });
    }
    if (info.project.name === "desktop-1440" || info.project.name === "mobile-390") {
        await organization.screenshot({ path: screenshotPath(`org-selection-card-${info.project.name}.png`), animations: "disabled" });
    }

    await organization.click();
    await expect(page).toHaveURL(/\/org\/org-pilot$/);
    await expect(page.getByRole("heading", { level: 1, name: "Open a branch dashboard" })).toBeVisible();
    if (info.project.name === "desktop-1440") {
        await expect(page.locator('aside[aria-label="Organization navigation"] svg[viewBox="0 0 180 116"]')).toBeVisible();
    } else {
        await page.getByRole("button", { name: "Open navigation" }).click();
        await expect(page.locator('aside[aria-label="Organization navigation"] svg[viewBox="0 0 180 116"]')).toBeVisible();
        await page.getByRole("button", { name: "Close navigation" }).click();
    }
    const branch = page.getByRole("link", { name: "Open Shanti Study Library dashboard" });
    await expect(branch).toHaveAttribute("href", "/branch/pilot");
    await expect(branch).toContainText("Shanti Study Library");
    await expect(branch).toContainText("Needs follow-up");
    await expectNoHorizontalOverflow(page);
    if (["desktop-1440", "mobile-390", "mobile-320"].includes(info.project.name)) {
        await branch.screenshot({ path: screenshotPath(`org-overview-branch-${info.project.name}.png`), animations: "disabled" });
    }
    expect(errors).toEqual([]);
});

test("Hindi and Hinglish workspace entry and overview remain usable at narrow widths", async ({ page }, info) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await installOrgFixtures(page);

    for (const [language, htmlLanguage, selectHeading, overviewHeading] of [
        ["hi", "hi-IN", "कार्यक्षेत्र चुनें", "ब्रांच का डैशबोर्ड खोलें"],
        ["hinglish", "hi-Latn-IN", "Workspace chunein", "Branch dashboard kholein"],
    ] as const) {
        await page.goto(`/org?mode=after&lang=${language}`);
        await expect(page.locator("html")).toHaveAttribute("lang", htmlLanguage);
        await expect(page.getByRole("heading", { level: 1, name: selectHeading })).toBeVisible();
        await expect(page.getByRole("button", { name: /Shanti Learning Spaces/ })).toBeVisible();
        await expectNoHorizontalOverflow(page);

        await page.goto(`/org/org-pilot?mode=after&lang=${language}`);
        await expect(page.locator("html")).toHaveAttribute("lang", htmlLanguage);
        await expect(page.getByRole("heading", { level: 1, name: overviewHeading })).toBeVisible();
        await expect(page.getByRole("link", { name: language === "hi"
            ? "Shanti Study Library का डैशबोर्ड खोलें"
            : "Shanti Study Library ka dashboard kholein" })).toBeVisible();
        await expectNoHorizontalOverflow(page);
        if (info.project.name === "mobile-320" && language === "hi") {
            await page.screenshot({ path: screenshotPath("org-overview-hi-mobile-320.png"), animations: "disabled" });
        }
    }
    expect(errors).toEqual([]);
});

test("overview retains branch access during an analytics failure and recovers on retry", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop-1440", "Recovery is covered at the desktop viewport.");
    const state = await installOrgFixtures(page);
    await page.goto("/org/org-pilot?mode=after&lang=en");
    const branch = page.getByRole("link", { name: "Open Shanti Study Library dashboard" });
    await expect(branch).toBeVisible();

    state.snapshotFail = true;
    await page.getByRole("button", { name: "Refresh", exact: true }).click();
    await expect(page.getByRole("button", { name: "Retry analytics" })).toBeVisible();
    await expect(branch).toBeVisible();
    state.snapshotFail = false;
    await page.getByRole("button", { name: "Retry analytics" }).click();
    await expect(page.getByRole("button", { name: "Retry analytics" })).toHaveCount(0);
    await expect(branch).toBeVisible();

    const createBranch = page.getByRole("button", { name: "Create branch" }).first();
    await createBranch.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.querySelector('[role="dialog"]')?.contains(document.activeElement))).toBe(true);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(createBranch).toBeFocused();
});

test("an empty organization directory keeps the onboarding destination", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop-1440", "The redirect destination is viewport-independent.");
    const state = await installOrgFixtures(page);
    state.organizations = [];
    await page.goto("/org?mode=after&lang=en");
    await expect(page).toHaveURL(/\/onboarding$/);
});
