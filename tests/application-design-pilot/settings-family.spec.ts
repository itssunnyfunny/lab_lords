import fs from "node:fs";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { installSettingsFixture } from "./settings-family-fixture";

const output = "docs/redesign/application-rollout-evidence/settings";
test("dashboard settings keeps compact composition and saved threshold across languages", async ({ page }, info) => {
    const commands = await installSettingsFixture(page);
    const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    await page.goto("/branch/pilot/dashboard-settings?mode=after&lang=en");
    await expect(page.getByRole("heading", { name: "Dashboard setup" })).toBeVisible();
    await expect(page.locator(".ui-record-header")).toBeVisible();
    if (info.project.name === "desktop-1440") await expect(page.locator(".ui-table--compact").first()).toBeVisible();
    await page.getByLabel("Threshold (%)").fill("42");
    await page.getByRole("button", { name: "Save threshold" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();
    expect(commands.at(-1)).toEqual({ path: "/api/branches/pilot/dashboard/settings", body: { utilizationThreshold: 42 } });
    await page.locator('select[id$="interfaceLanguage"]').first().selectOption("hi");
    await expect(page.locator("html")).toHaveAttribute("lang", "hi-IN");
    await expect(page.getByLabel("स्तर (%)")).toHaveValue("42");
    await page.evaluate(() => document.fonts.ready);
    fs.mkdirSync(output, { recursive: true });
    if (info.project.name === "desktop-1440" || info.project.name === "mobile-390") await page.screenshot({ path: `${output}/dashboard-setup-hi-${info.project.name}.png`, animations: "disabled" });
    await page.locator('select[id$="interfaceLanguage"]').first().selectOption("hinglish");
    await expect(page.locator("html")).toHaveAttribute("lang", "hi-Latn-IN");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    const { violations } = await new AxeBuilder({ page }).analyze();
    expect(violations.filter(item => ["serious", "critical"].includes(item.impact!))).toEqual([]);
    expect(errors).toEqual([]);
});

test("expectations and terms retain their original commands and mobile cards", async ({ page }, info) => {
    const commands = await installSettingsFixture(page);
    await page.goto("/branch/pilot/dashboard-settings?mode=after&lang=en&section=expectations");
    await expect(page.getByRole("heading", { name: "Attendance expectations" }).first()).toBeVisible();
    if (info.project.name === "desktop-1440") await expect(page.locator(".ui-table--compact").first()).toBeVisible();
    else await expect(page.locator(".ui-record-card:visible").first()).toBeVisible();
    await page.getByRole("combobox", { name: "Student" }).click();
    await page.getByRole("option", { name: "Aarav Mehta" }).click();
    await page.getByRole("button", { name: "Save expectation" }).click();
    expect(commands.at(-1)).toEqual({ path: "/api/branches/pilot/dashboard/expectations", body: { studentId: "student-aarav", weekdays: [1, 3, 5], expectedBy: "09:00", enabled: true } });
    await page.getByRole("button", { name: "Membership terms" }).click();
    await expect(page.locator("[data-membership-student]:visible")).toHaveCount(1);
    await page.locator("button:visible").filter({ hasText: "Renew term" }).first().click();
    await page.getByLabel("End date").fill("2026-12-31");
    await page.getByRole("button", { name: "Save membership term" }).click();
    expect(commands.at(-1)).toEqual({ path: "/api/branches/pilot/dashboard/terms", body: { studentId: "student-aarav", label: "Quarterly", startDate: "2026-10-01", endDate: "2026-12-31" } });
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    if (info.project.name === "mobile-390") {
        await expect(page.locator(".ui-record-card").first()).toBeVisible();
        fs.mkdirSync(output, { recursive: true });
        await page.locator(".ui-record-card").first().scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${output}/membership-mobile-390.png`, animations: "disabled" });
    }
});
