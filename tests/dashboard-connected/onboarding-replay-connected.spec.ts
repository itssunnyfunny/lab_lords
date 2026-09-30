import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { Client } from "pg";
import { assertDisposableTestDatabaseTarget } from "../setup/testDatabaseSafety";
import { refreshDevelopmentSession } from "../browser/helpers/development-session";

type Fixture = { databaseName: string; branchId: string; ownerId: string; staffId: string };
type Identity = { id: string; clerkId: string };
type Counts = {
    ownerOrganizations: number; ownerBranches: number; ownerReceipts: number; ownerTrialGrants: number;
    organizations: number; branches: number; receipts: number; trials: number;
    billingChanges: number; providerActions: number;
};
type Trial = {
    id: string; organizationId: string | null; source: string; status: string;
    grantedAt: Date; claimedAt: Date | null; trialStartedAt: Date | null;
    trialEndsAt: Date | null; consumedAt: Date | null;
};
type Result = { org: { id: string }; branch: { id: string } };
type Receipt = {
    ownerId: string; idempotencyKey: string; requestHash: string;
    organizationId: string; branchId: string; createdAt: Date;
    organizationOwnerId: string; branchOrganizationId: string;
    organizationName: string; branchName: string; billingModelVersion: string;
    selectedPostTrialPlan: string;
};

const fixture = JSON.parse(readFileSync(".clerk/dashboard-fixture.json", "utf8")) as Fixture;
const target = assertDisposableTestDatabaseTarget(process.env.TEST_DATABASE_URL, process.env);
if (target.databaseName !== fixture.databaseName || !target.databaseName.includes("browser_test")) {
    throw new Error("Connected onboarding fixture/database mismatch");
}

async function database() {
    const db = new Client({ connectionString: process.env.TEST_DATABASE_URL,
        options: "-c default_transaction_read_only=on" });
    await db.connect();
    try {
        const identity = await db.query<{ name: string }>("SELECT current_database() AS name");
        if (identity.rows[0]?.name !== target.databaseName) throw new Error("Connected database identity changed");
        const marker = await db.query<{ count: number }>(
            'SELECT COUNT(*)::int AS count FROM "DashboardEvent" WHERE "branchId"=$1 AND kind=\'CONFIGURATION\' AND detail=\'Synthetic expected-attendance schedule configured\'',
            [fixture.branchId]);
        if (marker.rows[0]?.count !== 1) throw new Error("Synthetic fixture marker is missing or duplicated");
        return db;
    } catch (error) {
        await db.end();
        throw error;
    }
}

async function identity(db: Client, userId: string) {
    const result = await db.query<Identity>('SELECT id, "clerkId" FROM "User" WHERE id=$1', [userId]);
    if (!result.rows[0]?.clerkId?.startsWith("user_")) throw new Error("Synthetic Clerk identity is not linked");
    return result.rows[0];
}

async function counts(db: Client, ownerId: string): Promise<Counts> {
    const result = await db.query<Counts>(`SELECT
        (SELECT COUNT(*)::int FROM "Organization" WHERE "ownerId"=$1) AS "ownerOrganizations",
        (SELECT COUNT(*)::int FROM "Branch" WHERE "organizationId" IN
            (SELECT id FROM "Organization" WHERE "ownerId"=$1)) AS "ownerBranches",
        (SELECT COUNT(*)::int FROM "OnboardingRequest" WHERE "ownerId"=$1) AS "ownerReceipts",
        (SELECT COUNT(*)::int FROM "OwnerTrialGrant" WHERE "ownerId"=$1) AS "ownerTrialGrants",
        (SELECT COUNT(*)::int FROM "Organization") AS organizations,
        (SELECT COUNT(*)::int FROM "Branch") AS branches,
        (SELECT COUNT(*)::int FROM "OnboardingRequest") AS receipts,
        (SELECT COUNT(*)::int FROM "OwnerTrialGrant") AS trials,
        (SELECT COUNT(*)::int FROM "OrganizationBillingChange") AS "billingChanges",
        (SELECT COUNT(*)::int FROM "BillingProviderAction") AS "providerActions"`, [ownerId]);
    return result.rows[0];
}

