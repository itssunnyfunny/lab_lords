import { createHash, randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../app/generated/prisma/client";
import { assertDisposableTestDatabaseTarget } from "../setup/testDatabaseSafety";
import { refreshDevelopmentSession } from "../browser/helpers/development-session";

type Fixture = {
    databaseName: string;
    orgId: string;
    branchId: string;
    ownerId: string;
};
type DraftItem = {
    studentId: string;
    studentName: string;
    phone: string | null;
    dueDate: string;
    amount: number;
    daysOverdue: number;
    paymentCount: number;
    message: string;
    isOutdated?: boolean;
};
type DraftResponse = { items: DraftItem[]; meta: { generatedCount: number } };

const fixture = JSON.parse(readFileSync(".clerk/dashboard-fixture.json", "utf8")) as Fixture;
const target = assertDisposableTestDatabaseTarget(process.env.TEST_DATABASE_URL, process.env);
if (target.databaseName !== "lab_lords_dashboard_closeout_browser_test"
    || fixture.databaseName !== target.databaseName
    || target.hostname !== "127.0.0.1" || target.port !== "59117") {
    throw new Error("IM-04 requires the exact retained loopback synthetic browser fixture");
}
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.TEST_DATABASE_URL! }) });
const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3117";
const draftsPath = `/api/ai/branch/${fixture.branchId}/messages`;

function assertAuditOutput(testInfo: TestInfo) {
    const root = path.resolve(".clerk", "audit-browser-runs");
    if (!path.resolve(testInfo.outputDir).startsWith(`${root}${path.sep}`)) {
        throw new Error("IM-04 output must use an ignored, unique audit browser directory");
    }
}

async function scopedCounts() {
    const branchId = fixture.branchId;
    const [students, payments, drafts, reports, leases, auditLogs, events] = await Promise.all([
        db.student.count({ where: { branchId } }),
        db.payment.count({ where: { branchId } }),
        db.messageDraft.count({ where: { branchId } }),
        db.branchAIReport.count({ where: { branchId } }),
        db.branchGenerationLease.count({ where: { branchId } }),
        db.auditLog.count({ where: { branchId } }),
        db.dashboardEvent.count({ where: { branchId } }),
    ]);
    return { students, payments, drafts, reports, leases, auditLogs, events };
}

async function authenticatedGet(page: Page, requestPath: string) {
    let token: string | null;
    try {
        token = await page.evaluate(async () => {
            const clerk = (window as unknown as {
                Clerk?: { session?: { getToken(options: { skipCache: boolean }): Promise<string | null> } };
            }).Clerk;
            return clerk?.session?.getToken({ skipCache: true }) ?? null;
        });
    } catch {
        throw new Error(`Authenticated GET ${requestPath} could not read the local Clerk session`);
    }
    if (!token) throw new Error(`Authenticated GET ${requestPath} has no real Clerk session`);
    try {
        return await page.request.fetch(requestPath, {
            headers: { Authorization: `Bearer ${token}` }, timeout: 30_000,
        });
    } catch {
        // Playwright's transport error can include the Authorization header.
        throw new Error(`Authenticated GET ${requestPath} failed at the local transport`);
    }
}

async function getDraft(page: Page, studentId: string) {
    const response = await authenticatedGet(page, draftsPath);
    expect(response.status()).toBe(200);
    const body = await response.json() as DraftResponse;
    expect(body.meta.generatedCount).toBe(0);
    const item = body.items.find(candidate => candidate.studentId === studentId);
    expect(item).toBeDefined();
    return item!;
}

test.afterAll(async () => { await db.$disconnect(); });

