import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../app/generated/prisma/client";
import { assertDisposableTestDatabaseTarget } from "../setup/testDatabaseSafety";
import { refreshDevelopmentSession } from "../browser/helpers/development-session";
import type { DashboardOverview } from "../../lib/dashboardContracts";

type Fixture = { databaseName: string; branchId: string; orgId: string; ownerId: string; staffId: string; otherBranchId: string;
    foreignBranchId: string; readonlyBranchId: string; students: { id: string; name: string }[]; today: string; month: string };
const fixture = JSON.parse(readFileSync(".clerk/dashboard-fixture.json", "utf8")) as Fixture;
const target = assertDisposableTestDatabaseTarget(process.env.TEST_DATABASE_URL, process.env);
if (target.databaseName !== fixture.databaseName || !target.databaseName.includes("browser_test")) throw new Error("Connected fixture/database mismatch");
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.TEST_DATABASE_URL! }) });

async function request(page: Page, path: string, method = "GET", body?: unknown) {
    const token = await page.evaluate(async () => {
        const clerk = (window as unknown as { Clerk: { session: { getToken(options: { skipCache: boolean }): Promise<string | null> } } }).Clerk;
        return clerk.session.getToken({ skipCache: true });
    });
    if (!token) throw new Error("Existing development session is unavailable");
    // Keep a real authenticated request alive when dev compilation refreshes the page.
    const response = await page.request.fetch(path, { method, headers: { Authorization: `Bearer ${token}` }, data: body, timeout: 120_000 });
    return { status: response.status(), body: await response.json() };
}
const base = `/api/branches/${fixture.branchId}/dashboard`;
async function applicationReady(page: Page) {
    // A full navigation starts the real development auth client again. Wait for
    // its confirmed identity before interacting with identity-keyed UI state.
    await page.waitForFunction(() => {
        const clerk = (window as unknown as { Clerk?: { loaded?: boolean; user?: unknown; session?: unknown } }).Clerk;
        return Boolean(clerk?.loaded && clerk.user && clerk.session);
    });
    await page.evaluate(() => document.fonts.ready);
}
async function openApplication(page: Page, path: string) {
    const response = await page.goto(path, { waitUntil: "domcontentloaded" });
    await applicationReady(page);
    return response;
}

test.beforeAll(async () => {
    const identity = await db.$queryRaw<Array<{ name: string }>>`SELECT current_database() AS name`;
    expect(identity[0]?.name).toBe(target.databaseName);
    // Reestablish only this fixture's follow-ups after any interrupted verification.
    await db.renewalFollowUp.updateMany({ where: { branchId: fixture.branchId, id: { in: ["dashboard-followup-0", "dashboard-followup-1"] } }, data: { completedAt: null } });
});
test.afterAll(async () => { await db.$disconnect(); });
test.beforeEach(async ({ page }) => {
    // Block provider transactions at the browser as well as server-side release gates.
    await page.route(/(?:api\.razorpay\.com|checkout\.razorpay\.com|graph\.facebook\.com|generativelanguage\.googleapis\.com)/,
        route => route.abort("blockedbyclient"));
    await refreshDevelopmentSession(page);
    const profile = await request(page, "/api/users/me");
    expect(profile.status).toBe(200);
    expect(profile.body.id).toBe(fixture.ownerId);
});

