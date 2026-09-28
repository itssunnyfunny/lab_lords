import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { assertDisposableTestDatabaseTarget } from "../setup/testDatabaseSafety";
import { refreshDevelopmentSession } from "../browser/helpers/development-session";

const fixture = JSON.parse(readFileSync(".clerk/dashboard-fixture.json", "utf8")) as { databaseName: string };
const target = assertDisposableTestDatabaseTarget(process.env.TEST_DATABASE_URL, process.env);
if (target.databaseName !== fixture.databaseName) throw new Error("Connected account fixture/database mismatch");

async function tokenColor(page: Page, token: string) {
    return page.evaluate(name => {
        const probe = document.createElement("span");
        probe.style.color = `var(${name})`;
        document.body.append(probe);
        const color = getComputedStyle(probe).color;
        probe.remove();
        return color;
    }, token);
}

async function checkProvider(page: Page, label: string) {
    await refreshDevelopmentSession(page);
    const response = await page.goto("/account", { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBe(200);
    await expect(page.locator('[data-app-design-pilot="workspace"]')).toBeVisible();
    await page.evaluate(() => document.fonts.ready);

    await page.locator(".cl-userButtonTrigger").click();
    const popover = page.locator(".cl-userButtonPopoverCard");
    await expect(popover).toBeVisible();
    const manage = popover.locator(".cl-userButtonPopoverActionButton").filter({ hasText: /manage account/i });
    await expect(manage).toBeVisible();
    const primary = await tokenColor(page, "--text-primary");
    expect(await manage.evaluate(element => getComputedStyle(element).color)).toBe(primary);
    expect(await popover.locator(".cl-userPreviewMainIdentifier").evaluate(element => getComputedStyle(element).color)).toBe(primary);
    await popover.screenshot({
        path: `docs/redesign/application-closeout-evidence/provider-actual/account-menu-${label}.png`,
        animations: "disabled", mask: [popover.locator(".cl-userPreview")], maskColor: "#e9f1eb",
    });

    await manage.click();
    const modal = page.locator(".cl-modalContent");
    await expect(modal).toBeVisible();
    await expect(modal.locator(".cl-profileSectionTitleText").first()).toBeVisible();
    expect(await modal.locator(".cl-headerTitle").evaluate(element => getComputedStyle(element).color)).toBe(primary);
    expect(await modal.locator(".cl-profileSectionTitleText").first().evaluate(element => getComputedStyle(element).color)).toBe(primary);
    if (label.startsWith("mobile")) {
        expect(await modal.locator(".cl-navbarMobileMenuButton").evaluate(element => getComputedStyle(element).color)).toBe(primary);
    }
    const accent = await tokenColor(page, "--ui-form-accent");
    expect(await modal.locator(".cl-profileSectionPrimaryButton").first().evaluate(element => getComputedStyle(element).color)).toBe(accent);
    await modal.screenshot({
        path: `docs/redesign/application-closeout-evidence/provider-actual/account-profile-${label}.png`,
        animations: "disabled",
        mask: [modal.locator(".cl-avatarBox"), modal.locator(".cl-profileSectionItem").filter({ hasText: /@/ })],
        maskColor: "#e9f1eb",
    });
}

test("actual development-authenticated account menu and profile use selected desktop and mobile colors", async ({ page, browser }) => {
    await checkProvider(page, "desktop-1491");
    const mobile = await browser.newContext({
        baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3117",
        storageState: ".clerk/dashboard-owner-auth.json", viewport: { width: 390, height: 844 },
    });
    try { await checkProvider(await mobile.newPage(), "mobile-390"); }
    finally { await mobile.close(); }
});
