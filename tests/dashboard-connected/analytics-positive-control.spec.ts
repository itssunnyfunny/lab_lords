import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type BrowserContext, type Page, type TestInfo } from "@playwright/test";
import { parse } from "dotenv";
import { Client } from "pg";
import { assertDisposableTestDatabaseTarget } from "../setup/testDatabaseSafety";

type Fixture = { databaseName: string; branchId: string };
type CapturedRequest = {
    phase: string;
    kind: "tag-read" | "blocked-google";
    url: string;
    body: string | null;
    referer: string;
};

const fixture = JSON.parse(readFileSync(".clerk/dashboard-fixture.json", "utf8")) as Fixture;
const target = assertDisposableTestDatabaseTarget(process.env.TEST_DATABASE_URL, process.env);
const syntheticId = "G-0000000000";
if (target.databaseName !== fixture.databaseName || !target.databaseName.includes("browser_test")
    || process.env.DASHBOARD_AUDIT_GA_CONFIRM !== fixture.databaseName) {
    throw new Error("Synthetic Google tag check requires the exact confirmed local browser_test fixture");
}

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3117";
const localOrigin = new URL(baseURL);
if (localOrigin.protocol !== "http:" || localOrigin.hostname !== "localhost") {
    throw new Error("Synthetic Google tag check requires the guarded localhost application");
}

function clerkDevelopmentOrigin() {
    const localFiles = [".env", ".env.local", ".env.production", ".env.production.local"];
    const local = Object.assign({}, ...localFiles.filter(existsSync).map(file => parse(readFileSync(file))));
    const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
        || local.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    if (!publishableKey?.startsWith("pk_test_")) {
        throw new Error("Synthetic Google tag check requires an existing Clerk development key");
    }
    const hostname = Buffer.from(publishableKey.slice("pk_test_".length), "base64")
        .toString("utf8").replace(/\$$/, "");
    if (!/^[a-z0-9.-]+\.accounts\.dev$/.test(hostname)) {
        throw new Error("Synthetic Google tag check cannot identify the exact Clerk development origin");
    }
    return `https://${hostname}`;
}

function assertAuditOutput(testInfo: TestInfo) {
    const root = path.resolve(".clerk", "audit-browser-runs");
    if (!path.resolve(testInfo.outputDir).startsWith(`${root}${path.sep}`)) {
        throw new Error("Synthetic Google tag output must stay in a unique ignored audit directory");
    }
}

async function assertFixtureMarker() {
    const db = new Client({
        connectionString: process.env.TEST_DATABASE_URL,
        options: "-c default_transaction_read_only=on",
    });
    await db.connect();
    try {
        const identity = await db.query<{ name: string }>("SELECT current_database() AS name");
        if (identity.rows[0]?.name !== target.databaseName) {
            throw new Error("Synthetic Google tag database identity changed");
        }
        const marker = await db.query<{ count: number }>(
            'SELECT COUNT(*)::int AS count FROM "DashboardEvent" WHERE "branchId"=$1 AND kind=\'CONFIGURATION\' AND detail=\'Synthetic expected-attendance schedule configured\'',
            [fixture.branchId]
        );
        if (marker.rows[0]?.count !== 1) throw new Error("Synthetic fixture marker is missing or duplicated");
    } finally {
        await db.end();
    }
}

function containsSyntheticInvite(value: string) {
    let decoded = value.toLowerCase();
    for (let depth = 0; depth < 4; depth++) {
        if (decoded.includes("v2.synthetic-hash.synthetic-secret")
            || decoded.includes("synthetic-secret")) return true;
        try {
            const next = decodeURIComponent(decoded.replaceAll("+", "%20"));
            if (next === decoded) break;
            decoded = next;
        } catch {
            break;
        }
    }
    return false;
}

function isGoogleHost(hostname: string) {
    return hostname === "www.googletagmanager.com"
        || hostname === "www.google-analytics.com"
        || hostname.endsWith(".google-analytics.com")
        || hostname === "google-analytics.com"
        || hostname === "www.google.com"
        || hostname.endsWith(".doubleclick.net");
}

function isCollectAttempt(url: string) {
    const parsed = new URL(url);
    return isGoogleHost(parsed.hostname)
        && /\/(?:g\/)?collect$/.test(parsed.pathname);
}

async function installEgressGuard(context: BrowserContext, clerkOrigin: string,
    captured: CapturedRequest[], counters: { phase: string; otherBlocked: number; clerkReads: number }) {
    await context.route("**/*", async route => {
        const request = route.request();
        const url = new URL(request.url());
        if (url.protocol !== "http:" && url.protocol !== "https:") return route.continue();
        const referer = request.headers().referer || "";
        try {
            if (url.origin === localOrigin.origin) return await route.continue();
            if (url.origin === clerkOrigin) {
                counters.clerkReads++;
                return await route.continue();
            }
            const tagRead = request.method() === "GET"
                && url.protocol === "https:"
                && url.hostname === "www.googletagmanager.com"
                && (url.pathname === "/gtag/js" || url.pathname === "/gtag/destination")
                && url.searchParams.get("id") === syntheticId;
            if (tagRead) {
                captured.push({ phase: counters.phase, kind: "tag-read", url: url.href, body: null, referer });
                return await route.continue();
            }
            if (isGoogleHost(url.hostname)) {
                captured.push({ phase: counters.phase, kind: "blocked-google",
                    url: url.href, body: request.postData(), referer });
            } else {
                counters.otherBlocked++;
            }
            return await route.abort("blockedbyclient");
        } catch {
            // Do not surface browser request headers or provider payloads.
            throw new Error("Synthetic tag network interception failed");
        }
    });
}

