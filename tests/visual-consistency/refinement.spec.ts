import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function open(page: Page, route: string, language = "en") {
    await page.goto(`${route}${route.includes("?") ? "&" : "?"}mode=after&lang=${language}`);
    await page.getByTestId("synthetic-pilot-label").evaluate(node => node.remove());
    await page.locator("h1").first().waitFor();
    await page.evaluate(() => document.fonts.ready);
}

test.beforeEach(async ({ context }) => {
    await context.route("**/*", route => new URL(route.request().url()).hostname === "127.0.0.1" ? route.continue() : route.abort());
});

test("grouped navigation opens the active route and preserves direct destinations", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop-1440");
    await open(page, "/branch/pilot/payments");
    const nav = page.locator(".ui-navigation-sidebar");
    await expect(nav.getByRole("button", { name: "Fees", exact: true })).toHaveAttribute("aria-expanded", "true");
    await expect(nav.getByRole("link", { name: "Payments", exact: true })).toHaveAttribute("aria-current", "page");
    await nav.getByRole("button", { name: "Students", exact: true }).click();
    await expect(nav.getByRole("link", { name: "Import Assistant", exact: true })).toHaveAttribute("href", "/branch/pilot/onboarding/import");
    await nav.getByRole("link", { name: "Students", exact: true }).click();
    await expect(page.locator("h1")).toHaveText("Students");
    await expect(nav.getByRole("button", { name: "Students", exact: true })).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("link", { name: "Back to branch dashboard", exact: true })).toHaveCount(0);
    await expect(nav.locator(".ui-navigation-footer").getByRole("link", { name: "Account", exact: true })).toBeInViewport();
});

test("daily mobile navigation opens More and filters denied destinations", async ({ page }, info) => {
    test.skip(!info.project.name.startsWith("mobile"));
    await open(page, "/branch/pilot/students");
    const daily = page.getByRole("navigation", { name: "Daily navigation", exact: true });
    await expect(daily).toBeInViewport({ ratio: 1 });
    await expect(daily.getByRole("link", { name: "Students", exact: true })).toHaveAttribute("aria-current", "page");
    await daily.getByRole("button", { name: "More navigation", exact: true }).click();
    const drawer = page.getByRole("dialog", { name: "Branch navigation", exact: true });
    await expect(drawer).toBeVisible();
    await drawer.getByRole("button", { name: "Fees", exact: true }).click();
    await drawer.getByRole("link", { name: "Payments", exact: true }).click();
    await expect(page.locator("h1")).toHaveText("Payment history");
    await expect(drawer).toHaveCount(0);
    await page.route("**/api/branches/pilot/access", async route => {
        const response = await route.fetch(); const access = await response.json();
        await route.fulfill({ json: { ...access, isOwner: false, role: "STAFF", permissions: { ...access.permissions, students: false, seat_allocation: false, view_payments: false } } });
    });
    await open(page, "/branch/pilot");
    await expect(daily.getByRole("link")).toHaveCount(1);
    await expect(daily.getByRole("link", { name: "Overview", exact: true })).toBeVisible();
});

test("roster records and usable actions appear early in each mobile language", async ({ page }, info) => {
    test.skip(info.project.name !== "mobile-390");
    for (const lang of ["en", "hi", "hinglish"]) {
        await open(page, "/branch/pilot/students", lang);
        const first = page.locator("[data-student-record-card]:visible").first();
        await expect(first).toBeVisible();
        expect((await first.boundingBox())!.y).toBeLessThan(510);
        const input = page.locator('input[type="text"]').first();
        expect((await input.boundingBox())!.y).toBeLessThan(340);
        const tools = page.locator('.ui-record-actions button[aria-haspopup="menu"]');
        await expect(tools.locator("span")).not.toHaveText("");
        await tools.click(); await expect(page.getByRole("menu")).toBeVisible();
        await page.keyboard.press("Escape"); await expect(tools).toBeFocused();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.screenshot({ path: info.outputPath(`refined-students-${lang}.png`), animations: "disabled" });
    }
});

test("seat details remain adjacent on desktop and use the shared modal on mobile", async ({ page }, info) => {
    test.skip(!["desktop-1440", "mobile-390"].includes(info.project.name));
    await open(page, "/branch/pilot/seats");
    const first = page.locator(".ui-seat-grid article").first();
    if (info.project.name === "mobile-390") expect((await first.boundingBox())!.y).toBeLessThan(560);
    await first.getByRole("button", { name: "View seat A1", exact: true }).click();
    if (info.project.name === "desktop-1440") {
        const detail = page.locator(".ui-seat-detail");
        await expect(detail).toBeVisible();
        expect((await detail.boundingBox())!.x).toBeGreaterThan((await page.locator(".ui-seat-grid").boundingBox())!.x);
        await expect(page.getByRole("dialog")).toHaveCount(0);
        await detail.getByRole("button", { name: "Close seat details", exact: true }).click();
        await expect(detail).toHaveCount(0);
    } else {
        const drawer = page.getByRole("dialog", { name: "Seat A1", exact: true });
        await expect(drawer).toBeVisible();
        expect(await drawer.evaluate(node => node.contains(document.activeElement))).toBe(true);
        await page.keyboard.press("Escape"); await expect(drawer).toHaveCount(0);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(result.violations.filter(item => ["critical", "serious"].includes(item.impact!))).toEqual([]);
});
