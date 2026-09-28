import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

// Optional interactive review window. Auth state stays in ignored local files.
const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3117";
if (new URL(baseURL).hostname !== "localhost") throw new Error("Review is restricted to the local application");
const fixture = JSON.parse(readFileSync(".clerk/dashboard-fixture.json", "utf8"));
const browser = await chromium.launch({ headless: false });
try {
    const context = await browser.newContext({ baseURL, viewport: { width: 1491, height: 1055 },
        storageState: process.env.PLAYWRIGHT_OWNER_AUTH_STATE || ".clerk/dashboard-owner-auth.json" });
    const page = await context.newPage();
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.Clerk?.loaded);
    const authenticated = await page.evaluate(async () => Boolean(await window.Clerk.session?.getToken({ skipCache: true })));
    if (!authenticated) throw new Error("Refresh the existing synthetic development session before opening review");
    await page.goto(`/branch/${fixture.branchId}`);
    await page.waitForFunction(() => Boolean(window.Clerk?.loaded && window.Clerk.user && window.Clerk.session));
    console.log("Interactive synthetic connected review opened. Close the browser window when finished.");
    await new Promise(resolve => browser.once("disconnected", resolve));
} finally { if (browser.isConnected()) await browser.close(); }
