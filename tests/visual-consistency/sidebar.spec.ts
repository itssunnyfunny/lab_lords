import { expect, test, type Locator, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { installSettingsRouteFixture } from "../application-design-pilot/settings-route-closeout-fixture";

const surfaces = [
    ["standard", "/branch/pilot?plan=STANDARD&legacy=1"],
    ["pro", "/branch/pilot?plan=PRO&legacy=1"],
    ["basic", "/branch/pilot?plan=BASIC&legacy=1"],
    ["organization", "/org/org-pilot"],
    ["workspaces", "/org"],
    ["account-profile", "/account/profile"],
    ["account-preferences", "/account/preferences"],
    ["account-billing", "/account/billing?organizationId=org-pilot&branchId=pilot"],
    ["basic-import", "/branch/pilot/onboarding/import?plan=BASIC&legacy=1"],
] as const;
const errors = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page, context }) => {
    errors.set(page, []);
    page.on("pageerror", error => errors.get(page)!.push(error.message));
    page.on("response", response => { if (response.status() >= 400 && new URL(response.url()).pathname.startsWith("/api/")) errors.get(page)!.push(`${response.status()} ${new URL(response.url()).pathname}`); });
    await context.route("**/*", route => new URL(route.request().url()).hostname === "127.0.0.1" ? route.continue() : route.abort());
    await installSettingsRouteFixture(page);
    await page.route("**/api/organizations/org-pilot/billing/invoices*", route => route.fulfill({ json: { items: [], nextCursor: null } }));
    await page.route("**/api/organizations", route => route.fulfill({ json: [{ id: "org-pilot", name: "Shanti Learning Spaces" }, { id: "org-second", name: "Bright Reading Rooms" }] }));
    await page.route("**/api/branches/pilot/basic-overview", route => route.fulfill({ json: { branchId: "pilot", today: "2026-09-22", activeStudents: 3, money: { collectedThisMonth: 1900, pendingDues: 2400 } } }));
    await page.route("**/api/organizations/org-pilot/branches", route => route.fulfill({ json: [{ id: "pilot", organizationId: "org-pilot", name: "Shanti Study Library", city: "Indore", defaultFee: 1400, _count: { students: 3, seats: 8, shifts: 2 } }] }));
    await page.route("**/api/branches/pilot/import-sessions", route => route.fulfill({ json: [] }));
});
test.afterEach(async ({ page }) => expect(errors.get(page)).toEqual([]));

async function openSidebar(page: Page, route: string, language = "en") {
    await page.goto(route + (route.includes("?") ? "&" : "?") + `mode=after&lang=${language}`);
    // The harness banner adds 21px above a 100dvh application. Remove only that
    // synthetic label so viewport/footer geometry matches the real application.
    await page.getByTestId("synthetic-pilot-label").evaluate(label => label.remove());
    if (page.viewportSize()!.width < 1024) await page.locator("header button[aria-expanded]").first().click();
    const sidebar = page.locator(".ui-navigation-sidebar");
    await expect(sidebar).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await page.mouse.move(page.viewportSize()!.width - 1, 1);
    return sidebar;
}

