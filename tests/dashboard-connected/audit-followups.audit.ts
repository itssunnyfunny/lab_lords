import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../app/generated/prisma/client";
import { translateOwnedText } from "../../lib/i18n";
import { assertDisposableTestDatabaseTarget } from "../setup/testDatabaseSafety";
import { refreshDevelopmentSession } from "../browser/helpers/development-session";

const fixture = JSON.parse(readFileSync(".clerk/dashboard-fixture.json", "utf8")) as { databaseName: string; orgId: string; ownerId: string };
const target = assertDisposableTestDatabaseTarget(process.env.TEST_DATABASE_URL, process.env);
if (!["lab_lords_audit_20261025_browser_test", "lab_lords_audit_20261025r2_browser_test"].includes(target.databaseName) || fixture.databaseName !== target.databaseName
    || target.hostname !== "127.0.0.1" || target.port !== "59117") throw new Error("Follow-up tests require the new exact synthetic fixture");
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.TEST_DATABASE_URL! }) });
async function request(page: Page, path: string, method = "GET", body?: unknown) {
    return page.evaluate(async ({ path, method, body }) => {
        const clerk = (window as unknown as { Clerk: { session: { getToken(options: { skipCache: boolean }): Promise<string> } } }).Clerk;
        const token = await clerk.session.getToken({ skipCache: true });
        if (!token) throw new Error("Real development session missing");
        const response = await fetch(path, { method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
        return { status: response.status, body: await response.json() };
    }, { path, method, body });
}
async function open(page: Page, path: string) {
    // Each full-document navigation needs a fresh development-session cookie;
    // the long combined journey can cross Clerk's short token boundary.
    await refreshDevelopmentSession(page);
    await page.goto(path, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => Boolean((window as unknown as { Clerk?: { loaded?: boolean; session?: unknown } }).Clerk?.session));
    const dismiss = page.getByRole("button", { name: "Dismiss trial reminder for this session", exact: true });
    if (await dismiss.isVisible()) await dismiss.click();
}
test.afterAll(() => db.$disconnect());
for (const language of ["en", "hi", "hinglish"] as const) {
    test(`durable recovery and membership/billing history in ${language}`, async ({ page }, info) => {
        const t = (key: string, params: Record<string, string> = {}) => translateOwnedText(language, key, params);
        const identity = await db.$queryRaw<Array<{ name: string }>>`SELECT current_database() AS name`;
        expect(identity[0].name).toBe(target.databaseName);
        await page.route(/(?:api\.razorpay\.com|checkout\.razorpay\.com|graph\.facebook\.com|generativelanguage\.googleapis\.com)/, route => route.abort("blockedbyclient"));
        await refreshDevelopmentSession(page);
        const original = await db.user.findUniqueOrThrow({ where: { id: fixture.ownerId }, select: { interfaceLanguage: true } });
        expect((await request(page, "/api/users/me", "PATCH", { interfaceLanguage: language })).status).toBe(200);
        const suffix = randomUUID();
        const branch = await db.branch.create({ data: { organizationId: fixture.orgId, name: `Synthetic audit ${suffix}`, aiEnabled: false } });
        const shifts = await Promise.all([
            db.shift.create({ data: { branchId: branch.id, name: "Audit Morning", startTime: "08:00", endTime: "12:00", price: 600 } }),
            db.shift.create({ data: { branchId: branch.id, name: "Audit Afternoon", startTime: "12:00", endTime: "16:00", price: 900 } }),
        ]);
        const seats = await Promise.all(["A1", "A2"].map(label => db.seat.create({ data: { branchId: branch.id, label } })));
        const student = await db.student.create({ data: { branchId: branch.id, name: `Synthetic move ${suffix}`, monthlyFee: 600 } });
        const invoiceIds = Array.from({ length: 45 }, (_, i) => `audit-invoice-${suffix}-${i}`);
        const historyIds = Array.from({ length: 45 }, (_, i) => `audit-history-${suffix}-${i}`);
        try {
            expect((await request(page, `/api/branches/${branch.id}/seat-allocations`, "POST", { studentId: student.id, seatId: seats[0].id, shiftIds: [shifts[0].id] })).status).toBe(201);
            const source = await db.seatAllocation.findFirstOrThrow({ where: { studentId: student.id, endDate: null } });
            const commands: { key?: string; body: string | null }[] = [];
            await page.route(`**/api/seat-allocations/${source.id}`, async route => {
                if (route.request().method() !== "PATCH") return route.continue();
                commands.push({ key: route.request().headers()["idempotency-key"], body: route.request().postData() });
                if (commands.length === 1) {
                    let committed;
                    try { committed = await route.fetch(); }
                    catch { throw new Error("Synthetic seat-change transport failed; credentials suppressed"); }
                    expect(committed.status()).toBe(200);
                    return route.abort("failed");
                }
                return route.continue();
            });
            await open(page, `/branch/${branch.id}/allocations?changeStudentId=${student.id}`);
            const move = page.getByRole("dialog", { name: t("Change seat or shift"), exact: true });
            await move.getByRole("button", { name: "A2", exact: true }).click();
            await move.getByRole("button", { name: t("Update"), exact: true }).click();
            await expect(move.getByRole("button", { name: t("Check seat change"), exact: true })).toBeVisible();
            expect((await db.seatAllocation.findFirstOrThrow({ where: { studentId: student.id, endDate: null } })).seatId).toBe(seats[1].id);
            await move.getByRole("button", { name: t("Check seat change"), exact: true }).click();
            await expect(move).toHaveCount(0);
            expect(commands).toHaveLength(2); expect(commands[1]).toEqual(commands[0]); expect(commands[0].key).toMatch(/^[a-f0-9-]{36}$/);
            expect(await db.allocationMoveCommand.count({ where: { branchId: branch.id, studentId: student.id } })).toBe(1);
            expect(await db.seatAllocation.count({ where: { studentId: student.id } })).toBe(2);

            // A real admission saves the profile before the first allocation
            // attempt fails. Only that allocation request is simulated as busy.
            let admissionAttempts = 0;
            await page.route(`**/api/branches/${branch.id}/seat-allocations`, route => {
                if (route.request().method() === "POST" && admissionAttempts++ === 0) return route.fulfill({ status: 409, json: { error: "Synthetic occupied seat" } });
                return route.continue();
            });
            await open(page, `/branch/${branch.id}/students?action=add`);
            const admission = page.getByRole("dialog", { name: t("Add new student"), exact: true });
            await admission.locator("#add-student-name").fill(`Synthetic admission ${suffix}`);
            await admission.locator("#add-student-phone").fill("9000000001");
            await admission.getByRole("checkbox", { name: t("Allocate seat now (Optional)") }).check();
            await admission.getByRole("button", { name: /Audit Morning/ }).click();
            await admission.getByRole("checkbox", { name: t("Link monthly fee to {feeLinkLabel} price", { feeLinkLabel: "selected shift" }), exact: true }).check();
            await admission.getByRole("button", { name: "A1", exact: true }).click();
            const failedAllocation = page.waitForResponse(response => response.request().method() === "POST"
                && new URL(response.url()).pathname === `/api/branches/${branch.id}/seat-allocations` && response.status() === 409);
            await admission.getByRole("button", { name: t("Save & Allocate"), exact: true }).click();
            await failedAllocation;
            await expect(admission.getByRole("button", { name: t("Save & Allocate"), exact: true })).toBeEnabled();
            await expect(admission.getByRole("button", { name: /Audit Afternoon/ })).toBeDisabled();
            const saved = await db.student.findFirstOrThrow({ where: { branchId: branch.id, name: `Synthetic admission ${suffix}` } });
            expect(saved).toMatchObject({ feeLinkedShiftId: shifts[0].id, monthlyFee: 600 });
            await admission.getByRole("button", { name: t("Save & Allocate"), exact: true }).click();
            await expect(admission).toHaveCount(0);
            expect(await db.student.count({ where: { branchId: branch.id, name: saved.name } })).toBe(1);
            expect(await db.seatAllocation.findFirstOrThrow({ where: { studentId: saved.id, endDate: null } })).toMatchObject({ shiftId: shifts[0].id, seatId: seats[0].id });

            const termsUrl = `/api/branches/${branch.id}/dashboard/terms`;
            const term = await request(page, termsUrl, "POST", { studentId: student.id, label: "Synthetic annual term", startDate: "2031-01-01", endDate: "2031-12-31" });
            expect(term.status).toBe(200);
            await open(page, `/branch/${branch.id}/dashboard-settings?section=terms&studentId=${student.id}`);
            await page.getByRole("button", { name: t("Manage term"), exact: true }).click();
            let dialog = page.getByRole("dialog", { name: t("Correct term"), exact: true });
            await dialog.getByLabel(t("Start date"), { exact: true }).fill("2031-02-01");
            await dialog.getByLabel(t("Reason for change"), { exact: true }).fill("Synthetic recording correction");
            await dialog.getByRole("button", { name: t("Save change"), exact: true }).click();
            await expect(dialog).toHaveCount(0);
            await page.getByRole("button", { name: t("History"), exact: true }).click();
            dialog = page.getByRole("dialog", { name: t("Membership history"), exact: true });
            await expect(dialog).toContainText("Synthetic recording correction");
            await expect(dialog).toContainText("2031-01-01"); await expect(dialog).toContainText("2031-02-01");
            await page.screenshot({ path: info.outputPath(`membership-${language}.png`) });
            await dialog.getByRole("button", { name: t("Close"), exact: true }).click();
            await page.getByRole("button", { name: t("Manage term"), exact: true }).click();
            dialog = page.getByRole("dialog");
            await dialog.getByRole("combobox", { name: t("Change type"), exact: true }).click();
            await page.getByRole("option", { name: t("Void an erroneous term"), exact: true }).click();
            await dialog.getByLabel(t("Reason for change"), { exact: true }).fill("Synthetic erroneous term");
            await dialog.getByRole("button", { name: t("Save change"), exact: true }).click();
            await expect(dialog).toHaveCount(0);
            const recorded = await db.membershipTerm.findFirstOrThrow({ where: { branchId: branch.id } });
            await page.bringToFront();
            const historyAction = page.getByRole("button", { name: t("History"), exact: true });
            try { await expect(historyAction).toBeFocused(); }
            catch (failure) {
                await info.attach("terminal-focus-state", { contentType: "application/json", body: JSON.stringify(await historyAction.evaluate(button => ({
                    targetDisabled: button.hasAttribute("disabled"), targetInert: Boolean(button.closest("[inert]")),
                    activeTag: document.activeElement?.tagName, activeIsBody: document.activeElement === document.body,
                    activeIsTarget: document.activeElement === button, documentFocused: document.hasFocus(),
                    remainingDialogs: document.querySelectorAll('[data-dialog-overlay="true"]').length,
                }))) });
                throw failure;
            }
            expect(recorded).toMatchObject({ status: "VOIDED", revision: 3 });
            expect(await db.membershipTermRevision.count({ where: { termId: recorded.id } })).toBe(3);
            expect((await request(page, termsUrl, "POST", { studentId: student.id, label: "Synthetic replacement", startDate: "2031-02-01", endDate: "2031-12-31" })).status).toBe(200);

            await db.organizationSubscriptionInvoice.createMany({ data: invoiceIds.map((id, index) => ({ id, organizationId: fixture.orgId, razorpayInvoiceId: `provider_${id}`, status: "paid", amountSubunits: 49900, currency: "INR", providerMode: "TEST" as const, createdAt: new Date(1_750_000_000_000 + index) })) });
            await db.organizationSubscriptionHistory.createMany({ data: historyIds.map((id, index) => ({ id, organizationId: fixture.orgId, razorpaySubscriptionId: `provider_${suffix}`, plan: "PRO" as const, toStatus: "ACTIVE" as const, source: "SYSTEM" as const, amountSubunits: 49900, currency: "INR", createdAt: new Date(1_750_000_000_000 + index) })) });
            await open(page, `/org/${fixture.orgId}/settings`);
            await page.getByRole("button", { name: t("View all invoices and history"), exact: true }).click();
            dialog = page.getByRole("dialog", { name: t("Billing history"), exact: true });
            for (const kind of ["invoices", "history"] as const) {
                if (kind === "history") {
                    const previous = await dialog.locator("[data-billing-record]").first().getAttribute("data-billing-record");
                    await dialog.getByRole("combobox", { name: t("Records"), exact: true }).click();
                    await page.getByRole("option", { name: t("Subscription history"), exact: true }).click();
                    await expect(dialog.locator("[data-billing-record]").first()).not.toHaveAttribute("data-billing-record", previous!);
                }
                const expected = kind === "invoices" ? await db.organizationSubscriptionInvoice.findMany({ where: { organizationId: fixture.orgId }, select: { id: true } }) : await db.organizationSubscriptionHistory.findMany({ where: { organizationId: fixture.orgId }, select: { id: true } });
                const seen: string[] = [];
                for (let pages = 0; pages < 20; pages++) {
                    await expect(dialog.locator("[data-billing-record]").first()).toBeVisible();
                    seen.push(...await dialog.locator("[data-billing-record]").evaluateAll(rows => rows.map(row => row.getAttribute("data-billing-record")!)));
                    const older = dialog.getByRole("button", { name: t("Older records"), exact: true });
                    if (await older.isDisabled()) break;
                    const previous = await dialog.locator("[data-billing-record]").first().getAttribute("data-billing-record");
                    const response = page.waitForResponse(response => response.url().includes(`/billing/${kind}?cursor=`) && response.status() === 200);
                    await older.click(); await response;
                    await expect(dialog.locator("[data-billing-record]").first()).not.toHaveAttribute("data-billing-record", previous!);
                }
                expect(new Set(seen).size).toBe(seen.length);
                expect([...seen].sort()).toEqual(expected.map(row => row.id).sort());
            }
            expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
            await page.screenshot({ path: info.outputPath(`billing-${language}.png`) });
        } finally {
            await db.organizationSubscriptionInvoice.deleteMany({ where: { organizationId: fixture.orgId, id: { in: invoiceIds } } });
            await db.organizationSubscriptionHistory.deleteMany({ where: { organizationId: fixture.orgId, id: { in: historyIds } } });
            await db.user.update({ where: { id: fixture.ownerId }, data: original });
            // Immutable move and membership evidence stays in this explicitly
            // synthetic branch. It is not hidden by deleting audit records.
        }
    });
}