test("real dashboard API agrees with its PostgreSQL fee cohort, attendance and complete capacity", async ({ page }) => {
    const result = await request(page, base);
    expect(result.status).toBe(200);
    const data = result.body as DashboardOverview;
    expect(data.money).toMatchObject({ status: "success", data: { collectedThisMonth: 1900, pendingDues: 2400, overdueAmount: 2400 } });
    expect(data.collections).toMatchObject({ status: "success", data: { billed: 4300, collected: 1900, pending: 2400, rate: 44 } });
    expect(data.collections.data!.points.reduce((sum, point) => sum + point.billed, 0)).toBe(4300);
    expect(data.seating).toMatchObject({ status: "success", data: { seats: 16, shifts: 3, capacity: 48, occupied: 6, physicalSeatsInUse: 2 } });
    expect(data.attendance.data).toMatchObject({ configured: true, expectedToday: 6, attendedToday: 5, gaps: 1 });
    expect(data.followUps.data).toMatchObject({ pending: 2, dueToday: 2 });
    expect(data.terms.data).toMatchObject({ configured: true, renewalsThisWeek: 3 });
    expect(data.students.data?.active).toBe(8);
    expect(await db.payment.aggregate({ where: { branchId: fixture.branchId }, _sum: { amount: true, collectedAmount: true } }))
        .toMatchObject({ _sum: { amount: 4300, collectedAmount: 1900 } });
    const empty = await request(page, `/api/branches/${fixture.otherBranchId}/dashboard`);
    expect(empty.status).toBe(200);
    expect(empty.body.attendance.data).toMatchObject({ configured: false, expectedToday: 0 });
    expect(empty.body.terms.data).toMatchObject({ configured: false, renewalsThisWeek: 0 });
    expect(empty.body.seating.data).toMatchObject({ capacity: 0, utilizationPercent: null });
});

test("task, follow-up and notification actions survive real API reload without changing debt", async ({ page }) => {
    const task = await request(page, `${base}/tasks`, "POST", { title: "Connected verification task", dueAt: null, assigneeId: fixture.ownerId });
    expect(task.status).toBe(200);
    const saved = await request(page, `${base}/tasks/${task.body.id}`, "PATCH", { status: "DONE" });
    expect(saved.status).toBe(200);
    expect((await request(page, `${base}/tasks?status=DONE`)).body.items.some((item: { id: string }) => item.id === task.body.id)).toBe(true);
    expect(await db.dashboardTask.findUniqueOrThrow({ where: { id: task.body.id } })).toMatchObject({ status: "DONE" });
    const followUps = await request(page, `${base}/follow-ups?filter=DUE`);
    const id = followUps.body.items[0].id;
    expect((await request(page, `${base}/follow-ups/${id}`, "PATCH", { completed: true })).status).toBe(200);
    expect((await request(page, `${base}/follow-ups?filter=COMPLETED`)).body.items.some((item: { id: string }) => item.id === id)).toBe(true);
    expect((await request(page, base)).body.money.data.pendingDues).toBe(2400);
    expect((await request(page, `${base}/follow-ups/${id}`, "PATCH", { completed: false })).status).toBe(200);
    const notifications = await request(page, `${base}/notifications`);
    const notification = notifications.body.items.find((item: { kind: string }) => item.kind === "OVERDUE");
    expect((await request(page, `${base}/notifications`, "PATCH", { key: notification.key, action: "READ" })).status).toBe(200);
    expect((await request(page, `${base}/notifications`, "PATCH", { key: notification.key, action: "SNOOZE" })).status).toBe(200);
    expect((await request(page, `${base}/notifications`)).body.items.find((item: { key: string }) => item.key === notification.key)).toMatchObject({ read: true });
    expect(await db.dashboardNotificationState.count({ where: { userId: fixture.ownerId, branchId: fixture.branchId, key: notification.key } })).toBe(1);
    expect(await db.feeCollection.count({ where: { branchId: fixture.branchId, voidedAt: null } })).toBe(19);
    expect((await request(page, base)).body.followUps.data.pending).toBe(2);
});

