import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test, type CDPSession, type Page } from "@playwright/test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../app/generated/prisma/client";
import { assertDisposableTestDatabaseTarget } from "../setup/testDatabaseSafety";
import { refreshDevelopmentSession } from "../browser/helpers/development-session";

type Fixture = {
    databaseName: string;
    branchId: string;
    otherBranchId: string;
    ownerId: string;
    staffId: string;
    students: { id: string; name: string }[];
    month: string;
};
type PausedResponse = {
    requestId: string;
    request: { url: string };
    responseStatusCode?: number;
};

const fixture = JSON.parse(readFileSync(".clerk/dashboard-fixture.json", "utf8")) as Fixture;
const target = assertDisposableTestDatabaseTarget(process.env.TEST_DATABASE_URL, process.env);
if (target.databaseName !== fixture.databaseName || !target.databaseName.includes("browser_test")) {
    throw new Error("Connected finance fixture/database mismatch");
}
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.TEST_DATABASE_URL! }) });
const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3117";
const paymentPath = `/api/branches/${fixture.branchId}/payments`;
const analyticsPath = `/api/analytics/branch/${fixture.branchId}`;

async function blockBusinessProviders(page: Page) {
    await page.route(/(?:api\.razorpay\.com|checkout\.razorpay\.com|graph\.facebook\.com|generativelanguage\.googleapis\.com)/,
        route => route.abort("blockedbyclient"));
}

async function request(page: Page, path: string) {
    const token = await page.evaluate(async () => {
        const clerk = (window as unknown as { Clerk?: { session?: { getToken(options: { skipCache: boolean }): Promise<string | null> } } }).Clerk;
        return clerk?.session?.getToken({ skipCache: true }) ?? null;
    });
    if (!token) throw new Error("Existing development session is unavailable");
    try {
        return await page.request.fetch(path, { headers: { Authorization: `Bearer ${token}` }, timeout: 30_000 });
    } catch {
        // Playwright's raw request error includes all request headers. Keep
        // Clerk bearer and cookie values out of CLI, JSON and error artifacts.
        throw new Error(`Authenticated GET ${new URL(path, baseURL).pathname} did not complete`);
    }
}

async function open(page: Page, path: string) {
    const response = await page.goto(path, { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBe(200);
    await page.waitForFunction(() => {
        const clerk = (window as unknown as { Clerk?: { loaded?: boolean; user?: unknown; session?: unknown } }).Clerk;
        return Boolean(clerk?.loaded && clerk.user && clerk.session);
    });
}

/** Pause completed localhost responses at the Chromium transport layer. No
 * application response is fulfilled or replaced by the test. */
async function holdRealResponses(page: Page, path: string, match: (url: URL) => boolean) {
    const session: CDPSession = await page.context().newCDPSession(page);
    const held = new Map<string, PausedResponse>();
    const errors: unknown[] = [];
    const onPaused = (event: PausedResponse) => {
        let shouldHold = false;
        try { shouldHold = event.responseStatusCode !== undefined && match(new URL(event.request.url)); }
        catch (error) { errors.push(error); }
        if (shouldHold) {
            held.set(event.requestId, event);
        } else {
            void session.send(event.responseStatusCode === undefined ? "Fetch.continueRequest" : "Fetch.continueResponse",
                { requestId: event.requestId }).catch(error => { errors.push(error); });
        }
    };
    session.on("Fetch.requestPaused", onPaused);
    await session.send("Fetch.enable", { patterns: [{ urlPattern: `*${new URL(baseURL).host}${path}*`, requestStage: "Response" }] });
    return {
        held,
        errors,
        async next() {
            await expect.poll(() => held.size, { timeout: 30_000 }).toBeGreaterThan(0);
            const response = held.values().next().value;
            if (!response) throw new Error("Expected completed local response was not paused");
            expect(response.responseStatusCode).toBe(200);
            return response;
        },
        async release(response: PausedResponse) {
            held.delete(response.requestId);
            await session.send("Fetch.continueResponse", { requestId: response.requestId });
        },
        async interrupt(response: PausedResponse) {
            held.delete(response.requestId);
            await session.send("Fetch.failRequest", { requestId: response.requestId, errorReason: "ConnectionClosed" });
        },
        async close() {
            for (const response of held.values()) {
                try { await session.send("Fetch.continueResponse", { requestId: response.requestId }); }
                catch (error) { errors.push(error); }
            }
            held.clear();
            try { await session.send("Fetch.disable"); } finally { await session.detach(); }
            expect(errors).toEqual([]);
        },
    };
}

const paymentQuery = (url: URL) => url.pathname === paymentPath;
const activeDueQuery = (url: URL) => paymentQuery(url)
    && url.searchParams.get("status") === "DUE"
    && url.searchParams.get("month") === fixture.month
    && url.searchParams.get("limit") === "50"
    && !url.searchParams.has("cursor");
const visibleSyntheticPayments = (page: Page, prefix: string) =>
    page.locator(`[id^="payment-table-${prefix}"], [id^="payment-grid-${prefix}"]`).filter({ visible: true });
const currency = (amount: number) => new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 0,
}).format(amount);

