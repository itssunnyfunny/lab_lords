import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const evidence = path.resolve("docs/redesign/dashboard-correction-evidence");

async function open(page: Page, query: Record<string, string> = {}) {
    await page.goto(`/branch/pilot?${new URLSearchParams({ mode: "after", lang: "en", ...query })}`);
    await expect(page.locator("main h1")).toHaveText("Shanti Study Library");
    await expect(page.locator("[data-dashboard-refinement]")).toHaveAttribute("aria-busy", "false");
    await page.evaluate(async () => {
        await Promise.all([document.fonts.load('600 24px "Playfair Display"'), document.fonts.load('400 14px "Inter"'),
            document.fonts.load('400 14px "Noto Sans Devanagari"', "उपस्थिति")]);
        await document.fonts.ready;
    });
}

async function fonts(page: Page, language: string) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("DOM.enable"); await cdp.send("CSS.enable");
    const { root } = await cdp.send("DOM.getDocument");
    const result = [];
    for (const selector of ["main h1", ".dashboard-primary-actions button span", "#action-center-title", ".dashboard-summary [data-accent] p:nth-child(2)"]) {
        const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector });
        const { fonts: actual } = await cdp.send("CSS.getPlatformFontsForNode", { nodeId });
        expect(actual.some(font => font.isCustomFont && font.glyphCount > 0), selector).toBe(true);
        expect(actual.some(font => /Times New Roman|Arial|Segoe UI/.test(font.familyName)), selector).toBe(false);
        result.push({ selector, fonts: actual });
    }
    expect(result[0].fonts.some(font => font.familyName.includes(language === "hi" ? "Noto Sans Devanagari" : "Playfair Display"))).toBe(true);
    await cdp.detach();
    return result;
}

async function capture(page: Page, info: TestInfo, name: string) {
    const directory = path.join(evidence, info.project.name);
    fs.mkdirSync(directory, { recursive: true });
    await page.screenshot({ path: path.join(directory, `${name}.png`), fullPage: true });
}

test.beforeEach(async ({ request, page }) => {
    await request.post("/api/pilot/reset", { maxRetries: 2 });
    await page.clock.setFixedTime(new Date("2026-09-23T08:30:00Z"));
});

for (const language of ["en", "hi", "hinglish"]) {
    test(`dashboard renders ${language} with real fonts, readable layout and matching amounts`, async ({ page }, info) => {
        const errors: string[] = [];
        page.on("pageerror", error => errors.push(error.message));
        await open(page, { lang: language });
        const fontEvidence = await fonts(page, language);
        expect(await page.evaluate(() => {
            const main = document.querySelector("main")!;
            return main.scrollWidth <= main.clientWidth && document.documentElement.scrollWidth <= innerWidth;
        })).toBe(true);
        await expect(page.locator(".dashboard-priority")).toHaveCount(2);
        await expect(page.locator('[data-priority="overdue"] .dashboard-priority-value')).toHaveText("₹2,400");
        await expect(page.locator(".dashboard-summary")).toContainText("₹1,900");
        await expect(page.locator(".dashboard-financial-facts")).toContainText("₹1,500");
        await expect(page.locator(".dashboard-attendance-facts dd")).toHaveText(["1", "0", "1"]);
        await expect(page.locator(".dashboard-priority a").first()).toHaveAttribute("href", "/branch/pilot/overdue");
        await expect(page.locator(".dashboard-priority a").last()).toHaveAttribute("href", "/branch/pilot/renewals");
        await capture(page, info, `dashboard-${language}`);
        fs.writeFileSync(path.join(evidence, info.project.name, `fonts-${language}.json`), JSON.stringify(fontEvidence, null, 2));
        await page.locator(".dashboard-collections").scrollIntoViewIfNeeded();
        await capture(page, info, `dashboard-${language}-operations`);
        await page.locator("main").evaluate(element => { element.scrollTop = element.scrollHeight; });
        await capture(page, info, `dashboard-${language}-lower`);
        expect(errors).toEqual([]);
        if (language === "en") {
            const { violations } = await new AxeBuilder({ page }).analyze();
            expect(violations.filter(item => ["serious", "critical"].includes(item.impact ?? ""))).toEqual([]);
        }
    });
}