test("actual APIs reject foreign children and read-only writes; search stays branch scoped", async ({ page }) => {
    for (const suffix of ["", "/tasks", "/follow-ups", "/notifications", "/terms", "/expectations"]) {
        const foreign = await request(page, `/api/branches/${fixture.foreignBranchId}/dashboard${suffix}`);
        const missing = await request(page, `/api/branches/not-present/dashboard${suffix}`);
        expect(foreign.status).toBe(404);
        expect(foreign).toEqual(missing);
    }
    const foreignChild = await request(page, `/api/branches/${fixture.otherBranchId}/dashboard/tasks/dashboard-task-first`, "PATCH", { status: "DONE" });
    expect(foreignChild).toEqual(await request(page, `/api/branches/${fixture.otherBranchId}/dashboard/tasks/missing-task`, "PATCH", { status: "DONE" }));
    expect(foreignChild.status).toBe(404);
    const readonly = await request(page, `/api/branches/${fixture.readonlyBranchId}/dashboard/tasks`, "POST", { title: "Must not save" });
    expect(readonly.status).toBe(403);
    expect(await db.dashboardTask.count({ where: { branchId: fixture.readonlyBranchId } })).toBe(0);
    const search = await request(page, `/api/branches/${fixture.branchId}/search?q=Rahul`);
    expect(search.status).toBe(200);
    expect(JSON.stringify(search.body)).toContain("Rahul Verma");
    expect(JSON.stringify((await request(page, `/api/branches/${fixture.otherBranchId}/search?q=Rahul`)).body)).not.toContain("Rahul Verma");
    const reportQuery = `kind=fees&from=${fixture.month}-01&through=${fixture.today}`;
    expect(await request(page, `/api/branches/${fixture.foreignBranchId}/reports?${reportQuery}`))
        .toEqual(await request(page, `/api/branches/not-present/reports?${reportQuery}`));
});

