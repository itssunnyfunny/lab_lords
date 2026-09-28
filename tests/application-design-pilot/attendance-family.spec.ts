import fs from "node:fs";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const evidence = "docs/redesign/application-rollout-evidence/attendance";
const day = "2026-09-28";
const rows = [
    { id: "student-aarav", name: "Aarav Mehta", phone: "+919876543210", status: "ACTIVE", attendance: "NOT_MARKED", mark: null, visits: [], openVisit: null, currentAllocations: [{ seat: "A3", shift: "Morning" }] },
    { id: "student-nisha", name: "Nisha Verma", phone: "+919876543211", status: "ACTIVE", attendance: "PRESENT", mark: { date: day, status: "PRESENT", version: 1, note: null, correctedAt: null, updatedAt: `${day}T04:00:00.000Z`, source: "MANUAL", actor: { name: "Ananya Sharma" } }, visits: [], openVisit: { id: "visit-nisha", date: day, timezone: "Asia/Kolkata", checkIn: `${day}T04:00:00.000Z`, checkOut: null, version: 1, source: "MANUAL", note: null, correctedAt: null, voidedAt: null, actor: { name: "Ananya Sharma" } }, currentAllocations: [{ seat: "B1", shift: "Morning" }] },
];

test("real attendance route retains roster, confirmation, and compact history", async ({ page }, info) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    const commands: Record<string, unknown>[] = [];
    await page.route(/\/api\/branches\/pilot\/attendance(?:\?.*)?$/, async route => {
        const request = route.request();
        if (request.method() === "POST") {
            commands.push(request.postDataJSON() as Record<string, unknown>);
            await route.fulfill({ json: { message: "Attendance recorded." } });
            return;
        }
        const url = new URL(request.url());
        if (url.searchParams.has("studentId")) {
            await route.fulfill({ json: { student: { id: "student-aarav", name: "Aarav Mehta", status: "ACTIVE" }, today: day, from: day, to: day, timezone: "Asia/Kolkata", marks: [], visits: [], audits: [], nextCursor: null, auditNextCursor: null, qr: null } });
            return;
        }
        await route.fulfill({ json: { items: rows, total: 2, nextCursor: null, date: day, today: day, timezone: "Asia/Kolkata", shifts: [{ id: "shift-morning", name: "Morning" }], counts: { attended: 1, absent: 0, notMarked: 1, open: 1 } } });
    });
    await page.goto("/branch/pilot/attendance?mode=after&lang=en");
    await expect(page.getByRole("heading", { name: "Attendance", level: 1 })).toBeVisible();
    await expect(page.locator(".ui-record-card:visible")).toHaveCount(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    fs.mkdirSync(evidence, { recursive: true });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `${evidence}/attendance-${info.project.name}.png`, animations: "disabled" });
    await page.locator(".ui-record-card:visible").first().screenshot({ path: `${evidence}/attendance-card-${info.project.name}.png`, animations: "disabled" });
    await page.locator('.ui-record-card:visible').first().getByRole("button", { name: "Mark Present" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
    await dialog.getByRole("button", { name: "Confirm" }).click();
    await expect.poll(() => commands.length).toBe(1);
    expect(commands[0]).toMatchObject({ kind: "MARK", status: "PRESENT" });
    await page.locator('.ui-record-card:visible').first().getByRole("button", { name: "History & QR" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    for (const [lang, htmlLang] of [["hi", "hi-IN"], ["hinglish", "hi-Latn-IN"]] as const) {
        await page.goto(`/branch/pilot/attendance?mode=after&lang=${lang}`);
        await expect(page.locator("html")).toHaveAttribute("lang", htmlLang);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    }
    if (info.project.name === "mobile-390") {
        await page.setViewportSize({ width: 320, height: 800 });
        await page.goto("/branch/pilot/attendance?mode=after&lang=en");
        await expect(page.locator(".ui-record-card:visible")).toHaveCount(2);
        expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    }
    const { violations } = await new AxeBuilder({ page }).analyze();
    expect(violations.filter(item => ["serious", "critical"].includes(item.impact!))).toEqual([]);
    expect(errors).toEqual([]);
});