test.beforeAll(async () => {
    const identity = await db.$queryRaw<Array<{ name: string }>>`SELECT current_database() AS name`;
    expect(identity[0]?.name).toBe(target.databaseName);
    expect(await db.user.count({ where: { id: fixture.ownerId } })).toBe(1);
    expect(await db.user.count({ where: { id: fixture.staffId } })).toBe(1);
    expect(await db.staff.count({ where: { userId: fixture.staffId, branchId: fixture.branchId } })).toBe(1);
    expect(await db.staff.count({ where: { userId: fixture.staffId, branchId: fixture.otherBranchId } })).toBe(0);
    expect(await db.payment.count({ where: { id: "dashboard-payment-0", branchId: fixture.branchId } })).toBe(1);
});
test.afterAll(async () => { await db.$disconnect(); });
test.beforeEach(async ({ page }) => {
    await blockBusinessProviders(page);
    await refreshDevelopmentSession(page);
    const profile = await request(page, "/api/users/me");
    expect(profile.status()).toBe(200);
    expect((await profile.json()).id).toBe(fixture.ownerId);
});

test("MONEY-01: restricted staff keeps operational analytics but loses all finance after a persisted permission transition", async ({ browser }) => {
    test.setTimeout(300_000);
    const membership = await db.staff.findUniqueOrThrow({
        where: { userId_branchId: { userId: fixture.staffId, branchId: fixture.branchId } },
    });
    const key = { staffId_action: { staffId: membership.id, action: "ANALYTICS" as const } };
    const analyticsBefore = await db.staffPermissionOverride.findUnique({ where: key });
    const paymentsBefore = await db.staffPermissionOverride.findUnique({
        where: { staffId_action: { staffId: membership.id, action: "VIEW_PAYMENTS" } },
    });
    expect(paymentsBefore?.allowed).toBe(false);
    const overridesBefore = await db.staffPermissionOverride.count({ where: { staffId: membership.id } });
    const staffContext = await browser.newContext({ baseURL, storageState: process.env.PLAYWRIGHT_STAFF_AUTH_STATE,
        viewport: { width: test.info().project.name === "mobile" ? 390 : 1491, height: test.info().project.name === "mobile" ? 844 : 1055 } });
    try {
        // The branch and staff identities are fixed synthetic fixture IDs. The
        // temporary grant proves that the same page first had finance to clear.
        await db.staffPermissionOverride.upsert({ where: key,
            create: { staffId: membership.id, action: "ANALYTICS", allowed: true }, update: { allowed: true } });
        await db.staffPermissionOverride.update({ where: { id: paymentsBefore!.id }, data: { allowed: true } });
        const staff = await staffContext.newPage();
        await blockBusinessProviders(staff);
        await refreshDevelopmentSession(staff);
        expect((await (await request(staff, "/api/users/me")).json()).id).toBe(fixture.staffId);
        await open(staff, `/branch/${fixture.branchId}/analytics`);
        await expect(staff.getByRole("heading", { name: "Analytics & Trends" })).toBeVisible();
        await expect(staff.getByText("Collected Revenue", { exact: true })).toBeVisible();
        await expect(staff.getByText("Billable Revenue", { exact: true })).toBeVisible();

        await db.staffPermissionOverride.update({ where: { id: paymentsBefore!.id }, data: { allowed: false } });
        const access = await request(staff, `/api/branches/${fixture.branchId}/access`);
        expect(access.status()).toBe(200);
        expect((await access.json()).permissions).toMatchObject({ analytics: true, view_payments: false });
        const snapshot = await request(staff, `${analyticsPath}/snapshot?period=month`);
        expect(snapshot.status()).toBe(200);
        const body = await snapshot.json();
        expect(body).toMatchObject({ financialAccess: false, activeStudents: 8 });
        for (const key of ["monthlyRevenue", "dueAmount", "paidAmount", "collectionRate", "payments", "paymentCount", "overdueCount", "healthScore"]) {
            expect(body).not.toHaveProperty(key);
        }
        expect((await request(staff, `${analyticsPath}/trends?type=payment&period=month&from=${fixture.month}-01&to=${fixture.month}-03`)).status()).toBe(403);
        expect((await request(staff, `${analyticsPath}/trends?type=seat&from=${fixture.month}-01&to=${fixture.month}-03`)).status()).toBe(200);
        expect((await request(staff, `${paymentPath}?status=DUE&month=${fixture.month}&limit=1`)).status()).toBe(403);
        const dashboard = await request(staff, `/api/branches/${fixture.branchId}/dashboard`);
        expect(dashboard.status()).toBe(200);
        const dashboardBody = await dashboard.json();
        expect(dashboardBody).toMatchObject({ money: { status: "restricted", data: null },
            collections: { status: "restricted", data: null }, students: { status: "success" } });
        expect(dashboardBody.activity.every((item: { kind: string; amount?: number }) =>
            item.kind !== "COLLECTION" && item.amount === undefined)).toBe(true);

        const gate = await holdRealResponses(staff, `${analyticsPath}/snapshot`, url => url.pathname === `${analyticsPath}/snapshot`);
        try {
            await staff.getByRole("button", { name: "Refresh", exact: true }).click();
            const deniedResponse = await gate.next();
            await expect(staff.getByText("Collected Revenue", { exact: true })).toHaveCount(0);
            await expect(staff.getByText("Billable Revenue", { exact: true })).toHaveCount(0);
            await gate.release(deniedResponse);
            await expect(staff.getByText("Active Students", { exact: true })).toBeVisible();
            await expect(staff.getByText("Total Utilization", { exact: true })).toBeVisible();
            await expect(staff.getByText("Collected Revenue", { exact: true })).toHaveCount(0);
            await expect(staff.getByText("Billable Revenue", { exact: true })).toHaveCount(0);
            await expect(staff.getByRole("group", { name: "Chart metric" }).getByRole("button", { name: "Utilization" })).toBeVisible();
            await expect(staff.locator("[data-record-list], main").first()).not.toContainText("₹");
        } finally { await gate.close(); }
        await staff.reload();
        await expect(staff.getByText("Active Students", { exact: true })).toBeVisible();
        await expect(staff.getByText("Collected Revenue", { exact: true })).toHaveCount(0);
        // This same organization has a second owner branch, but this staff
        // identity has no membership there. A branch transition must not carry
        // the first branch's operational or formerly visible finance panel.
        await open(staff, `/branch/${fixture.otherBranchId}/analytics`);
        await expect(staff.getByRole("heading", { name: "No access", exact: true })).toBeVisible();
        await expect(staff.getByText("Collected Revenue", { exact: true })).toHaveCount(0);
        await expect(staff.locator("main")).not.toContainText("₹");
        expect((await request(staff, `/api/branches/${fixture.otherBranchId}/access`)).status()).toBe(404);
        expect((await request(staff, `/api/analytics/branch/${fixture.otherBranchId}/snapshot?period=month`)).status()).toBe(404);
        await open(staff, `/branch/${fixture.branchId}/analytics`);
        await expect(staff.getByText("Active Students", { exact: true })).toBeVisible();
        await expect(staff.getByText("Collected Revenue", { exact: true })).toHaveCount(0);
    } finally {
        try {
            await db.staffPermissionOverride.update({ where: { id: paymentsBefore!.id }, data: { allowed: paymentsBefore!.allowed } });
            if (analyticsBefore) await db.staffPermissionOverride.update({ where: { id: analyticsBefore.id }, data: { allowed: analyticsBefore.allowed } });
            else await db.staffPermissionOverride.deleteMany({ where: { staffId: membership.id, action: "ANALYTICS" } });
            expect(await db.staffPermissionOverride.count({ where: { staffId: membership.id } })).toBe(overridesBefore);
        } finally { await staffContext.close(); }
    }
});