test("actual Next pages load the dashboard and its supporting destinations", async ({ page }) => {
    test.setTimeout(600_000);
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    for (const route of ["", "follow-ups", "tasks", "reports", "dashboard-settings", "students", "seats", "attendance", "shifts", "payments", "renewals", "allocations"]) {
        const response = await openApplication(page, `/branch/${fixture.branchId}/${route}`);
        expect(response?.status(), route).toBe(200);
        await expect(page.locator("h1").first()).toBeVisible();
        await expect(page.getByText("Application error: a client-side exception")).toHaveCount(0);
    }
    await openApplication(page, `/branch/${fixture.branchId}`);
    await expect(page.getByRole("heading", { name: "Action Center", exact: true })).toBeVisible();
    await expect(page.locator(".reference-dashboard")).toHaveAttribute("aria-busy", "false");
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: "test-results/dashboard-connected/authenticated-desktop.png", fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: "test-results/dashboard-connected/authenticated-mobile-390.png", fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await page.setViewportSize({ width: 320, height: 740 });
    await page.screenshot({ path: "test-results/dashboard-connected/authenticated-mobile-320.png", fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.screenshot({ path: "test-results/dashboard-connected/authenticated-tablet.png", fullPage: true });
    const language = page.locator('select').filter({ has: page.locator('option[value="hinglish"]') }).first();
    for (const [value, tag] of [["hi", "hi-IN"], ["hinglish", "hi-Latn-IN"], ["en", "en-IN"]]) {
        await language.selectOption(value);
        await expect(page.locator("html")).toHaveAttribute("lang", tag);
        await expect.poll(async () => (await request(page, "/api/users/me")).body.interfaceLanguage).toBe(value);
    }
    expect(errors).toEqual([]);
});

test("real chart periods, seating tabs, top search and branch controls use scoped live routes", async ({ page }) => {
    await openApplication(page, `/branch/${fixture.branchId}`);
    await expect(page.getByRole("heading", { name: "Action Center", exact: true })).toBeVisible();
    await expect(page.locator(".reference-dashboard")).toHaveAttribute("aria-busy", "false");
    await page.evaluate(() => document.fonts.ready);
    const period = page.getByRole("combobox", { name: /^Collection period/ });
    const previous = new Date(`${fixture.month}-01T12:00:00Z`);
    previous.setUTCMonth(previous.getUTCMonth() - 1);
    const previousMonth = previous.toISOString().slice(0, 7);
    const chartResponse = page.waitForResponse(response => response.url().includes(`/dashboard?month=${previousMonth}`));
    await period.selectOption(previousMonth);
    expect((await chartResponse).status()).toBe(200);
    await expect(period).toHaveValue(previousMonth);
    await expect(page.locator(".rd-collections")).toHaveAttribute("aria-busy", "false");
    await expect(page.locator(".rd-chart-summary")).toContainText("₹0");
    await period.selectOption(fixture.month);
    await expect(page.locator(".rd-chart-summary")).toContainText("₹4,300");
    await page.getByRole("tab", { name: "Today", exact: true }).click();
    await expect(page.locator(".rd-today-matrix")).toBeVisible();
    await page.getByRole("tab", { name: "Seat map", exact: true }).click();
    await expect(page.locator(".rd-seat-map button")).toHaveCount(16);
    await page.locator(".rd-seat-map button").first().click();
    await expect(page.locator(".rd-cell-detail")).toContainText("allocated shifts");
    await page.getByRole("tab", { name: "This week", exact: true }).click();
    await expect(page.locator(".rd-heatmap tbody tr")).toHaveCount(3);
    await page.getByRole("combobox", { name: "Search current branch", exact: true }).fill("Rahul");
    await page.getByRole("option").filter({ hasText: "Rahul Verma" }).first().click();
    await expect(page).toHaveURL(new RegExp(`/branch/${fixture.branchId}/students`));
    await expect(page.getByText("Rahul Verma", { exact: true }).and(page.locator(":visible")).first()).toBeVisible();
    await page.getByLabel("Switch branch", { exact: true }).selectOption(fixture.otherBranchId);
    await expect(page).toHaveURL(new RegExp(`/branch/${fixture.otherBranchId}$`));
    await expect(page.getByRole("heading", { name: "Action Center", exact: true })).toBeVisible();
    await expect(page.locator(".rd-metrics")).toContainText("0");
    await page.getByLabel("Switch branch", { exact: true }).selectOption(fixture.branchId);
    await expect(page).toHaveURL(new RegExp(`/branch/${fixture.branchId}$`));
    await expect(page.locator(".rd-chart-summary")).toContainText("₹4,300");
});

test("a real restricted staff session cannot read payment sources or mutate tasks", async ({ browser }) => {
    const membership = await db.staff.findUniqueOrThrow({ where: { userId_branchId: { userId: fixture.staffId, branchId: fixture.branchId } } });
    await db.staffPermissionOverride.upsert({ where: { staffId_action: { staffId: membership.id, action: "VIEW_PAYMENTS" } },
        create: { staffId: membership.id, action: "VIEW_PAYMENTS", allowed: false }, update: { allowed: false } });
    const context = await browser.newContext({ baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3117", storageState: ".clerk/dashboard-staff-auth.json" });
    try {
        const page = await context.newPage();
        await refreshDevelopmentSession(page);
        expect((await request(page, "/api/users/me")).body.id).toBe(fixture.staffId);
        const snapshot = await request(page, base);
        expect(snapshot.status).toBe(200);
        expect(snapshot.body.money).toEqual({ status: "restricted", data: null });
        expect(snapshot.body.followUps).toEqual({ status: "restricted", data: null });
        expect(snapshot.body.students.status).toBe("success");
        expect((await request(page, `${base}/tasks`, "POST", { title: "Forbidden staff task" })).status).toBe(403);
        expect((await request(page, `${base}/follow-ups`)).status).toBe(403);
        expect((await request(page, `/api/branches/${fixture.branchId}/reports?kind=fees&from=${fixture.month}-01&through=${fixture.today}`)).status).toBe(403);
        expect((await request(page, `${base}/notifications`)).body.items.every((item: { kind: string }) => !["FOLLOW_UP", "OVERDUE", "TASK"].includes(item.kind))).toBe(true);
    } finally { await context.close(); }
});

test("real task and follow-up forms persist, notifications acknowledge, and filtered CSV downloads", async ({ page }) => {
    await openApplication(page, `/branch/${fixture.branchId}/tasks`);
    await expect(page.getByRole("button", { name: "Refresh", exact: true })).toBeEnabled();
    await page.evaluate(() => document.fonts.ready);
    await page.getByRole("button", { name: "Add task", exact: true }).click();
    await page.getByRole("dialog").evaluate(async element => {
        await Promise.all(element.getAnimations().map(animation => animation.finished.catch(() => undefined)));
    });
    const title = `Connected UI task ${Date.now()}`;
    await page.getByRole("dialog").getByLabel("Task", { exact: true }).fill(title);
    await expect(page.getByRole("dialog").getByLabel("Task", { exact: true })).toHaveValue(title);
    await page.getByRole("button", { name: "Save task", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByText(title, { exact: true })).toBeVisible();
    await page.reload();
    await applicationReady(page);
    await expect(page.getByText(title, { exact: true })).toBeVisible();
    expect(await db.dashboardTask.count({ where: { branchId: fixture.branchId, title } })).toBe(1);
    await openApplication(page, `/branch/${fixture.branchId}/follow-ups`);
    await expect(page.getByRole("row").filter({ hasText: "Rahul Verma" })).toBeVisible();
    await page.getByRole("row").filter({ hasText: "Rahul Verma" }).getByRole("button", { name: "Update follow-up" }).click();
    await page.getByRole("dialog").evaluate(async element => {
        await Promise.all(element.getAnimations().map(animation => animation.finished.catch(() => undefined)));
    });
    const note = `Connected UI contact note ${Date.now()}`;
    await page.getByRole("dialog").getByRole("textbox", { name: /^Follow-up note/ }).fill(note);
    const followUpSaved = page.waitForResponse(response => response.request().method() === "PATCH"
        && response.url().endsWith("/dashboard/follow-ups/dashboard-followup-0"));
    await page.getByRole("button", { name: "Save follow-up", exact: true }).click();
    expect((await followUpSaved).status()).toBe(200);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByText(note, { exact: true })).toBeVisible();
    await expect.poll(async () => (await db.renewalFollowUp.findUniqueOrThrow({ where: { id: "dashboard-followup-0" } })).note).toBe(note);
    await page.getByRole("button", { name: "Notifications", exact: true }).click();
    const notifications = page.getByRole("dialog", { name: "Notifications", exact: true });
    await expect(notifications).toBeVisible();
    await notifications.getByLabel("Show all alerts").check();
    const unread = notifications.getByRole("button", { name: "Mark all read", exact: true });
    await expect(unread).toBeEnabled();
    await unread.click();
    await expect.poll(async () => (await request(page, `${base}/notifications`)).body.unreadCount).toBe(0);
    await page.keyboard.press("Escape");
    await openApplication(page, `/branch/${fixture.branchId}/reports`);
    await page.getByLabel("Student name", { exact: true }).fill("Rahul");
    await expect(page.getByText("1 matching rows", { exact: true })).toBeVisible();
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download CSV", exact: true }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^lab-lords-fees-/);
    const contents = readFileSync((await download.path())!, "utf8");
    expect(contents).toContain("Rahul Verma");
    expect(contents).not.toContain("Priya Singh");
    expect(contents).not.toContain("Connected UI contact note");
});

test("actual setup controls save advisory configuration, explicit expectations and independent terms", async ({ page }) => {
    await openApplication(page, `/branch/${fixture.branchId}/dashboard-settings`);
    await page.getByLabel("Threshold (%)", { exact: true }).fill("36");
    await page.getByRole("button", { name: "Save threshold", exact: true }).click();
    await expect.poll(async () => (await db.dashboardSettings.findUniqueOrThrow({ where: { branchId: fixture.branchId } })).utilizationThreshold).toBe(36);
    await page.getByLabel("Threshold (%)", { exact: true }).fill("35");
    await page.getByRole("button", { name: "Save threshold", exact: true }).click();
    await expect.poll(async () => (await db.dashboardSettings.findUniqueOrThrow({ where: { branchId: fixture.branchId } })).utilizationThreshold).toBe(35);
    await expect(page.getByRole("button", { name: "Save threshold", exact: true })).toBeEnabled();
    await page.getByRole("button", { name: "Attendance expectations", exact: true }).click();
    await expect(page.getByRole("button", { name: "Attendance expectations", exact: true })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("row").filter({ hasText: "Rahul Verma" }).getByRole("button", { name: "Edit", exact: true }).click();
    await page.getByLabel("Expected by", { exact: true }).fill("00:02");
    await page.getByRole("button", { name: "Save expectation", exact: true }).click();
    await expect.poll(async () => (await db.attendanceExpectation.findUniqueOrThrow({ where: { studentId: "dashboard-student-0" } })).expectedBy).toBe("00:02");
    await page.getByRole("button", { name: "Membership terms", exact: true }).click();
    await page.getByRole("combobox", { name: "Student", exact: true }).click();
    await page.getByRole("option", { name: "Meera Gupta", exact: true }).click();
    const future = (days: number) => new Date(Date.parse(fixture.today) + days * 86_400_000).toISOString().slice(0, 10);
    const existing = await db.membershipTerm.findFirst({ where: { branchId: fixture.branchId, studentId: "dashboard-student-7" }, orderBy: { endDate: "desc" } });
    const start = existing ? new Date(Date.parse(existing.endDate) + 86_400_000).toISOString().slice(0, 10) : future(30);
    await page.getByLabel("Membership label", { exact: true }).fill("Synthetic next membership");
    await page.getByLabel("Start date", { exact: true }).fill(start);
    await page.getByLabel("End date", { exact: true }).fill(new Date(Date.parse(start) + 30 * 86_400_000).toISOString().slice(0, 10));
    await page.getByRole("button", { name: "Save membership term", exact: true }).click();
    await expect(page.getByRole("row").filter({ hasText: "Meera Gupta" }).last()).toContainText("Synthetic next membership");
    expect(await db.payment.count({ where: { branchId: fixture.branchId } })).toBe(5);
    expect((await db.student.findUniqueOrThrow({ where: { id: "dashboard-student-7" } })).status).toBe("ACTIVE");
    await openApplication(page, `/branch/${fixture.readonlyBranchId}/tasks`);
    await expect(page.getByRole("button", { name: "Add task", exact: true })).toBeDisabled();
});

test("actual collection retries reuse one receipt and owner void restores the original dashboard balance", async ({ page }) => {
    const collectionBase = `/api/branches/${fixture.branchId}/collections`;
    const input = { studentId: "dashboard-student-0", paymentIds: ["dashboard-payment-0"], amount: 100,
        method: "CASH", reference: "Connected verification", note: "Synthetic recovery verification", idempotencyKey: randomUUID() };
    const before = await request(page, base);
    const first = await request(page, collectionBase, "POST", input);
    expect(first.status).toBe(200);
    try {
        const retry = await request(page, collectionBase, "POST", input);
        expect(retry.status).toBe(200);
        expect(retry.body.id).toBe(first.body.id);
        expect(retry.body.receiptNumber).toBe(first.body.receiptNumber);
        expect((await request(page, `${collectionBase}/${first.body.id}`)).body.snapshot).toEqual(first.body.snapshot);
        expect((await request(page, base)).body.money.data.pendingDues).toBe(before.body.money.data.pendingDues - 100);
        expect(await db.feeCollection.count({ where: { branchId: fixture.branchId, idempotencyKey: input.idempotencyKey } })).toBe(1);
    } finally {
        const reversal = await request(page, `${collectionBase}/${first.body.id}`, "PATCH", { reason: "Restore synthetic verification balance" });
        expect(reversal.status).toBe(200);
    }
    expect((await request(page, base)).body.money.data.pendingDues).toBe(before.body.money.data.pendingDues);
    expect((await db.feeCollection.findUniqueOrThrow({ where: { id: first.body.id } })).snapshot).toEqual(first.body.snapshot);
});
