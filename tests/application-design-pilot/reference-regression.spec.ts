import { expect, test } from "@playwright/test";
import { referenceDashboardFixture } from "./reference-fixture";

test("dashboard refresh reloads the selected historical month with an honest pending state", async ({ page }) => {
    let collected = 1900;
    let historyReads = 0;
    let release: (() => void) | undefined;
    let hold = false;
    await page.route("**/api/branches/pilot/dashboard**", async route => {
        if (route.request().method() !== "GET") return route.fulfill({ json: { captured: true } });
        const month = new URL(route.request().url()).searchParams.get("month") ?? "2026-09";
        if (month === "2026-08") {
            historyReads++;
            if (hold) await new Promise<void>(resolve => { release = resolve; });
        }
        const data = referenceDashboardFixture("populated", "pilot", month);
        if (month === "2026-08") { data.collections.data!.collected = collected; data.collections.data!.pending = 4300 - collected; }
        await route.fulfill({ json: data });
    });
    await page.goto("/branch/pilot?mode=after&lang=en");
    const chart = page.locator(".rd-collections");
    await chart.locator("select").selectOption("2026-08");
    await expect(chart.locator(".rd-chart-summary")).toContainText("₹1,900");
    expect(historyReads).toBe(1);
    hold = true; collected = 2400;
    await page.locator(".rd-meta button").click();
    await expect.poll(() => historyReads).toBe(2);
    await expect(chart).toHaveAttribute("aria-busy", "true");
    await expect(chart.getByRole("status")).toHaveText("Loading collections…");
    await expect(chart.locator("select")).toHaveValue("2026-08");
    await expect(chart.locator(".rd-chart-summary")).toHaveCount(0);
    hold = false; release?.();
    await expect(chart.locator(".rd-chart-summary")).toContainText("₹2,400");
    await expect(chart).toHaveAttribute("aria-busy", "false");
});

for (const status of ["restricted", "locked", "error"] as const) {
    test(`current ${status} source immediately supersedes cached historical financial values`, async ({ page }) => {
        let parentStatus: typeof status | null = null;
        let historyReads = 0;
        await page.route("**/api/branches/pilot/dashboard**", async route => {
            if (route.request().method() !== "GET") return route.fulfill({ json: { captured: true } });
            const month = new URL(route.request().url()).searchParams.get("month") ?? "2026-09";
            const data = referenceDashboardFixture("populated", "pilot", month);
            if (month === "2026-08") historyReads++;
            else if (parentStatus) data.collections = { status: parentStatus, data: null };
            await route.fulfill({ json: data });
        });
        await page.goto("/branch/pilot?mode=after&lang=en");
        const chart = page.locator(".rd-collections");
        await chart.locator("select").selectOption("2026-08");
        await expect(chart.locator(".rd-chart-summary")).toContainText("₹1,900");
        parentStatus = status;
        await page.locator(".rd-meta button").click();
        await expect(chart.getByRole("status")).toContainText(status === "restricted" ? "Not included in your access" : status === "locked" ? "Available on Standard" : "This source could not be refreshed.");
        await expect(chart.locator(".rd-chart-summary")).toHaveCount(0);
        await expect(chart).not.toContainText("₹1,900");
        await expect(chart.locator("select")).toHaveValue("2026-08");
        expect(historyReads).toBe(1);
    });
}

test("calendar labels keep their day when browser and saved display timezones differ", async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL, locale: "en-IN", timezoneId: "America/Los_Angeles" });
    const page = await context.newPage();
    try {
        await page.goto("/branch/pilot?mode=after&lang=en");
        // The fixture user retains Asia/Kolkata. Noon PDT is the next day in IST.
        await expect(page.locator("html")).toHaveAttribute("data-timezone", "Asia/Kolkata");
        await expect(page.locator(".rd-chart text").filter({ hasText: /^1 Sept$/ })).toHaveCount(1);
        await expect(page.locator(".rd-heatmap thead th").nth(1)).toHaveText("Wed");
        await page.locator(".rd-heatmap tbody tr").first().locator("button").first().click();
        await expect(page.locator(".rd-cell-detail")).toContainText("16 Sept");
        await expect(page.locator(".rd-renewals tbody tr").first().locator("td").nth(2)).toHaveText("25 Sept 2026");
        // True event timestamps still use the existing persisted preference.
        await expect(page.locator(".rd-activity time").first()).toHaveAttribute("title", /03:41 pm/);
    } finally { await context.close(); }
});
