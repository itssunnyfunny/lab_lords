import fs from "node:fs";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const evidence = "docs/redesign/application-rollout-evidence/payments";

test("real payments page keeps compact records and collection review", async ({ page }, info) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto("/branch/pilot/payments?mode=after&lang=en");
    await expect(page.getByRole("heading", { name: "Payment history", level: 1 })).toBeVisible();
    await expect(page.locator(".ui-record-surface")).toBeVisible();
    await expect(page.locator('.ui-record-results :text("Aarav Mehta"):visible').first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    fs.mkdirSync(evidence, { recursive: true });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `${evidence}/payments-${info.project.name}.png`, animations: "disabled" });
    await page.locator(".ui-record-results").first().screenshot({ path: `${evidence}/payments-results-${info.project.name}.png`, animations: "disabled" });
    await page.locator('button:visible').filter({ hasText: "Collect fee" }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    for (const [lang, htmlLang] of [["hi", "hi-IN"], ["hinglish", "hi-Latn-IN"]] as const) {
        await page.goto(`/branch/pilot/payments?mode=after&lang=${lang}`);
        await expect(page.locator("html")).toHaveAttribute("lang", htmlLang);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    }
    if (info.project.name === "mobile-390") {
        await page.setViewportSize({ width: 320, height: 800 });
        await page.goto("/branch/pilot/payments?mode=after&lang=en");
        await expect(page.locator(".ui-record-results").first()).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    }
    const { violations } = await new AxeBuilder({ page }).analyze();
    expect(violations.filter(item => ["serious", "critical"].includes(item.impact!))).toEqual([]);
    expect(errors).toEqual([]);
});
