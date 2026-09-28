import fs from "node:fs";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const evidence = "docs/redesign/application-rollout-evidence/work-queues";
const followUp = { id: "followup-local-1", studentId: "student-aarav", studentName: "Aarav Mehta", phone: "+919876543210", type: "MONTHLY", periodStart: "2026-09-01T00:00:00.000Z", note: "Agreed to call again", outcome: "PROMISED_PAYMENT", nextFollowUpAt: "2026-09-29T00:00:00.000Z", completedAt: null, updatedAt: "2026-09-23T09:00:00.000Z" };

test("real work-queue routes retain records, commands, and compact layouts", async ({ page }, info) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    const commands: unknown[] = [];
    await page.route(/\/api\/branches\/pilot\/dashboard\/follow-ups(?:\/[^?]+)?(?:\?.*)?$/, async route => {
        if (route.request().method() === "PATCH") {
            commands.push(route.request().postDataJSON());
            await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ...followUp, note: "Called back" }) });
            return;
        }
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [followUp], counts: { pending: 1, dueToday: 1, completed: 0 }, nextCursor: null }) });
    });
    const routes = ["follow-ups", "renewals", "overdue"] as const;
    for (const route of routes) {
        await page.goto(`/branch/pilot/${route}?mode=after&lang=en`);
        await expect(page.locator(".ui-record-header")).toBeVisible();
        await expect(page.locator(".ui-record-surface")).toBeVisible();
        await expect(page.locator('.ui-record-results :text("Aarav Mehta"):visible').first()).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
        if (info.project.name === "mobile-390") {
            fs.mkdirSync(evidence, { recursive: true });
            await page.evaluate(() => document.fonts.ready);
            await page.screenshot({ path: `${evidence}/${route}-mobile-390.png`, animations: "disabled" });
            await (route === "renewals" ? page.locator(".ui-record-results .ui-panel--compact").first() : page.locator(".ui-record-results"))
                .screenshot({ path: `${evidence}/${route}-mobile-results-390.png`, animations: "disabled" });
        } else if (route !== "renewals") {
            fs.mkdirSync(evidence, { recursive: true });
            await page.locator(".ui-record-results").screenshot({ path: `${evidence}/${route}-desktop-results-1440.png`, animations: "disabled" });
        }
    }
    await page.goto("/branch/pilot/follow-ups?mode=after&lang=en");
    await page.locator("button:visible").filter({ hasText: "Update follow-up" }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("textbox", { name: "Follow-up note" }).fill("Called back");
    await page.getByRole("button", { name: "Save follow-up" }).click();
    await expect.poll(() => commands.length).toBe(1);
    expect(commands).toEqual([{ note: "Called back", outcome: "PROMISED_PAYMENT", nextFollowUpAt: "2026-09-29", completed: false }]);
    const { violations } = await new AxeBuilder({ page }).analyze();
    expect(violations.filter(item => ["serious", "critical"].includes(item.impact!))).toEqual([]);
    expect(errors).toEqual([]);
});
