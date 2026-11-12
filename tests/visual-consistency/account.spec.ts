import { expect, test, type Page, type TestInfo } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { installSettingsRouteFixture } from "../application-design-pilot/settings-route-closeout-fixture";

const query = "?mode=after&lang=en&organizationId=org-pilot&branchId=pilot&returnTo=%2Fbranch%2Fpilot%2Fstudents";
const errors = new WeakMap<Page, string[]>();
const dialogs = new WeakMap<Page, string[]>();
async function navigation(page: Page, name: string) {
    const link = () => page.getByRole("link", { name, exact: true }).filter({ visible: true }).first();
    const open = page.getByRole("button", { name: "Open navigation", exact: true });
    // Wait for the shell to finish rendering before choosing desktop or drawer navigation.
    await expect(link().or(open).first()).toBeVisible();
    if (!await link().count()) await open.click();
    await link().click();
}
async function closeDrawer(page: Page) {
    const close = page.getByRole("button", { name: "Close navigation", exact: true });
    if (await close.isVisible()) await close.click();
}
async function capture(page: Page, info: TestInfo, name: string) {
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`${name}.png`), animations: "disabled", fullPage: true });
}
async function editPreferences(page: Page) {
    await page.getByRole("button", { name: "Edit settings", exact: true }).click();
    await page.getByRole("radio", { name: "Compact", exact: true }).click();
}
test.beforeEach(async ({ page, context }) => {
    errors.set(page, []); dialogs.set(page, []);
    page.on("pageerror", error => errors.get(page)!.push(error.message));
    page.on("dialog", async dialog => { dialogs.get(page)!.push(dialog.type()); await dialog.dismiss(); });
    await context.route("**/*", route => new URL(route.request().url()).hostname === "127.0.0.1" ? route.continue() : route.abort());
    await installSettingsRouteFixture(page);
    await page.route("**/api/branches/pilot/basic-overview", route => route.fulfill({ json: { branchId: "pilot", today: "2026-09-22", activeStudents: 3, money: { collectedThisMonth: 1900, pendingDues: 2400 } } }));
});
test.afterEach(async ({ page }) => { expect(errors.get(page)).toEqual([]); expect(dialogs.get(page)).toEqual([]); });

