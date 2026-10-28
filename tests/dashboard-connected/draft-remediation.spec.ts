import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../app/generated/prisma/client";
import { assertDisposableTestDatabaseTarget } from "../setup/testDatabaseSafety";
import { refreshDevelopmentSession } from "../browser/helpers/development-session";

const fixture = JSON.parse(readFileSync(".clerk/dashboard-fixture.json", "utf8")) as {
    databaseName: string; branchId: string; ownerId: string;
};
const target = assertDisposableTestDatabaseTarget(process.env.TEST_DATABASE_URL, process.env);
if (!["lab_lords_dashboard_closeout_browser_test", "lab_lords_audit_20261025_browser_test", "lab_lords_audit_20261025r2_browser_test"].includes(target.databaseName) || fixture.databaseName !== target.databaseName
    || target.hostname !== "127.0.0.1" || target.port !== "59117") throw new Error("Retirement requires the exact local synthetic fixture");
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.TEST_DATABASE_URL! }) });
async function request(page: Page, path: string, method: string) {
    const token = await page.evaluate(async () => {
        const clerk = (window as unknown as { Clerk: { session: { getToken(options: { skipCache: boolean }): Promise<string> } } }).Clerk;
        return clerk.session.getToken({ skipCache: true });
    });
    if (!token) throw new Error("Real development session is unavailable");
    try { return await page.request.fetch(path, { method, headers: { Authorization: `Bearer ${token}` } }); }
    catch { throw new Error(`Local retired API ${method} failed before a response; credentials suppressed`); }
}
test.afterAll(() => db.$disconnect());
test("retired AI Messages return 410, retain historical drafts and lead bookmarks to follow-ups", async ({ page }) => {
    const identity = await db.$queryRaw<Array<{ name: string }>>`SELECT current_database() AS name`;
    expect(identity[0]?.name).toBe(target.databaseName);
    expect(await db.organization.count({ where: { branches: { some: { id: fixture.branchId } }, ownerId: fixture.ownerId } })).toBe(1);
    const branchBefore = await db.branch.findUniqueOrThrow({ where: { id: fixture.branchId } });
    const reportsBefore = await db.branchAIReport.findMany({ where: { branchId: fixture.branchId } });
    const leasesBefore = await db.branchGenerationLease.findMany({ where: { branchId: fixture.branchId } });
    const id = `retired-browser-${randomUUID()}`;
    const student = await db.student.create({ data: { id, branchId: fixture.branchId, name: "Synthetic historical draft", monthlyFee: 100 } });
    const draft = await db.messageDraft.create({ data: { branchId: fixture.branchId, studentId: student.id, action: "HISTORICAL", language: "en", message: "Retained historical text" } });
    const providerRequests: string[] = [];
    const domains = /(?:api\.razorpay\.com|checkout\.razorpay\.com|graph\.facebook\.com|generativelanguage\.googleapis\.com)/;
    page.on("request", req => { if (domains.test(req.url())) providerRequests.push(new URL(req.url()).hostname); });
    await page.route(domains, route => route.abort("blockedbyclient"));
    try {
        await refreshDevelopmentSession(page);
        for (const method of ["GET", "POST"]) {
            const response = await request(page, `/api/ai/branch/${fixture.branchId}/messages`, method);
            expect(response.status()).toBe(410);
            expect(await response.json()).toMatchObject({ code: "AI_MESSAGES_RETIRED" });
        }
        await page.goto(`/branch/${fixture.branchId}/ai/messages`, { waitUntil: "domcontentloaded" });
        await expect(page).toHaveURL(new RegExp(`/branch/${fixture.branchId}/follow-ups`));
        await expect(page.getByRole("main")).toBeVisible();
        expect(await db.messageDraft.findUniqueOrThrow({ where: { id: draft.id } })).toEqual(draft);
        expect(await db.branchAIReport.findMany({ where: { branchId: fixture.branchId } })).toEqual(reportsBefore);
        expect(await db.branchGenerationLease.findMany({ where: { branchId: fixture.branchId } })).toEqual(leasesBefore);
        expect(await db.branch.findUniqueOrThrow({ where: { id: fixture.branchId } })).toEqual(branchBefore);
        expect(providerRequests).toEqual([]);
    } finally {
        await db.messageDraft.delete({ where: { id: draft.id } });
        await db.student.delete({ where: { id: student.id } });
    }
});