test("calm, empty and failed sources never invent urgency", async ({ page }, info) => {
    await open(page, { state: "calm" });
    await expect(page.getByText("Nothing needs attention in these queues")).toBeVisible();
    await expect(page.locator(".dashboard-priority")).toHaveCount(0);
    await expect(page.locator(".dashboard-upcoming-list li")).toHaveCount(2);
    await capture(page, info, "calm");
    await open(page, { state: "empty" });
    await expect(page.locator(".dashboard-priority")).toHaveCount(0);
    await expect(page.getByText("No recent activity", { exact: true })).toBeVisible();
    await capture(page, info, "empty");
    await open(page, { state: "attendance-error" });
    await expect(page.getByText("Attendance today: could not be refreshed.")).toBeVisible();
    await expect(page.locator(".dashboard-summary")).toContainText("Unavailable");
    await expect(page.locator('[data-priority="overdue"]')).toContainText("₹2,400");
    await open(page, { state: "error" });
    await expect(page.getByText("Priorities could not be confirmed")).toBeVisible();
    await expect(page.getByText("Nothing needs attention in these queues")).toHaveCount(0);
    await capture(page, info, "source-error");
});

test("loading is visible before the sources arrive", async ({ page }, info) => {
    let release!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; });
    await page.route("**/api/analytics/branch/pilot/snapshot?**", async route => { await held; await route.continue(); });
    await page.goto("/branch/pilot?mode=after");
    await expect(page.getByText("Loading branch dashboard")).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await capture(page, info, "loading");
    release();
    await expect(page.locator("main h1")).toBeVisible();
});

test("restricted and read-only access retain real available actions", async ({ page }, info) => {
    const requests: string[] = [];
    page.on("request", request => { if (request.url().includes("/api/")) requests.push(request.url()); });
    await open(page, { role: "restricted" });
    expect(requests.filter(url => /\/(collections|renewals|payments)(\?|\/|$)/.test(url))).toEqual([]);
    await expect(page.getByText("Fee priorities are not included in your access.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Review payments", exact: true })).toHaveCount(0);
    await capture(page, info, "restricted");
    await open(page, { role: "readonly" });
    await expect(page.getByText("Workspace is read-only", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add student", exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Record payment", exact: true }).first()).toBeDisabled();
    await expect(page.getByRole("button", { name: "Review payments", exact: true })).toBeEnabled();
    await capture(page, info, "readonly");
});

test("confirmed partial collection refreshes figures, preserves selection and keeps the receipt mounted", async ({ page }) => {
    await open(page, { scenario: "dashboard-collection" });
    const checkbox = page.getByRole("checkbox", { name: "Select Aarav Mehta's overdue payment" }).filter({ visible: true }).first();
    await checkbox.check();
    const trigger = page.getByRole("button", { name: "Record payment", exact: true }).filter({ visible: true }).first();
    await trigger.click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Amount received (whole ₹)").fill("700");
    await dialog.getByRole("button", { name: "Confirm collection", exact: true }).click();
    await expect(dialog.getByRole("heading", { name: "Collection recorded" })).toBeVisible();
    await expect(page.locator('[data-priority="overdue"]')).toContainText("₹1,700");
    await expect(page.locator(".dashboard-summary")).toContainText("₹2,600");
    await expect(page.locator(".dashboard-financial-facts")).toContainText("₹1,700");
    await expect(dialog.getByRole("heading", { name: "Collection recorded" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(checkbox).toBeChecked();
    await expect(trigger).toBeFocused();
});

test("keyboard controls and reduced motion remain usable", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await open(page);
    const refresh = page.getByRole("button", { name: "Refresh", exact: true });
    await refresh.focus();
    await expect(refresh).toBeFocused();
    expect(await refresh.evaluate(element => getComputedStyle(element).outlineStyle)).not.toBe("none");
    expect(await refresh.evaluate(element => getComputedStyle(element).transitionDuration)).toBe("0s");
    await refresh.press("Enter");
    await expect(page.locator("[data-dashboard-refinement]")).toHaveAttribute("aria-busy", "false");
    await page.getByRole("button", { name: "Add student", exact: true }).click();
    await expect(page).toHaveURL(/\/students\?action=add/);
    await expect(page.getByRole("dialog", { name: "Add new student", exact: true })).toBeVisible();
});

test("workspace keyboard order follows its visual reading order", async ({ page }, info) => {
    await open(page, { state: "busy" });
    const compact = info.project.name !== "desktop-1440";
    const regions = await page.locator(".dashboard-workspace-grid > *").evaluateAll(elements => elements.map(element =>
        [...element.classList].find(name => ["dashboard-worklists", "dashboard-collections", "dashboard-seating", "dashboard-side-column"].includes(name))));
    expect(regions).toEqual(compact
        ? ["dashboard-worklists", "dashboard-collections", "dashboard-seating", "dashboard-side-column"]
        : ["dashboard-collections", "dashboard-seating", "dashboard-side-column", "dashboard-worklists"]);
    const listOrder = await page.locator(".dashboard-worklists > *").evaluateAll(elements => elements.map(element =>
        element.classList.contains("dashboard-overdue-queue") ? "followups" : "upcoming"));
    expect(listOrder).toEqual(compact ? ["followups", "upcoming"] : ["upcoming", "followups"]);
    const focusableCount = await page.locator(".dashboard-workspace-grid").evaluate(grid => {
        const focusable = [...grid.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), input:not([disabled]), summary, select:not([disabled])")]
            .filter(element => element.getClientRects().length > 0 && element.tabIndex >= 0);
        focusable[0]?.focus();
        return focusable.length;
    });
    expect(focusableCount).toBeGreaterThan(2);
    await page.keyboard.press("Tab");
    expect(await page.locator(".dashboard-workspace-grid").evaluate(grid => {
        const focusable = [...grid.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), input:not([disabled]), summary, select:not([disabled])")]
            .filter(element => element.getClientRects().length > 0 && element.tabIndex >= 0);
        return document.activeElement === focusable[1];
    })).toBe(true);
});

test("queue selection survives the responsive reading-order change", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop-1440");
    await open(page, { state: "busy" });
    const selected = page.getByRole("checkbox", { name: "Select Aarav Mehta's overdue payment" }).filter({ visible: true }).first();
    await selected.check();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator(".dashboard-workspace-grid > *").first()).toHaveClass(/dashboard-worklists/);
    await expect(selected).toBeChecked();
    await page.setViewportSize({ width: 1440, height: 1024 });
    await expect(page.locator(".dashboard-workspace-grid > *").first()).toHaveClass(/dashboard-collections/);
    await expect(selected).toBeChecked();
});

