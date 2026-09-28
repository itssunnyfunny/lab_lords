import fs from "node:fs";
import { test, expect, type Page, type TestInfo } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { installTasksFixture } from "./tasks-family-fixture";

const output = "docs/redesign/batch-two-evidence/tasks";
async function open(page: Page, query: Record<string, string> = {}) {
    await page.goto(`/branch/pilot/tasks?${new URLSearchParams({ mode: "after", lang: "en", ...query })}`);
    await expect(page.getByRole("heading", { name: /Tasks|काम/ }).first()).toBeVisible();
    await expect(page.locator('[data-record-list] [aria-busy="true"]')).toHaveCount(0);
    await page.evaluate(() => document.fonts.ready);
}
async function shot(page: Page, info: TestInfo, name: string) {
    fs.mkdirSync(output, { recursive: true });
    await page.screenshot({ path: `${output}/${name}-${info.project.name}.png`, animations: "disabled" });
    if ((name === "en" || name === "hi") && !info.project.name.startsWith("desktop")) {
        await page.locator('[data-task-record-card]:visible').first().scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${output}/${name}-records-${info.project.name}.png`, animations: "disabled" });
    }
}

test("Tasks uses the approved card hierarchy, compact table and three languages", async ({ page }, info) => {
    await installTasksFixture(page); const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    for (const [lang, htmlLang] of [["en", "en-IN"], ["hi", "hi-IN"], ["hinglish", "hi-Latn-IN"]]) {
        await open(page, { lang }); await expect(page.locator("html")).toHaveAttribute("lang", htmlLang);
        await expect(page.locator('[data-record-list]')).toContainText("Review evening shift roster");
        expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
        if (info.project.name.startsWith("desktop")) await expect(page.locator(".ui-table--compact")).toBeVisible();
        else {
            const cards = page.locator('[data-task-record-card]:visible'); await expect(cards).toHaveCount(2);
            await expect(cards.first()).toContainText("Aditi Sharma"); await expect(cards.first()).toContainText("Review evening shift roster");
            if (lang === "en") await expect(cards.nth(1)).toContainText("Unassigned");
            expect(await cards.evaluateAll(nodes => nodes.every(node => node.scrollWidth <= node.clientWidth))).toBe(true);
            expect(await cards.first().locator(".ui-record-card-details").evaluate(node => node.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
            expect(await cards.first().getByRole("button", { name: /Actions|कार्रवाई|Action/ }).evaluate(node => node.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
        }
        if (lang === "en" && info.project.name !== "mobile-320" || lang === "hi" && info.project.name === "mobile-320") await shot(page, info, lang);
    }
    const { violations } = await new AxeBuilder({ page }).analyze(); expect(violations.filter(item => ["serious", "critical"].includes(item.impact!))).toEqual([]); expect(errors).toEqual([]);
});

test("Tasks retain canonical create/edit commands, validation, failed drafts and language", async ({ page }, info) => {
    const fixture = await installTasksFixture(page); await open(page);
    await page.getByRole("button", { name: "Add task", exact: true }).click();
    const dialog = page.getByRole("dialog"); await expect(dialog).toHaveAccessibleName("Add task");
    await expect(dialog.getByRole("button", { name: "Save task", exact: true })).toBeDisabled();
    await dialog.getByLabel("Task", { exact: true }).fill("Verify evening checklist");
    await dialog.getByLabel("Due date and time (device timezone)").fill("2026-09-26T12:00");
    await dialog.getByRole("combobox", { name: "Owner" }).click(); await page.getByRole("option", { name: "Aditi Sharma" }).click();
    fixture.setFailSave(true); await dialog.getByRole("button", { name: "Save task", exact: true }).click(); await expect(dialog.getByRole("alert")).toBeVisible();
    await dialog.locator("select").selectOption("hi");
    await expect(dialog.getByLabel("काम", { exact: true })).toHaveValue("Verify evening checklist");
    if (info.project.name === "mobile-390") await shot(page, info, "editor-hi");
    fixture.setFailSave(false); await dialog.getByRole("button", { name: "काम सेव करें", exact: true }).click(); await expect(dialog).toHaveCount(0);
    expect(fixture.commands.at(-1)).toMatchObject({ method: "POST", path: "/api/branches/pilot/dashboard/tasks", body: { title: "Verify evening checklist", dueAt: "2026-09-26T06:30:00.000Z", assigneeId: "synthetic-owner" } });
    await page.locator('select[id$="interfaceLanguage"]').first().selectOption("en");
    await expect(page.locator('[data-record-list]')).toContainText("Verify evening checklist");
    const edit = info.project.name.startsWith("desktop") ? page.locator('#task-table-synthetic-open-1').getByRole("button", { name: /Edit task/ }) : page.locator('#task-grid-synthetic-open-1').locator(".ui-record-card-details");
    await edit.click(); await expect(dialog).toHaveAccessibleName("Edit task");
    await dialog.getByRole("combobox", { name: "Status" }).click(); await page.getByRole("option", { name: "Completed" }).click();
    await dialog.getByRole("button", { name: "Save task", exact: true }).click(); await expect(dialog).toHaveCount(0);
    await expect(page.locator("#task-search")).toBeFocused();
    expect(fixture.commands.at(-1)).toMatchObject({ method: "PATCH", path: "/api/branches/pilot/dashboard/tasks/synthetic-open-1", body: { title: "Review evening shift roster", status: "DONE", assigneeId: "synthetic-owner" } });
    await expect(page.locator('[data-record-list]')).not.toContainText("Review evening shift roster");
});

test("Tasks filters, pagination, source links and recorded activity retain their routes", async ({ page }, info) => {
    await installTasksFixture(page); await open(page, { scenario: "pagination" });
    await expect(page.locator('[data-record-list]')).not.toContainText("Follow up on a very long accessibility");
    await page.getByRole("button", { name: "Next page", exact: true }).click(); await expect(page.locator('[data-record-list]')).toContainText("Follow up on a very long accessibility");
    await page.getByRole("button", { name: "First page", exact: true }).click(); await expect(page.locator('[data-record-list]')).toContainText("Review evening shift roster");
    await page.getByLabel("Search tasks").fill("none matches"); await expect(page.getByRole("heading", { name: "No tasks in this view." })).toBeVisible();
    await page.getByLabel("Search tasks").fill(""); await page.getByRole("combobox", { name: "Status" }).click(); await page.getByRole("option", { name: "Completed" }).click();
    await expect(page.locator('[data-record-list]')).toContainText("Check entry desk supplies");
    await expect(page.locator('[data-record-list]')).not.toContainText("Review evening shift roster");
    await expect(page.locator('[data-record-list] a[href="/branch/pilot/overdue"]')).toBeVisible();
    await page.getByRole("link", { name: "Recent activity" }).click(); await expect(page).toHaveURL(/view=activity/);
    await expect(page.getByRole("heading", { name: "Recent activity" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Task updated" })).toHaveAttribute("href", "/branch/pilot/tasks");
    await expect(page.locator('[data-record-list]')).toContainText("₹500");
    if (info.project.name.startsWith("desktop")) await shot(page, info, "activity-en");
});

test("Tasks loading failures, readonly, source-only and denied states remain distinct", async ({ page }, info) => {
    const fixture = await installTasksFixture(page); fixture.setFailRead(true); await open(page);
    await expect(page.getByRole("alert")).toBeVisible(); await expect(page.locator('[data-record-list]')).not.toContainText("No tasks in this view.");
    fixture.setFailRead(false); await page.getByRole("button", { name: "Try again" }).click(); await expect(page.locator('[data-record-list]')).toContainText("Review evening shift roster");
    fixture.setFailSource(true); await open(page); await expect(page.getByRole("alert")).toBeVisible(); fixture.setFailSource(false);
    await open(page, { role: "readonly" }); await expect(page.getByRole("button", { name: "Add task", exact: true })).toBeDisabled();
    if (info.project.name.startsWith("desktop")) await expect(page.locator('[data-record-list]').getByRole("button", { name: /Edit task/ }).first()).toBeDisabled();
    else await expect(page.locator('[data-task-record-card]:visible').first().getByRole("button")).toHaveCount(0);
    await open(page, { role: "restricted" }); await expect(page.getByRole("button", { name: "Add task", exact: true })).toHaveCount(0); await expect(page.locator('[data-task-record-card]')).toHaveCount(0);
    await expect(page.locator('[data-record-list] a[href="/branch/pilot/attendance"]')).toBeVisible();
    if (info.project.name === "mobile-390") await shot(page, info, "source-only-en");
    await page.goto("/branch/pilot/tasks?mode=after&lang=en&state=empty"); await expect(page.getByRole("heading", { name: "No tasks in this view." })).toBeVisible();
});

test("Task edit cancels with keyboard focus restored and keeps the same record", async ({ page }, info) => {
    await installTasksFixture(page); await open(page);
    const trigger = info.project.name.startsWith("desktop") ? page.locator('#task-table-synthetic-open-1').getByRole("button", { name: /Edit task/ }) : page.locator('#task-grid-synthetic-open-1').getByRole("button", { name: "Actions" });
    await trigger.focus(); await page.keyboard.press("Enter");
    if (!info.project.name.startsWith("desktop")) { await expect(page.getByRole("menuitem", { name: "Edit task" })).toBeFocused(); await page.keyboard.press("Enter"); }
    const dialog = page.getByRole("dialog"); await expect(dialog).toBeVisible();
    await dialog.getByLabel("Task", { exact: true }).fill("Discarded local draft"); await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0); await expect(trigger).toBeFocused(); await expect(page.locator('[data-record-list]')).not.toContainText("Discarded local draft");
});
