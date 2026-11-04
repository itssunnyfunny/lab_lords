import fs from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { refreshDevelopmentSession } from "./helpers/development-session";

const auth = process.env.PLAYWRIGHT_OWNER_AUTH_STATE;
const branch = process.env.PLAYWRIGHT_OWNER_BRANCH_ID;
const otherBranch = process.env.PLAYWRIGHT_IMPORT_OTHER_BRANCH_ID;
const clean = process.env.PLAYWRIGHT_IMPORT_CLEAN_SESSION_ID;
const mixed = process.env.PLAYWRIGHT_IMPORT_MIXED_SESSION_ID;
const plan = process.env.PLAYWRIGHT_IMPORT_EXPECTED_PLAN;
const configured = !!(auth && fs.existsSync(auth) && branch && otherBranch && clean && mixed && plan);
test.use({ storageState: configured ? auth! : { cookies: [], origins: [] } });
test.beforeEach(async ({ page }) => {
    test.skip(!configured, "Requires isolated guided import fixtures and a saved Test Clerk identity.");
    await refreshDevelopmentSession(page);
});

test("real workspace shows clean students and distinct fees with readable shared surfaces", async ({ page }) => {
    await page.goto(`/branch/${branch}/onboarding/import/${clean}`);
    await expect(page.getByRole("heading", { name: "Your students are ready to review", exact: true })).toBeVisible();
    await expect(page.getByRole("tab", { name: /^Ready for review/ })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("button", { name: "Prepare remaining records", exact: true })).toHaveCount(0);
    const access = await page.request.get(`/api/branches/${branch}/access`);
    expect(access.ok()).toBe(true); expect((await access.json()).effectivePlan).toBe(plan);
    await expect(page.locator("[data-basic-workspace]")).toHaveCount(plan === "BASIC" ? 1 : 0);
    expect((await new AxeBuilder({ page }).include('[data-import-experience="guided"]').withRules(["color-contrast"]).analyze()).violations).toEqual([]);
    const draftUrl = page.url();
    await page.getByText("Inspect uploaded columns and meanings", { exact: true }).click();
    await page.getByRole("combobox", { name: /^ERP field for .*Monthly Fee/i }).click();
    await page.getByRole("option", { name: "Do not import this column", exact: true }).click();
    const reset = page.getByRole("button", { name: "Reset column changes", exact: true });
    await expect(reset).toBeVisible();
    await expect(page.getByRole("button", { name: /^Review and save/ })).toBeDisabled();
    const branchPicker = page.getByLabel("Switch branch", { exact: true });
    await branchPicker.selectOption(otherBranch!);
    await expect(page.getByRole("alert").filter({ hasText: "Save or reset your edits before continuing." })).toBeVisible();
    await expect(page).toHaveURL(draftUrl);
    await expect(branchPicker).toHaveValue(branch!);
    await reset.click();
    await expect(reset).toHaveCount(0);
    await page.getByRole("button", { name: /^Review and save/ }).click();
    const totals = page.getByLabel("Reviewed fee outcomes");
    for (const label of ["Outstanding dues to create", "Record as already paid", "Record as waived", "Future dues", "No eligible due this month"]) {
        await expect(totals.getByText(label, { exact: true })).toBeVisible();
    }
    expect((await new AxeBuilder({ page }).include('[data-import-experience="guided"]').withRules(["color-contrast"]).analyze()).violations).toEqual([]);
});

test("real workspace task opens the correction and keyboard reaches visual assignment", async ({ page }) => {
    await page.goto(`/branch/${branch}/onboarding/import/${mixed}`);
    await page.getByRole("article").filter({ hasText: "Anaya Test" }).getByRole("button", { name: "Confirm joining date", exact: true }).click();
    await expect(page.getByLabel("Joined date", { exact: true })).toBeFocused();
    await page.getByRole("tab", { name: "Student details", exact: true }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("tab", { name: "Seat and timings", exact: true })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("dialog").getByText("Uploaded timings: FD", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /Morning \+ Evening, .*seats free/ })).toBeVisible();
    expect((await new AxeBuilder({ page }).include('[role="dialog"]').withRules(["color-contrast"]).analyze()).violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
