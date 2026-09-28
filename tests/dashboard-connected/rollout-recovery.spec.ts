import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../app/generated/prisma/client";
import { assertDisposableTestDatabaseTarget } from "../setup/testDatabaseSafety";
import { refreshDevelopmentSession } from "../browser/helpers/development-session";

type Fixture = {
    databaseName: string;
    branchId: string;
    ownerId: string;
    students: { id: string; name: string }[];
};
const fixture = JSON.parse(readFileSync(".clerk/dashboard-fixture.json", "utf8")) as Fixture;
const target = assertDisposableTestDatabaseTarget(process.env.TEST_DATABASE_URL, process.env);
if (target.databaseName !== fixture.databaseName || !target.databaseName.includes("browser_test")) {
    throw new Error("Connected rollout fixture/database mismatch");
}
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.TEST_DATABASE_URL! }) });
const branchApi = `/api/branches/${fixture.branchId}`;

async function request(page: Page, path: string, method = "GET", data?: unknown) {
    const token = await page.evaluate(async () => {
        const clerk = (window as unknown as { Clerk?: { session?: { getToken(options: { skipCache: boolean }): Promise<string | null> } } }).Clerk;
        return clerk?.session?.getToken({ skipCache: true }) ?? null;
    });
    if (!token) throw new Error("Existing development session is unavailable");
    return page.request.fetch(path, { method, data, headers: { Authorization: `Bearer ${token}` }, timeout: 120_000 });
}

async function finances() {
    const payments = await db.payment.aggregate({ where: { branchId: fixture.branchId },
        _count: { id: true }, _sum: { amount: true, collectedAmount: true, waivedAmount: true } });
    return { fees: payments._count.id, billed: payments._sum.amount, collected: payments._sum.collectedAmount,
        waived: payments._sum.waivedAmount,
        liveReceipts: await db.feeCollection.count({ where: { branchId: fixture.branchId, voidedAt: null } }) };
}

function savedVisitId(result: unknown) {
    if (result && typeof result === "object" && "visitId" in result && typeof result.visitId === "string") return result.visitId;
    return null;
}

test.beforeAll(async () => {
    const identity = await db.$queryRaw<Array<{ name: string }>>`SELECT current_database() AS name`;
    expect(identity[0]?.name).toBe(target.databaseName);
    expect(await db.user.count({ where: { id: fixture.ownerId } })).toBe(1);
    expect(await db.seat.count({ where: { branchId: fixture.branchId } })).toBe(16);
});
test.afterAll(async () => { await db.$disconnect(); });
test.beforeEach(async ({ page }) => {
    await page.route(/(?:api\.razorpay\.com|checkout\.razorpay\.com|graph\.facebook\.com|generativelanguage\.googleapis\.com)/,
        route => route.abort("blockedbyclient"));
    await refreshDevelopmentSession(page);
    const profile = await request(page, "/api/users/me");
    expect(profile.status()).toBe(200);
    expect((await profile.json()).id).toBe(fixture.ownerId);
});

test("real allocation API rejects occupied seat and already allocated student without changing capacity or fees", async ({ page }) => {
    const beforeAllocations = await db.seatAllocation.count({ where: { branchId: fixture.branchId } });
    const beforeFinances = await finances();
    const occupied = await db.seatAllocation.findFirstOrThrow({ where: { branchId: fixture.branchId,
        seatId: "dashboard-seat-0", shiftId: "dashboard-shift-0", endDate: null } });
    expect(occupied.studentId).toBe(fixture.students[0].id);
    expect(await db.seatAllocation.count({ where: { branchId: fixture.branchId,
        seatId: "dashboard-seat-2", shiftId: "dashboard-shift-0", endDate: null } })).toBe(0);

    const seatConflict = await request(page, `${branchApi}/seat-allocations`, "POST", {
        seatId: "dashboard-seat-0", studentId: fixture.students[6].id, shiftIds: ["dashboard-shift-0"],
    });
    expect(seatConflict.status()).toBe(400);
    expect((await seatConflict.json()).error).toMatch(/Seat is already assigned|Seat is already occupied/);

    const studentConflict = await request(page, `${branchApi}/seat-allocations`, "POST", {
        seatId: "dashboard-seat-2", studentId: fixture.students[0].id, shiftIds: ["dashboard-shift-0"],
    });
    expect(studentConflict.status()).toBe(400);
    expect((await studentConflict.json()).error).toMatch(/Student already has a seat|Student is already allocated/);
    expect(await db.seatAllocation.count({ where: { branchId: fixture.branchId } })).toBe(beforeAllocations);
    expect(await finances()).toEqual(beforeFinances);
});