test("MONEY-02/03: owner sees real daily cutoffs and the retained partial-receipt ledger", async ({ page }) => {
    test.setTimeout(300_000);
    const fee = await db.payment.findUniqueOrThrow({ where: { id: "dashboard-payment-0" } });
    expect(fee).toMatchObject({ branchId: fixture.branchId, studentId: fixture.students[0].id,
        ledgerBacked: true, status: "DUE", amount: 1200, collectedAmount: 700, waivedAmount: 0 });
    const receiptsBefore = await db.feeCollection.count({ where: { branchId: fixture.branchId, studentId: fee.studentId } });
    const paymentsBefore = await db.payment.count({ where: { branchId: fixture.branchId } });
    await open(page, `/branch/${fixture.branchId}/analytics`);
    await expect(page.getByText("Billable Revenue", { exact: true })).toBeVisible();
    const beforeResponse = await request(page, `${analyticsPath}/snapshot?period=month`);
    expect(beforeResponse.status()).toBe(200);
    const before = await beforeResponse.json() as { monthlyRevenue: number; paidAmount: number; dueAmount: number };
    await expect(page.getByText("Billable Revenue", { exact: true }).locator("..").locator("h3"))
        .toHaveText(currency(before.monthlyRevenue));
    await expect(page.getByText("Collected Revenue", { exact: true }).locator("..").locator("h2"))
        .toHaveText(currency(before.paidAmount));

    const trendResponse = page.waitForResponse(response => {
        const url = new URL(response.url());
        return url.pathname === `${analyticsPath}/trends` && url.searchParams.get("type") === "payment"
            && url.searchParams.get("period") === "month" && response.status() === 200;
    });
    await page.getByRole("group", { name: "Chart metric" }).getByRole("button", { name: "Collected", exact: true }).click();
    const points = await (await trendResponse).json() as { date: string; value: number; category: string }[];
    const collected = points.filter(point => point.category === "Collected");
    expect(collected.length).toBeGreaterThan(1);
    expect(collected.at(-1)!.value).toBeGreaterThan(collected[0].value);
    await expect(page.getByText("Collected Trend", { exact: true })).toBeVisible();

    await open(page, `/branch/${fixture.branchId}/payments`);
    const record = page.locator(`[id="payment-table-${fee.id}"], [id="payment-grid-${fee.id}"]`).filter({ visible: true });
    await expect(record).toBeVisible();
    await expect(record).toContainText("Collected ₹700");
    await expect(record).toContainText("Waived ₹0");
    await expect(record).toContainText("Remaining ₹500");
    expect(await db.feeCollection.count({ where: { branchId: fixture.branchId, studentId: fee.studentId } })).toBe(receiptsBefore);
    expect(await db.payment.count({ where: { branchId: fixture.branchId } })).toBe(paymentsBefore);
});