test("shared Account header separates translated return actions from its title", async ({ page }, info) => {
    for (const language of ["en", "hi", "hinglish"]) {
        await page.goto("/account/billing" + query.replace("lang=en", "lang=" + language));
        const header = page.locator(".ui-account-topbar");
        await expect(header).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        const title = header.locator(":scope > div").first().locator(":scope > span");
        const back = header.getByRole("link");
        await expect(back).toHaveAttribute("href", "/branch/pilot/students");
        const titleBox = (await title.boundingBox())!, backBox = (await back.boundingBox())!, headerBox = (await header.boundingBox())!;
        expect(titleBox.x + titleBox.width).toBeLessThanOrEqual(backBox.x - 4);
        expect(backBox.x + backBox.width).toBeLessThanOrEqual(page.viewportSize()!.width);
        expect(backBox.y + backBox.height).toBeLessThanOrEqual(headerBox.y + headerBox.height);
        expect(backBox.height).toBeGreaterThanOrEqual(44);
        expect(await back.locator("span").evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
        if (info.project.name !== "desktop-1440") {
            const menuBox = (await header.getByRole("button").boundingBox())!;
            expect(menuBox.width).toBeGreaterThanOrEqual(44);
            expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(titleBox.x);
        }
        await capture(page, info, `account-header-${language}`);
    }
});

test("Basic Standard and Pro share the Account footer and retain their workspace return", async ({ page }, info) => {
    for (const plan of ["BASIC", "STANDARD", "PRO"]) {
        await page.goto(`/branch/pilot/students?mode=after&lang=en&plan=${plan}&legacy=1`);
        await expect(page.getByRole("button", { name: "Add student", exact: true })).toBeVisible();
        await expect(page.locator("header select[id$=interfaceLanguage]")).toHaveCount(0);
        if (!await page.getByRole("link", { name: "Account", exact: true }).isVisible()) await page.getByRole("button", { name: "Open navigation", exact: true }).click();
        const account = page.getByRole("link", { name: "Account", exact: true });
        await expect(account).toHaveAttribute("href", /account(?:\/profile)?\?.*returnTo=/);
        if (plan === "BASIC") {
            await capture(page, info, "shared-navigation");
            const axe = await new AxeBuilder({ page }).analyze();
            expect(axe.violations.filter(item => ["serious", "critical"].includes(item.impact!))).toEqual([]);
        }
        await account.click();
        await expect(page.getByRole("heading", { name: "Profile & security", exact: true })).toBeVisible();
        await expect(page.getByRole("link", { name: "Back to workspace", exact: true })).toHaveAttribute("href", /\/branch\/pilot\/students/);
        expect((await page.locator(".ui-account-topbar").boundingBox())!.height).toBeLessThan(100);
        await capture(page, info, `account-${plan.toLowerCase()}`);
        if (plan === "BASIC" && info.project.name === "desktop-1440") {
            await page.getByRole("button", { name: "Collapse sidebar", exact: true }).click();
            await expect(page.getByRole("complementary")).toHaveAttribute("data-collapsed", "true");
            await page.getByRole("link", { name: "Back to workspace", exact: true }).click();
            await expect(page.getByRole("complementary")).not.toHaveAttribute("data-collapsed", "true");
        }
    }
});

test("Preferences own language controls and keep the last field reachable above Save", async ({ page }, info) => {
    await page.goto("/account/preferences" + query);
    for (const [value, tag] of [["hi", "hi-IN"], ["hinglish", "hi-Latn-IN"], ["en", "en-IN"]]) {
        await page.locator('select[id$="interfaceLanguage"]').selectOption(value);
        await expect(page.locator("html")).toHaveAttribute("lang", tag);
        await expect(page.locator('select[id$="documentLanguage"]')).toHaveValue("en");
        await capture(page, info, `preferences-${value}`);
    }
    await editPreferences(page);
    await page.getByRole("main").evaluate(node => { node.scrollTop = node.scrollHeight; });
    const last = page.getByRole("radiogroup", { name: "Landing page", exact: true });
    const bar = page.getByRole("status").filter({ has: page.getByRole("button", { name: "Save changes", exact: true }) });
    await expect(last).toBeVisible();
    expect((await last.boundingBox())!.y).toBeGreaterThanOrEqual((await page.getByRole("main").boundingBox())!.y);
    expect((await last.boundingBox())!.y + (await last.boundingBox())!.height).toBeLessThan((await bar.boundingBox())!.y);
    await capture(page, info, "preferences-edit-bottom");
    await page.getByRole("button", { name: "Save changes", exact: true }).click();
    await expect(page.getByText("Settings saved.", { exact: true })).toBeVisible();
    await page.reload();
    await page.getByRole("button", { name: "Edit settings", exact: true }).click();
    await expect(page.getByRole("radio", { name: "Compact", exact: true })).toBeChecked();
    await page.getByRole("radio", { name: "Comfortable", exact: true }).click();
    await page.getByRole("button", { name: "Save changes", exact: true }).click();
});

test("Account leave confirmation preserves drafts and resumes links Back and Forward once", async ({ page }, info) => {
    await page.goto("/account/profile" + query);
    await navigation(page, "Preferences");
    await editPreferences(page);
    await navigation(page, "Billing");
    const confirmation = page.getByRole("alertdialog", { name: "Unsaved changes", exact: true });
    await expect(confirmation.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
    await capture(page, info, "account-unsaved");
    const axe = await new AxeBuilder({ page }).analyze();
    expect(axe.violations.filter(item => ["serious", "critical"].includes(item.impact!))).toEqual([]);
    await confirmation.getByRole("button", { name: "Cancel", exact: true }).click();
    await closeDrawer(page);
    await expect(page.getByRole("radio", { name: "Compact", exact: true })).toBeChecked();
    await navigation(page, "Billing");
    await confirmation.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(page).toHaveURL(/account\/billing.*organizationId=org-pilot.*branchId=pilot/);
    await expect(page.getByRole("region", { name: "Subscription workspace" })).toContainText("Shanti Study Library");
    await page.evaluate(() => history.back());
    await editPreferences(page);
    await page.evaluate(() => history.back());
    await confirmation.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(page.getByRole("radio", { name: "Compact", exact: true })).toBeChecked();
    await page.evaluate(() => history.back());
    await confirmation.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Profile & security", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Edit settings", exact: true }).click();
    const name = page.getByRole("textbox", { name: "Display name", exact: true });
    await name.fill("Synthetic retained account draft");
    await page.evaluate(() => history.forward());
    await confirmation.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(name).toHaveValue("Synthetic retained account draft");
    await page.evaluate(() => history.forward());
    await confirmation.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Preferences", exact: true, level: 1 })).toBeVisible();
});

test("Account pending saves block navigation and failed saves retain a discardable draft", async ({ page }, info) => {
    let release: (() => void) | undefined, writes = 0;
    await page.route("**/api/users/me", async route => {
        if (route.request().method() !== "PATCH") return route.fallback();
        writes++;
        await new Promise<void>(resolve => { release = resolve; });
        await route.fulfill({ status: 503, json: { error: "Synthetic preference save failure" } });
    });
    await page.goto("/account/preferences" + query);
    await editPreferences(page);
    await page.getByRole("button", { name: "Save changes", exact: true }).click();
    await expect.poll(() => Boolean(release)).toBe(true);
    await page.getByRole("link", { name: "Back to workspace", exact: true }).click();
    await expect(page).toHaveURL(/account\/preferences/);
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    release!();
    await expect(page.getByRole("alert")).toContainText("Something went wrong. Try again.");
    await expect(page.getByRole("radio", { name: "Compact", exact: true })).toBeChecked();
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    const discard = page.getByRole("alertdialog", { name: "Discard account changes?", exact: true });
    await capture(page, info, "account-discard");
    await discard.getByRole("button", { name: "Keep editing", exact: true }).click();
    await expect(page.getByRole("radio", { name: "Compact", exact: true })).toBeChecked();
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await discard.getByRole("button", { name: "Discard changes", exact: true }).click();
    await expect(page.getByRole("button", { name: "Edit settings", exact: true })).toBeVisible();
    expect(writes).toBe(1);
});
