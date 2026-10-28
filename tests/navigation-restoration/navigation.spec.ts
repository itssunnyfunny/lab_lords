import { reviewEvidencePath } from "../browser/helpers/review-evidence";
import fs from "node:fs";
import { expect, test } from "@playwright/test";
import { translateOwnedText } from "../../lib/i18n";
import { buildTopSearchResults } from "../../lib/topSearch";
import { installSettingsRouteFixture } from "../application-design-pilot/settings-route-closeout-fixture";

const evidence = reviewEvidencePath("docs/redesign/navigation-restoration-evidence/2026-10-24-brand-correction");
test.beforeEach(async ({ page }) => {
    await page.route("**/*", route => new URL(route.request().url()).hostname === "127.0.0.1" ? route.continue() : route.abort());
    await page.route(/\/api\/branches\/pilot\/renewals(?:\?.*)?$/, route => route.fulfill({ json: { items: [{ key: "due", studentId: "student-aarav", studentName: "Aarav Mehta", phone: null, studentStatus: "ACTIVE", paymentId: "payment-monthly-aarav", type: "MONTHLY", periodStart: "2026-09-01T00:00:00Z", periodEnd: "2026-09-30T00:00:00Z", dueDate: "2026-09-01T00:00:00Z", amount: 700, expected: false, allocations: [], followUp: null }], counts: { ALL: 1, OVERDUE: 1 }, outstandingAmount: 700, expectedAmount: 0, nextCursor: null, asOf: "2026-09-22" } }));
    await page.route("**/api/branches/pilot/dashboard/settings", route => route.fulfill({ json: { utilizationThreshold: 35 } }));
    await page.route(/\/api\/branches\/pilot\/dashboard\/attendance-gaps(?:\?.*)?$/, route => route.fulfill({ json: { items: [], total: 0, nextCursor: null, today: "2026-09-22", timezone: "Asia/Kolkata" } }));
});

test("restored navigation stays in the selected design in all three languages", async ({ page }, info) => {
    const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    for (const language of ["en", "hi", "hinglish"] as const) {
        await page.goto(`/branch/pilot?mode=after&lang=${language}`);
        await expect(page.getByRole("heading", { name: "Shanti Study Library", exact: true })).toBeVisible();
        const compact = info.project.name !== "desktop-1440";
        if (compact) {
            await expect(page.locator('header').getByRole('link', { name: translateOwnedText(language, "Account settings"), exact: true })).toBeVisible();
            await page.getByRole("button", { name: translateOwnedText(language, "Open navigation"), exact: true }).click();
        }
        const nav = page.locator('aside[data-dashboard-navigation="true"]');
        await expect(nav.locator('.reference-sidebar-wordmark')).toHaveText('Lab Lords');
        await expect(nav).toHaveCSS('background-color', 'rgb(244, 248, 242)');
        if (compact) {
            const drawer = page.getByRole('dialog', { name: translateOwnedText(language, 'Branch navigation'), exact: true });
            await expect(drawer.getByRole('combobox', { name: translateOwnedText(language, 'Interface language'), exact: true })).toHaveCount(0);
            await expect(nav.locator('a[href="/branch/pilot"]')).toHaveCount(2);
            expect((await nav.locator('a[href="/branch/pilot/students"]').boundingBox())!.height).toBeGreaterThanOrEqual(44);
        }
        for (const href of ["/org/org-pilot", "/branch/pilot/dashboard-settings"]) await expect(nav.locator(`a[href="${href}"]`)).toHaveCount(1);
        for (const href of ["/account", "/onboarding", "/branch/pilot/ai/messages"]) await expect(nav.locator(`a[href="${href}"]`)).toHaveCount(0);
        await expect(nav.locator('nav[aria-label] a[href="/org/org-pilot"]')).toHaveCount(1);
        await nav.locator('a[href="/branch/pilot/dashboard-settings"]').scrollIntoViewIfNeeded();
        fs.mkdirSync(evidence, { recursive: true });
        if (language === "en") await page.screenshot({ path: `${evidence}/navigation-${info.project.name}.png`, animations: "disabled" });
        if (compact) await page.getByRole("button", { name: translateOwnedText(language, "Close navigation"), exact: true }).click();
        await expect(page.locator('.rd-quick a[href="/branch/pilot/onboarding/import"]')).toHaveCount(1);
        await expect(page.locator('.rd-quick a[href="/branch/pilot/ai/messages"]')).toHaveCount(0);
        await expect(page.getByRole("combobox", { name: translateOwnedText(language, "Switch organization"), exact: true })).toHaveCount(0);
        await expect(page.getByLabel(translateOwnedText(language, "Current organization"), { exact: true })).toBeVisible();
        await expect(page.locator('section[aria-label] a[href*="paymentId=payment-monthly-aarav"]').first()).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
        if (language === "hi") await page.screenshot({ path: `${evidence}/dashboard-hi-${info.project.name}.png`, fullPage: false, animations: "disabled" });
    }
    expect(errors).toEqual([]);
});

