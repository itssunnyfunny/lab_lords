import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { Client } from "pg";
import { assertDisposableTestDatabaseTarget } from "../setup/testDatabaseSafety";
import { refreshDevelopmentSession } from "../browser/helpers/development-session";
import type { StaffWithUser } from "../../lib/api/staff";

const fixture = JSON.parse(readFileSync(".clerk/dashboard-fixture.json", "utf8"));
const target = assertDisposableTestDatabaseTarget(process.env.TEST_DATABASE_URL, process.env);
if (target.databaseName !== fixture.databaseName || !target.databaseName.includes("browser_test")) throw new Error("Connected Batch 2 fixture identity mismatch");
const output = "docs/redesign/batch-two-evidence/connected";
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
async function database() {
    const db = new Client({ connectionString: process.env.TEST_DATABASE_URL }); await db.connect();
    if ((await db.query("SELECT current_database() AS name")).rows[0].name !== target.databaseName) throw new Error("Connected database identity changed");
    return db;
}
async function finances(db: Client) {
    return (await db.query('SELECT COUNT(*)::int AS count, SUM(amount)::int AS billed, SUM("collectedAmount")::int AS collected, SUM("waivedAmount")::int AS waived FROM "Payment" WHERE "branchId" = $1', [fixture.branchId])).rows[0];
}
test.beforeEach(async ({ page }) => {
    await page.route(/(?:api\.razorpay\.com|checkout\.razorpay\.com|graph\.facebook\.com|generativelanguage\.googleapis\.com)/, route => route.abort("blockedbyclient"));
    await refreshDevelopmentSession(page);
});

test("Staff actual route persists access commands, restores fixture access and renders three languages", async ({ page }) => {
    const db = await database(); const before = await finances(db);
    const profileResponse = await request(page, "/api/users/me"); expect(profileResponse.ok()).toBe(true); const profile = await profileResponse.json();
    const rosterResponse = await request(page, `/api/branches/${fixture.branchId}/staff?limit=50`); expect(rosterResponse.ok()).toBe(true);
    const roster = await rosterResponse.json(); const member: StaffWithUser = roster.items.find((item: StaffWithUser) => item.userId === fixture.staffId);
    expect(!!member).toBe(true);
    const memberPath = `/api/branches/${fixture.branchId}/staff/${member.id}`;
    const previousStudents = member.permissionOverrides?.find(item => item.action === "STUDENTS")?.allowed ?? null;
    try {
        expect((await request(page, "/api/users/me", "PATCH", { interfaceLanguage: "en" })).ok()).toBe(true);
        await ready(page, `/branch/${fixture.branchId}/staff?staffId=${member.id}`);
        await expect(page.locator('[data-app-design-pilot="workspace"]')).toBeVisible();
        const row = page.locator(`#staff-row-${member.id}`); await expect(row).toBeVisible();
        await row.getByRole("button", { name: "Actions", exact: true }).click();
        await page.getByRole("menuitem", { name: /^(Set|Edit) Access$/ }).click();
        const dialog = page.getByRole("dialog", { name: "Staff Access" });
        await dialog.getByRole("group", { name: "Staff role", exact: true }).getByRole("button", { name: /^Manager/ }).click();
        await dialog.getByRole("group", { name: "Students", exact: true }).getByRole("button", { name: "Block", exact: true }).click();
        await dialog.getByRole("button", { name: "Save Access", exact: true }).click(); await expect(dialog).toHaveCount(0);
        const persisted = (await db.query('SELECT role FROM "Staff" WHERE id=$1 AND "branchId"=$2', [member.id, fixture.branchId])).rows[0]; expect(persisted.role).toBe("MANAGER");
        const blocked = await db.query('SELECT allowed FROM "StaffPermissionOverride" WHERE "staffId"=$1 AND action=\'STUDENTS\'', [member.id]); expect(blocked.rows[0]?.allowed).toBe(false);
        const restore = await request(page, memberPath, "PATCH", { role: member.role, permissions: { students: previousStudents } }); expect(restore.ok()).toBe(true);
        for (const language of ["en", "hi", "hinglish"]) {
            expect((await request(page, "/api/users/me", "PATCH", { interfaceLanguage: language })).ok()).toBe(true);
            for (const width of [1491, 390]) {
                await page.setViewportSize({ width, height: width === 1491 ? 1055 : 844 });
                await ready(page, `/branch/${fixture.branchId}/staff?staffId=${member.id}`);
                const record = page.locator(width === 1491 ? `#staff-row-${member.id}` : `#staff-card-${member.id}`); await expect(record).toBeVisible();
                await expect(page.locator('html')).toHaveAttribute('lang', language === 'en' ? 'en-IN' : language === 'hi' ? 'hi-IN' : 'hi-Latn-IN');
                expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
                if (language === "en" && width === 1491 || language === "hi" && width === 390) {
                    await record.scrollIntoViewIfNeeded(); await page.screenshot({ path: `${output}/staff-${language}-${width}.png` });
                }
            }
        }
        expect(await finances(db)).toEqual(before);
        writeFileSync(`${output}/staff-verification.json`, JSON.stringify({ scope: "actual Next Staff route and APIs; verified disposable database; development authentication; providers held", roleAndPermissionPersisted: true, priorAccessRestored: true, financialAggregateUnchanged: true, languages: ["en", "hi", "hinglish"], widths: [1491, 390] }, null, 2));
    } finally {
        try {
            expect((await request(page, memberPath, "PATCH", { role: member.role, permissions: { students: previousStudents } })).ok()).toBe(true);
            expect((await request(page, "/api/users/me", "PATCH", { interfaceLanguage: profile.interfaceLanguage })).ok()).toBe(true);
        } finally { await db.end(); }
    }
});

test("Staff actual readonly and restricted routes preserve owner-only management and branch scope", async ({ page, browser }) => {
    await ready(page, `/branch/${fixture.readonlyBranchId}/staff`);
    await expect(page.getByRole("button", { name: "Add Staff", exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Create invite", exact: true })).toBeDisabled();
    // Legacy Staff GET maps scope denial to 500. Record that discrepancy rather
    // than changing the backend in a presentation-only migration. Both denials
    // must remain indistinguishable and must return no roster data.
    const foreign = await request(page, `/api/branches/${fixture.foreignBranchId}/staff?limit=10`);
    const missing = await request(page, "/api/branches/missing-batch-two-branch/staff?limit=10");
    expect(foreign.status()).toBe(missing.status());
    expect([403, 404, 500]).toContain(foreign.status());
    expect(await foreign.json()).toEqual(await missing.json());
    const context = await browser.newContext({ baseURL: "http://localhost:3117", storageState: ".clerk/dashboard-staff-auth.json" });
    try {
        const staff = await context.newPage(); await refreshDevelopmentSession(staff);
        await ready(staff, `/branch/${fixture.branchId}/staff`);
        await expect(staff.getByRole("heading", { name: "No access", exact: true })).toBeVisible();
        await expect(staff.getByRole("button", { name: "Add Staff", exact: true })).toHaveCount(0);
        expect((await request(staff, `/api/branches/${fixture.branchId}/staff?limit=10`)).status()).toBe(403);
    } finally { await context.close(); }
});
