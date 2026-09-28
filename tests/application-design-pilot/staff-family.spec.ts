import fs from "node:fs";
import { test, expect, type Page, type TestInfo } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { installStaffFixture } from "./staff-family-fixture";

const output = "docs/redesign/batch-two-evidence/staff";
async function open(page: Page, query: Record<string, string> = {}) {
    await page.goto(`/branch/pilot/staff?${new URLSearchParams({ mode: "after", lang: "en", ...query })}`);
    await expect(page.locator('[data-record-list] [aria-busy="true"]')).toHaveCount(0);
    await expect(page.locator("p:visible").filter({ hasText: /^Aditi Sharma$/ })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
}
async function shot(page: Page, info: TestInfo, name: string) {
    fs.mkdirSync(output, { recursive: true });
    if (name === "access-hi") await page.getByRole("dialog").evaluate(node => { node.scrollTop = 0; });
    await page.screenshot({ path: `${output}/${name}-${info.project.name}.png`, fullPage: true, animations: "disabled" });
    if (["en", "hi"].includes(name) && !info.project.name.startsWith("desktop")) {
        await page.locator('[data-staff-record-card]:visible').first().scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${output}/${name}-records-${info.project.name}.png`, animations: "disabled" });
    }
}

test("Staff uses the approved hierarchy, compact table and all three languages without narrow overflow", async ({ page }, info) => {
    await installStaffFixture(page);
    const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    for (const [lang, htmlLang] of [["en", "en-IN"], ["hi", "hi-IN"], ["hinglish", "hi-Latn-IN"]]) {
        await open(page, { lang });
        await expect(page.locator("html")).toHaveAttribute("lang", htmlLang);
        await expect(page.locator('[data-record-list]')).toContainText("very.long.synthetic.address.for.wrapping@example.test");
        expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
        if (info.project.name.startsWith("desktop")) await expect(page.locator(".ui-table--compact")).toBeVisible();
        else {
            const cards = page.locator('[data-staff-record-card]:visible'); await expect(cards).toHaveCount(3);
            expect(await cards.evaluateAll(nodes => nodes.every(node => node.scrollWidth <= node.clientWidth))).toBe(true);
            expect(await cards.first().getByRole("button").first().evaluate(node => node.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
        }
        if (lang === "en" && info.project.name !== "mobile-320" || lang === "hi" && info.project.name === "mobile-320") await shot(page, info, lang);
    }
    const { violations } = await new AxeBuilder({ page }).analyze();
    expect(violations.filter(item => ["serious", "critical"].includes(item.impact!))).toEqual([]); expect(errors).toEqual([]);
});

test("Staff access retains canonical role/permission commands, failed drafts, language and focus", async ({ page }, info) => {
    const commands = await installStaffFixture(page); let fail = true;
    await page.route("**/api/branches/pilot/staff/synthetic-manager", route => route.request().method() === "PATCH" && fail ? route.fulfill({ status: 503, json: { error: "Synthetic save failed" } }) : route.fallback());
    await open(page);
    const trigger = page.locator('button[aria-haspopup="menu"]:visible').first();
    await trigger.focus(); await page.keyboard.press("Enter"); await expect(page.getByRole("menuitem").first()).toBeFocused();
    await page.getByRole("menuitem", { name: "Set Access", exact: true }).click();
    const dialog = page.getByRole("dialog"); await expect(dialog).toHaveAccessibleName("Staff Access");
    await dialog.getByRole("group", { name: "Staff role", exact: true }).getByRole("button", { name: /^Staff/ }).click();
    await dialog.getByRole("group", { name: "View payments", exact: true }).getByRole("button", { name: "Block", exact: true }).click();
    await dialog.getByRole("button", { name: "Save Access" }).click(); await expect(dialog.getByRole("alert")).toBeVisible();
    await dialog.getByLabel("Interface language", { exact: true }).selectOption("hi");
    await expect(dialog.getByRole("group", { name: "पेमेंट देखें", exact: true }).getByRole("button", { name: "रोकें", exact: true })).toHaveAttribute("aria-pressed", "true");
    if (info.project.name === "mobile-390" || info.project.name.startsWith("desktop")) await shot(page, info, "access-hi");
    fail = false; await dialog.getByRole("button", { name: "अनुमति सेव करें", exact: true }).click(); await expect(dialog).toHaveCount(0); await expect(trigger).toBeFocused();
    expect(commands.at(-1)).toMatchObject({ method: "PATCH", path: "/api/branches/pilot/staff/synthetic-manager", body: { role: "STAFF", permissions: { view_payments: false } } });
    await expect(page.locator('[data-record-list]')).toContainText("1 रुके हुए");
});

test("Staff invitation and add validation retain existing account-bound commands and local copy/revoke", async ({ page, context }, info) => {
    const commands = await installStaffFixture(page);
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await open(page);
    await page.getByRole("button", { name: "Create invite", exact: true }).click(); await expect(page.getByRole("alert")).toBeVisible();
    await page.getByLabel("Invite email", { exact: true }).fill("review@example.test"); await page.getByRole("button", { name: "Create invite", exact: true }).click();
    await expect(page.getByLabel("Latest invite link")).toHaveValue(/SYNTHETIC-NOT-A-CREDENTIAL/);
    expect(commands.at(-1)).toMatchObject({ method: "POST", path: "/api/branches/pilot/staff-invites", body: { email: "review@example.test", role: "STAFF" } });
    await page.getByRole("button", { name: "Copy link", exact: true }).click(); await expect(page.getByRole("button", { name: "Copied", exact: true })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("SYNTHETIC-NOT-A-CREDENTIAL");
    await page.getByRole("button", { name: "Revoke", exact: true }).click(); await expect(page.getByLabel("Latest invite link")).toHaveCount(0);
    expect(commands.at(-1)).toMatchObject({ method: "DELETE", path: "/api/branches/pilot/staff-invites/synthetic-invite" });
    await page.getByRole("button", { name: "Add Staff", exact: true }).click();
    const dialog = page.getByRole("dialog"); await dialog.getByRole("button", { name: "Add Staff", exact: true }).click(); await expect(dialog.locator("#add-staff-email")).toHaveAttribute("aria-invalid", "true");
    await dialog.getByLabel("Email *").fill("new@example.test"); await dialog.getByLabel("Interface language", { exact: true }).selectOption("hinglish"); await expect(dialog.locator("#add-staff-email")).toHaveValue("new@example.test");
    await dialog.getByRole("combobox").selectOption("en");
    await dialog.getByRole("button", { name: "Add Staff", exact: true }).click(); await expect(dialog).toHaveCount(0);
    expect(commands.at(-1)).toMatchObject({ method: "POST", path: "/api/branches/pilot/staff", body: { email: "new@example.test", role: "STAFF" } });
    const record = page.locator('[data-record-list]').getByText("Added synthetic member", { exact: true }).filter({ visible: true }); await expect(record).toBeVisible();
    if (info.project.name === "mobile-390") await shot(page, info, "invite-validation");
});

test("Staff removal keeps confirmation, keyboard cancellation and the scoped delete identity", async ({ page }) => {
    const commands = await installStaffFixture(page); await open(page);
    const trigger = page.locator('button[aria-haspopup="menu"]:visible').first();
    await trigger.click(); await page.getByRole("menuitem", { name: "Remove", exact: true }).click();
    const confirmation = page.getByRole("alertdialog", { name: "Remove Staff" }); await expect(confirmation).toBeVisible();
    await page.keyboard.press("Escape"); await expect(confirmation).toHaveCount(0); await expect(trigger).toBeFocused();
    expect(commands.filter(command => command.method === "DELETE")).toHaveLength(0);
    await trigger.click(); await page.getByRole("menuitem", { name: "Remove", exact: true }).click();
    await confirmation.getByRole("button", { name: "Remove", exact: true }).click(); await expect(confirmation).toHaveCount(0);
    await expect(page.locator('[data-record-list]')).not.toContainText("Aditi Sharma");
    expect(commands.at(-1)).toMatchObject({ method: "DELETE", path: "/api/branches/pilot/staff/synthetic-manager" });
});

test("Staff loading errors, pagination, readonly, manager-only and denied access stay distinct", async ({ page }) => {
    await installStaffFixture(page);
    await open(page, { scenario: "pagination" }); await page.getByRole("button", { name: "Load more staff" }).click(); await expect(page.locator('[data-record-list]')).toContainText("Showing 3 of 3");
    await open(page, { role: "readonly" }); await expect(page.getByRole("button", { name: "Add Staff", exact: true })).toBeDisabled(); await expect(page.getByRole("button", { name: "Create invite", exact: true })).toBeDisabled();
    await page.route("**/api/branches/pilot/access", async route => { const response = await route.fetch(); const data = await response.json(); data.isOwner = false; data.role = "MANAGER"; data.permissions.staff_management = false; await route.fulfill({ response, json: data }); });
    await open(page); await expect(page.getByRole("button", { name: "Add Staff", exact: true })).toHaveCount(0); await expect(page.getByRole("button", { name: "Actions", exact: true })).toHaveCount(0); await expect(page.getByLabel("Invite email", { exact: true })).toHaveCount(0);
    await page.unroute("**/api/branches/pilot/access");
    let fail = true; await page.route("**/api/branches/pilot/staff?**", route => fail ? route.fulfill({ status: 503, json: { error: "Synthetic read failure" } }) : route.fallback());
    await page.goto("/branch/pilot/staff?mode=after&lang=en"); await expect(page.getByRole("alert")).toBeVisible(); await expect(page.locator("#staff-pagination-status")).toHaveCount(0); fail = false;
    await page.getByRole("button", { name: "Try again" }).click(); await expect(page.locator("p:visible").filter({ hasText: /^Aditi Sharma$/ })).toBeVisible();
    await page.goto("/branch/pilot/staff?mode=after&lang=en&role=restricted"); await expect(page.getByRole("heading", { name: "No access", exact: true })).toBeVisible(); await expect(page.locator("main")).not.toContainText("Aditi Sharma");
});