test("notification filters update an already mounted follow-up list and phone search reaches its API", async ({ page }) => {
    const searches: string[] = [];
    await page.route(/\/api\/branches\/pilot\/dashboard\/follow-ups(?:\?.*)?$/, route => {
        searches.push(new URL(route.request().url()).searchParams.get("search") ?? "");
        return route.fulfill({ json: { items: [], counts: { pending: 2, dueToday: 1, completed: 0 }, nextCursor: null } });
    });
    await page.route("**/api/branches/pilot/dashboard/notifications", route => route.fulfill({ json: { items: [{ key: "follow-up-test", kind: "FOLLOW_UP", count: 1, href: "/branch/pilot/follow-ups?filter=DUE", read: false, dismissed: false, snoozedUntil: null }], unreadCount: 1 } }));
    await page.goto("/branch/pilot/follow-ups?mode=after&lang=en");
    await expect(page.getByRole("combobox", { name: "Status", exact: true })).toHaveText("Follow-ups pending");
    await page.getByRole("button", { name: "Notifications", exact: true }).click();
    await page.getByRole("dialog", { name: "Notifications", exact: true }).getByRole("link", { name: /Follow-ups due/ }).click();
    await expect(page.getByRole("combobox", { name: "Status", exact: true })).toHaveText("Due today");
    await page.getByRole("searchbox", { name: "Search by name or phone", exact: true }).fill("5550100");
    await expect.poll(() => searches.at(-1)).toBe("5550100");
});

