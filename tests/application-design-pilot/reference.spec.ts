import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const output = path.resolve("docs/redesign/reference-dashboard-evidence");
test("full composition, real interactions and loaded fonts", async ({ page }, info) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto("/branch/pilot?mode=after&lang=en");
    await expect(page.locator(".rd-priorities article")).toHaveCount(5);
    await expect(page.locator(".rd-metrics article")).toHaveCount(6);
    await expect(page.locator(".rd-quick nav a")).toHaveCount(6);
    await expect(page.locator(".rd-followups tbody tr")).toHaveCount(4);
    await expect(page.locator(".rd-renewals tbody tr")).toHaveCount(3);
    await page.evaluate(async () => { await document.fonts.load('400 20px "Dashboard Caveat"'); await document.fonts.ready; });
    expect(await page.evaluate(() => document.fonts.check('400 20px "Dashboard Caveat"'))).toBe(true);
    await page.getByRole("tab", { name: "Seat map", exact: true }).click();
    await expect(page.locator(".rd-seat-map button")).toHaveCount(16);
    await page.locator(".rd-seat-map button").first().click();
    await expect(page.locator(".rd-cell-detail")).toContainText("A1");
    await page.getByRole("tab", { name: "Today", exact: true }).click();
    await expect(page.locator(".rd-today-matrix > div")).toHaveCount(3);
    await page.getByRole("tab", { name: "This week", exact: true }).click();
    await expect(page.locator(".rd-heatmap tbody button")).toHaveCount(21);
    await page.getByRole("tab", { name: "This week", exact: true }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("tab", { name: "Seat map", exact: true })).toBeFocused();
    await page.keyboard.press("Home");
    await expect(page.getByRole("tab", { name: "Today", exact: true })).toHaveAttribute("aria-selected", "true");
    await page.getByRole("tab", { name: "This week", exact: true }).click();
    await page.locator(".rd-period select").selectOption("2026-08");
    await expect(page.locator(".rd-chart")).toBeVisible();
    await expect(page.locator(".rd-chart text").filter({ hasText: "Aug" }).first()).toBeVisible();
    await page.locator(".rd-period select").selectOption("2026-09");
    const horizontal = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    expect(horizontal).toBe(false);
    fs.mkdirSync(path.join(output, info.project.name), { recursive: true });
    await page.screenshot({ path: path.join(output, info.project.name, "en-top.png") });
    await page.locator(".rd-worklists").scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(output, info.project.name, "en-lower.png") });
    expect(errors).toEqual([]);
});

for (const language of ["en", "hi", "hinglish"]) {
    test(`responsive ${language} layout and source states`, async ({ page }, info) => {
        await page.goto(`/branch/pilot?mode=after&lang=${language}`);
        await expect(page.locator(".rd-metrics article")).toHaveCount(6);
        await page.evaluate(async () => {
            await document.fonts.load('400 14px "Noto Sans Devanagari"', "हाजिरी");
            await document.fonts.ready;
        });
        const directory = path.join(output, info.project.name); fs.mkdirSync(directory, { recursive: true });
        await page.screenshot({ path: path.join(directory, `${language}-top.png`) });
        await page.locator(".rd-worklists").scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.join(directory, `${language}-lower.png`) });
        expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
        for (const state of ["empty", "calm", "unconfigured", "sparse", "locked", "restricted", "source-error"]) {
            await page.goto(`/branch/pilot?mode=after&lang=${language}&state=${state}`);
            await expect(page.locator(".rd-priorities article")).toHaveCount(5);
            await expect(page.locator(".rd-metrics article")).toHaveCount(6);
            expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
            if (language === "en") await page.screenshot({ path: path.join(directory, `${state}.png`) });
            if (state === "calm") await expect(page.locator(".rd-count")).toHaveText("0");
            if (state === "restricted") {
                await expect(page.locator(".rd-priorities")).not.toContainText("₹2,400");
                await expect(page.locator(".rd-metrics")).not.toContainText("₹1,900");
            }
        }
    });
}

test("native reference geometry and basic accessibility", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop-native");
    await page.goto("/branch/pilot?mode=after&lang=en");
    await expect(page.locator(".rd-priorities article")).toHaveCount(5);
    await page.evaluate(async () => { await document.fonts.load('400 20px "Dashboard Caveat"'); await document.fonts.ready; });
    const ribbon = await page.getByTestId("synthetic-pilot-label").evaluate(e => e.getBoundingClientRect().height);
    const action = (await page.locator(".rd-action-center").boundingBox())!;
    const chart = (await page.locator(".rd-collections").boundingBox())!;
    const seating = (await page.locator(".rd-seating").boundingBox())!;
    const lists = (await page.locator(".rd-worklists").boundingBox())!;
    expect(Math.abs(action.y - ribbon - 214)).toBeLessThanOrEqual(5);
    expect(Math.abs(chart.y - ribbon - 532)).toBeLessThanOrEqual(5);
    expect(Math.abs(chart.width - 556)).toBeLessThanOrEqual(6);
    expect(Math.abs(seating.width - 366)).toBeLessThanOrEqual(6);
    expect(lists.y - ribbon).toBeLessThanOrEqual(878);
    expect(lists.y - ribbon + lists.height).toBeLessThanOrEqual(1060);
    const result = await new AxeBuilder({ page }).include(".reference-dashboard").withTags(["wcag2a", "wcag2aa"]).analyze();
    fs.writeFileSync(path.join(output, "accessibility.json"), JSON.stringify(result.violations.map(v => ({ id: v.id, impact: v.impact, description: v.description, nodes: v.nodes.map(n => n.target) })), null, 2));
    expect(result.violations).toEqual([]);
    await page.emulateMedia({ reducedMotion: "reduce" });
    expect(await page.locator(".rd-heading button svg").evaluate(e => getComputedStyle(e).animationName)).toBe("none");
});

test("stale old-branch responses never enter the new scope", async ({ page }) => {
    let release: (() => void) | undefined;
    let access: unknown;
    await page.route("**/api/branches/pilot/access", async route => { const response = await route.fetch(); access = await response.json(); await route.fulfill({ response }); });
    await page.route("**/api/branches/pilot/dashboard", async route => {
        if (route.request().method() !== "GET") return route.fulfill({json:{captured:true}});
        const response = await route.fetch();
        await new Promise<void>(resolve => { release = resolve; });
        await route.fulfill({ response }).catch(() => undefined);
    });
    await page.goto("/branch/pilot?mode=after&lang=en");
    await expect.poll(() => Boolean(release)).toBe(true);
    await page.route("**/api/branches/new-scope/access", route => route.fulfill({ json: { ...(access as Record<string, unknown>), branchId: "new-scope", branchName: "New scoped library" } }));
    await page.route("**/api/branches/new-scope/dashboard", async route => {
        if (route.request().method() !== "GET") return route.fulfill({json:{captured:true}});
        const response = await page.request.get("/api/branches/pilot/dashboard?month=2026-09");
        const data = await response.json(); data.branchId = "new-scope"; data.money.data.pendingDues = 900;
        await route.fulfill({json:data});
    });
    await page.evaluate(() => { history.pushState({}, "", "/branch/new-scope?mode=after&lang=en"); dispatchEvent(new PopStateEvent("popstate")); });
    await expect(page.locator(".rd-heading h1")).toHaveText("New scoped library");
    release?.();
    await expect(page.locator(".rd-metrics article").nth(1)).toContainText("₹900");
});
