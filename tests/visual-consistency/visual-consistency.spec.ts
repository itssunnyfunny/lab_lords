import { expect, test, type Page, type TestInfo } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const browserErrors = new WeakMap<Page, string[]>();
const nativeDialogs = new WeakMap<Page, string[]>();

const basic = "?mode=after&lang=en&plan=BASIC&legacy=1";
const draftName = "Synthetic retained draft";
const draftKey = "basic-student-draft:v1:pilot-owner:pilot:new";
const operationKey = "basic-operation:v1:pilot-owner:pilot";

async function capture(page: Page, info: TestInfo, name: string) {
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await page.screenshot({ path: info.outputPath(`${name}.png`), animations: "disabled", fullPage: true });
}
async function readyBasic(page: Page, area: string) {
    await page.goto(`/branch/pilot/${area}${basic}`);
    await expect(page.locator("#bp-main")).toHaveAttribute("aria-busy", "false");
}
async function basicLink(page: Page, href: string) {
    const link = () => page.locator(`a[href*="${href}"]:visible`).first();
    if (!await link().count()) await page.getByRole("button", { name: "Open navigation", exact: true }).click();
    return link();
}
async function closeNavigation(page: Page) {
    const drawer = page.getByRole("dialog", { name: "Branch navigation", exact: true });
    if (await drawer.isVisible()) await drawer.getByRole("button", { name: "Close navigation", exact: true }).click();
}
async function setupDraft(page: Page) {
    await readyBasic(page, "setup");
    await page.getByRole("textbox", { name: "Library name", exact: true }).fill(draftName);
}
const cancel = (page: Page) => page.getByRole("alertdialog").getByRole("button", { name: "Cancel", exact: true }).click();
const approve = (page: Page) => page.getByRole("alertdialog").getByRole("button", { name: "Continue", exact: true }).click();

test.beforeEach(async ({ context, page }) => {
    const errors: string[] = [], dialogs: string[] = [];
    browserErrors.set(page, errors); nativeDialogs.set(page, dialogs);
    page.on("pageerror", error => errors.push(error.message));
    page.on("dialog", async dialog => { dialogs.push(dialog.type()); await dialog.dismiss(); });
    await context.route("**/*", route => new URL(route.request().url()).hostname === "127.0.0.1" ? route.continue() : route.abort());
    await page.route("**/api/branches/pilot", route => route.request().method() === "GET" ? route.fulfill({ json: {
        id: "pilot", name: "Shanti Study Library", organizationId: "org-pilot", defaultFee: 1400, defaultAdmissionFee: 0,
    } }) : route.fallback());
    await page.route("**/api/branches/pilot/basic-overview", route => route.fulfill({ json: {
        branchId: "pilot", today: "2026-09-22", activeStudents: 3,
        money: { collectedThisMonth: 1900, pendingDues: 2400 },
    } }));
    await page.route("**/api/branches/pilot/shifts", async route => {
        const response = await route.fetch();
        const rows = await response.json();
        await route.fulfill({ response, json: rows.map((row: object) => ({ ...row, status: "ACTIVE" })) });
    });
});

test.afterEach(async ({ page }) => {
    expect(browserErrors.get(page)).toEqual([]);
    expect(nativeDialogs.get(page)).toEqual([]);
});

for (const area of ["fees", "setup", "students/student-aarav"]) test(`${area} keeps the selected cold loading and error canvas`, async ({ page }, info) => {
        for (const boundary of ["loading", "error"]) {
            await page.goto(`/branch/pilot/${area}?mode=after&lang=en&boundary=${boundary}`);
            await expect(page.locator('[data-app-design-pilot="workspace"]')).toBeVisible();
            await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe("rgb(247, 248, 246)");
            await expect(page.getByText("Synthetic internal detail")).toHaveCount(0);
            await capture(page, info, `${area.replaceAll("/", "-")}-${boundary}`);
        }
});