test("IM-04 cached draft review and copy stop when its real overdue source changes", async ({ page }, testInfo) => {
    assertAuditOutput(testInfo);
    const identity = await db.$queryRaw<Array<{ name: string }>>`SELECT current_database() AS name`;
    expect(identity[0]?.name).toBe(target.databaseName);
    expect(await db.dashboardEvent.count({ where: {
        branchId: fixture.branchId, kind: "CONFIGURATION", detail: "Synthetic expected-attendance schedule configured",
    } })).toBe(1);
    expect(await db.organization.count({ where: { id: fixture.orgId, ownerId: fixture.ownerId } })).toBe(1);
    const trial = await db.ownerTrialGrant.findUnique({ where: { ownerId: fixture.ownerId } });
    if (trial?.status !== "ACTIVE" || !trial.trialEndsAt || trial.trialEndsAt.getTime() <= Date.now()) {
        throw new Error("The exact synthetic owner's Standard trial is not active");
    }
    const branchBefore = await db.branch.findUniqueOrThrow({ where: { id: fixture.branchId }, select: {
        aiEnabled: true, aiStatus: true, aiLastCalledAt: true, lastDataChange: true,
        defaultMessageLanguage: true, reminderTone: true, billingStatus: true,
    } });
    expect(branchBefore.aiEnabled).toBe(false);
    expect(branchBefore.defaultMessageLanguage).toBe("en");
    expect(branchBefore.reminderTone).toBe("polite");
    const before = await scopedCounts();
    const suffix = randomUUID().slice(0, 12);
    const studentId = `audit-im04-${suffix}-student`;
    const paymentId = `audit-im04-${suffix}-fee`;
    const draftId = `audit-im04-${suffix}-draft`;
    const studentName = `Draft Review Sample ${suffix}`;
    const message = `Hi ${studentName}, your synthetic fee is pending. Please review it at the desk.`;
    const periodStart = new Date(Date.now() - 70 * 86_400_000);
    const dueDate = new Date(Date.now() - 40 * 86_400_000);
    const blockedMethods: string[] = [];
    const providerRequests: string[] = [];
    page.on("request", request => {
        if (new URL(request.url()).pathname === draftsPath && request.method() !== "GET") {
            blockedMethods.push(request.method());
        }
        if (/(?:api\.razorpay\.com|checkout\.razorpay\.com|graph\.facebook\.com|generativelanguage\.googleapis\.com)/.test(request.url())) {
            providerRequests.push(new URL(request.url()).hostname);
        }
    });
    await page.route(/(?:api\.razorpay\.com|checkout\.razorpay\.com|graph\.facebook\.com|generativelanguage\.googleapis\.com)/,
        route => route.abort("blockedbyclient"));

    try {
        await refreshDevelopmentSession(page);
        const profile = await authenticatedGet(page, "/api/users/me");
        expect(profile.status()).toBe(200);
        expect((await profile.json() as { id: string }).id).toBe(fixture.ownerId);
        const accessResponse = await authenticatedGet(page, `/api/branches/${fixture.branchId}/access`);
        expect(accessResponse.status()).toBe(200);
        const access = await accessResponse.json() as { isOwner: boolean; entitlements: string[] };
        expect(access.isOwner).toBe(true);
        expect(access.entitlements).toContain("AI_ACCESS");

        await db.$transaction(async tx => {
            await tx.branch.update({ where: { id: fixture.branchId }, data: { aiEnabled: true } });
            await tx.student.create({ data: { id: studentId, branchId: fixture.branchId, name: studentName, monthlyFee: 1200 } });
            await tx.payment.create({ data: {
                id: paymentId, branchId: fixture.branchId, studentId, amount: 1200,
                status: "DUE", type: "MONTHLY", periodStart, periodEnd: dueDate, dueDate,
            } });
        });
        const targetBeforeDraft = await getDraft(page, studentId);
        expect(targetBeforeDraft).toMatchObject({ studentName, amount: 1200, paymentCount: 1, message: "" });
        expect(targetBeforeDraft.daysOverdue).toBeGreaterThan(7);
        const student = await db.student.findUniqueOrThrow({ where: { id: studentId }, select: { updatedAt: true } });
        const fingerprint = createHash("sha256").update(JSON.stringify([
            1, fixture.branchId, studentId, student.updatedAt.toISOString(),
            [[paymentId, studentName, null, targetBeforeDraft.dueDate, 1200, targetBeforeDraft.daysOverdue]],
        ])).digest("hex");
        await db.messageDraft.create({ data: {
            id: draftId, branchId: fixture.branchId, studentId,
            action: `FOLLOW_UP_OVERDUE_PAYMENTS:SOURCE_V1:${fingerprint}`,
            language: "en", message,
        } });

        expect(await getDraft(page, studentId)).toMatchObject({
            amount: 1200, message, isOutdated: false,
        });
        await page.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin: new URL(baseURL).origin });
        const navigation = await page.goto(`/branch/${fixture.branchId}/ai/messages`, { waitUntil: "domcontentloaded" });
        expect(navigation?.status()).toBe(200);
        const card = page.locator("article").filter({ hasText: studentName });
        await expect(card).toBeVisible();
        await expect(card).toContainText(message);
        const copy = card.getByRole("button", { name: "Copy", exact: true });
        await expect(copy).toBeEnabled();
        await copy.click();
        await expect(card.getByRole("button", { name: "Copied", exact: true })).toBeVisible();
        expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(message);
        await page.screenshot({ path: testInfo.outputPath("im04-current.png") });

        await db.payment.update({ where: { id: paymentId }, data: { amount: 1700 } });
        expect(await getDraft(page, studentId)).toMatchObject({
            amount: 1700, message: "", isOutdated: true,
        });
        expect((await db.messageDraft.findUniqueOrThrow({ where: { id: draftId } })).message).toBe(message);
        await page.evaluate(() => navigator.clipboard.writeText("synthetic-clipboard-sentinel"));
        await page.getByRole("button", { name: "Refresh", exact: true }).click();
        await expect(card.getByText("The debt changed. Regenerate this draft before copying.")).toBeVisible();
        await expect(card.getByRole("button", { name: "Copy", exact: true })).toBeDisabled();
        await card.getByText("The debt changed. Regenerate this draft before copying.").dblclick();
        expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("synthetic-clipboard-sentinel");
        await page.reload({ waitUntil: "domcontentloaded" });
        await expect(card.getByRole("button", { name: "Copy", exact: true })).toBeDisabled();
        await expect(card).not.toContainText(message);
        await page.screenshot({ path: testInfo.outputPath("im04-outdated.png") });
        expect(blockedMethods).toEqual([]);
        expect(providerRequests).toEqual([]);
    } finally {
        await db.$transaction(async tx => {
            await tx.messageDraft.deleteMany({ where: { id: draftId, branchId: fixture.branchId, studentId } });
            await tx.payment.deleteMany({ where: { id: paymentId, branchId: fixture.branchId, studentId } });
            await tx.student.deleteMany({ where: { id: studentId, branchId: fixture.branchId } });
            await tx.branch.update({ where: { id: fixture.branchId }, data: branchBefore });
        });
        const after = await scopedCounts();
        const branchAfter = await db.branch.findUniqueOrThrow({ where: { id: fixture.branchId }, select: {
            aiEnabled: true, aiStatus: true, aiLastCalledAt: true, lastDataChange: true,
            defaultMessageLanguage: true, reminderTone: true, billingStatus: true,
        } });
        writeFileSync(testInfo.outputPath("im04-scoped-counts.json"), JSON.stringify({ before, after,
            branchMetadataRestored: JSON.stringify(branchAfter) === JSON.stringify(branchBefore),
            providerRequestCount: providerRequests.length, generationRequestCount: blockedMethods.length,
        }, null, 2));
        expect(after).toEqual(before);
        expect(branchAfter).toEqual(branchBefore);
    }
});