test("missing shift-slot details are not relabelled physical seats", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop-1440");
    await page.route("**/api/analytics/branch/pilot/snapshot?**", async route => {
        const response = await route.fetch();
        const snapshot = await response.json();
        delete snapshot.seatDetails;
        await route.fulfill({ response, json: snapshot });
    });
    await open(page, { state: "busy" });
    await expect(page.locator(".dashboard-seating")).toContainText("Shift slots: Unavailable");
    await expect(page.locator(".dashboard-slot-overview")).toHaveCount(0);
});

test("a late old-branch response cannot restore old values or selections", async ({ page }) => {
    await open(page);
    await page.getByRole("checkbox", { name: "Select Aarav Mehta's overdue payment" }).filter({ visible: true }).first().check();
    let release!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; });
    let started!: () => void;
    const requestStarted = new Promise<void>(resolve => { started = resolve; });
    let finished!: () => void;
    const requestFinished = new Promise<void>(resolve => { finished = resolve; });
    await page.route("**/api/analytics/branch/pilot/snapshot?**", async route => {
        const response = await route.fetch();
        const data = await response.json();
        started(); await held;
        await route.fulfill({ json: { ...data, paidAmount: 777777 } }); finished();
    });
    await page.route(/\/api\/(?:branches|analytics\/branch)\/other(?:\/|\?)/, async route => {
        const response = await route.fetch({ url: route.request().url().replace("/other/", "/pilot/") });
        const body = (await response.text()).replaceAll("Shanti Study Library", "Other library").replaceAll("Aarav Mehta", "Other student");
        await route.fulfill({ response, body });
    });
    await page.getByRole("button", { name: "Refresh", exact: true }).click();
    await requestStarted;
    await page.evaluate(() => {
        history.pushState({}, "", "/branch/other?mode=after&lang=en");
        dispatchEvent(new Event("pilot:navigation"));
    });
    await expect(page.locator("main h1")).toHaveText("Other library");
    await expect(page.locator("[data-dashboard-refinement]")).toHaveAttribute("aria-busy", "false");
    release(); await requestFinished;
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await expect(page.locator("main")).not.toContainText("Aarav Mehta");
    await expect(page.locator("main")).not.toContainText("7,77,777");
    await expect(page.locator('main input[type="checkbox"]:checked')).toHaveCount(0);
});