test("initial access loading and failure stay themed, fail closed, and retry", async ({ page }, info) => {
    let release: (() => void) | undefined;
    let failed = true;
    await page.route("**/api/branches/pilot/access", async route => {
        if (!failed) return route.continue();
        await new Promise<void>(resolve => { release = resolve; });
        await route.fulfill({ status: 503, json: { error: "Synthetic access failure" } });
    });
    await page.goto("/branch/pilot/students?mode=after&lang=en");
    await expect(page.getByRole("status")).toContainText("Loading workspace");
    await expect(page.locator('[data-app-design-pilot="workspace"]')).toBeVisible();
    await expect(page.getByRole("button", { name: "Retry" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Add student", exact: true })).toHaveCount(0);
    await expect.poll(() => Boolean(release)).toBe(true);
    release!();
    const retry = page.getByRole("button", { name: "Retry", exact: true });
    await expect(retry).toBeVisible();
    await expect(page.getByRole("alert")).toContainText("Access could not be refreshed");
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe("rgb(247, 248, 246)");
    if (info.project.name.startsWith("mobile")) expect((await retry.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await capture(page, info, "access-error");
    failed = false;
    await retry.click();
    await expect(page.getByRole("button", { name: "Add student", exact: true })).toBeVisible();
});

test("admission has a distinct primary action and import choices meet touch sizing", async ({ page }, info) => {
    await page.goto("/branch/pilot/students?mode=after&lang=en");
    await page.getByRole("button", { name: "Add student", exact: true }).click();
    const submit = page.locator('button[form="add-student-form"]');
    await expect(submit).toHaveClass(/ui-button-primary-bg/);
    const form = page.getByRole("dialog");
    expect(await submit.evaluate(element => getComputedStyle(element).backgroundColor)).not.toBe(await form.getByRole("button", { name: "Cancel", exact: true }).evaluate(element => getComputedStyle(element).backgroundColor));
    await capture(page, info, "admission-primary");
    await page.keyboard.press("Escape");
    await page.goto("/branch/pilot/onboarding/import?mode=after&lang=en");
    for (const name of ["Upload file", "Paste table"]) {
        const choice = page.getByRole("button", { name, exact: true });
        await expect(choice).toBeVisible();
        expect((await choice.boundingBox())!.height).toBeGreaterThanOrEqual(44);
        await choice.click();
        await expect(choice).toHaveAttribute("aria-pressed", "true");
    }
    await capture(page, info, "import-source");
});

test("seat summaries translate complete messages and preserve stored shift names", async ({ page }, info) => {
    for (const lang of ["hi", "hinglish"]) {
        await page.goto(`/branch/pilot/seats?mode=after&lang=${lang}`);
        const main = page.getByRole("main");
        await main.locator("details").filter({ hasText: lang === "hi" ? "क्षमता का विवरण" : "Capacity ka vivaran" }).locator("summary").click();
        await expect(main).toContainText(lang === "hi" ? "स्लॉट का उपयोग" : "Slots ka use");
        await expect(main).toContainText(lang === "hi" ? "कुल 8" : "Kul 8");
        await expect(main).toContainText("Morning");
        if (lang === "hi") await expect(main.locator("article").first()).not.toContainText(/Allocated|Available|No active allocation/);
        await expect(main).not.toContainText(/loaded shift slots used|loaded active slots|Slot use|loaded unallocated seats/);
        await capture(page, info, `seats-${lang}`);
    }
});

test("mobile dashboard controls fit touch targets inside the named matrix scroll area", async ({ page }, info) => {
    test.skip(!info.project.name.startsWith("mobile"), "Touch target checks apply to mobile widths.");
    await page.goto("/branch/pilot?mode=after&lang=en");
    await expect(page.locator(".rd-heatmap button").first()).toBeVisible();
    const undersized = await page.locator(".reference-dashboard").evaluate(root => Array.from(root.querySelectorAll("button,a[href],summary,select")).flatMap(element => {
        const box = element.getBoundingClientRect();
        if (!box.width || !box.height || getComputedStyle(element).visibility === "hidden") return [];
        return box.height < 43.9 || box.width < 43.9 ? [{ text: element.textContent, width: box.width, height: box.height }] : [];
    }));
    expect(undersized).toEqual([]);
    const matrix = page.getByRole("tabpanel", { name: "This week" });
    await expect(matrix).toHaveAttribute("tabindex", "0");
    expect(await matrix.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true);
    await page.locator(".rd-heatmap button").last().click();
    await expect(page.locator(".rd-cell-detail")).toBeVisible();
    await page.getByRole("tab", { name: "This week" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("tab", { name: "Seat map" })).toHaveAttribute("aria-selected", "true");
    await page.getByRole("tab", { name: "This week" }).click();
    await capture(page, info, "dashboard-touch");
});

test("Basic mobile assignment selects use readable native control text", async ({ page }, info) => {
    test.skip(!info.project.name.startsWith("mobile"));
    await readyBasic(page, "seats");
    const select = page.locator(".bp-assignment select").first();
    await expect(select).toBeVisible();
    expect(await select.evaluate(element => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(16);
    await capture(page, info, "basic-assignment");
});

test("Basic unsaved form dialog preserves drafts, traps focus and restores the parent", async ({ page }, info) => {
    await readyBasic(page, "students");
    await page.getByRole("button", { name: "Add student", exact: true }).click();
    const form = page.getByRole("dialog", { name: "Add a student", exact: true });
    await form.getByRole("textbox", { name: "Student name", exact: true }).fill(draftName);
    expect(await page.evaluate(() => !window.dispatchEvent(new Event("beforeunload", { cancelable: true })))).toBe(true);
    await form.getByRole("button", { name: "Close dialog" }).click();
    const confirmation = page.getByRole("alertdialog", { name: "Unsaved changes" });
    await expect(confirmation).toBeVisible();
    await expect(confirmation.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
    for (let i = 0; i < 7; i++) {
        await page.keyboard.press("Tab");
        expect(await confirmation.evaluate(element => element.contains(document.activeElement))).toBe(true);
    }
    await capture(page, info, "basic-unsaved-dialog");
    const { violations } = await new AxeBuilder({ page }).analyze();
    expect(violations.filter(item => ["serious", "critical"].includes(item.impact!))).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(confirmation).toHaveCount(0);
    await expect(form.getByRole("textbox", { name: "Student name", exact: true })).toHaveValue(draftName);
    await expect(form.getByRole("button", { name: "Close dialog" })).toBeFocused();
    await form.getByRole("button", { name: "Close dialog" }).click();
    await approve(page);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)!).name, draftKey)).toBe(draftName);
    await page.getByRole("button", { name: "Add student", exact: true }).click();
    await expect(form.getByRole("textbox", { name: "Student name", exact: true })).toHaveValue(draftName);
});

test("Basic link and programmatic branch navigation resume only after confirmation", async ({ page }, info) => {
    await page.route("**/api/workspaces", async route => {
        const response = await route.fetch(); const directory = await response.json();
        const org = directory.organizations[0];
        org.branches.push({ ...org.branches[0], id: "second", name: "Second synthetic branch", href: "/branch/second" });
        await route.fulfill({ response, json: directory });
    });
    await setupDraft(page);
    const studentsLink = await basicLink(page, "/branch/pilot/students");
    await studentsLink.click();
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await cancel(page);
    await closeNavigation(page);
    await expect(page).toHaveURL(/\/branch\/pilot\/setup/);
    await expect(page.getByRole("textbox", { name: "Library name", exact: true })).toHaveValue(draftName);
    await page.getByRole("combobox", { name: "Switch branch" }).selectOption("second");
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await cancel(page);
    await expect(page.getByRole("combobox", { name: "Switch branch" })).toHaveValue("pilot");
    await page.getByRole("combobox", { name: "Switch branch" }).selectOption("second");
    await approve(page);
    await expect(page).toHaveURL(/\/branch\/second\/settings/);
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    // The fixture intentionally denies this unconfigured branch; no old branch draft is exposed.
    await expect(page.getByRole("textbox", { name: "Library name", exact: true })).toHaveCount(0);
    await capture(page, info, "basic-switch-denied");
});

test("Basic Back and Forward cancel safely and replay the selected history entry once", async ({ page }) => {
    await readyBasic(page, "students");
    await (await basicLink(page, "/branch/pilot/setup")).click();
    await page.getByRole("textbox", { name: "Library name", exact: true }).fill(draftName);
    await page.evaluate(() => history.back());
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await cancel(page);
    await expect(page).toHaveURL(/\/branch\/pilot\/setup/);
    await expect(page.getByRole("textbox", { name: "Library name", exact: true })).toHaveValue(draftName);
    await page.evaluate(() => history.back());
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await approve(page);
    await expect(page).toHaveURL(/\/branch\/pilot\/students/);
    await page.getByRole("button", { name: "Add student", exact: true }).click();
    await page.getByRole("textbox", { name: "Student name", exact: true }).fill(draftName);
    await page.evaluate(() => history.forward());
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await cancel(page);
    await expect(page).toHaveURL(/\/branch\/pilot\/students/);
    await page.evaluate(() => history.forward());
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await approve(page);
    await expect(page).toHaveURL(/\/branch\/pilot\/setup/);
    await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("Basic pending operations block navigation and recovery clearing keeps the draft", async ({ page }) => {
    let release: (() => void) | undefined;
    let writes = 0;
    await page.route("**/api/branches/pilot", async route => {
        if (route.request().method() !== "PATCH") return route.fallback();
        writes++;
        await new Promise<void>(resolve => { release = resolve; });
        await route.fulfill({ status: 503, json: { error: "Synthetic uncertain operation" } });
    });
    await setupDraft(page);
    await page.getByRole("button", { name: "Save setup", exact: true }).click();
    await expect.poll(() => writes).toBe(1);
    await (await basicLink(page, "/branch/pilot/students")).click();
    await closeNavigation(page);
    await expect(page.getByText("Wait for the current operation to finish.")).toBeVisible();
    await expect(page).toHaveURL(/\/branch\/pilot\/setup/);
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    release!();
    await page.getByRole("button", { name: "I reviewed the records" }).click();
    await cancel(page);
    expect(await page.evaluate(key => Boolean(sessionStorage.getItem(key)), operationKey)).toBe(true);
    await expect(page.getByRole("textbox", { name: "Library name", exact: true })).toHaveValue(draftName);
    await page.getByRole("button", { name: "I reviewed the records" }).click();
    await approve(page);
    expect(await page.evaluate(key => sessionStorage.getItem(key), operationKey)).toBeNull();
    await expect(page.getByRole("textbox", { name: "Library name", exact: true })).toHaveValue(draftName);
    expect(writes).toBe(1);
});


test("Basic admission recovery closes only after review and retains the original draft", async ({ page }) => {
    let writes = 0;
    page.on("request", request => { if (["POST", "PATCH", "DELETE"].includes(request.method())) writes++; });
    await page.addInitScript(({ operationKey, draftKey, draftName }) => {
        sessionStorage.setItem(draftKey, JSON.stringify({ name: draftName, phone: "9876543210", fee: "1400", admission: "0" }));
        sessionStorage.setItem(operationKey, JSON.stringify({ version: 1, scope: "pilot-owner:pilot", kind: "student",
            url: "/branches/pilot/students", method: "POST", body: { name: draftName, phone: "9876543210", monthlyFee: 1400, admissionFee: 0 }, key: "synthetic-uncertain-admission" }));
    }, { operationKey, draftKey, draftName });
    await readyBasic(page, "students");
    await page.getByRole("button", { name: "Check saved operation", exact: true }).click();
    const review = page.getByRole("dialog", { name: "Review uncertain admission", exact: true });
    await expect(review).toBeVisible();
    await review.getByRole("button", { name: "Close recovery and keep draft" }).click();
    await cancel(page);
    expect(await page.evaluate(key => Boolean(sessionStorage.getItem(key)), operationKey)).toBe(true);
    await review.getByRole("button", { name: "Close recovery and keep draft" }).click();
    await approve(page);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(await page.evaluate(key => sessionStorage.getItem(key), operationKey)).toBeNull();
    await page.getByRole("button", { name: "Add student", exact: true }).click();
    await expect(page.getByRole("textbox", { name: "Student name", exact: true })).toHaveValue(draftName);
    expect(writes).toBe(0);
});

test("Basic access refresh errors and presentation changes retain the draft until confirmed", async ({ page }, info) => {
    let fail = false;
    let full = false;
    await page.route("**/api/branches/pilot/access", async route => {
        if (fail) return route.fulfill({ status: 503, json: { error: "Synthetic access refresh failure" } });
        const response = await route.fetch(); const access = await response.json();
        if (full) { access.effectivePlan = "PRO"; access.billingExperience.effectivePlan = "PRO"; }
        await route.fulfill({ response, json: access });
    });
    await setupDraft(page);
    fail = true;
    await page.evaluate(() => window.dispatchEvent(new Event("billing-access-changed")));
    const refresh = page.getByRole("dialog", { name: "Access could not be refreshed", exact: true });
    await expect(refresh).toBeVisible();
    await capture(page, info, "basic-access-refresh");
    fail = false;
    await refresh.getByRole("button", { name: "Retry", exact: true }).click();
    await expect(refresh).toHaveCount(0);
    await expect(page.getByRole("textbox", { name: "Library name", exact: true })).toHaveValue(draftName);
    full = true;
    await page.evaluate(() => window.dispatchEvent(new Event("billing-access-changed")));
    const transition = page.getByRole("dialog", { name: "Workspace access changed", exact: true });
    await transition.getByRole("button", { name: "Continue to the updated workspace", exact: true }).click();
    await cancel(page);
    await expect(transition).toBeVisible();
    await transition.getByRole("button", { name: "Continue to the updated workspace", exact: true }).click();
    const confirmation = page.getByRole("alertdialog", { name: "Workspace access changed", exact: true });
    await capture(page, info, "workspace-transition-confirmation");
    await confirmation.getByRole("button", { name: "Continue to the updated workspace", exact: true }).click();
    await expect(transition).toHaveCount(0);
    await expect(page.locator("[data-basic-workspace]")).toHaveCount(0);
    await expect(page.locator('div[data-app-design-pilot="workspace"]')).toBeVisible();
    expect(await page.locator("#root").evaluate(element => (element as HTMLElement).inert)).toBe(false);
});


for (const status of [401, 403, 404]) test(`access ${status} clears drafts and shows a generic denied state`, async ({ page }, info) => {
    let denied = false;
    await page.route("**/api/branches/pilot/access", route => denied
        ? route.fulfill({ status, json: { error: "Synthetic denied access" } }) : route.continue());
    await page.goto("/branch/pilot/students?mode=after&lang=en");
    await page.getByRole("button", { name: "Add student", exact: true }).click();
    await page.locator("#add-student-name").fill(draftName);
    denied = true;
    await page.evaluate(() => window.dispatchEvent(new Event("billing-access-changed")));
    await expect(page.getByRole("heading", { name: "No access", exact: true })).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator("main")).not.toContainText(draftName);
    await expect(page.locator("main")).not.toContainText("Your draft is still here");
    await capture(page, info, `access-denied-${status}`);
    denied = false;
    await page.getByRole("button", { name: "Retry", exact: true }).click();
    await page.getByRole("button", { name: "Add student", exact: true }).click();
    await expect(page.locator("#add-student-name")).toHaveValue("");
});

test("row menus focus visible items on Enter and arrow keys and restore the trigger", async ({ page }) => {
    await page.goto("/branch/pilot/students?mode=after&lang=en");
    const trigger = page.locator('button[aria-label="Actions"]:visible').first();
    for (const key of ["Enter", "ArrowUp", "ArrowDown"]) {
        await trigger.focus();
        await page.keyboard.press(key);
        const items = page.getByRole("menuitem").filter({ visible: true });
        await expect(key === "ArrowUp" ? items.last() : items.first()).toBeFocused();
        await page.keyboard.press("Escape");
        await expect(trigger).toBeFocused();
        await expect(page.getByRole("menu")).toHaveCount(0);
    }
});
