import { readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { expect, test, type Browser, type Page, type TestInfo } from "@playwright/test";
import { Client } from "pg";
import { assertDisposableTestDatabaseTarget } from "../setup/testDatabaseSafety";
import { refreshDevelopmentSession } from "../browser/helpers/development-session";

type Fixture = {
    databaseName: string;
    orgId: string;
    branchId: string;
    ownerId: string;
    staffId: string;
};
type Identity = { id: string; clerkId: string };
type StaffMembership = { id: string; role: string; manageOverride: boolean | null };
type MessagingCounts = {
    senders: number; subscriptions: number; snapshots: number; messages: number;
    notices: number; incidents: number; drafts: number; staffOverrides: number;
    consents: number; auditEvents: number; safetyStates: number;
};
type BranchAccess = {
    isOwner: boolean;
    role: string;
    permissions: Record<string, boolean>;
    entitlements: string[];
};
type BlockedBusinessEndpoint = { hostname: string; pathname: string };

const fixture = JSON.parse(readFileSync(".clerk/dashboard-fixture.json", "utf8")) as Fixture;
const target = assertDisposableTestDatabaseTarget(process.env.TEST_DATABASE_URL, process.env);
if (target.databaseName !== fixture.databaseName || !target.databaseName.includes("browser_test")) {
    throw new Error("Connected messaging fixture/database mismatch");
}

function assertAuditOutput(testInfo: TestInfo) {
    const root = path.resolve(".clerk", "audit-browser-runs");
    if (!path.resolve(testInfo.outputDir).startsWith(`${root}${path.sep}`)) {
        throw new Error("Connected messaging must use an ignored, unique audit browser output directory");
    }
}

async function database(writable = false) {
    if (writable && (target.databaseName !== "lab_lords_dashboard_closeout_browser_test"
        || target.hostname !== "127.0.0.1" || target.port !== "59117")) {
        throw new Error("Connected messaging writes require the exact retained local synthetic fixture");
    }
    const db = new Client({
        connectionString: process.env.TEST_DATABASE_URL,
        options: writable ? undefined : "-c default_transaction_read_only=on",
    });
    await db.connect();
    try {
        const identity = await db.query<{ name: string }>("SELECT current_database() AS name");
        if (identity.rows[0]?.name !== target.databaseName) {
            throw new Error("Connected messaging database identity changed");
        }
        const marker = await db.query<{ count: number }>(
            'SELECT COUNT(*)::int AS count FROM "DashboardEvent" WHERE "branchId"=$1 AND kind=\'CONFIGURATION\' AND detail=\'Synthetic expected-attendance schedule configured\'',
            [fixture.branchId]
        );
        if (marker.rows[0]?.count !== 1) throw new Error("Synthetic fixture marker is missing or duplicated");
        return db;
    } catch (error) {
        await db.end();
        throw error;
    }
}

async function identity(db: Client, id: string) {
    const row = (await db.query<Identity>('SELECT id, "clerkId" FROM "User" WHERE id=$1', [id])).rows[0];
    if (!row?.clerkId?.startsWith("user_")) throw new Error("Synthetic Clerk identity is not linked");
    return row;
}

async function messagingCounts(db: Client): Promise<MessagingCounts> {
    return (await db.query<MessagingCounts>(`SELECT
        (SELECT COUNT(*)::int FROM "WhatsAppSender" WHERE "organizationId"=$1) AS senders,
        (SELECT COUNT(*)::int FROM "WhatsAppReportSubscription" WHERE "organizationId"=$1) AS subscriptions,
        (SELECT COUNT(*)::int FROM "WhatsAppDailyReportSnapshot" WHERE "organizationId"=$1) AS snapshots,
        (SELECT COUNT(*)::int FROM "WhatsAppMessage" WHERE "organizationId"=$1) AS messages,
        (SELECT COUNT(*)::int FROM "WhatsAppServiceNotice" WHERE "organizationId"=$1) AS notices,
        (SELECT COUNT(*)::int FROM "WhatsAppOperationalIncident" WHERE "organizationId"=$1) AS incidents,
        (SELECT COUNT(*)::int FROM "WhatsAppConsent" WHERE "senderId" IN
            (SELECT id FROM "WhatsAppSender" WHERE "organizationId"=$1)) AS consents,
        (SELECT COUNT(*)::int FROM "WhatsAppAuditEvent" WHERE "organizationId"=$1) AS "auditEvents",
        (SELECT COUNT(*)::int FROM "WhatsAppSenderSafetyState" WHERE "senderId" IN
            (SELECT id FROM "WhatsAppSender" WHERE "organizationId"=$1)) AS "safetyStates",
        (SELECT COUNT(*)::int FROM "MessageDraft" WHERE "branchId"=$2) AS drafts,
        (SELECT COUNT(*)::int FROM "StaffPermissionOverride" WHERE "staffId" IN
            (SELECT id FROM "Staff" WHERE "branchId"=$2)) AS "staffOverrides"`,
        [fixture.orgId, fixture.branchId])).rows[0];
}

async function staffMembership(db: Client): Promise<StaffMembership> {
    const row = (await db.query<StaffMembership>(`SELECT s.id, s.role,
        o.allowed AS "manageOverride"
        FROM "Staff" s LEFT JOIN "StaffPermissionOverride" o
            ON o."staffId"=s.id AND o.action='MANAGE_WHATSAPP'
        WHERE s."branchId"=$1 AND s."userId"=$2`, [fixture.branchId, fixture.staffId])).rows[0];
    if (!row) throw new Error("Synthetic STAFF membership is missing");
    return row;
}

async function blockBusinessProviders(
    page: Page,
    onAttempt?: (endpoint: BlockedBusinessEndpoint, method: string) => void
) {
    await page.route(/(?:api\.razorpay\.com|checkout\.razorpay\.com|graph\.facebook\.com|generativelanguage\.googleapis\.com)/,
        route => {
            const request = route.request();
            const url = new URL(request.url());
            onAttempt?.({ hostname: url.hostname, pathname: url.pathname }, request.method());
            return route.abort("blockedbyclient");
        });
}

async function authenticatedRequest(page: Page, requestPath: string, method = "GET", data?: unknown) {
    let token: string | null;
    try {
        token = await page.evaluate(async () => {
            const clerk = (window as unknown as {
                Clerk: { session?: { getToken(options: { skipCache: boolean }): Promise<string | null> } };
            }).Clerk;
            return clerk.session?.getToken({ skipCache: true }) ?? null;
        });
    } catch {
        throw new Error(`${method} ${requestPath} could not read the local Clerk session`);
    }
    if (!token) throw new Error(`${method} ${requestPath} has no real Clerk session`);
    try {
        return await page.request.fetch(requestPath, {
            method, data, headers: { Authorization: `Bearer ${token}` }, timeout: 30_000,
        });
    } catch {
        // Playwright transport errors can include headers. Keep JWTs out of output.
        throw new Error(`${method} ${requestPath} failed at the local authenticated transport`);
    }
}

async function assertSignedInAs(page: Page, expectedId: string) {
    await refreshDevelopmentSession(page);
    const response = await authenticatedRequest(page, "/api/users/me");
    expect(response.status()).toBe(200);
    expect((await response.json() as { id: string }).id).toBe(expectedId);
}

async function openPage(page: Page, route: string) {
    const response = await page.goto(route, { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBe(200);
    await page.waitForFunction(() => {
        const clerk = (window as unknown as { Clerk?: { loaded?: boolean; user?: unknown; session?: unknown } }).Clerk;
        return Boolean(clerk?.loaded && clerk.user && clerk.session);
    });
}

async function staffContext(browser: Browser) {
    const state = process.env.PLAYWRIGHT_STAFF_AUTH_STATE;
    if (!state || !state.replaceAll("\\", "/").startsWith(".clerk/")) {
        throw new Error("Set PLAYWRIGHT_STAFF_AUTH_STATE to an ignored real development Clerk state");
    }
    const context = await browser.newContext({
        baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3117",
        storageState: state,
    });
    const page = await context.newPage();
    await blockBusinessProviders(page);
    return { context, page };
}

test("staff sees branch notices and incidents without daily-report access", async ({ page, browser }, testInfo) => {
    assertAuditOutput(testInfo);
    const db = await database();
    let staffSession: Awaited<ReturnType<typeof staffContext>> | null = null;
    try {
        const before = await messagingCounts(db);
        const member = await staffMembership(db);
        const owner = await identity(db, fixture.ownerId);
        const staff = await identity(db, fixture.staffId);
        expect(staff.clerkId).not.toBe(owner.clerkId);
        expect(member.role).toBe("STAFF");
        expect(member.manageOverride).not.toBe(true);
        expect(before.senders).toBe(0);
        expect(before.subscriptions).toBe(0);
        expect(before.messages).toBe(0);
        expect((await db.query<{ count: number }>(
            'SELECT COUNT(*)::int AS count FROM "Organization" WHERE "ownerId"=$1', [staff.id])).rows[0].count).toBe(0);

        await blockBusinessProviders(page);
        await assertSignedInAs(page, owner.id);
        staffSession = await staffContext(browser);
        const staffPage = staffSession.page;
        await assertSignedInAs(staffPage, staff.id);
        const accessPath = `/api/branches/${fixture.branchId}/access`;
        const accessBeforeResponse = await authenticatedRequest(staffPage, accessPath);
        expect(accessBeforeResponse.status()).toBe(200);
        const accessBefore = await accessBeforeResponse.json() as BranchAccess;
        expect(accessBefore.isOwner).toBe(false);
        expect(accessBefore.permissions).toMatchObject({
            view_whatsapp: true, send_whatsapp: true, manage_whatsapp: false,
            receive_whatsapp_reports: false, view_payments: false, analytics: false,
            manage_branch: false,
        });
        expect(accessBefore.entitlements).toContain("WHATSAPP_AUTOMATION");

        const memberPath = `/api/branches/${fixture.branchId}/staff/${member.id}`;
        let grantAttempted = false;
        try {
            // This reversible owner command changes only the independent notice
            // permission. The staff member remains report-denied and non-owner.
            grantAttempted = true;
            const grant = await authenticatedRequest(page, memberPath, "PATCH", {
                permissions: { manage_whatsapp: true },
            });
            expect(grant.status()).toBe(200);
            expect((await staffMembership(db)).manageOverride).toBe(true);

            const accessAfterResponse = await authenticatedRequest(staffPage, accessPath);
            expect(accessAfterResponse.status()).toBe(200);
            const accessAfter = await accessAfterResponse.json() as BranchAccess;
            expect(accessAfter.permissions).toMatchObject({
                view_whatsapp: true, send_whatsapp: true, manage_whatsapp: true,
                receive_whatsapp_reports: false, view_payments: false, analytics: false,
                manage_branch: false,
            });
            const branchBase = `/api/branches/${fixture.branchId}/whatsapp`;
            const deniedReport = await authenticatedRequest(staffPage, `${branchBase}/report-subscription`);
            expect(deniedReport.status()).toBe(404);

            const browserGets: Array<{ pathname: string; status: number }> = [];
            staffPage.on("response", response => {
                if (response.request().method() !== "GET") return;
                const pathname = new URL(response.url()).pathname;
                if (pathname.startsWith(branchBase)) browserGets.push({ pathname, status: response.status() });
            });
            await openPage(staffPage, `/branch/${fixture.branchId}/settings`);
            await expect(staffPage.getByRole("heading", { name: "Operational service notice" })).toBeVisible();
            await expect(staffPage.getByRole("heading", { name: "Operational incidents" })).toBeVisible();
            await expect(staffPage.getByRole("heading", { name: "Branch daily report recipient" })).toHaveCount(0);
            await expect(staffPage.getByRole("button", { name: "Preview typed notice" })).toBeVisible();
            await expect(staffPage.getByRole("button", { name: "Edit settings" })).toHaveCount(0);
            expect(browserGets).toContainEqual({ pathname: `${branchBase}/service-notices`, status: 200 });
            expect(browserGets).toContainEqual({ pathname: `${branchBase}/incidents`, status: 200 });
            expect(browserGets.some(item => item.pathname === `${branchBase}/report-subscription`)).toBe(false);
            expect(await messagingCounts(db)).toMatchObject({ ...before, staffOverrides: before.staffOverrides + (member.manageOverride === null ? 1 : 0) });
        } finally {
            if (grantAttempted) {
                const restore = await authenticatedRequest(page, memberPath, "PATCH", {
                    permissions: { manage_whatsapp: member.manageOverride },
                });
                expect(restore.status()).toBe(200);
            }
        }
        expect((await staffMembership(db)).manageOverride).toBe(member.manageOverride);
        const after = await messagingCounts(db);
        expect(after).toEqual(before);
        writeFileSync(testInfo.outputPath("staff-messaging-counts.json"),
            JSON.stringify({ before, after, reportDenied: true, noticeAndIncidentPanelsVisible: true }, null, 2));
    } finally {
        await staffSession?.context.close();
        await db.end();
    }
});

test("owner keeps organization operations visible when report loading is lost and history recovers", async ({ page }, testInfo) => {
    assertAuditOutput(testInfo);
    const db = await database();
    try {
        const before = await messagingCounts(db);
        expect(before.senders).toBe(0);
        expect(before.snapshots).toBe(0);
        expect(before.messages).toBe(0);
        await blockBusinessProviders(page);
        const owner = await identity(db, fixture.ownerId);
        await assertSignedInAs(page, owner.id);
        const apiBase = `/api/organizations/${fixture.orgId}/whatsapp`;
        const sendersResponse = await authenticatedRequest(page, `${apiBase}/senders`);
        expect(sendersResponse.status()).toBe(200);
        expect(await sendersResponse.json()).toMatchObject({
            enabled: true, operationsUiEnabled: true, senders: [],
        });
        const historyPath = `${apiBase}/reports/history`;
        const initialHistory = await authenticatedRequest(page, historyPath);
        expect(initialHistory.status()).toBe(200);
        expect(await initialHistory.json()).toEqual({ reports: [] });

        await openPage(page, `/org/${fixture.orgId}/settings`);
        await expect(page.getByRole("heading", { name: "Organization daily report recipient" })).toBeVisible();
        await expect(page.getByRole("heading", { name: "Today's organization report" })).toBeVisible();
        await expect(page.getByRole("heading", { name: "Operational incidents" })).toBeVisible();
        await expect(page.getByText("No daily report history yet.")).toBeVisible();

        let reportStatus: number | null = null;
        let reportTransportFailed = false;
        const subscriptionPath = `${apiBase}/report-subscription`;
        await page.route(`**${subscriptionPath}`, async route => {
            if (route.request().method() !== "GET") return route.continue();
            try {
                reportStatus = (await route.fetch({ timeout: 30_000 })).status();
            } catch {
                reportTransportFailed = true;
            }
            await route.abort("failed");
        });
        await page.reload({ waitUntil: "domcontentloaded" });
        await expect(page.getByRole("heading", { name: "Operational incidents" })).toBeVisible();
        await expect(page.getByRole("heading", { name: "Today's organization report" })).toBeVisible();
        await expect(page.getByRole("heading", { name: "Organization daily report recipient" })).toHaveCount(0);
        expect(reportTransportFailed).toBe(false);
        expect(reportStatus).toBe(200);
        await page.unroute(`**${subscriptionPath}`);

        await page.reload({ waitUntil: "domcontentloaded" });
        await expect(page.getByRole("heading", { name: "Organization daily report recipient" })).toBeVisible();
        await expect(page.getByText("No daily report history yet.")).toBeVisible();
        let historyStatus: number | null = null;
        let historyTransportFailed = false;
        await page.route(`**${historyPath}`, async route => {
            if (route.request().method() !== "GET") return route.continue();
            try {
                const response = await route.fetch({ timeout: 30_000 });
                historyStatus = response.status();
                expect(await response.json()).toEqual({ reports: [] });
            } catch {
                historyTransportFailed = true;
            }
            await route.abort("failed");
        });
        await page.getByRole("button", { name: "Refresh report history" }).click();
        await expect(page.getByText("Daily report history is unavailable. Try refreshing.")).toBeVisible();
        await expect(page.getByRole("heading", { name: "Operational incidents" })).toBeVisible();
        expect(historyTransportFailed).toBe(false);
        expect(historyStatus).toBe(200);
        await page.unroute(`**${historyPath}`);
        await page.reload({ waitUntil: "domcontentloaded" });
        await expect(page.getByText("No daily report history yet.")).toBeVisible();
        const after = await messagingCounts(db);
        expect(after).toEqual(before);
        writeFileSync(testInfo.outputPath("owner-messaging-counts.json"),
            JSON.stringify({ before, after, reportLossStatus: reportStatus, historyLossStatus: historyStatus }, null, 2));
    } finally {
        await db.end();
    }
});

test("mobile owner keeps sender safety during report failure and pauses only a branch subscription", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "The pending report-pause UI acceptance is mobile-specific");
    assertAuditOutput(testInfo);
    const db = await database(true);
    const unique = randomUUID();
    const senderId = `audit-pause-sender-${unique}`;
    const consentId = `audit-pause-consent-${unique}`;
    const subscriptionId = `audit-pause-subscription-${unique}`;
    const phone = "+910000000000";
    let transactionOpen = false;
    let before: MessagingCounts | null = null;
    let pauseStatus: number | null = null;
    let senderSafetyStatus: number | null = null;
    let reportLossStatus: number | null = null;
    const blockedBusinessEndpoints: BlockedBusinessEndpoint[] = [];
    const unexpectedBusinessEndpoints: BlockedBusinessEndpoint[] = [];
    let metaGeminiAttempts = 0;
    let providerWriteAttempts = 0;
    try {
        before = await messagingCounts(db);
        expect(before.senders).toBe(0);
        expect(before.consents).toBe(0);
        expect(before.subscriptions).toBe(0);
        expect(before.messages).toBe(0);
        const owner = await identity(db, fixture.ownerId);
        const originalSettings = (await db.query(
            'SELECT "senderId", enabled, "automationEnabledAt", "configurationRevision", "updatedAt" FROM "BranchWhatsAppSettings" WHERE "branchId"=$1',
            [fixture.branchId])).rows;

        // The TEST-mode rows are prerequisites for exercising Pause, not proof
        // of Meta connection, phone confirmation, or submitted report history.
        await db.query("BEGIN");
        transactionOpen = true;
        await db.query(`INSERT INTO "WhatsAppSender"
            (id, "organizationId", provider, "providerMode", "wabaId", "phoneNumberId", "displayPhoneNumber", status,
             "createdAt", "updatedAt")
            VALUES ($1, $2, 'META_CLOUD', 'TEST', $3, $4, $5, 'ACTIVE', NOW(), NOW())`,
            [senderId, fixture.orgId, `audit-pause-waba-${unique}`, `audit-pause-phone-${unique}`, phone]);
        await db.query(`INSERT INTO "WhatsAppConsent"
            (id, "senderId", "phoneE164", "consentType", status, source, "policyVersion", "grantedAt", "recordedByUserId",
             "createdAt", "updatedAt")
            VALUES ($1, $2, $3, 'OWNER_REPORT', 'OPTED_IN', 'OWNER_CONFIGURATION', $4, NOW(), $5, NOW(), NOW())`,
            [consentId, senderId, phone, "synthetic-browser-report-pause", owner.id]);
        await db.query(`INSERT INTO "WhatsAppReportSubscription"
            (id, "organizationId", "branchId", scope, "scopeKey", "senderId", "userId", "consentId",
             "phoneE164", language, "sendTimeLocal", status, "confirmationAttemptCount", "activatedAt",
             "createdAt", "updatedAt")
            VALUES ($1, $2, $3, 'BRANCH', $3, $4, $5, $6, $7, 'en_IN', '21:00', 'ACTIVE', 0, NOW(), NOW(), NOW())`,
            [subscriptionId, fixture.orgId, fixture.branchId, senderId, owner.id, consentId, phone]);
        await db.query("COMMIT");
        transactionOpen = false;
        expect(await messagingCounts(db)).toMatchObject({
            ...before, senders: before.senders + 1, consents: before.consents + 1,
            subscriptions: before.subscriptions + 1,
        });

        await blockBusinessProviders(page, (endpoint, method) => {
            blockedBusinessEndpoints.push(endpoint);
            if (endpoint.hostname === "graph.facebook.com"
                || endpoint.hostname === "generativelanguage.googleapis.com") {
                metaGeminiAttempts += 1;
            }
            if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) providerWriteAttempts += 1;
            // Organization settings always mounts a read-only Checkout script.
            // It remains blocked here, but is unrelated to messaging delivery.
            if (!(endpoint.hostname === "checkout.razorpay.com"
                && endpoint.pathname === "/v1/checkout.js" && method === "GET")) {
                unexpectedBusinessEndpoints.push(endpoint);
            }
        });
        await assertSignedInAs(page, owner.id);
        const organizationBase = `/api/organizations/${fixture.orgId}/whatsapp`;
        const safetyPath = `${organizationBase}/senders/${senderId}/safety`;
        const organizationSubscriptionPath = `${organizationBase}/report-subscription`;
        let reportTransportFailed = false;
        await page.route(`**${organizationSubscriptionPath}`, async route => {
            if (route.request().method() !== "GET") return route.continue();
            try {
                reportLossStatus = (await route.fetch({ timeout: 30_000 })).status();
            } catch {
                reportTransportFailed = true;
            }
            await route.abort("failed");
        });
        const safetyResponsePromise = page.waitForResponse(response =>
            new URL(response.url()).pathname === safetyPath && response.request().method() === "GET");
        await openPage(page, `/org/${fixture.orgId}/settings`);
        const safetyResponse = await safetyResponsePromise;
        senderSafetyStatus = safetyResponse.status();
        expect(senderSafetyStatus).toBe(200);
        expect(await safetyResponse.json()).toMatchObject({
            senderStatus: "ACTIVE", paused: false, unknownOutcomeCount: 0,
            openCriticalIncidentCount: 0,
        });
        await expect(page.getByRole("heading", { name: "Sender delivery safety" })).toBeVisible();
        await expect(page.getByText("Delivery active")).toBeVisible();
        await expect(page.getByRole("heading", { name: "Operational incidents" })).toBeVisible();
        await expect(page.getByRole("heading", { name: "Organization daily report recipient" })).toHaveCount(0);
        expect(reportTransportFailed).toBe(false);
        expect(reportLossStatus).toBe(200);
        await page.unroute(`**${organizationSubscriptionPath}`);
        expect((await db.query<{ count: number }>(
            'SELECT COUNT(*)::int AS count FROM "WhatsAppSenderSafetyState" WHERE "senderId"=$1',
            [senderId])).rows[0].count).toBe(0);
        expect(metaGeminiAttempts).toBe(0);
        expect(providerWriteAttempts).toBe(0);
        expect(unexpectedBusinessEndpoints).toEqual([]);

        await openPage(page, `/branch/${fixture.branchId}/settings`);
        await expect(page.getByRole("heading", { name: "Branch daily report recipient" })).toBeVisible();
        await expect(page.getByRole("button", { name: "Pause reports" })).toBeVisible();
        const pausePath = `/api/branches/${fixture.branchId}/whatsapp/report-subscription/pause`;
        const pauseResponsePromise = page.waitForResponse(response =>
            new URL(response.url()).pathname === pausePath && response.request().method() === "POST");
        await page.getByRole("button", { name: "Pause reports" }).click();
        const pauseResponse = await pauseResponsePromise;
        pauseStatus = pauseResponse.status();
        expect(pauseStatus).toBe(200);
        expect(await pauseResponse.json()).toMatchObject({
            changed: true, cancelledMessages: 0, subscription: { id: subscriptionId, status: "PAUSED" },
        });
        await expect(page.getByText("Daily report delivery was paused.")).toBeVisible();
        await expect(page.getByRole("button", { name: "Pause reports" })).toHaveCount(0);
        await expect(page.getByRole("button", { name: "Reissue one-time code" })).toBeVisible();
        const paused = (await db.query<{
            status: string; pausedAt: Date | null; scope: string; scopeKey: string;
        }>('SELECT status, "pausedAt", scope, "scopeKey" FROM "WhatsAppReportSubscription" WHERE id=$1',
        [subscriptionId])).rows[0];
        if (!paused) throw new Error("Synthetic report subscription disappeared after pause");
        expect(paused).toMatchObject({ status: "PAUSED", scope: "BRANCH", scopeKey: fixture.branchId });
        expect(paused.pausedAt).toBeInstanceOf(Date);
        expect((await db.query<{ action: string; actorUserId: string }>(
            'SELECT action, "actorUserId" FROM "WhatsAppAuditEvent" WHERE "senderId"=$1',
            [senderId])).rows).toEqual([{ action: "REPORT_SUBSCRIPTION_PAUSED", actorUserId: owner.id }]);
        expect((await db.query(
            'SELECT "senderId", enabled, "automationEnabledAt", "configurationRevision", "updatedAt" FROM "BranchWhatsAppSettings" WHERE "branchId"=$1',
            [fixture.branchId])).rows).toEqual(originalSettings);
        expect(await messagingCounts(db)).toMatchObject({
            ...before, senders: before.senders + 1, consents: before.consents + 1,
            subscriptions: before.subscriptions + 1, auditEvents: before.auditEvents + 1,
        });
        expect(metaGeminiAttempts).toBe(0);
        expect(providerWriteAttempts).toBe(0);
        expect(unexpectedBusinessEndpoints).toEqual([]);

        await page.reload({ waitUntil: "domcontentloaded" });
        await expect(page.getByRole("heading", { name: "Branch daily report recipient" })).toBeVisible();
        await expect(page.getByRole("button", { name: "Reissue one-time code" })).toBeVisible();
        await expect(page.getByRole("button", { name: "Pause reports" })).toHaveCount(0);
        expect(metaGeminiAttempts).toBe(0);
        expect(providerWriteAttempts).toBe(0);
        expect(unexpectedBusinessEndpoints).toEqual([]);
    } finally {
        if (transactionOpen) await db.query("ROLLBACK");
        try {
            await db.query("BEGIN");
            await db.query('DELETE FROM "WhatsAppAuditEvent" WHERE "senderId"=$1', [senderId]);
            await db.query('DELETE FROM "WhatsAppReportSubscription" WHERE id=$1', [subscriptionId]);
            await db.query('DELETE FROM "WhatsAppConsent" WHERE id=$1', [consentId]);
            await db.query('DELETE FROM "WhatsAppSender" WHERE id=$1', [senderId]);
            await db.query("COMMIT");
            if (before) {
                const after = await messagingCounts(db);
                expect(after).toEqual(before);
                writeFileSync(testInfo.outputPath("mobile-report-pause-counts.json"), JSON.stringify({
                    before, after, pauseStatus, senderSafetyStatus, reportLossStatus,
                    blockedBusinessEndpoints, metaGeminiAttempts, providerWriteAttempts,
                    unexpectedBusinessEndpointCount: unexpectedBusinessEndpoints.length,
                    syntheticPrerequisite: true, phoneConfirmationAndMetaDeliveryVerified: false,
                }, null, 2));
            }
        } catch (error) {
            await db.query("ROLLBACK").catch(() => undefined);
            throw error;
        } finally {
            await db.end();
        }
    }
});
