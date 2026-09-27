import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { Client } from "pg";
import { assertDisposableTestDatabaseTarget } from "../setup/testDatabaseSafety";
import { refreshDevelopmentSession } from "../browser/helpers/development-session";

const fixture = JSON.parse(readFileSync(".clerk/dashboard-fixture.json", "utf8"));
const target = assertDisposableTestDatabaseTarget(process.env.TEST_DATABASE_URL, process.env);
if (target.databaseName !== fixture.databaseName || !target.databaseName.includes("browser_test")) throw new Error("Connected fixture identity mismatch");
const output = "docs/redesign/shared-system-evidence/connected";
mkdirSync(output, { recursive: true });
async function request(page: Page, path: string, method = "GET", data?: unknown) {
    const token = await page.evaluate(async () => (window as unknown as { Clerk: { session: { getToken(options: { skipCache: boolean }): Promise<string> } } }).Clerk.session.getToken({ skipCache: true }));
    if (!token) throw new Error("Existing development session unavailable");
    return page.request.fetch(path, { method, data, headers: { Authorization: `Bearer ${token}` } });
}
async function ready(page: Page, route: string) {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => { const clerk = (window as unknown as { Clerk?: { loaded?: boolean; user?: unknown; session?: unknown } }).Clerk; return !!(clerk?.loaded && clerk.user && clerk.session); });
    await page.evaluate(() => document.fonts.ready);
    const trial = page.getByRole("button", { name: "Dismiss trial reminder for this session", exact: true });
    if (await trial.isVisible()) await trial.click();
}
test.beforeEach(async ({ page }) => {
    await page.route(/(?:api\.razorpay\.com|checkout\.razorpay\.com|graph\.facebook\.com|generativelanguage\.googleapis\.com)/, route => route.abort("blockedbyclient"));
    await refreshDevelopmentSession(page);
});

test("authenticated Students edits persist, keep allocations and expose the canonical nested fee dialog in three languages", async ({ page }) => {
    const db = new Client({ connectionString: process.env.TEST_DATABASE_URL }); await db.connect();
    const identity = await db.query("SELECT current_database() AS name"); expect(identity.rows[0].name).toBe(target.databaseName);
    const finances = async () => (await db.query('SELECT COUNT(*)::int AS count, SUM(amount)::int AS billed, SUM("collectedAmount")::int AS collected, SUM("waivedAmount")::int AS waived FROM "Payment" WHERE "branchId" = $1', [fixture.branchId])).rows[0];
    const before = await finances();
    // Recover only this test's interrupted edit from its previous attempt.
    await db.query('UPDATE "Student" SET name = $1, phone = NULL WHERE id = $2 AND "branchId" = $3 AND name = $4 AND phone = ANY($5::text[])', [fixture.students[0].name, fixture.students[0].id, fixture.branchId, "Students Pattern Verification", ["+919000000001", "+91 90000 00001", "9000000001"]]);
    const profileResponse = await request(page, "/api/users/me"); expect(profileResponse.ok()).toBe(true); const profile = await profileResponse.json();
    const rosterResponse = await request(page, `/api/branches/${fixture.branchId}/students?status=ACTIVE&limit=50`); expect(rosterResponse.ok()).toBe(true);
    const roster = await rosterResponse.json(); const student = roster.items.find((row: { id: string }) => row.id === fixture.students[0].id);
    expect(student).toBeTruthy();
    expect(student.name).toBe(fixture.students[0].name);
    try {
        expect((await request(page, "/api/users/me", "PATCH", { interfaceLanguage: "en" })).ok()).toBe(true);
        await ready(page, `/branch/${fixture.branchId}/students?studentId=${student.id}&status=ACTIVE`);
        await expect(page.locator('[data-record-list] [aria-busy="true"]')).toHaveCount(0);
        const row = page.locator(`#student-table-${student.id}`);
        await expect(row).toBeVisible();
        const allocationText = await row.locator("td").nth(1).innerText();
        await row.getByRole("button", { name: "Actions", exact: true }).click();
        await page.getByRole("menuitem", { name: /Edit Details/ }).click();
        const edit = page.getByRole("dialog", { name: "Edit student" });
        await edit.getByLabel("Full Name *").fill("Students Pattern Verification");
        // The earlier dashboard fixture intentionally had no phone numbers.
        // Supply a clearly synthetic valid value to exercise the existing form.
        await edit.getByLabel("Phone Number *").fill("9000000001");
        await page.screenshot({ path: `${output}/students-edit.png` });
        await edit.getByRole("button", { name: "Save Changes" }).click();
        await expect(edit).toHaveCount(0);
        await expect(row).toContainText("Students Pattern Verification");
        await expect(row.locator("td").nth(1)).toHaveText(allocationText, { useInnerText: true });
        const persisted = await db.query('SELECT name FROM "Student" WHERE id = $1 AND "branchId" = $2', [student.id, fixture.branchId]);
        expect(persisted.rows[0].name).toBe("Students Pattern Verification");
        await row.getByRole("button", { name: "Actions", exact: true }).click();
        await page.getByRole("menuitem", { name: /View Fees/ }).click();
        const fees = page.getByRole("dialog", { name: "Students Pattern Verification" });
        await expect(fees.getByText("Payment history", { exact: true })).toBeVisible();
        await page.screenshot({ path: `${output}/students-fees.png` });
        await fees.getByRole("button", { name: "Collect fee", exact: true }).click();
        const collection = page.getByRole("dialog", { name: "Collect fee", exact: true });
        await expect(collection.getByLabel("Amount received (whole ₹)")).toBeVisible();
        expect(await fees.evaluate(element => !!element.closest("[inert]"))).toBe(true);
        await page.screenshot({ path: `${output}/students-nested-fees.png` });
        await page.keyboard.press("Escape"); await expect(collection).toHaveCount(0); await expect(fees.getByRole("button", { name: "Collect fee", exact: true })).toBeFocused();
        await page.keyboard.press("Escape"); await expect(fees).toHaveCount(0);
        await row.getByRole("button", { name: "Actions", exact: true }).click();
        await page.getByRole("menuitem", { name: "Attendance & QR", exact: true }).click();
        const attendance = page.getByRole("dialog", { name: "Students Pattern Verification" });
        await expect(attendance.getByRole("heading", { name: "Attendance history & QR" })).toBeVisible();
        await expect(attendance.getByRole("heading", { name: "Daily manual marks" })).toBeVisible();
        await expect(attendance.getByRole("alert")).toHaveCount(0);
        await page.screenshot({ path: `${output}/students-attendance.png` });
        await page.keyboard.press("Escape"); await expect(attendance).toHaveCount(0);
        const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export", exact: true }).click()]);
        const exportPath = await download.path();
        if (!exportPath) throw new Error("Existing Students export did not produce a local file");
        const csv = readFileSync(exportPath, "utf8");
        expect(csv).toContain("Students Pattern Verification");
        expect(csv).toContain("Total Due");
        expect(await finances()).toEqual(before);
        for (const language of ["en", "hi", "hinglish"]) {
            expect((await request(page, "/api/users/me", "PATCH", { interfaceLanguage: language })).ok()).toBe(true);
            for (const width of [1491, 390]) {
                await page.setViewportSize({ width, height: width === 1491 ? 1055 : 844 });
                await ready(page, `/branch/${fixture.branchId}/students`);
                await expect(page.locator('[data-record-list]')).toBeVisible();
                await expect(page.locator('[data-record-list] [aria-busy="true"]')).toHaveCount(0);
                await expect(page.locator('p:visible').filter({ hasText: /^Students Pattern Verification$/ })).toBeVisible();
                expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
                await page.screenshot({ path: `${output}/students-${language}-${width}.png` });
                if (width < 1491) { await page.locator("#main-content").evaluate(element => element.scrollTop = 700); await page.screenshot({ path: `${output}/students-${language}-${width}-records.png` }); }
            }
        }
        writeFileSync(`${output}/verification.json`, JSON.stringify({ scope: "actual Next route; existing development authentication; reverified loopback disposable database; providers held", scalarEditPersisted: true, allocationContextPreserved: true, financialAggregateUnchanged: true, languages: ["en", "hi", "hinglish"], widths: [1491, 390], nestedFeeFocusRestored: true, attendanceHistoryLoaded: true, existingCsvDownloaded: true }, null, 2));
    } finally {
        try {
            // Existing public editing requires a nonblank phone. Restore the
            // earlier null fixture directly in this independently verified DB.
            const restored = await db.query('UPDATE "Student" SET name = $1, phone = $2 WHERE id = $3 AND "branchId" = $4', [student.name, student.phone, student.id, fixture.branchId]); expect(restored.rowCount).toBe(1);
            const preferences = await request(page, "/api/users/me", "PATCH", { interfaceLanguage: profile.interfaceLanguage }); expect(preferences.ok()).toBe(true);
        } finally { await db.end(); }
    }
});

