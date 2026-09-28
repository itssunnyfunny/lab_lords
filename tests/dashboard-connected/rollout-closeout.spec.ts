import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { Client } from "pg";
import { assertDisposableTestDatabaseTarget } from "../setup/testDatabaseSafety";
import { refreshDevelopmentSession } from "../browser/helpers/development-session";

type Fixture = {
    databaseName: string;
    branchId: string;
    orgId: string;
    ownerId: string;
    staffId: string;
    foreignBranchId: string;
    readonlyBranchId: string;
    today: string;
    month: string;
};
type Profile = { id: string; interfaceLanguage: string; documentLanguage: string; defaultLandingPage: string };
type Report = { columns: string[]; rows: (string | number)[][]; count: number };

const fixture = JSON.parse(readFileSync(".clerk/dashboard-fixture.json", "utf8")) as Fixture;
const target = assertDisposableTestDatabaseTarget(process.env.TEST_DATABASE_URL, process.env);
if (target.databaseName !== fixture.databaseName || !target.databaseName.includes("browser_test")) {
    throw new Error("Connected rollout fixture/database mismatch");
}

async function database() {
    const db = new Client({ connectionString: process.env.TEST_DATABASE_URL });
    await db.connect();
    try {
        const identity = await db.query<{ name: string }>("SELECT current_database() AS name");
        if (identity.rows[0]?.name !== target.databaseName) throw new Error("Connected database identity changed");
        const marker = await db.query<{ count: number }>(
            "SELECT COUNT(*)::int AS count FROM \"DashboardEvent\" WHERE \"branchId\"=$1 AND kind='CONFIGURATION' AND detail='Synthetic expected-attendance schedule configured'",
            [fixture.branchId]
        );
        if (marker.rows[0]?.count !== 1) throw new Error("Synthetic fixture marker is missing or duplicated");
        return db;
    } catch (error) {
        await db.end();
        throw error;
    }
}

async function request(page: Page, path: string, method = "GET", data?: unknown) {
    const token = await page.evaluate(async () => {
        const clerk = (window as unknown as { Clerk: { session: { getToken(options: { skipCache: boolean }): Promise<string | null> } } }).Clerk;
        return clerk.session.getToken({ skipCache: true });
    });
    if (!token) throw new Error("Existing development session is unavailable");
    return page.request.fetch(path, { method, data, headers: { Authorization: `Bearer ${token}` }, timeout: 120_000 });
}

async function open(page: Page, path: string) {
    const response = await page.goto(path, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => {
        const clerk = (window as unknown as { Clerk?: { loaded?: boolean; user?: unknown; session?: unknown } }).Clerk;
        return Boolean(clerk?.loaded && clerk.user && clerk.session);
    });
    await page.evaluate(() => document.fonts.ready);
    const trial = page.getByRole("button", { name: "Dismiss trial reminder for this session", exact: true });
    if (await trial.isVisible()) await trial.click();
    return response;
}

test.beforeEach(async ({ page }) => {
    // Abort external business providers, never the application's APIs or Clerk authentication.
    await page.route(/(?:api\.razorpay\.com|checkout\.razorpay\.com|graph\.facebook\.com|generativelanguage\.googleapis\.com)/,
        route => route.abort("blockedbyclient"));
    await refreshDevelopmentSession(page);
    const profile = await request(page, "/api/users/me");
    expect(profile.status()).toBe(200);
    expect((await profile.json() as Profile).id).toBe(fixture.ownerId);
});

