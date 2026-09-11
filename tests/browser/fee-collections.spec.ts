import fs from "node:fs";
import { expect, test } from "@playwright/test";
import { mockFeeCollections } from "./helpers/fee-collection";
import { refreshDevelopmentSession } from "./helpers/development-session";

const statePath = process.env.PLAYWRIGHT_OWNER_AUTH_STATE;
const available = Boolean(statePath && fs.existsSync(statePath));
const branchId = process.env.PLAYWRIGHT_OWNER_BRANCH_ID ?? "fee-browser";
test.use({ storageState: available ? statePath : { cookies: [], origins: [] } });
test.beforeEach(() => test.skip(!available, "Requires the existing saved development Clerk session; API responses below are mocked."));

test("partial collection, lost-response recovery and PDF failure never double-record", async ({ page }) => {
    const state = await mockFeeCollections(page, branchId);
    await page.route(`**/api/branches/${branchId}/access`, route => route.fulfill({ json: {
        branchId, branchName: "Sample Library", organizationId: "org", isOwner: true, role: "OWNER", effectivePlan: "BASIC", entitlements: [],
        permissions: { view_payments: true, mark_payment_paid: true, students: true, seat_allocation: true },
    } }));
    await page.route(`**/api/branches/${branchId}/renewals?**`, route => route.fulfill({ json: {
        items: state.received >= 1200 ? [] : [{ key: "fee", paymentId: "payment", studentId: "student", studentName: "Sample Student", phone: null,
            studentStatus: "ACTIVE", type: "MONTHLY", periodStart: "2026-07-10T00:00:00.000Z", periodEnd: "2026-08-10T00:00:00.000Z",
            dueDate: "2026-08-10T00:00:00.000Z", amount: 1200 - state.received, expected: false, allocations: [], followUp: null }],
        counts: { ALL: 1, TODAY: 0, UPCOMING: 0, OUTSTANDING: 1, OVERDUE: 1 }, outstandingAmount: 1200 - state.received,
        expectedAmount: 0, nextCursor: null, asOf: "2026-09-10T00:00:00.000Z",
    } }));
    await refreshDevelopmentSession(page);
    await page.goto(`/branch/${branchId}/renewals`);
    await page.getByRole("button", { name: "Collect fee", exact: true }).click();
    await page.getByLabel("Amount received (whole ₹)").fill("700");
    await expect(page.getByText(/apply ₹700 · ₹500 remains/)).toBeVisible();
    state.loseResponse = true;
    await page.getByRole("button", { name: "Confirm collection", exact: true }).click();
    await page.getByRole("button", { name: "Retry same collection" }).click();
    await expect(page.getByRole("heading", { name: "Collection recorded", exact: true })).toBeVisible();
    expect(state.attempts).toHaveLength(2); expect(state.attempts[0]).toEqual(state.attempts[1]); expect(state.records.size).toBe(1);
    state.receiptFailure = true;
    await page.getByRole("button", { name: "Download PDF", exact: true }).click();
    await expect(page.getByText(/Your collection remains recorded/)).toBeVisible();
    state.receiptFailure = false;
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download PDF", exact: true }).click();
    await (await download).saveAs(test.info().outputPath("receipt.pdf"));
    expect(state.records.size).toBe(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole("button", { name: "Close dialog" }).click();
    await page.getByRole("button", { name: "Collect fee", exact: true }).click();
    await expect(page.getByLabel("Amount received (whole ₹)")).toHaveValue("500");
    await page.getByLabel("Payment method").selectOption("UPI");
    await page.getByRole("button", { name: "Confirm collection", exact: true }).click();
    await expect(page.getByText("Receipt: LL-TEST-2", { exact: true })).toBeVisible();
    expect(state.received).toBe(1200);

    // The attendance change to the shared Dialog must preserve collection
    // receipt/correction dismissal and the pending-void Escape guard.
    await page.getByRole("button", { name: "Close dialog" }).click();
    await page.route(`**/api/branches/${branchId}/payments?**`, route => route.fulfill({ json: { items: [], total: 0, nextCursor: null } }));
    let releaseVoid: (() => void) | undefined;
    const voidPending = new Promise<void>(resolve => { releaseVoid = resolve; });
    await page.route(`**/api/branches/${branchId}/collections/collection-1`, async route => {
        if (route.request().method() !== "PATCH") return route.fallback();
        expect(route.request().postDataJSON()).toEqual({ reason: "Verified duplicate entry" });
        await voidPending;
        const record = [...state.records.values()][0];
        record.voidedAt = "2026-09-11T06:00:00Z"; record.voidReason = "Verified duplicate entry";
        await route.fulfill({ json: record });
    });
    await page.goto(`/branch/${branchId}/payments`);
    await page.getByRole("button", { name: "View receipt", exact: true }).first().click();
    await expect(page.getByRole("dialog", { name: "Fee payment receipt" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.getByRole("button", { name: "Correct / void", exact: true }).first().click();
    await expect(page.getByRole("button", { name: "Void collection", exact: true })).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.getByRole("button", { name: "Correct / void", exact: true }).first().click();
    await page.getByLabel("Required reason").fill("Verified duplicate entry");
    await page.getByRole("button", { name: "Void collection", exact: true }).click();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Void mistaken collection" })).toBeVisible();
    releaseVoid!();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByText(/Sample Student · ₹700 · CASH · VOID/)).toBeVisible();
});