test("MONEY-04: real reordered tab/month/page responses cannot replace current rows; interrupted refresh retries", async ({ page }) => {
    test.setTimeout(300_000);
    const prefix = `audit-money04-${randomUUID()}`;
    const beforeStudents = await db.student.count({ where: { branchId: fixture.branchId } });
    const beforePayments = await db.payment.count({ where: { branchId: fixture.branchId } });
    const firstOfMonth = new Date(`${fixture.month}-01T00:00:00.000Z`);
    const priorMonth = new Date(firstOfMonth);
    priorMonth.setUTCMonth(priorMonth.getUTCMonth() - 1);
    const ids = Array.from({ length: 52 }, (_, index) => ({
        studentId: `${prefix}-student-${String(index).padStart(2, "0")}`,
        paymentId: `${prefix}-payment-${String(index).padStart(2, "0")}`,
        dueDate: new Date(firstOfMonth.getTime() + index * 60_000),
    }));
    try {
        // Each payment has its own synthetic student and a valid monthly period.
        // These records exist only for the cursor UI and are removed in finally.
        await db.$transaction(async tx => {
            await tx.student.createMany({ data: ids.map((item, index) => ({ id: item.studentId,
                branchId: fixture.branchId, name: `Audit pagination student ${String(index).padStart(2, "0")}`,
                monthlyFee: 100, status: "ACTIVE" as const })) });
            await tx.payment.createMany({ data: ids.map(item => ({ id: item.paymentId,
                branchId: fixture.branchId, studentId: item.studentId, status: "DUE" as const,
                type: "MONTHLY" as const, periodStart: priorMonth, periodEnd: item.dueDate,
                dueDate: item.dueDate, amount: 100 })) });
        });
        expect(await db.student.count({ where: { branchId: fixture.branchId } })).toBe(beforeStudents + 52);
        expect(await db.payment.count({ where: { branchId: fixture.branchId } })).toBe(beforePayments + 52);

        const staleTab = await holdRealResponses(page, paymentPath, activeDueQuery);
        try {
            await open(page, `/branch/${fixture.branchId}/payments`);
            const oldDue = await staleTab.next();
            await page.getByRole("button", { name: /^Paid\b/ }).click();
            await expect(page.getByRole("button", { name: /^Paid\b/ })).toHaveAttribute("aria-current", "page");
            await expect(page.locator('[data-record-list] [aria-busy="true"]')).toHaveCount(0);
            const completed = page.waitForEvent("requestfinished", { predicate: request => request.url() === oldDue.request.url });
            await staleTab.release(oldDue);
            await completed;
            await expect(visibleSyntheticPayments(page, prefix)).toHaveCount(0);
            await expect(page.getByRole("button", { name: /^Paid\b/ })).toHaveAttribute("aria-current", "page");
        } finally { await staleTab.close(); }

        const staleMonth = await holdRealResponses(page, paymentPath, activeDueQuery);
        try {
            await open(page, `/branch/${fixture.branchId}/payments`);
            const oldMonth = await staleMonth.next();
            await page.getByRole("button", { name: "Previous month" }).click();
            await expect(page.locator('[data-record-list] [aria-busy="true"]')).toHaveCount(0);
            const completed = page.waitForEvent("requestfinished", { predicate: request => request.url() === oldMonth.request.url });
            await staleMonth.release(oldMonth);
            await completed;
            await expect(visibleSyntheticPayments(page, prefix)).toHaveCount(0);
        } finally { await staleMonth.close(); }

        await open(page, `/branch/${fixture.branchId}/payments`);
        const firstPage = await request(page, `${paymentPath}?status=DUE&month=${fixture.month}&limit=50`);
        expect(firstPage.status()).toBe(200);
        const total = (await firstPage.json() as { total: number }).total;
        expect(total).toBeGreaterThan(50);
        await expect(page.locator("#payments-pagination-status")).toContainText(`Showing 50 of ${total} due payments`);
        const staleAppend = await holdRealResponses(page, paymentPath, url => paymentQuery(url)
            && url.searchParams.get("status") === "DUE" && url.searchParams.has("cursor"));
        try {
            await page.getByRole("button", { name: "Load more payments" }).click();
            const oldPage = await staleAppend.next();
            await page.getByRole("button", { name: /^Paid\b/ }).click();
            await expect(page.locator('[data-record-list] [aria-busy="true"]')).toHaveCount(0);
            const completed = page.waitForEvent("requestfinished", { predicate: request => request.url() === oldPage.request.url });
            await staleAppend.release(oldPage);
            await completed;
            await expect(visibleSyntheticPayments(page, prefix)).toHaveCount(0);
            await expect(page.getByRole("button", { name: /^Paid\b/ })).toHaveAttribute("aria-current", "page");
        } finally { await staleAppend.close(); }
        await page.getByRole("button", { name: /^Due\b/ }).click();
        await expect(page.locator("#payments-pagination-status")).toContainText(`Showing 50 of ${total} due payments`);
        await page.getByRole("button", { name: "Load more payments" }).click();
        await expect(page.locator("#payments-pagination-status")).toContainText(`Showing ${total} of ${total} due payments`);
        await expect(page.getByRole("button", { name: "Load more payments" })).toHaveCount(0);

        const interruptedRefresh = await holdRealResponses(page, paymentPath, activeDueQuery);
        try {
            await page.evaluate(() => window.dispatchEvent(new Event("focus")));
            const completedOnServer = await interruptedRefresh.next();
            const failed = page.waitForEvent("requestfailed", { predicate: request => request.url() === completedOnServer.request.url });
            await interruptedRefresh.interrupt(completedOnServer);
            await failed;
            await expect(page.getByRole("heading", { name: "Something went wrong" })).toBeVisible();
        } finally { await interruptedRefresh.close(); }
        await page.getByRole("button", { name: "Try again" }).click();
        await expect(page.locator("#payments-pagination-status")).toContainText(`Showing 50 of ${total} due payments`);
        await expect(page.getByRole("heading", { name: "Something went wrong" })).toHaveCount(0);
    } finally {
        await db.$transaction(async tx => {
            await tx.payment.deleteMany({ where: { branchId: fixture.branchId, id: { in: ids.map(item => item.paymentId) } } });
            await tx.student.deleteMany({ where: { branchId: fixture.branchId, id: { in: ids.map(item => item.studentId) } } });
        });
        expect(await db.student.count({ where: { branchId: fixture.branchId } })).toBe(beforeStudents);
        expect(await db.payment.count({ where: { branchId: fixture.branchId } })).toBe(beforePayments);
    }
});