test("actual account languages, workspace navigation and settings access use the isolated owner record", async ({ page }) => {
    const db = await database();
    let original: Profile | null = null;
    try {
        const originalResponse = await request(page, "/api/users/me");
        original = await originalResponse.json() as Profile;
        expect((await request(page, "/api/users/me", "PATCH", { interfaceLanguage: "en" })).status()).toBe(200);
        expect((await open(page, "/account"))?.status()).toBe(200);
        await expect(page.getByRole("heading", { name: "Account Settings", exact: true })).toBeVisible();
        const interfaceControl = page.locator("#preferences select").first();
        await expect(interfaceControl).toHaveValue("en");
        await interfaceControl.selectOption("hi");
        await expect(page.locator("html")).toHaveAttribute("lang", "hi-IN");
        await expect.poll(async () => (await db.query<{ interfaceLanguage: string }>(
            'SELECT "interfaceLanguage" FROM "User" WHERE id=$1', [fixture.ownerId])).rows[0]?.interfaceLanguage).toBe("hi");
        await interfaceControl.selectOption("hinglish");
        await expect(page.locator("html")).toHaveAttribute("lang", "hi-Latn-IN");
        await expect.poll(async () => (await db.query<{ interfaceLanguage: string }>(
            'SELECT "interfaceLanguage" FROM "User" WHERE id=$1', [fixture.ownerId])).rows[0]?.interfaceLanguage).toBe("hinglish");

        const directoryResponse = await request(page, "/api/workspaces");
        expect(directoryResponse.status()).toBe(200);
        const directory = await directoryResponse.json() as {
            defaultHref: string;
            organizations: { id: string; branches: { id: string }[] }[];
        };
        expect(directory.organizations.some(org => org.id === fixture.orgId && org.branches.some(branch => branch.id === fixture.branchId))).toBe(true);
        expect(directory.organizations.some(org => org.branches.some(branch => branch.id === fixture.foreignBranchId))).toBe(false);
        expect(directory.defaultHref).toBe(original.defaultLandingPage === "account" ? "/account" : "/org");
        await open(page, "/app");
        await expect(page).toHaveURL(new RegExp(`${directory.defaultHref}$`));

        await open(page, "/org");
        await expect(page.locator('[data-app-design-pilot="workspace"]')).toBeVisible();
        await page.getByRole("button").filter({ hasText: fixture.orgId }).click();
        await expect(page).toHaveURL(new RegExp(`/org/${fixture.orgId}$`));
        await page.locator(`a[href="/branch/${fixture.branchId}"]`).first().click();
        await expect(page).toHaveURL(new RegExp(`/branch/${fixture.branchId}$`));

        const foreignOrg = await db.query<{ organizationId: string }>(
            'SELECT "organizationId" FROM "Branch" WHERE id=$1', [fixture.foreignBranchId]);
        const foreign = await request(page, `/api/organizations/${foreignOrg.rows[0].organizationId}`);
        const missing = await request(page, "/api/organizations/not-a-workspace");
        expect(foreign.status()).toBe(404);
        expect(foreign.status()).toBe(missing.status());
        expect(await foreign.json()).toEqual(await missing.json());

        expect((await request(page, "/api/users/me", "PATCH", { interfaceLanguage: "en" })).status()).toBe(200);
        expect((await open(page, `/org/${fixture.orgId}/settings`))?.status()).toBe(200);
        await expect(page.getByRole("heading", { name: "Organization Settings", exact: true })).toBeVisible();
        await expect(page.getByRole("button", { name: "Edit settings", exact: true })).toBeDisabled();
        await expect(page.getByRole("button", { name: "Edit settings", exact: true }))
            .toHaveAttribute("title", /billing access is restored/);
        await expect(page.locator('[data-app-design-pilot="workspace"]')).toBeVisible();
        expect((await open(page, `/branch/${fixture.branchId}/settings`))?.status()).toBe(200);
        await expect(page.getByRole("heading", { name: "Branch Settings", exact: true })).toBeVisible();
        await expect(page.getByRole("button", { name: "Edit settings", exact: true })).toBeEnabled();
        await expect(page.locator('[data-app-design-pilot="workspace"]')).toBeVisible();
        expect((await open(page, `/branch/${fixture.readonlyBranchId}/settings`))?.status()).toBe(200);
        await expect(page.getByRole("heading", { name: "Branch Settings", exact: true })).toBeVisible();
        await expect(page.getByRole("button", { name: "Edit settings", exact: true })).toBeDisabled();
    } finally {
        try {
            if (original) {
                const restored = await request(page, "/api/users/me", "PATCH", { interfaceLanguage: original.interfaceLanguage });
                expect(restored.status()).toBe(200);
            }
        } finally {
            await db.end();
        }
    }
});