async function openPrivate(page: Page, route: string, title: string) {
    const response = await page.goto(route, { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBe(200);
    if (title) await expect(page.getByRole("heading", { name: title })).toBeVisible();
    await page.waitForFunction(() => {
        const clerk = (window as unknown as { Clerk?: { loaded?: boolean } }).Clerk;
        return clerk?.loaded === true;
    });
    await expect(page.locator("script#google-analytics")).toHaveCount(0);
}

test("synthetic real Google tag makes an intercepted collect attempt without invitation data", async ({ browser }, testInfo) => {
    assertAuditOutput(testInfo);
    await assertFixtureMarker();
    const clerkOrigin = clerkDevelopmentOrigin();
    const captured: CapturedRequest[] = [];
    const counters = { phase: "direct-invite-unknown", otherBlocked: 0, clerkReads: 0 };
    const context = await browser.newContext({ baseURL, serviceWorkers: "block" });
    const responses: number[] = [];
    const invitePath = "/invite/v2.synthetic-hash.synthetic-secret";
    const encodedReturnPath = `/sign-in?redirect_url=${encodeURIComponent(invitePath)}`;
    try {
        await installEgressGuard(context, clerkOrigin, captured, counters);
        const page = await context.newPage();
        page.on("response", response => {
            const url = new URL(response.url());
            if (url.hostname === "www.googletagmanager.com" && url.pathname === "/gtag/js"
                && url.searchParams.get("id") === syntheticId) responses.push(response.status());
        });
        const openPublic = async (phase: string) => {
            counters.phase = phase;
            const earlierResponses = responses.length;
            const response = await page.goto("/", { waitUntil: "domcontentloaded" });
            expect(response?.status()).toBe(200);
            await expect(page.locator("script#google-analytics")).toHaveAttribute("src",
                `https://www.googletagmanager.com/gtag/js?id=${syntheticId}`);
            await expect.poll(() => responses.length).toBeGreaterThan(earlierResponses);
            expect(responses.at(-1)).toBe(200);
        };

        // A full-document direct invite has no public-route tag activation.
        await openPrivate(page, invitePath, "Invite not found");
        expect(captured.some(item => item.kind === "tag-read")).toBe(false);
        await openPublic("public-unknown");
        expect(await page.evaluate(() => (window as unknown as {
            labLordsGaMeasurementId?: string;
        }).labLordsGaMeasurementId)).toBe(syntheticId);
        await expect(page.getByRole("button", { name: "Reject", exact: true })).toBeVisible();
        expect(await page.evaluate(() => localStorage.getItem("lab_lords_cookie_consent_v2"))).toBeNull();

        counters.phase = "direct-invite-after-unknown-public";
        await openPrivate(page, invitePath, "Invite not found");
        await openPublic("public-after-unknown-invite");

        counters.phase = "public-rejected";
        await page.getByRole("button", { name: "Reject", exact: true }).click();
        expect(await page.evaluate(() => localStorage.getItem("lab_lords_cookie_consent_v2"))).toBe("rejected");
        counters.phase = "direct-invite-rejected";
        await openPrivate(page, invitePath, "Invite not found");
        await openPublic("public-after-rejected-invite");
        await page.getByRole("button", { name: "Cookie settings", exact: true }).click();
        counters.phase = "public-accepted";
        await page.getByRole("button", { name: "Accept analytics", exact: true }).click();
        expect(await page.evaluate(() => localStorage.getItem("lab_lords_cookie_consent_v2"))).toBe("accepted");

        // These are full-document transitions. They test real private route
        // bootstrapping/referrer behavior, not GA stream history settings.
        counters.phase = "direct-return-url-accepted";
        await openPrivate(page, encodedReturnPath, "");
        await openPublic("public-after-return-url");
        await expect.poll(() => captured.filter(item => item.kind === "blocked-google"
            && isCollectAttempt(item.url)
            && item.phase === "public-after-return-url").length).toBeGreaterThan(0);
        counters.phase = "direct-invite-accepted";
        await openPrivate(page, invitePath, "Invite not found");
        await openPublic("public-after-accepted-invite");

        // The Google script itself must have loaded; queued app gtag calls do
        // not count as the tag-generated network positive control.
        await expect.poll(() => captured.filter(item => item.kind === "tag-read"
            && new URL(item.url).pathname === "/gtag/js").length).toBeGreaterThan(0);
        await expect.poll(() => captured.filter(item => item.kind === "blocked-google"
            && isCollectAttempt(item.url)).length).toBeGreaterThan(0);
        await expect.poll(() => captured.filter(item => item.kind === "blocked-google"
            && isCollectAttempt(item.url)
            && (item.phase === "public-after-return-url"
                || item.phase === "public-after-accepted-invite")).length).toBeGreaterThan(0);
        expect(responses.length).toBeGreaterThan(0);
        expect(responses.every(status => status === 200)).toBe(true);
        expect(captured.some(item => [item.url, item.body || "", item.referer]
            .some(containsSyntheticInvite))).toBe(false);
        writeFileSync(testInfo.outputPath("synthetic-tag-summary.json"), JSON.stringify({
            tagReads: captured.filter(item => item.kind === "tag-read").length,
            successfulTagResponses: responses.length,
            interceptedCollectAttempts: captured.filter(item => item.kind === "blocked-google"
                && isCollectAttempt(item.url)).length,
            blockedOtherRequests: counters.otherBlocked,
            clerkDevelopmentRequests: counters.clerkReads,
            inviteMarkerAbsentFromCapturedGoogleRequestFields: true,
            consentStates: ["unknown", "rejected", "accepted"],
            navigation: "full-document",
        }, null, 2));
    } finally {
        await context.close();
        // Keep full Google request fields only in this ignored private run path.
        writeFileSync(testInfo.outputPath("synthetic-tag-private-traffic.json"),
            JSON.stringify(captured, null, 2));
    }
});