async function assertOriginalStyle(page: Page, sidebar: Locator) {
    const desktop = page.viewportSize()!.width >= 1024;
    await expect(sidebar).toHaveCSS("background-color", "rgb(244, 248, 242)");
    if (desktop) await expect(sidebar).toHaveCSS("width", "230px");
    await expect(sidebar.locator(".ui-navigation-wordmark")).toHaveCSS("font-size", "27px");
    const active = sidebar.locator('a[aria-current="page"]').first();
    await expect(active).toBeVisible();
    await expect(active).toHaveCSS("color", "rgb(255, 255, 255)");
    const hindi = await page.locator("html").getAttribute("lang") === "hi-IN";
    await expect(active).toHaveCSS("font-family", hindi ? /Noto Sans Devanagari/ : /^Inter,/);
    await expect(active.locator(".ui-navigation-item-label")).toHaveCSS("font-weight", "500");
    await expect(active).toHaveCSS("background-image", "linear-gradient(110deg, rgb(7, 81, 58), rgb(34, 134, 83))");
    const inactive = sidebar.locator('a.ui-navigation-item:not([aria-current])').first();
    await expect(inactive).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await expect(inactive).toHaveCSS("border-top-color", "rgba(0, 0, 0, 0)");
    await expect(inactive).toHaveCSS("color", "rgb(72, 91, 112)");
    const geometry = await sidebar.evaluate(element => {
        const sidebar = element.getBoundingClientRect();
        const footer = element.querySelector(".ui-navigation-footer")!.getBoundingClientRect();
        const scroll = element.querySelector(".ui-navigation-scroll")!.getBoundingClientRect();
        const items = [...element.querySelectorAll<HTMLElement>(".ui-navigation-item")].filter(item => item.getBoundingClientRect().height > 0);
        return {
            sidebar: { x: sidebar.x, right: sidebar.right, bottom: sidebar.bottom },
            footer: { y: footer.y, bottom: footer.bottom }, scrollBottom: scroll.bottom,
            minimumItemHeight: Math.min(...items.map(item => item.getBoundingClientRect().height)),
            clipped: items.flatMap(item => {
                const box = item.getBoundingClientRect();
                return [...item.querySelectorAll<HTMLElement>("span,svg")].filter(child => {
                    const childBox = child.getBoundingClientRect();
                    return childBox.left < box.left - 1 || childBox.right > box.right + 1 || childBox.top < box.top - 1 || childBox.bottom > box.bottom + 1;
                }).map(child => child.textContent || child.getAttribute("aria-label") || child.tagName);
            }),
            pageOverflow: document.documentElement.scrollWidth > innerWidth,
            scrollOwners: [...element.querySelectorAll("*")].filter(node => getComputedStyle(node).overflowY === "auto").length,
        };
    });
    expect(geometry.pageOverflow).toBe(false);
    expect(geometry.clipped).toEqual([]);
    expect(geometry.scrollOwners).toBe(1);
    expect(geometry.minimumItemHeight).toBeGreaterThanOrEqual(desktop ? 36 : 44);
    expect(geometry.sidebar.x).toBeGreaterThanOrEqual(0);
    expect(geometry.sidebar.right).toBeLessThanOrEqual(page.viewportSize()!.width);
    expect(geometry.footer.bottom).toBeLessThanOrEqual(page.viewportSize()!.height + 1);
    expect(geometry.scrollBottom).toBeLessThanOrEqual(geometry.footer.y + 1);
    const footer = sidebar.locator(".ui-navigation-footer");
    const before = await footer.boundingBox();
    await sidebar.locator(".ui-navigation-scroll").evaluate(element => { element.scrollTop = element.scrollHeight; });
    expect(await footer.boundingBox()).toEqual(before);
    await expect(footer.locator(".ui-navigation-item")).toBeInViewport({ ratio: 1 });
    await sidebar.locator(".ui-navigation-scroll").evaluate(element => { element.scrollTop = 0; });
}

test("every sidebar uses the original Standard Pro presentation and keeps its footer visible", async ({ page }, info) => {
    test.setTimeout(180_000);
    for (const [name, route] of surfaces) {
        const sidebar = await openSidebar(page, route);
        if (name === "workspaces") await expect(page.getByRole("button", { name: /Shanti Learning Spaces/ })).toBeAttached();
        await assertOriginalStyle(page, sidebar);
        await page.screenshot({ path: info.outputPath(`${name}.png`), animations: "disabled" });
        const axe = await new AxeBuilder({ page }).include(".ui-navigation-sidebar").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
        expect(axe.violations, name).toEqual([]);
    }
});

test("translated navigation and short screens keep readable rows and reachable Account actions", async ({ page }, info) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: page.viewportSize()!.width, height: 568 });
    for (const language of ["hi", "hinglish"]) {
        for (const name of ["basic", "standard", "pro", "account-preferences"]) {
            const route = surfaces.find(surface => surface[0] === name)![1];
            const sidebar = await openSidebar(page, route, language);
            await assertOriginalStyle(page, sidebar);
            await page.screenshot({ path: info.outputPath(`${name}-${language}-short.png`), animations: "disabled" });
        }
    }
});

test("collapsed workspace and Account sidebars retain separate preferences and keyboard access", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop-1440", "Collapse is a desktop navigation control.");
    const sidebar = await openSidebar(page, "/branch/pilot/students?plan=PRO&legacy=1");
    await page.getByRole("button", { name: "Collapse sidebar", exact: true }).click();
    await expect(sidebar).toHaveCSS("width", "72px");
    const account = sidebar.getByRole("link", { name: "Account", exact: true });
    await account.focus();
    await expect(account).toBeFocused();
    await expect(account).toHaveAttribute("title", "Account");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "Profile & security", exact: true })).toBeVisible();
    await expect(sidebar).toHaveCSS("width", "230px");
    await page.getByRole("button", { name: "Collapse sidebar", exact: true }).click();
    await expect(sidebar).toHaveCSS("width", "72px");
    await page.screenshot({ path: info.outputPath("account-collapsed.png"), animations: "disabled" });
    await page.getByRole("link", { name: "Back to workspace", exact: true }).click();
    await expect(sidebar).toHaveCSS("width", "72px");
    await page.getByRole("button", { name: "Expand sidebar", exact: true }).click();
    await expect(sidebar).toHaveCSS("width", "230px");
    await page.reload();
    await expect(sidebar).toHaveCSS("width", "230px");
    await sidebar.getByRole("link", { name: "Account", exact: true }).click();
    await expect(sidebar).toHaveCSS("width", "72px");
    await expect(sidebar.getByRole("link", { name: "Preferences", exact: true })).toHaveAttribute("title", "Preferences");
});