test("actual authorized reports and CSV use persisted fees and document language; staff fees stay denied", async ({ page, browser }) => {
    const db = await database();
    let original: Profile | null = null;
    try {
        original = await (await request(page, "/api/users/me")).json() as Profile;
        expect((await request(page, "/api/users/me", "PATCH", { interfaceLanguage: "en" })).status()).toBe(200);
        await open(page, "/account");
        const documentControl = page.locator("#preferences select").nth(1);
        await documentControl.selectOption("hi");
        await expect.poll(async () => (await db.query<{ documentLanguage: string }>(
            'SELECT "documentLanguage" FROM "User" WHERE id=$1', [fixture.ownerId])).rows[0]?.documentLanguage).toBe("hi");
        await expect(page.locator("html")).toHaveAttribute("lang", "en-IN");

        const reportParams = new URLSearchParams({ kind: "fees", from: `${fixture.month}-01`, through: fixture.today,
            status: "ALL", search: "", format: "json" });
        const reportResponse = await request(page, `/api/branches/${fixture.branchId}/reports?${reportParams}`);
        expect(reportResponse.status()).toBe(200);
        const report = await reportResponse.json() as Report;
        expect(report.columns).toContain("मूल फीस");
        const money = await db.query<{ fees: number; billed: number; collected: number; pending: number }>(
            'SELECT COUNT(*)::int AS fees, SUM(amount)::int AS billed, SUM("collectedAmount")::int AS collected, SUM(amount-"collectedAmount"-"waivedAmount")::int AS pending FROM "Payment" WHERE "branchId"=$1',
            [fixture.branchId]);
        expect(money.rows[0]).toMatchObject({ fees: 5, billed: 4300, collected: 1900, pending: 2400 });
        expect(report.count).toBe(money.rows[0].fees);
        expect(report.rows.reduce((sum, row) => sum + Number(row[5]), 0)).toBe(money.rows[0].billed);
        expect(report.rows.reduce((sum, row) => sum + Number(row[6]), 0)).toBe(money.rows[0].collected);
        expect(report.rows.reduce((sum, row) => sum + Number(row[8]), 0)).toBe(money.rows[0].pending);

        expect((await open(page, `/branch/${fixture.branchId}/reports`))?.status()).toBe(200);
        await expect(page.getByRole("heading", { name: "Exports & Reports", exact: true })).toBeVisible();
        await page.getByLabel("From date", { exact: true }).fill(`${fixture.month}-01`);
        await page.getByLabel("Through date", { exact: true }).fill(fixture.today);
        await expect(page.getByRole("columnheader", { name: "मूल फीस", exact: true })).toBeVisible();
        await expect(page.getByRole("button", { name: "Download CSV", exact: true })).toBeEnabled();
        const [download] = await Promise.all([
            page.waitForEvent("download"), page.getByRole("button", { name: "Download CSV", exact: true }).click(),
        ]);
        expect(download.suggestedFilename()).toMatch(/^lab-lords-fees-/);
        const path = await download.path();
        if (!path) throw new Error("Authorized report did not produce a local download");
        const csv = readFileSync(path, "utf8");
        expect(csv).toContain("मूल फीस");
        expect(csv).toContain("Rahul Verma");

        const branchAnalytics = await request(page, `/api/analytics/branch/${fixture.branchId}/snapshot?period=month`);
        expect(branchAnalytics.status()).toBe(200);
        expect((await branchAnalytics.json() as { activeStudents: number }).activeStudents).toBe(8);
        const orgAnalytics = await request(page, `/api/analytics/org/${fixture.orgId}/snapshot`);
        expect(orgAnalytics.status()).toBe(200);
        expect((await orgAnalytics.json() as { organization: { totalBranches: number } }).organization.totalBranches).toBe(2);

        const staffContext = await browser.newContext({ baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3117",
            storageState: ".clerk/dashboard-staff-auth.json" });
        try {
            const staff = await staffContext.newPage();
            await refreshDevelopmentSession(staff);
            const staffProfile = await request(staff, "/api/users/me");
            expect(staffProfile.status()).toBe(200);
            expect((await staffProfile.json() as Profile).id).toBe(fixture.staffId);
            const deniedFees = await request(staff, `/api/branches/${fixture.branchId}/reports?${new URLSearchParams({
                kind: "fees", from: `${fixture.month}-01`, through: fixture.today, format: "csv",
            })}`);
            expect(deniedFees.status()).toBe(403);
            expect(deniedFees.headers()["content-type"]).toContain("application/json");
            const from = new Date(`${fixture.today}T00:00:00.000Z`);
            from.setUTCDate(from.getUTCDate() - 92);
            const allowedStudents = await request(staff, `/api/branches/${fixture.branchId}/reports?${new URLSearchParams({
                kind: "students", from: from.toISOString().slice(0, 10), through: fixture.today, format: "json",
            })}`);
            expect(allowedStudents.status()).toBe(200);
            expect((await allowedStudents.json() as Report).count).toBe(8);
            const staffWorkspace = await request(staff, "/api/workspaces");
            expect(staffWorkspace.status()).toBe(200);
            const staffDirectory = await staffWorkspace.json() as { organizations: { id: string }[]; staffBranches: { id: string }[] };
            expect(staffDirectory.organizations.some(org => org.id === fixture.orgId)).toBe(false);
            expect(staffDirectory.staffBranches.some(branch => branch.id === fixture.branchId)).toBe(true);
        } finally {
            await staffContext.close();
        }
    } finally {
        try {
            if (original) {
                const restored = await request(page, "/api/users/me", "PATCH", {
                    interfaceLanguage: original.interfaceLanguage, documentLanguage: original.documentLanguage,
                });
                expect(restored.status()).toBe(200);
            }
        } finally {
            await db.end();
        }
    }
});

