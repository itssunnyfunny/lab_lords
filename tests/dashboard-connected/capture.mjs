import { readFileSync, mkdirSync } from "node:fs";
import { chromium, expect } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3117";
if (new URL(baseURL).hostname !== "localhost") throw new Error("Capture is restricted to the local application");
const fixture = JSON.parse(readFileSync(".clerk/dashboard-fixture.json", "utf8"));
const output = "test-results/dashboard-connected-review";
mkdirSync(output, { recursive: true });
const browser = await chromium.launch();
try {
    const context = await browser.newContext({ baseURL, viewport: { width: 1491, height: 1055 },
        storageState: process.env.PLAYWRIGHT_OWNER_AUTH_STATE || ".clerk/dashboard-owner-auth.json" });
    const page = await context.newPage();
    page.setDefaultTimeout(30_000);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.Clerk?.loaded);
    if (!await page.evaluate(async () => Boolean(await window.Clerk.session?.getToken({ skipCache: true }))))
        throw new Error("Refresh the existing synthetic development session before capture");
    await page.goto(`/branch/${fixture.branchId}`);
    await page.waitForFunction(() => Boolean(window.Clerk?.loaded && window.Clerk.user && window.Clerk.session));
    await expect(page.getByRole("heading", { name: "Action Center", exact: true })).toBeVisible();
    await expect(page.locator(".reference-dashboard")).toHaveAttribute("aria-busy", "false");
    await page.evaluate(() => document.fonts.ready);
    const reminder = page.getByRole("button", { name: "Dismiss trial reminder for this session", exact: true });
    if (await reminder.isVisible()) await reminder.click();
    for (const [name, width, height] of [["desktop", 1491, 1055], ["mobile-390", 390, 844], ["mobile-320", 320, 740], ["tablet", 768, 1024]]) {
        await page.setViewportSize({ width, height });
        // Real lazy images must be observed and decoded before visual comparison.
        await page.locator(".reference-dashboard img").evaluateAll(images => images.forEach(image => { image.loading = "eager"; }));
        for (const artwork of await page.locator(".reference-dashboard img").all()) if (await artwork.isVisible()) await artwork.scrollIntoViewIfNeeded();
        await page.waitForFunction(() => [...document.querySelectorAll(".reference-dashboard img")]
            .every(image => image.complete && image.naturalWidth > 0));
        await page.evaluate(() => document.fonts.ready);
        await page.locator("#main-content").evaluate(element => element.scrollTop = 0);
        await page.screenshot({ path: `${output}/${name}.png` });
        if (width < 1491) {
            await page.locator(".rd-collections").scrollIntoViewIfNeeded();
            await page.screenshot({ path: `${output}/${name}-middle.png` });
            await page.locator("#main-content").evaluate(element => element.scrollTop = element.scrollHeight);
            await page.screenshot({ path: `${output}/${name}-bottom.png` });
        }
    }
    console.log("Actual authenticated desktop, mobile and tablet captures saved; trial reminder dismissed with its normal session control. No entitlement changed.");
} finally { await browser.close(); }