test("search opens admission and Payments exposes its existing collection picker", async ({ page }, info) => {
    const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    await page.route(/\/api\/branches\/pilot\/search(?:\?.*)?$/, route => route.fulfill({ json: buildTopSearchResults({ branchId: "pilot", query: new URL(route.request().url()).searchParams.get("q") ?? "", access: { permissions: { students: true } } }) }));
    await page.goto("/branch/pilot?mode=after&lang=en");
    if (info.project.name !== "desktop-1440") await page.getByRole("button", { name: "Search current branch", exact: true }).click();
    const search = page.getByRole("combobox", { name: "Search current branch", exact: true });
    await search.fill("Add Student");
    await page.getByRole("option", { name: /Add Student/ }).click();
    await expect(page.getByRole("dialog", { name: "Add new student", exact: true })).toBeVisible();
    await page.goto("/branch/pilot/payments?mode=after&lang=en");
    await page.getByRole("button", { name: "Record payment", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Record payment", exact: true })).toBeVisible();
    expect(errors).toEqual([]);
});

test("attendance gaps page beyond the old eight-row preview for a students-only viewer", async ({ page }) => {
    await page.route(/\/api\/branches\/pilot\/dashboard\/attendance-gaps(?:\?.*)?$/, route => {
        const second = Boolean(new URL(route.request().url()).searchParams.get("cursor"));
        return route.fulfill({ json: { items: Array.from({ length: second ? 5 : 50 }, (_, index) => ({ id: `gap-${second ? index + 50 : index}`, name: `Gap student ${second ? index + 50 : index}`, expectedBy: "09:00" })), total: 55, nextCursor: second ? null : "gap-49", today: "2026-09-22", timezone: "Asia/Kolkata" } });
    });
    await page.goto("/branch/pilot/dashboard-settings?mode=after&lang=en&role=restricted&section=expectations&filter=gaps");
    await expect(page.getByText("Gap student 49", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Next Attendance gaps", exact: true }).click();
    await expect(page.getByText("Gap student 54", { exact: true })).toBeVisible();
    await expect(page.getByText("Gap student 0", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Next Attendance gaps", exact: true })).toBeDisabled();
    await page.getByRole("button", { name: "Previous Attendance gaps", exact: true }).click();
    await expect(page.getByText("Gap student 0", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Save expectation", exact: true })).toHaveCount(0);
});

test("WhatsApp initial failures stay visible and retry without enabling rollout gates", async ({ page }) => {
    await installSettingsRouteFixture(page);
    let fail = true; let requests = 0;
    await page.route(/\/api\/(?:organizations\/org-pilot|branches\/pilot)\/whatsapp(?:\/.*)?$/, route => {
        requests++;
        return route.fulfill({ status: fail ? 503 : 200, json: fail ? { error: "Synthetic unavailable" } : { enabled: false, availableSenders: [], assignment: null, canManage: false } });
    });
    for (const path of ["/branch/pilot/settings", "/org/org-pilot/settings"]) {
        fail = true;
        await page.goto(`${path}?mode=after&lang=en`);
        const panel = page.locator("#whatsapp");
        await expect(panel.getByRole("alert")).toBeVisible();
        const before = requests; fail = false;
        await panel.getByRole("button", { name: "Retry", exact: true }).click();
        await expect.poll(() => requests).toBeGreaterThan(before);
        await expect(panel).toHaveCount(0);
    }
});

test("branch billing removal requires review and retains its exact retry identity before undo", async ({ page }) => {
    const fixture = await installSettingsRouteFixture(page);
    fixture.org.branches.push({ ...fixture.org.branches[0], id: "second", name: "Second branch" }); fixture.org._count.branches = 2;
    const keys: string[] = []; let undone = false;
    await page.route("**/api/branches/pilot/billing-removal", async route => {
        if (route.request().method() === "DELETE") { undone = true; return route.fulfill({ json: { undone: true } }); }
        keys.push(route.request().headers()["idempotency-key"]);
        if (keys.length === 1) return route.abort("connectionreset");
        return route.fulfill({ status: 202, json: { action: "NONE", change: { id: "removal-pilot", effectiveAt: "2026-11-01T00:00:00Z" } } });
    });
    await page.goto("/org/org-pilot/settings?mode=after&lang=en");
    await page.getByRole("button", { name: "Schedule branch removal", exact: true }).first().click();
    expect(keys).toEqual([]);
    let dialog = page.getByRole("dialog", { name: "Schedule branch removal", exact: true });
    await dialog.getByRole("button", { name: "Confirm branch removal", exact: true }).click();
    await expect(dialog.getByRole("alert")).toBeVisible();
    await page.reload();
    await page.getByRole("button", { name: "Resume branch removal", exact: true }).click();
    dialog = page.getByRole("dialog", { name: "Schedule branch removal", exact: true });
    await dialog.getByRole("button", { name: "Retry same request", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    expect(keys).toHaveLength(2); expect(keys[0]).toBeTruthy(); expect(keys[1]).toBe(keys[0]);
    await page.getByRole("button", { name: "Undo branch removal", exact: true }).click();
    dialog = page.getByRole("dialog", { name: "Undo branch removal", exact: true });
    await dialog.getByRole("button", { name: "Undo branch removal", exact: true }).click();
    await expect(dialog).toHaveCount(0); expect(undone).toBe(true);
});

test("saved recipes support explicit deletion and retain past-import context", async ({ page }) => {
    let deleted = false; let deletes = 0;
    await page.route("**/api/branches/pilot/import-recipes", route => route.fulfill({ json: deleted ? [] : [{ id: "recipe-pilot", name: "Synthetic saved recipe" }] }));
    await page.route("**/api/branches/pilot/import-recipes/recipe-pilot", route => { expect(route.request().method()).toBe("DELETE"); deletes++; deleted = true; return route.fulfill({ json: { deleted: true } }); });
    await page.goto("/branch/pilot/onboarding/import?mode=after&lang=en");
    await page.getByRole("button", { name: "Saved import recipes", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Saved import recipes", exact: true });
    await dialog.getByRole("button", { name: "Delete", exact: true }).click();
    expect(deletes).toBe(0);
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await dialog.getByRole("button", { name: "Delete", exact: true }).click();
    await dialog.getByRole("button", { name: "Confirm recipe deletion", exact: true }).click();
    await expect(dialog.getByText("No saved import recipes.", { exact: true })).toBeVisible();
    expect(deletes).toBe(1);
});

test("account settings retain read-only information and return directly to the workspace", async ({ page }, info) => {
    await installSettingsRouteFixture(page);
    await page.goto("/account?mode=after&lang=en&returnTo=%2Fbranch%2Fpilot%2Fpayments");
    await expect(page.getByRole("heading", { name: "Account Settings", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Profile", exact: true })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Switch branch", exact: true })).toHaveCount(0);
    await expect(page.getByLabel("Current organization", { exact: true })).toHaveCount(0);
    await expect(page.locator('main a[href^="/org/"]')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Back to workspace', exact: true })).toHaveAttribute('href', '/branch/pilot/payments');
    await expect(page.getByRole('button', { name: 'Open navigation', exact: true })).toHaveCount(0);
    await expect(page.locator('aside')).toHaveCount(0);
    await expect(page.locator('a[href="/app"], a[href="/org"]')).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "System Info", exact: true })).toHaveCount(1);
    await expect(page.getByRole("heading", { name: "Access", exact: true })).toHaveCount(0);
    await expect(page.locator('[data-app-design-pilot="workspace"]')).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await page.screenshot({ path: `${evidence}/account-cleanup-${info.project.name}.png`, animations: "disabled" });
    await page.goto('/account?mode=after&lang=en&returnTo=https%3A%2F%2Fevil.test');
    await expect(page.getByRole('link', { name: 'Back to workspace', exact: true })).toHaveAttribute('href', '/org/org-pilot');
});

test("cold loading fills the light canvas and consent uses the current shared controls", async ({ page }, info) => {
    await page.goto("/branch/pilot?mode=after&lang=en&boundary=loading");
    const loading = page.locator('.ui-route-loading');
    await expect(loading).toBeVisible();
    expect((await loading.boundingBox())!.height).toBeGreaterThanOrEqual(page.viewportSize()!.height);
    await expect(page.evaluate(() => getComputedStyle(document.body).backgroundColor)).resolves.toBe("rgb(255, 251, 244)");
    await page.goto("/branch/pilot?mode=after&lang=en&cookie=review");
    const consent = page.getByRole("complementary", { name: "Cookie preferences", exact: true });
    await expect(consent.locator('.ui-panel--compact')).toBeVisible();
    for (const label of ["Accept analytics", "Reject"]) {
        const button = consent.getByRole("button", { name: label, exact: true });
        expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await page.screenshot({ path: `${evidence}/consent-cleanup-${info.project.name}.png`, animations: "disabled" });
    await consent.getByRole("button", { name: "Reject", exact: true }).click();
    await expect(consent).toHaveCount(0);
});

test("receipt activity links retry the exact receipt independently of the history list", async ({ page }) => {
    let fail = true; let reads = 0;
    await page.route("**/api/branches/pilot/collections/activity-receipt", route => {
        reads++;
        return route.fulfill({ status: fail ? 503 : 200, json: fail ? { error: "Synthetic unavailable" } : {
            id: "activity-receipt", receiptNumber: "ACTIVITY-1", amount: 50, collectedAt: "2026-10-22T06:00:00Z", method: "CASH", reference: null, voidedAt: null, voidReason: null,
            snapshot: { version: 1, branchName: "Shanti Study Library", organizationName: "Shanti Learning Spaces", address: null, contactPhone: null, studentName: "Aarav Mehta", studentId: "student-aarav", recordedBy: "Synthetic owner", recordedById: "pilot-owner", collectedAt: "2026-10-22T06:00:00Z", amount: 50, method: "CASH", reference: "", note: "", remainingBalance: 650, allocations: [] },
        } });
    });
    await page.goto("/branch/pilot/payments?mode=after&lang=en&collectionId=activity-receipt");
    const error = page.getByRole("alert").filter({ hasText: "Unable to retrieve the receipt" });
    await expect(error).toBeVisible();
    fail = false; await error.getByRole("button", { name: "Retry", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Fee payment receipt", exact: true })).toBeVisible();
    expect(reads).toBe(2);
});

test("Renewals applies mounted query changes and back navigation", async ({ page }) => {
    const requests: string[] = [];
    await page.route(/\/api\/branches\/pilot\/renewals(?:\?.*)?$/, route => {
        requests.push(new URL(route.request().url()).searchParams.get("filter") ?? "");
        return route.fulfill({ json: { items: [], counts: {}, outstandingAmount: 0, expectedAmount: 0, nextCursor: null, asOf: "2026-10-22" } });
    });
    await page.goto("/branch/pilot/renewals?mode=after&lang=en");
    await expect.poll(() => requests.at(-1)).toBe("ALL");
    await page.evaluate(() => { history.pushState({}, "", "/branch/pilot/renewals?mode=after&lang=en&filter=OVERDUE"); window.dispatchEvent(new PopStateEvent("popstate")); });
    await expect.poll(() => requests.at(-1)).toBe("OVERDUE");
    await page.goBack();
    await expect.poll(() => requests.at(-1)).toBe("ALL");
});
