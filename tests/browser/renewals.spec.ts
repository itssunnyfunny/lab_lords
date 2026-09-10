import fs from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { mockFeeCollections } from "./helpers/fee-collection";
import { refreshDevelopmentSession } from "./helpers/development-session";
import type { RenewalPage, RenewalRow } from "@/lib/renewals";

const statePath = process.env.PLAYWRIGHT_OWNER_AUTH_STATE;
const available = Boolean(statePath && fs.existsSync(statePath));
const branchId = process.env.PLAYWRIGHT_OWNER_BRANCH_ID ?? "renewals-browser-branch";
test.use({ storageState: available ? statePath : { cookies: [], origins: [] } });
test.beforeEach(() => test.skip(!available, "Set PLAYWRIGHT_OWNER_AUTH_STATE for the existing authenticated browser setup."));

async function mockQueue(page: Page) {
    const actual: RenewalRow = { key: "actual", studentId: "student", studentName: "Sample Student",
        phone: "9999999999", studentStatus: "ACTIVE", paymentId: "payment", type: "MONTHLY",
        periodStart: "2026-07-10T00:00:00.000Z", periodEnd: "2026-08-10T00:00:00.000Z",
        dueDate: "2026-08-10T00:00:00.000Z", amount: 900, expected: false, allocations: [], followUp: null };
    const expected: RenewalRow = { ...actual, key: "expected", paymentId: null, expected: true, amount: 1000,
        periodStart: "2026-08-10T00:00:00.000Z", periodEnd: "2026-09-10T00:00:00.000Z", dueDate: "2026-09-10T00:00:00.000Z" };
    const state = { paid: false, reads: 0, collectionAttempts: 0, rejectCollection: false, followUpWrites: 0 };
    await page.route("**/api/users/me", route => route.fulfill({ json: { locale: "en-IN", timezone: "Asia/Kolkata" } }));
    await page.route(`**/api/branches/${branchId}/access`, route => route.fulfill({ json: {
        branchId, branchName: "Renewals test", organizationId: "org", isOwner: true, role: "OWNER", effectivePlan: "BASIC", entitlements: [],
        permissions: { view_payments: true, mark_payment_paid: true, students: true, seat_allocation: true },
    } }));
    await page.route(`**/api/branches/${branchId}/renewals?**`, route => {
        state.reads++;
        const response: RenewalPage = { items: state.paid ? [expected] : [actual, expected],
            counts: { ALL: state.paid ? 1 : 2, TODAY: 0, UPCOMING: 1, OUTSTANDING: state.paid ? 0 : 1, OVERDUE: state.paid ? 0 : 1 },
            outstandingAmount: state.paid ? 0 : 900, expectedAmount: 1000, nextCursor: null, asOf: "2026-09-08T00:00:00.000Z" };
        return route.fulfill({ json: response });
    });
    const collection = await mockFeeCollections(page, branchId, { amount: 900, onCollected: () => { state.paid = true; } });
    Object.defineProperties(state, {
        collectionAttempts: { get: () => collection.attempts.length },
        rejectCollection: { get: () => collection.reject, set: value => { collection.reject = value; } },
    });
    await page.route(`**/api/branches/${branchId}/renewals/follow-up`, route => {
        state.followUpWrites++;
        const body = route.request().postDataJSON();
        actual.followUp = { note: body.note, outcome: body.outcome, nextFollowUpAt: body.nextFollowUpAt ? `${body.nextFollowUpAt}T00:00:00.000Z` : null,
            updatedAt: "2026-09-08T10:00:00.000Z", author: { name: "Sample Collector" } };
        return route.fulfill({ json: actual.followUp });
    });
    await refreshDevelopmentSession(page);
    await page.goto(`/branch/${branchId}/renewals`);
    await expect(page.getByRole("heading", { name: "Renewals & dues", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Collect fee", exact: true })).toBeVisible();
    return state;
}

test("collection refreshes the affected entry and totals; failure stays in the dialog", async ({ page }) => {
    const state = await mockQueue(page);
    expect(state.collectionAttempts).toBe(0);
    state.rejectCollection = true;
    await page.getByRole("button", { name: "Collect fee", exact: true }).click();
    await page.getByRole("button", { name: "Confirm collection", exact: true }).click();
    await expect(page.getByRole("dialog").getByRole("alert")).toHaveText("Collection unavailable");
    state.rejectCollection = false;
    const reads = state.reads;
    await page.getByRole("button", { name: "Confirm collection", exact: true }).click();
    await expect(page.getByRole("button", { name: "Collect fee", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Outstanding dues (0)", exact: true })).toBeVisible();
    await expect(page.getByText("Expected fee", { exact: true })).toBeVisible();
    expect(state.reads).toBeGreaterThan(reads);
    expect(state.collectionAttempts).toBe(2);
});

test("follow-up changes appear immediately and the next date can be cleared", async ({ page }) => {
    const state = await mockQueue(page);
    await page.getByRole("button", { name: "Update follow-up", exact: true }).first().click();
    await page.getByRole("textbox", { name: "Follow-up note" }).fill("Call after class");
    await page.getByLabel("Next follow-up date", { exact: true }).fill("2026-09-12");
    await page.getByRole("button", { name: "Save follow-up", exact: true }).click();
    await expect(page.getByText("Call after class", { exact: true })).toBeVisible();
    await expect(page.getByText(/Latest: Sample Collector/)).toBeVisible();
    await page.getByRole("button", { name: "Update follow-up", exact: true }).first().click();
    await page.getByRole("button", { name: "Clear follow-up date", exact: true }).click();
    await page.getByRole("button", { name: "Save follow-up", exact: true }).click();
    await expect(page.getByText("Next follow-up: Not scheduled", { exact: true })).toHaveCount(2);
    expect(state.followUpWrites).toBe(2);
});

test("manual fallback never records delivery and the queue fits a phone", async ({ page }) => {
    const writes: string[] = [];
    await page.addInitScript(() => Object.defineProperty(navigator, "clipboard", { configurable: true,
        value: { writeText: async () => undefined } }));
    await mockQueue(page);
    await page.screenshot({ path: test.info().outputPath("renewals-queue.png"), fullPage: true });
    page.on("request", request => { if (request.method() !== "GET" && request.url().includes("/api/")) writes.push(request.url()); });
    await page.getByRole("button", { name: "Reminder options", exact: true }).first().click();
    await expect(page.getByRole("button", { name: /Preview approved reminder/ })).toBeDisabled();
    await page.getByRole("button", { name: "Copy reminder", exact: true }).click();
    await expect(page.getByText("Copied for manual sharing. Delivery is not confirmed.", { exact: true })).toBeVisible();
    expect(writes).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