test("real attendance commands replay one result and preserve an auditable voided visit", async ({ page }) => {
    const studentId = fixture.students[7].id;
    const beforeFinances = await finances();
    const beforeVisits = await db.attendanceVisit.count({ where: { branchId: fixture.branchId, studentId } });
    const beforeAudits = await db.auditLog.count({ where: { branchId: fixture.branchId, studentId, action: "ATTENDANCE_CHANGED" } });
    expect(await db.attendanceVisit.count({ where: { branchId: fixture.branchId, studentId, voidedAt: null } })).toBe(0);
    const rosterBeforeResponse = await request(page, `${branchApi}/attendance`);
    expect(rosterBeforeResponse.status()).toBe(200);
    const rosterBefore = await rosterBeforeResponse.json();
    const checkInKey = randomUUID(), checkOutKey = randomUUID(), voidKey = randomUUID();
    const checkIn = { kind: "CHECK_IN", key: checkInKey, studentId, source: "MANUAL" };
    try {
        const checkedIn = await request(page, `${branchApi}/attendance`, "POST", checkIn);
        expect(checkedIn.status()).toBe(200);
        const result = await checkedIn.json();
        const visitId = savedVisitId(result);
        expect(visitId).toBeTruthy();
        const replay = await request(page, `${branchApi}/attendance`, "POST", checkIn);
        expect(replay.status()).toBe(200);
        expect(await replay.json()).toEqual(result);
        const changedRetry = await request(page, `${branchApi}/attendance`, "POST", { ...checkIn, note: "different request" });
        expect(changedRetry.status()).toBe(409);

        const visit = await db.attendanceVisit.findUniqueOrThrow({ where: { id: visitId! } });
        const checkOut = { kind: "CHECK_OUT", key: checkOutKey, studentId, visitId: visit.id, version: visit.version };
        const checkedOut = await request(page, `${branchApi}/attendance`, "POST", checkOut);
        expect(checkedOut.status()).toBe(200);
        const checkOutResult = await checkedOut.json();
        const checkOutReplay = await request(page, `${branchApi}/attendance`, "POST", checkOut);
        expect(checkOutReplay.status()).toBe(200);
        expect(await checkOutReplay.json()).toEqual(checkOutResult);
        const closedVisit = await db.attendanceVisit.findUniqueOrThrow({ where: { id: visit.id } });
        expect(closedVisit.checkOut).not.toBeNull();

        const voidInput = { kind: "VOID_VISIT", key: voidKey, studentId, visitId: visit.id,
            version: closedVisit.version, reason: "Void disposable verification visit" };
        const voided = await request(page, `${branchApi}/attendance`, "POST", voidInput);
        expect(voided.status()).toBe(200);
        const voidResult = await voided.json();
        const voidReplay = await request(page, `${branchApi}/attendance`, "POST", voidInput);
        expect(voidReplay.status()).toBe(200);
        expect(await voidReplay.json()).toEqual(voidResult);
        expect((await db.attendanceVisit.findUniqueOrThrow({ where: { id: visit.id } })).voidedAt).not.toBeNull();

        const rosterAfterResponse = await request(page, `${branchApi}/attendance?date=${rosterBefore.date}`);
        expect(rosterAfterResponse.status()).toBe(200);
        expect((await rosterAfterResponse.json()).counts).toEqual(rosterBefore.counts);
        expect(await db.attendanceVisit.count({ where: { branchId: fixture.branchId, studentId } })).toBe(beforeVisits + 1);
        expect(await db.attendanceVisit.count({ where: { branchId: fixture.branchId, studentId, voidedAt: null } })).toBe(0);
        expect(await db.attendanceCommand.count({ where: { branchId: fixture.branchId, key: { in: [checkInKey, checkOutKey, voidKey] } } })).toBe(3);
        expect(await db.auditLog.count({ where: { branchId: fixture.branchId, studentId, action: "ATTENDANCE_CHANGED" } })).toBe(beforeAudits + 3);
        expect(await finances()).toEqual(beforeFinances);
    } finally {
        // Preserve command/audit evidence. Only a visit created by this exact
        // request key may be voided if an assertion interrupted the main path.
        const receipt = await db.attendanceCommand.findUnique({ where: { branchId_key: { branchId: fixture.branchId, key: checkInKey } } });
        const visitId = savedVisitId(receipt?.result);
        if (visitId) {
            const visit = await db.attendanceVisit.findUnique({ where: { id: visitId } });
            if (visit && visit.branchId === fixture.branchId && visit.studentId === studentId && !visit.voidedAt) {
                const cleanup = await request(page, `${branchApi}/attendance`, "POST", { kind: "VOID_VISIT", key: voidKey,
                    studentId, visitId, version: visit.version, reason: "Void disposable verification visit" });
                expect(cleanup.status()).toBe(200);
            }
        }
    }
});

