import fs from "node:fs";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const evidence = "docs/redesign/application-rollout-evidence/seats-shifts";

test("seat map, allocations, and shifts use the selected compact family", async ({ page }, info) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    for (const [route, heading] of [["seats", "Seats"], ["allocations", "Allocations"], ["shifts", "Shifts"]] as const) {
        await page.goto(`/branch/pilot/${route}?mode=after&lang=en`);
        await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
        await expect(page.locator("header.ui-record-header")).toBeVisible();
        await expect(page.locator(".ui-panel--compact:visible").first()).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
        if (info.project.name === "mobile-390") {
            fs.mkdirSync(evidence, { recursive: true });
            await page.evaluate(() => document.fonts.ready);
            await page.screenshot({ path: `${evidence}/${route}-mobile-390.png`, animations: "disabled" });
        }
    }
    for (const language of ["hi", "hinglish"] as const) {
        await page.goto(`/branch/pilot/shifts?mode=after&lang=${language}`);
        await expect(page.locator("html")).toHaveAttribute("lang", language === "hi" ? "hi-IN" : "hi-Latn-IN");
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    }
    if (info.project.name === "mobile-390") {
        await page.setViewportSize({ width: 320, height: 800 });
        await page.goto("/branch/pilot/allocations?mode=after&lang=en");
        await expect(page.getByRole("heading", { level: 1, name: "Allocations" })).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    }
    await page.goto("/branch/pilot/shifts?mode=after&lang=en");
    await page.getByRole("button", { name: "Add shift" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await page.goto("/branch/pilot/allocations?mode=after&lang=en");
    await page.getByRole("button", { name: "Allocate seat" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    const { violations } = await new AxeBuilder({ page }).analyze();
    expect(violations.filter(item => ["serious", "critical"].includes(item.impact!))).toEqual([]);
    expect(errors).toEqual([]);
});