test("actual read-only, restricted and foreign branch routes retain access boundaries", async ({ page, browser }) => {
    await ready(page, `/branch/${fixture.readonlyBranchId}/students`);
    await expect(page.getByRole("button", { name: "Add student", exact: true })).toBeDisabled();
    await page.screenshot({ path: `${output}/students-readonly.png` });
    const foreign = await request(page, `/api/branches/${fixture.foreignBranchId}/students?limit=10`);
    expect([403, 404]).toContain(foreign.status());
    const context = await browser.newContext({ baseURL: "http://localhost:3117", storageState: ".clerk/dashboard-staff-auth.json", viewport: { width: 1491, height: 1055 } });
    try {
        const staff = await context.newPage(); await refreshDevelopmentSession(staff);
        await ready(staff, `/branch/${fixture.branchId}/students`);
        await expect(staff.getByText(/Fee details are hidden/)).toBeVisible();
        const accessResponse = await request(staff, `/api/branches/${fixture.branchId}/access`); const access = await accessResponse.json();
        if (!access.permissions.seat_allocation) await expect(staff.getByText(/Seat assignment actions are disabled/)).toBeVisible();
        await staff.screenshot({ path: `${output}/students-restricted.png` });
        expect((await request(staff, `/api/branches/${fixture.branchId}/payments?limit=10`)).status()).toBe(403);
    } finally { await context.close(); }
});

test("public content and an unmigrated page remain readable", async ({ page }) => {
    for (const route of ["/", "/hi", "/hinglish", "/features", "/pricing", "/faq"]) {
        const response = await page.goto(route); expect(response?.status()).toBe(200);
        await expect(page.locator('h1').first()).toBeVisible();
        await expect(page.locator('[data-app-design-pilot="workspace"]')).toHaveCount(0);
    }
    await ready(page, "/account");
    await expect(page.locator('h1').first()).toBeVisible();
    await expect(page.locator('[data-app-design-pilot="workspace"]')).toHaveCount(0);
});
