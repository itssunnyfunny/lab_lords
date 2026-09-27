import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function open(page: Page, query: Record<string, string> = {}) {
    await page.goto(`/branch/pilot/students?${new URLSearchParams({ mode: "after", lang: "en", ...query })}`);
    await expect(page.locator('[data-record-list] [aria-busy="true"]')).toHaveCount(0);
    await expect(page.locator('[data-student-record-card]:visible').first()).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
}

test("short cards keep distinct financial values and fit both narrow widths in all three languages", async ({ page }, info) => {
    test.skip(!info.project.name.startsWith("mobile"), "Focused narrow-screen card check");
    await page.route("**/api/branches/pilot/students?**", async route => {
        const response = await route.fetch(); const data = await response.json();
        data.items = data.items.map((row: { id: string }) => row.id === "student-meera" ? { ...row, phone: null } : row);
        await route.fulfill({ response, json: data });
    });
    for (const [lang, htmlLang, subtitle] of [["en", "en-IN", "View students, their seats and fee details."], ["hi", "hi-IN", "छात्रों, उनकी सीटों और फीस की जानकारी देखें।"], ["hinglish", "hi-Latn-IN", "Students, unki seats aur fee details dekhein."]]) {
        await open(page, { lang });
        await expect(page.locator("html")).toHaveAttribute("lang", htmlLang);
        await expect(page.locator(".ui-record-description")).toHaveText(subtitle);
        const cards = page.locator('[data-student-record-card]:visible'); await expect(cards).toHaveCount(3);
        await expect(cards.nth(0)).toContainText("2,400"); await expect(cards.nth(0)).toContainText("400");
        await expect(cards.nth(1)).toContainText("1,500");
        await expect(cards.nth(2).locator(".ui-record-card-due")).toContainText("0");
        await expect(cards.nth(2).locator(".ui-record-card-meta").first()).not.toContainText("+91");
        expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
        const sizes = await cards.evaluateAll(nodes => nodes.map(node => ({ height: node.getBoundingClientRect().height, overflow: node.scrollWidth > node.clientWidth, nameTap: node.querySelector(".ui-record-card-details")!.getBoundingClientRect().height, menuTap: node.querySelector('button[aria-haspopup="menu"]')!.getBoundingClientRect().height })));
        expect(sizes.every(size => !size.overflow && size.nameTap >= 44 && size.menuTap >= 44)).toBe(true);
        // Density is checked on short English records, without capping translated or long cards.
        if (lang === "en" && info.project.name === "mobile-390") expect(sizes.every(size => size.height >= 170 && size.height <= 210)).toBe(true);
    }
});

test("long names and multiple allocation pairs wrap without losing information", async ({ page }, info) => {
    test.skip(!info.project.name.startsWith("mobile"), "Focused narrow-screen card check");
    await page.route("**/api/branches/pilot/students?**", async route => {
        const response = await route.fetch(); const data = await response.json();
        data.items = data.items.map((row: { id: string; seatAllocations: Array<Record<string, unknown>> }) => row.id === "student-nisha" ? { ...row,
            name: "सिंथेटिक छात्रा आराध्या शर्मा बहुत लंबा छात्र नाम",
            seatAllocations: [...row.seatAllocations, { ...row.seatAllocations[0], id: "synthetic-extra", seat: { id: "seat-a1", label: "A1" }, shift: { id: "extended", name: "Morning extended study session" }, multiShift: { id: "bundle", name: "Full day" } }] } : row);
        await route.fulfill({ response, json: data });
    });
    await open(page, { lang: "hi" });
    const card = page.locator('[data-student-record-card]:visible').nth(1);
    await expect(card).toContainText("बहुत लंबा छात्र नाम"); await expect(card).toContainText("B2"); await expect(card).toContainText("Evening");
    await expect(card).toContainText("A1"); await expect(card).toContainText("Full day (Morning extended study session)");
    await expect(card.locator("li")).toHaveCount(2);
    expect(await card.evaluate(node => node.scrollWidth > node.clientWidth)).toBe(false);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});