test("identity changes discard old dashboard selections without a language remount", async ({ page }) => {
    await open(page);
    const checkbox = page.getByRole("checkbox", { name: "Select Aarav Mehta's overdue payment" }).filter({ visible: true }).first();
    await checkbox.check();
    await page.getByRole("combobox", { name: "Interface language", exact: true }).selectOption("hi");
    await expect(page.locator('main input[type="checkbox"]:checked').filter({ visible: true })).toHaveCount(1);
    await page.evaluate(() => {
        history.pushState({}, "", "/branch/pilot?mode=after&identity=different-user");
        dispatchEvent(new Event("pilot:navigation"));
    });
    await expect(page.locator("[data-dashboard-refinement]")).toHaveAttribute("aria-busy", "false");
    await expect(page.locator('main input[type="checkbox"]:checked')).toHaveCount(0);
});

test("busy library keeps the target proportions, honest chart and visible worklists", async ({ page }, info) => {
    await open(page, { state: "busy" });
    await fonts(page, "en");
    await expect(page.locator(".dashboard-summary")).toContainText("₹6,900");
    await expect(page.locator(".dashboard-summary")).toContainText("11");
    await expect(page.locator(".dashboard-summary")).toContainText("63%");
    await expect(page.locator(".dashboard-financial-facts")).toContainText("₹9,500");
    await expect(page.locator('[data-priority="overdue"]')).toContainText("₹5,400");
    await expect(page.locator(".dashboard-attendance-facts dd")).toHaveText(["1", "1", "3"]);
    await expect(page.locator(".dashboard-followup-list li")).toHaveCount(4);
    await expect(page.locator(".dashboard-upcoming-list li")).toHaveCount(4);
    await expect(page.locator(".dashboard-chart-bars > div")).toHaveCount(14);
    const boxes = await page.evaluate(() => Object.fromEntries(
        ["collections", "seating", "activity", "worklists", "overdue-queue", "action-center", "summary"].map(name => {
            const box = document.querySelector(`.dashboard-${name}`)!.getBoundingClientRect();
            return [name, { x: box.x, y: box.y, width: box.width, height: box.height }];
        })));
    if (info.project.name === "desktop-1440") {
        const sidebarWidth = await page.locator("[data-dashboard-navigation]").evaluate(element => element.getBoundingClientRect().width);
        fs.mkdirSync(path.join(evidence, info.project.name), { recursive: true });
        fs.writeFileSync(path.join(evidence, info.project.name, "busy-geometry.json"), JSON.stringify({
            viewport: page.viewportSize(), sidebarWidth, regions: boxes,
        }, null, 2));
        expect(sidebarWidth).toBeGreaterThanOrEqual(224);
        expect(sidebarWidth).toBeLessThanOrEqual(240);
        expect(boxes.collections.width).toBeGreaterThan(boxes.seating.width);
        expect(boxes.seating.width).toBeGreaterThan(boxes.activity.width);
        expect(Math.abs(boxes.collections.y - boxes.activity.y)).toBeLessThan(2);
        expect(boxes["action-center"].height).toBeLessThan(175);
        expect(boxes.summary.height).toBeLessThan(105);
        expect(boxes.worklists.y).toBeLessThan(870);
        expect(boxes.collections.width / boxes.activity.width).toBeGreaterThan(1.5);
    } else if (info.project.name.startsWith("mobile")) {
        expect(boxes["overdue-queue"].y).toBeLessThan(boxes.collections.y);
        expect(boxes["action-center"].width).toBeGreaterThan(boxes.summary.width * .9);
    }
    expect(await page.locator("main").evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await capture(page, info, "busy");
    const original = page.viewportSize()!;
    const height = await page.locator("main").evaluate(element => element.scrollHeight - element.clientHeight);
    await page.setViewportSize({ width: original.width, height: original.height + height + 30 });
    await capture(page, info, "busy-full");
    await page.setViewportSize(original);
    const breakdown = page.getByText("Amounts & daily breakdown", { exact: true });
    await breakdown.focus(); await breakdown.press("Enter");
    await expect(page.locator(".dashboard-collections details")).toHaveAttribute("open", "");
    const amounts = await page.locator(".dashboard-collections tbody tr td:last-child").allTextContents();
    expect(amounts.map(value => Number(value.replace(/[^0-9]/g, ""))).reduce((sum, amount) => sum + amount, 0)).toBe(5400);
    await open(page, { state: "trend-error" });
    await expect(page.getByText("Daily collections: could not be refreshed.")).toBeVisible();
    await expect(page.locator(".dashboard-financial-facts")).toContainText("₹1,500");
    await expect(page.locator(".dashboard-chart-bars")).toHaveCount(0);
});