async function trial(db: Client, ownerId: string): Promise<Trial | null> {
    const result = await db.query<Trial>(`SELECT id, "organizationId", source, status, "grantedAt", "claimedAt",
        "trialStartedAt", "trialEndsAt", "consumedAt" FROM "OwnerTrialGrant" WHERE "ownerId"=$1`, [ownerId]);
    return result.rows[0] ?? null;
}

async function receipt(db: Client, ownerId: string, key: string): Promise<Receipt | null> {
    const result = await db.query<Receipt>(`SELECT r."ownerId", r."idempotencyKey", r."requestHash",
        r."organizationId", r."branchId", r."createdAt",
        o."ownerId" AS "organizationOwnerId", b."organizationId" AS "branchOrganizationId",
        o.name AS "organizationName", b.name AS "branchName",
        o."billingModelVersion", o."selectedPostTrialPlan"
        FROM "OnboardingRequest" r
        JOIN "Organization" o ON o.id=r."organizationId"
        JOIN "Branch" b ON b.id=r."branchId"
        WHERE r."ownerId"=$1 AND r."idempotencyKey"=$2`, [ownerId, key]);
    return result.rows[0] ?? null;
}

function expectOneCommitted(before: Counts, after: Counts) {
    expect(after).toEqual({
        ...before,
        ownerOrganizations: before.ownerOrganizations + 1,
        ownerBranches: before.ownerBranches + 1,
        ownerReceipts: before.ownerReceipts + 1,
        organizations: before.organizations + 1,
        branches: before.branches + 1,
        receipts: before.receipts + 1,
    });
}

async function blockBusinessProviders(page: Page) {
    await page.route(/(?:api\.razorpay\.com|checkout\.razorpay\.com|graph\.facebook\.com|generativelanguage\.googleapis\.com)/,
        route => route.abort("blockedbyclient"));
}

async function assertSignedInAs(page: Page, expectedId: string) {
    await refreshDevelopmentSession(page);
    const token = await page.evaluate(async () => {
        const clerk = (window as unknown as {
            Clerk: { session?: { getToken(options: { skipCache: boolean }): Promise<string | null> } };
        }).Clerk;
        return clerk.session?.getToken({ skipCache: true }) ?? null;
    });
    if (!token) throw new Error("Real development Clerk session is unavailable");
    let response;
    try {
        response = await page.request.get("/api/users/me", {
            headers: { Authorization: `Bearer ${token}` }, timeout: 30_000,
        });
    } catch {
        throw new Error("GET /api/users/me failed at the local authenticated transport");
    }
    expect(response.status()).toBe(200);
    expect((await response.json() as { id: string }).id).toBe(expectedId);
}