test("actual onboarding validates its first step without creating a workspace or import", async ({ page }) => {
    const db = await database();
    try {
        const counts = () => db.query<{ organizations: number; branches: number; imports: number; grants: number }>(
            'SELECT (SELECT COUNT(*)::int FROM "Organization") AS organizations, (SELECT COUNT(*)::int FROM "Branch") AS branches, (SELECT COUNT(*)::int FROM "ImportSession") AS imports, (SELECT COUNT(*)::int FROM "OwnerTrialGrant") AS grants');
        const before = (await counts()).rows[0];
        let onboardingPosts = 0;
        page.on("request", request => {
            if (request.method() === "POST" && new URL(request.url()).pathname === "/api/onboarding") onboardingPosts++;
        });
        expect((await open(page, "/onboarding"))?.status()).toBe(200);
        await expect(page.locator('[data-app-design-pilot="workspace"]')).toBeVisible();
        await expect(page.locator('input[name="orgName"]')).toBeVisible();
        // The first pointer click can be consumed by the auto-focused field's
        // blur render; finish that focus transition before testing Continue.
        await page.locator('input[name="orgName"]').evaluate(input => input.blur());
        await page.getByRole("button", { name: "Continue", exact: true }).click();
        await expect(page.locator('input[name="orgName"]')).toHaveAttribute("aria-invalid", "true");
        await expect(page.locator('input[name="ownerPhone"]')).toHaveAttribute("aria-invalid", "true");
        await expect(page.locator('input[name="orgName"]')).toBeVisible();
        expect(onboardingPosts).toBe(0);
        expect((await counts()).rows[0]).toEqual(before);
    } finally {
        await db.end();
    }
});