test("real renewal API and page show the partial remaining fee alongside follow-up work", async ({ page }) => {
    const payment = await db.payment.findUniqueOrThrow({ where: { id: "dashboard-payment-0" } });
    expect(payment.branchId).toBe(fixture.branchId);
    expect(payment.status).toBe("DUE");
    expect(payment.amount).toBe(1200);
    expect(payment.collectedAmount).toBe(700);
    expect(payment.waivedAmount).toBe(0);
    const response = await request(page, `${branchApi}/renewals?filter=OUTSTANDING&search=Rahul&limit=25`);
    expect(response.status()).toBe(200);
    const renewal = (await response.json()).items.find((row: { paymentId: string | null }) => row.paymentId === payment.id);
    expect(renewal).toMatchObject({ studentId: fixture.students[0].id, amount: 500, expected: false });
    expect(renewal.followUp).toBeTruthy();

    await page.goto(`/branch/${fixture.branchId}/renewals?filter=OUTSTANDING&search=Rahul`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => {
        const clerk = (window as unknown as { Clerk?: { loaded?: boolean; user?: unknown; session?: unknown } }).Clerk;
        return Boolean(clerk?.loaded && clerk.user && clerk.session);
    });
    const panel = page.getByRole("heading", { name: fixture.students[0].name, exact: true }).locator("xpath=ancestor::section[1]");
    await expect(panel).toContainText(/₹\s*500/);
});

test("real collection correction dialog voids a synthetic receipt and restores the balance", async ({ page }) => {
    const collections = `${branchApi}/collections`;
    const before = await finances();
    const reference = `Closeout correction ${randomUUID()}`;
    const created = await request(page, collections, "POST", {
        studentId: fixture.students[0].id, paymentIds: ["dashboard-payment-0"], amount: 50,
        method: "CASH", reference, note: "Synthetic correction verification", idempotencyKey: randomUUID(),
    });
    expect(created.status()).toBe(200);
    const receipt = await created.json() as { id: string; snapshot: unknown };
    try {
        await page.goto(`/branch/${fixture.branchId}/payments`, { waitUntil: "domcontentloaded" });
        await page.waitForFunction(() => {
            const clerk = (window as unknown as { Clerk?: { loaded?: boolean; user?: unknown; session?: unknown } }).Clerk;
            return Boolean(clerk?.loaded && clerk.user && clerk.session);
        });
        await page.getByLabel("Search student, receipt or reference", { exact: true }).fill(reference);
        const card = page.locator("article").filter({ hasText: reference });
        await expect(card).toBeVisible();
        await card.getByRole("button", { name: "Correct / void", exact: true }).click();
        const dialog = page.getByRole("dialog", { name: "Void mistaken collection" });
        await expect(dialog).toContainText("does not return cash or initiate a provider refund");
        await expect(dialog.getByRole("button", { name: "Void collection" })).toBeDisabled();
        await dialog.getByLabel("Required reason").fill("Correct disposable verification collection");
        const voidResponse = page.waitForResponse(response => response.request().method() === "PATCH"
            && response.url().endsWith(`${collections}/${receipt.id}`));
        await dialog.getByRole("button", { name: "Void collection" }).click();
        expect((await voidResponse).status()).toBe(200);
        await expect(dialog).toHaveCount(0);
        await expect(card.getByText("VOID", { exact: true })).toBeVisible();
        await expect(card.getByRole("button", { name: "Correct / void", exact: true })).toHaveCount(0);
        const persisted = await db.feeCollection.findUniqueOrThrow({ where: { id: receipt.id } });
        expect(persisted.voidedAt).not.toBeNull();
        expect(persisted.snapshot).toEqual(receipt.snapshot);
        expect(await finances()).toEqual(before);
    } finally {
        const persisted = await db.feeCollection.findUnique({ where: { id: receipt.id } });
        if (persisted && !persisted.voidedAt) {
            const cleanup = await request(page, `${collections}/${receipt.id}`, "PATCH", { reason: "Restore disposable verification balance" });
            expect(cleanup.status()).toBe(200);
        }
    }
});