async function openOnboarding(page: Page) {
    const response = await page.goto("/onboarding", { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBe(200);
    await page.waitForFunction(() => {
        const clerk = (window as unknown as { Clerk?: { loaded?: boolean; user?: unknown; session?: unknown } }).Clerk;
        return Boolean(clerk?.loaded && clerk.user && clerk.session);
    });
    await expect(page.locator('[data-app-design-pilot="workspace"]')).toBeVisible();
}

async function staffWithOwnerCommand(browser: Browser, ownerLedger: string, ownerKey: string) {
    const staffState = process.env.PLAYWRIGHT_STAFF_AUTH_STATE;
    if (!staffState || !staffState.replaceAll("\\", "/").startsWith(".clerk/")) {
        throw new Error("Set PLAYWRIGHT_STAFF_AUTH_STATE to an ignored real development Clerk state");
    }
    const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3117";
    const context = await browser.newContext({ baseURL,
        storageState: staffState });
    const page = await context.newPage();
    await blockBusinessProviders(page);
    // Keep only the owner's non-secret pending-command record on this origin,
    // as after a shared browser switches to the independently authenticated staff.
    // This does not replace Clerk authentication or claim sign-in/MFA UI coverage.
    await page.addInitScript(({ key, value, origin }) => {
        if (location.origin === origin) localStorage.setItem(key, value);
    }, { key: ownerKey, value: ownerLedger, origin: new URL(baseURL).origin });
    return { context, page };
}

test("real onboarding recovers one committed request after response loss, reload and an authenticated account change", async ({ page, browser }, testInfo) => {
    const backupRoot = path.resolve(".clerk", "audit-browser-runs");
    if (!path.resolve(testInfo.outputDir).startsWith(`${backupRoot}${path.sep}`)) {
        throw new Error("Connected onboarding must use the ignored, unique audit browser output directory");
    }
    const pendingBackup = testInfo.outputPath("onboarding-pending-command.json");
    const db = await database();
    let backupSaved = false;
    let replayConfirmed = false;
    try {
        const owner = await identity(db, fixture.ownerId);
        const staff = await identity(db, fixture.staffId);
        expect(staff.clerkId).not.toBe(owner.clerkId);
        expect((await db.query<{ count: number }>(
            'SELECT COUNT(*)::int AS count FROM "Organization" WHERE "ownerId"=$1', [staff.id])).rows[0].count).toBe(0);
        const before = await counts(db, owner.id);
        const trialBefore = await trial(db, owner.id);
        expect(before.ownerTrialGrants).toBe(1);
        expect(trialBefore).not.toBeNull();
        await blockBusinessProviders(page);
        await assertSignedInAs(page, owner.id);
        await openOnboarding(page);
        if (await page.getByRole("heading", { name: "Your workspace is ready" }).isVisible()) {
            await page.getByRole("button", { name: "Set up another organization" }).click();
        }
        if (await page.getByRole("heading", { name: "Recover your saved setup" }).isVisible()) {
            throw new Error("An earlier owner setup is pending; recover it before starting another connected run");
        }
        await expect(page.getByRole("heading", { name: "Organization details" })).toBeVisible();

        const unique = randomUUID().slice(0, 8);
        const organizationName = `Synthetic Recovery Library ${unique}`;
        const branchName = `Synthetic Recovery Hall ${unique}`;
        const ownerKey = `lab-lords:onboarding:v1:${encodeURIComponent(owner.clerkId)}`;
        const attempts: Array<{ account: string | undefined; key: string | undefined; body: string | null }> = [];
        let firstResult: Result | null = null;
        let firstReceipt: Receipt | null = null;
        let afterCommit: Counts | null = null;
        let firstLedger: string | null = null;
        let firstError: Error | null = null;
        let firstStatus: number | null = null;
        await page.route("**/api/onboarding", async route => {
            const request = route.request();
            if (request.method() !== "POST") return route.continue();
            const attempt = { account: request.headers()["x-onboarding-account"],
                key: request.headers()["idempotency-key"], body: request.postData() };
            attempts.push(attempt);
            if (attempts.length > 1) return route.continue();
            let phase = "saved command verification";
            try {
                firstLedger = await page.evaluate(key => localStorage.getItem(key), ownerKey);
                if (!firstLedger) throw new Error("Pending owner command was not saved before dispatch");
                // An interrupted test context must not discard the only replay
                // key/body. This ignored file has synthetic setup input, no auth.
                mkdirSync(path.dirname(pendingBackup), { recursive: true });
                writeFileSync(pendingBackup, firstLedger, { encoding: "utf8", flag: "wx", mode: 0o600 });
                backupSaved = true;
                phase = "local API request";
                const response = await route.fetch({ timeout: 120_000 });
                firstStatus = response.status();
                if (firstStatus !== 201) throw new Error(`Real onboarding returned HTTP ${firstStatus}`);
                firstResult = await response.json() as Result;
                if (!firstResult?.org?.id || !firstResult?.branch?.id || !attempt.key) {
                    throw new Error("Real onboarding result or request key is incomplete");
                }
                phase = "PostgreSQL commit confirmation";
                firstReceipt = await receipt(db, owner.id, attempt.key);
                if (!firstReceipt || firstReceipt.organizationId !== firstResult.org.id
                    || firstReceipt.branchId !== firstResult.branch.id
                    || firstReceipt.organizationOwnerId !== owner.id
                    || firstReceipt.branchOrganizationId !== firstResult.org.id) {
                    throw new Error("Committed onboarding receipt/result was not visible in PostgreSQL before response loss");
                }
                afterCommit = await counts(db, owner.id);
                if (afterCommit.ownerOrganizations !== before.ownerOrganizations + 1
                    || afterCommit.ownerBranches !== before.ownerBranches + 1
                    || afterCommit.ownerReceipts !== before.ownerReceipts + 1) {
                    throw new Error("Expected exactly one new workspace, branch and receipt before response loss");
                }
            } catch {
                // Playwright transport errors can embed request headers. Never
                // place their raw text (including Clerk auth) in runner output.
                firstError = new Error(`Connected onboarding failed during ${phase}${firstStatus && firstStatus !== 201 ? ` (HTTP ${firstStatus})` : ""}`);
            }
            // route.fetch has completed the real local API request. The matching
            // PostgreSQL receipt and result were queried before this browser loss.
            await route.abort("failed");
        });

        await page.locator('input[name="orgName"]').fill(organizationName);
        await page.locator('input[name="ownerPhone"]').fill("9876543210");
        await page.getByRole("button", { name: "Continue", exact: true }).click();
        await page.locator('input[name="branchName"]').fill(branchName);
        await page.locator('input[name="seatCount"]').fill("2");
        await page.getByRole("button", { name: "Choose plan" }).click();
        await page.getByRole("button", { name: /^Basic\b/ }).click();
        await page.getByRole("button", { name: "Continue", exact: true }).click();
        await page.getByRole("button", { name: /Begin with a clean workspace/ }).click();
        await page.getByRole("button", { name: "Start Standard trial" }).click();
        await expect(page.getByRole("heading", { name: "Recover your saved setup" })).toBeVisible();
        if (firstError) throw firstError;
        expect(firstStatus).toBe(201);
        expect(firstResult).not.toBeNull();
        expect(firstReceipt).not.toBeNull();
        expect(afterCommit).not.toBeNull();
        expect(attempts).toHaveLength(1);
        expect(attempts[0].account).toBe(owner.clerkId);
        expect(attempts[0].key).toMatch(/^[0-9a-f]{8}-[0-9a-f-]{27}$/i);
        const originalKey = attempts[0].key!;
        const originalBody = attempts[0].body;
        const pending = JSON.parse(firstLedger!) as {
            accountId: string; pending: { commandId: string; body: string; status: string };
        };
        expect(pending.accountId).toBe(owner.clerkId);
        expect(pending.pending).toMatchObject({ commandId: originalKey, status: "pending" });
        expect(pending.pending.body === originalBody).toBe(true);
        expect(firstReceipt).toMatchObject({ ownerId: owner.id, idempotencyKey: originalKey,
            organizationName, branchName, billingModelVersion: "WORKSPACE_V2", selectedPostTrialPlan: "BASIC" });
        expect(firstReceipt!.requestHash).toMatch(/^v1:[0-9a-f]{64}$/);
        expectOneCommitted(before, afterCommit!);
        expect(await trial(db, owner.id)).toEqual(trialBefore);
        expect((await db.query<{ count: number }>('SELECT COUNT(*)::int AS count FROM "Seat" WHERE "branchId"=$1',
            [firstResult!.branch.id])).rows[0].count).toBe(2);

        await page.reload({ waitUntil: "domcontentloaded" });
        await expect(page.getByRole("heading", { name: "Recover your saved setup" })).toBeVisible();
        expect(attempts).toHaveLength(1);
        expect(await counts(db, owner.id)).toEqual(afterCommit);

        const staffSession = await staffWithOwnerCommand(browser, firstLedger!, ownerKey);
        try {
            const staffPage = staffSession.page;
            let automaticStaffPosts = 0;
            staffPage.on("request", request => {
                if (request.method() === "POST" && new URL(request.url()).pathname === "/api/onboarding") automaticStaffPosts++;
            });
            await assertSignedInAs(staffPage, staff.id);
            await openOnboarding(staffPage);
            await expect(staffPage.getByRole("heading", { name: "Organization details" })).toBeVisible();
            expect(await staffPage.evaluate(key => localStorage.getItem(key) !== null, ownerKey)).toBe(true);
            expect(await staffPage.evaluate(key => localStorage.getItem(key),
                `lab-lords:onboarding:v1:${encodeURIComponent(staff.clerkId)}`)).toBeNull();
            expect(automaticStaffPosts).toBe(0);
            expect(await counts(db, owner.id)).toEqual(afterCommit);

            // A stale owner command presented by real staff auth is rejected by
            // the actual API before body parsing and cannot consume the key.
            const staffToken = await staffPage.evaluate(async () => {
                const clerk = (window as unknown as {
                    Clerk: { session?: { getToken(options: { skipCache: boolean }): Promise<string | null> } };
                }).Clerk;
                return clerk.session?.getToken({ skipCache: true }) ?? null;
            });
            if (!staffToken) throw new Error("Real staff Clerk session is unavailable");
            let denied;
            try {
                denied = await staffPage.request.post("/api/onboarding", { data: originalBody!, timeout: 30_000,
                    headers: { Authorization: `Bearer ${staffToken}`, "Content-Type": "application/json",
                        "Idempotency-Key": originalKey, "X-Onboarding-Account": owner.clerkId } });
            } catch {
                throw new Error("POST /api/onboarding failed at the local staff-denial transport");
            }
            expect(denied.status()).toBe(409);
            expect((await denied.json() as { code: string }).code).toBe("ONBOARDING_ACCOUNT_CHANGED");
            expect(await counts(db, owner.id)).toEqual(afterCommit);
        } finally {
            await staffSession.context.close();
        }

        const replayResponse = page.waitForResponse(response => response.request().method() === "POST"
            && new URL(response.url()).pathname === "/api/onboarding");
        await page.getByRole("button", { name: "Retry saved setup" }).click();
        const replay = await replayResponse;
        expect(replay.status()).toBe(201);
        expect(await replay.json() as Result).toEqual(firstResult);
        expect(attempts).toHaveLength(2);
        expect(attempts[1].account).toBe(owner.clerkId);
        expect(attempts[1].key).toBe(originalKey);
        expect(attempts[1].body === originalBody).toBe(true);
        await expect.poll(async () => {
            try {
                return await page.evaluate(key => {
                    const ledger = JSON.parse(localStorage.getItem(key) ?? "null") as {
                        pending: unknown; completed: Array<{ result: Result }>;
                    } | null;
                    return ledger?.pending === null ? ledger.completed.at(-1)?.result.branch.id : null;
                }, ownerKey);
            } catch { return null; }
        }).toBe(firstResult!.branch.id);
        await openOnboarding(page);
        await expect(page.getByRole("heading", { name: "Your workspace is ready" })).toBeVisible();
        expect(attempts).toHaveLength(2);
        expect(await receipt(db, owner.id, originalKey)).toEqual(firstReceipt);
        expect(await counts(db, owner.id)).toEqual(afterCommit);
        expect(await trial(db, owner.id)).toEqual(trialBefore);
        replayConfirmed = true;
    } finally {
        if (backupSaved && replayConfirmed) unlinkSync(pendingBackup);
        await db.end();
    }
});
