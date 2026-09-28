import fs from "node:fs";
import { expect, test } from "@playwright/test";

const evidence = "docs/redesign/application-closeout-evidence";

test("selected cold loading and error boundaries use the application palette", async ({ page }, info) => {
    await page.goto("/onboarding?mode=after&lang=hi&boundary=loading");
    await expect(page.locator('[data-app-design-pilot="workspace"]')).toBeVisible();
    await expect(page.getByRole("status")).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "hi-IN");
    await expect(page.evaluate(() => getComputedStyle(document.body).backgroundColor)).resolves.toBe("rgb(255, 251, 244)");
    if (info.project.name === "mobile-390") {
        fs.mkdirSync(evidence, { recursive: true });
        await page.evaluate(() => document.fonts.ready);
        await page.screenshot({ path: `${evidence}/selected-route-loading-hi-mobile-390.png`, animations: "disabled" });
    }

    await page.goto("/onboarding?mode=after&lang=hi&boundary=error");
    await expect(page.locator('[data-app-design-pilot="workspace"]')).toBeVisible();
    await expect(page.getByRole("heading", { name: "कुछ गड़बड़ हुई" })).toBeVisible();
    const retry = page.getByRole("button", { name: "फिर कोशिश करें" });
    await expect(retry).toBeVisible();
    await retry.focus();
    await expect(retry).toBeFocused();
    await expect(page.getByText("Synthetic internal detail")).toHaveCount(0);
    await expect(page.evaluate(() => getComputedStyle(document.body).backgroundColor)).resolves.toBe("rgb(255, 251, 244)");
    if (info.project.name === "mobile-390") {
        fs.mkdirSync(evidence, { recursive: true });
        await page.evaluate(() => document.fonts.ready);
        await page.screenshot({ path: `${evidence}/selected-route-error-hi-mobile-390.png`, animations: "disabled" });
    }
});

test("excluded routes retain their existing fallback theme", async ({ page }) => {
    for (const pathname of ["/sign-in", "/branch/pilot/ai/messages", "/features"]) {
        await page.goto(`${pathname}?mode=after&lang=en&boundary=loading`);
        await expect(page.getByRole("status")).toBeVisible();
        await expect(page.locator('[data-app-design-pilot="workspace"]')).toHaveCount(0);
    }
    await page.goto("/features?mode=after&lang=en&boundary=error");
    await expect(page.locator('[data-app-design-pilot="workspace"]')).toHaveCount(0);
    await expect(page.getByText("Synthetic internal detail")).toBeVisible();
});