test("name and menu work independently by keyboard and restore focus and list context", async ({ page }, info) => {
    test.skip(!info.project.name.startsWith("mobile"), "Focused narrow-screen card check");
    await open(page);
    const search = page.getByLabel("Search students by name or phone"); await search.fill("Aarav");
    await expect(page.locator('[data-student-record-card]:visible')).toHaveCount(1);
    const card = page.locator('[data-student-record-card]:visible');
    const name = card.getByRole("button", { name: "Edit Details · Aarav Mehta", exact: true });
    await name.focus(); await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog", { name: "Edit student" })).toBeVisible();
    await page.keyboard.press("Escape"); await expect(name).toBeFocused();
    const menu = card.getByRole("button", { name: "Actions", exact: true });
    await menu.focus(); await page.keyboard.press("Enter"); await expect(page.getByRole("menuitem").first()).toBeFocused();
    await page.keyboard.press("Escape"); await expect(menu).toBeFocused();
    await menu.click(); await page.getByRole("menuitem", { name: "View Fees", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Aarav Mehta" })).toBeVisible();
    await page.keyboard.press("Escape"); await expect(menu).toBeFocused(); await expect(search).toHaveValue("Aarav");
    await expect(card).toContainText("A1");
    const { violations } = await new AxeBuilder({ page }).analyze();
    expect(violations.filter(item => ["serious", "critical"].includes(item.impact!))).toEqual([]);
});

test("restricted, readonly and inactive cards retain existing permissions and meanings", async ({ page }, info) => {
    test.skip(!info.project.name.startsWith("mobile"), "Focused narrow-screen card check");
    await open(page, { role: "restricted" });
    const cards = page.locator('[data-student-record-card]:visible');
    await expect(cards.first()).toContainText("No payment access"); await expect(cards.first()).not.toContainText("Due:");
    await cards.first().getByRole("button", { name: "Actions", exact: true }).click(); await expect(page.getByRole("menuitem", { name: "View Fees", exact: true })).toHaveCount(0); await page.keyboard.press("Escape");
    await open(page, { role: "readonly" });
    await cards.first().getByRole("button", { name: "View Fees · Aarav Mehta", exact: true }).click();
    const fees = page.getByRole("dialog", { name: "Aarav Mehta" }); await expect(fees).toBeVisible();
    await expect(fees.getByRole("button", { name: "Collect fee", exact: true })).toBeDisabled();
    await page.keyboard.press("Escape");
    await cards.first().getByRole("button", { name: "Actions", exact: true }).click();
    await expect(page.getByRole("menuitem", { name: /Edit Details/ })).toBeDisabled(); await page.keyboard.press("Escape");
    await page.getByRole("button", { name: /^Inactive/ }).click();
    await expect(cards).toHaveCount(1); await expect(cards.first()).toContainText("Inactive");
    await cards.first().getByRole("button", { name: "Actions", exact: true }).click();
    await expect(page.getByRole("menuitem", { name: /Activate/ })).toBeDisabled();
});

test("Edit keeps validation, language access, primary Save and blocked dismissal while saving", async ({ page }, info) => {
    test.skip(!info.project.name.startsWith("mobile"), "Focused narrow-screen card check");
    let release: (() => void) | undefined; let pending = false;
    await page.route("**/api/branches/pilot/students", async route => {
        if (route.request().method() === "PATCH") {
            pending = true; await new Promise<void>(resolve => { release = resolve; });
        }
        await route.continue();
    });
    await open(page);
    await page.locator('[data-student-record-card]:visible').first().getByRole("button", { name: "Edit Details · Aarav Mehta", exact: true }).click();
    const dialog = page.getByRole("dialog"); const name = dialog.locator("#edit-student-name"); const save = dialog.getByRole("button", { name: "Save Changes", exact: true });
    await expect(save).toBeDisabled(); await name.fill(""); await save.click();
    await expect(name).toHaveAttribute("aria-invalid", "true");
    await name.fill("Aarav retained review draft"); await expect(save).toBeEnabled();
    expect(await save.getAttribute("class")).toContain("--ui-button-primary-bg");
    expect(await dialog.getByRole("button", { name: "Cancel", exact: true }).getAttribute("class")).toContain("--ui-button-secondary-bg");
    await dialog.getByLabel("Interface language", { exact: true }).selectOption("hi");
    await expect(name).toHaveValue("Aarav retained review draft");
    await dialog.getByLabel("स्क्रीन की भाषा", { exact: true }).selectOption("en");
    await expect(dialog).toHaveAccessibleName("Edit student");
    expect(await page.locator("#root").evaluate(node => (node as HTMLElement).inert)).toBe(true);
    expect(await dialog.evaluate(node => node.scrollWidth > node.clientWidth)).toBe(false);
    await save.click(); await expect.poll(() => pending).toBe(true); await expect(dialog).toHaveAttribute("aria-busy", "true");
    await expect(dialog.getByRole("button", { name: "Cancel", exact: true })).toBeDisabled(); await page.keyboard.press("Escape"); await expect(dialog).toBeVisible();
    await dialog.getByLabel("Interface language", { exact: true }).selectOption("hinglish"); await expect(name).toHaveValue("Aarav retained review draft");
    release!(); await expect(dialog).toHaveCount(0);
    await expect(page.locator('[data-student-record-card]:visible').first()).toContainText("Aarav retained review draft");
});
