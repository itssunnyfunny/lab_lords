import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../app/generated/prisma/client";
import { assertDisposableTestDatabaseTarget } from "../setup/testDatabaseSafety";
import { refreshDevelopmentSession } from "../browser/helpers/development-session";
import type { DashboardNotification } from "../../lib/dashboardContracts";

type Fixture = {
    databaseName: string;
    branchId: string;
    foreignBranchId: string;
    ownerId: string;
    staffId: string;
    students: { id: string; name: string }[];
};

const fixture = JSON.parse(readFileSync(".clerk/dashboard-fixture.json", "utf8")) as Fixture;
const target = assertDisposableTestDatabaseTarget(process.env.TEST_DATABASE_URL, process.env);
if (target.databaseName !== fixture.databaseName || !target.databaseName.includes("browser_test")) {
    throw new Error("Connected OPS fixture/database mismatch");
}
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.TEST_DATABASE_URL! }) });
const providerDomains = /(?:api\.razorpay\.com|checkout\.razorpay\.com|graph\.facebook\.com|generativelanguage\.googleapis\.com)/;

async function checkedDatabase() {
    const identity = await db.$queryRaw<Array<{ name: string }>>`SELECT current_database() AS name`;
    expect(identity[0]?.name).toBe(target.databaseName);
    const marker = await db.dashboardEvent.count({ where: {
        branchId: fixture.branchId, kind: "CONFIGURATION", detail: "Synthetic expected-attendance schedule configured",
    } });
    expect(marker).toBe(1);
}

async function open(page: Page, path: string) {
    const response = await page.goto(path, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => {
        const clerk = (window as unknown as { Clerk?: { loaded?: boolean; user?: unknown; session?: unknown } }).Clerk;
        return Boolean(clerk?.loaded && clerk.user && clerk.session);
    });
    const trial = page.getByRole("button", { name: "Dismiss trial reminder for this session", exact: true });
    if (await trial.isVisible()) await trial.click();
    return response;
}

async function request(page: Page, path: string, method = "GET", data?: unknown) {
    try {
        const token = await page.evaluate(async () => {
            const clerk = (window as unknown as {
                Clerk: { session: { getToken(options: { skipCache: boolean }): Promise<string | null> } };
            }).Clerk;
            return clerk.session.getToken({ skipCache: true });
        });
        if (!token) throw new Error("Session unavailable");
        return await page.request.fetch(path, { method, data, headers: { Authorization: `Bearer ${token}` }, timeout: 120_000 });
    } catch {
        // Playwright's raw request failure can include Authorization headers.
        throw new Error(`Connected ${method} ${new URL(path, "http://localhost").pathname} failed before a response; headers suppressed`);
    }
}

async function scopedCounts() {
    const branchId = fixture.branchId;
    const [students, seats, shifts, multiShifts, components, allocations, expectations, terms, payments] = await Promise.all([
        db.student.count({ where: { branchId } }),
        db.seat.count({ where: { branchId } }),
        db.shift.count({ where: { branchId } }),
        db.multiShift.count({ where: { branchId } }),
        db.multiShiftComponent.count({ where: { branchId } }),
        db.seatAllocation.count({ where: { branchId } }),
        db.attendanceExpectation.count({ where: { branchId } }),
        db.membershipTerm.count({ where: { branchId } }),
        db.payment.count({ where: { branchId } }),
    ]);
    return { students, seats, shifts, multiShifts, components, allocations, expectations, terms, payments };
}

test.afterAll(async () => { await db.$disconnect(); });

test("OPS-04 real persisted periods and same-name students remain separate in table, grid and mobile reload", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "This journey checks desktop table/grid and then switches to the 390px mobile layout.");
    await page.route(providerDomains, route => route.abort("blockedbyclient"));
    await checkedDatabase();
    await refreshDevelopmentSession(page);
    const profile = await request(page, "/api/users/me");
    expect(profile.status()).toBe(200);
    expect((await profile.json() as { id: string }).id).toBe(fixture.ownerId);

    const before = await scopedCounts();
    const suffix = randomUUID().slice(0, 12);
    const studentIds = [`audit-ops04-${suffix}-student-a`, `audit-ops04-${suffix}-student-b`];
    const seatId = `audit-ops04-${suffix}-seat`;
    const multiShiftId = `audit-ops04-${suffix}-multi`;
    const sameName = `History Sample ${suffix}`;
    const seatLabel = `History-${suffix}`;
    const multiShiftName = `History bundle ${suffix}`;
    const shiftIds = ["dashboard-shift-0", "dashboard-shift-1"];
    const periods = [
        { studentId: studentIds[0], startDate: new Date("2026-09-01T00:00:00+05:30"), endDate: new Date("2026-09-10T00:00:00+05:30") },
        { studentId: studentIds[0], startDate: new Date("2026-09-11T00:00:00+05:30"), endDate: new Date("2026-09-20T00:00:00+05:30") },
        { studentId: studentIds[1], startDate: new Date("2026-09-11T00:00:00+05:30"), endDate: new Date("2026-09-20T00:00:00+05:30") },
    ];
    const allocationIds = periods.flatMap((_, period) => shiftIds.map((_, shift) => `audit-ops04-${suffix}-p${period}-s${shift}`));
    let inserted = false;
    try {
        await db.$transaction(async tx => {
            const shifts = await tx.shift.findMany({ where: { branchId: fixture.branchId, id: { in: shiftIds }, status: "ACTIVE" }, select: { id: true } });
            expect(shifts).toHaveLength(2);
            await tx.student.createMany({ data: studentIds.map(id => ({ id, branchId: fixture.branchId, name: sameName,
                joinedAt: new Date("2026-08-01T00:00:00+05:30"), monthlyFee: 0 })) });
            await tx.seat.create({ data: { id: seatId, branchId: fixture.branchId, label: seatLabel } });
            await tx.multiShift.create({ data: { id: multiShiftId, branchId: fixture.branchId, name: multiShiftName } });
            await tx.multiShiftComponent.createMany({ data: shiftIds.map((shiftId, order) => ({ branchId: fixture.branchId,
                multiShiftId, shiftId, order })) });
            await tx.seatAllocation.createMany({ data: periods.flatMap((period, periodIndex) => shiftIds.map((shiftId, shiftIndex) => ({
                id: allocationIds[periodIndex * 2 + shiftIndex], branchId: fixture.branchId,
                studentId: period.studentId, seatId, shiftId, multiShiftId,
                startDate: period.startDate, endDate: period.endDate,
            }))) });
        });
        inserted = true;
        expect(await scopedCounts()).toEqual({ ...before, students: before.students + 2, seats: before.seats + 1,
            multiShifts: before.multiShifts + 1, components: before.components + 2, allocations: before.allocations + 6 });

        const actual = await request(page, `/api/branches/${fixture.branchId}/seat-allocations?status=ENDED&multiShiftId=${multiShiftId}`);
        expect(actual.status()).toBe(200);
        const rows = (await actual.json() as { items: { id: string; studentId: string; startDate: string; endDate: string | null }[] }).items;
        expect(rows.map(row => row.id).sort()).toEqual([...allocationIds].sort());
        expect(new Set(rows.map(row => row.studentId))).toEqual(new Set(studentIds));
        expect(new Set(rows.map(row => `${row.studentId}:${row.startDate}:${row.endDate}`)).size).toBe(3);

        const linkedId = allocationIds[3]; // A component sibling, not a display-group identity.
        const path = `/branch/${fixture.branchId}/allocations?allocationId=${linkedId}&status=ENDED`;
        expect((await open(page, path))?.status()).toBe(200);
        const filter = page.getByRole("combobox", { name: "Filter allocations by shift" });
        await filter.click();
        await page.getByRole("option", { name: multiShiftName, exact: true }).click();
        const ended = page.getByRole("group", { name: "Allocation status filter" }).getByRole("button", { name: /^Ended/ });
        await expect(ended).toHaveAttribute("aria-pressed", "true");
        await page.getByRole("button", { name: "Table view" }).click();
        const table = page.getByRole("table", { name: "Loaded seat allocations" });
        await expect(table.getByRole("row").filter({ hasText: sameName })).toHaveCount(3);
        await expect(page.locator(`#allocation-record-${linkedId}-row`)).toHaveAttribute("aria-current", "true");
        for (const row of await table.getByRole("row").filter({ hasText: sameName }).all()) {
            await expect(row).toContainText("Morning");
            await expect(row).toContainText("Afternoon");
        }
        await page.screenshot({ path: testInfo.outputPath("ops04-table.png") });

        await page.getByRole("button", { name: "Grid view" }).click();
        const cards = page.locator("div.ui-panel--compact.relative").filter({ hasText: sameName });
        await expect(cards).toHaveCount(3);
        await expect(page.locator(`#allocation-record-${linkedId}-card`)).toHaveAttribute("aria-current", "true");
        await page.reload({ waitUntil: "domcontentloaded" });
        await page.waitForFunction(() => Boolean((window as unknown as { Clerk?: { loaded?: boolean; session?: unknown } }).Clerk?.loaded));
        await filter.click();
        await page.getByRole("option", { name: multiShiftName, exact: true }).click();
        await expect(cards).toHaveCount(3);
        await expect(page.locator(`#allocation-record-${linkedId}-card`)).toHaveAttribute("aria-current", "true");

        await page.setViewportSize({ width: 390, height: 844 });
        await expect(cards).toHaveCount(3);
        await expect(page.locator(`#allocation-record-${linkedId}-card`)).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.screenshot({ path: testInfo.outputPath("ops04-mobile.png"), fullPage: true });
    } finally {
        if (inserted) {
            await db.$transaction(async tx => {
                await tx.seatAllocation.deleteMany({ where: { id: { in: allocationIds }, branchId: fixture.branchId } });
                await tx.multiShiftComponent.deleteMany({ where: { multiShiftId, branchId: fixture.branchId } });
                await tx.multiShift.deleteMany({ where: { id: multiShiftId, branchId: fixture.branchId } });
                await tx.seat.deleteMany({ where: { id: seatId, branchId: fixture.branchId } });
                await tx.student.deleteMany({ where: { id: { in: studentIds }, branchId: fixture.branchId } });
            });
        }
        const after = await scopedCounts();
        writeFileSync(testInfo.outputPath("ops04-scoped-counts.json"), JSON.stringify({ before, inserted,
            expectedDuring: inserted ? { students: before.students + 2, seats: before.seats + 1,
                multiShifts: before.multiShifts + 1, components: before.components + 2, allocations: before.allocations + 6 } : null,
            after }, null, 2));
        expect(after).toEqual(before);
    }
});

test("OPS-09 real students-only notification changes the current settings route to terms without management rights", async ({ browser }, testInfo) => {
    await checkedDatabase();
    const staffState = process.env.PLAYWRIGHT_STAFF_AUTH_STATE;
    if (!staffState || !staffState.replaceAll("\\", "/").startsWith(".clerk/")) {
        throw new Error("Use the ignored verified staff development authentication state");
    }
    const context = await browser.newContext({ baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3117",
        storageState: staffState, viewport: testInfo.project.name === "mobile" ? { width: 390, height: 844 } : { width: 1491, height: 1055 } });
    try {
        const page = await context.newPage();
        await page.route(providerDomains, route => route.abort("blockedbyclient"));
        await refreshDevelopmentSession(page);
        const profile = await request(page, "/api/users/me");
        expect(profile.status()).toBe(200);
        expect((await profile.json() as { id: string }).id).toBe(fixture.staffId);
        const accessResponse = await request(page, `/api/branches/${fixture.branchId}/access`);
        expect(accessResponse.status()).toBe(200);
        const access = await accessResponse.json() as { permissions: { students: boolean; manage_branch: boolean; view_payments: boolean } };
        expect(access.permissions).toMatchObject({ students: true, manage_branch: false, view_payments: false });

        const beforeTerms = await db.membershipTerm.count({ where: { branchId: fixture.branchId } });
        const notificationResponse = await request(page, `/api/branches/${fixture.branchId}/dashboard/notifications`);
        expect(notificationResponse.status()).toBe(200);
        const notifications = await notificationResponse.json() as { items: DashboardNotification[] };
        const renewal = notifications.items.find(item => item.kind === "RENEWAL");
        expect(renewal?.count).toBeGreaterThan(0);
        const destination = `/branch/${fixture.branchId}/dashboard-settings?section=terms`;
        expect(renewal?.href).toBe(destination);
        expect(notifications.items.some(item => item.kind === "OVERDUE" || item.kind === "FOLLOW_UP")).toBe(false);

        expect((await open(page, `/branch/${fixture.branchId}/dashboard-settings?section=expectations`))?.status()).toBe(200);
        const expectations = page.getByRole("button", { name: "Attendance expectations", exact: true });
        await expect(expectations).toHaveAttribute("aria-pressed", "true");
        await page.getByRole("button", { name: "Notifications", exact: true }).click();
        const dialog = page.getByRole("dialog", { name: "Notifications", exact: true });
        await dialog.getByLabel("Show all alerts").check();
        const link = dialog.getByRole("link", { name: /^Upcoming renewals/ });
        await expect(link).toHaveAttribute("href", destination);
        await link.click();
        await expect(page).toHaveURL(new RegExp(`/branch/${fixture.branchId}/dashboard-settings\\?section=terms$`));
        await expect(page.getByRole("button", { name: "Membership terms", exact: true })).toHaveAttribute("aria-pressed", "true");
        await expect(page.getByRole("button", { name: "Save membership term", exact: true })).toBeDisabled();
        await expect(page.getByRole("button", { name: "Renew term", exact: true }).first()).toBeDisabled();
        await expect(page.getByText("Ask a branch manager to change these settings.", { exact: true })).toHaveCount(0);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.screenshot({ path: testInfo.outputPath(`ops09-students-only-${testInfo.project.name}.png`), fullPage: true });

        const forbidden = await request(page, `/api/branches/${fixture.branchId}/dashboard/terms`, "POST", {
            studentId: fixture.students[0].id, label: "Forbidden synthetic term", startDate: "2027-01-01", endDate: "2027-01-31",
        });
        expect(forbidden.status()).toBe(403);
        expect(await db.membershipTerm.count({ where: { branchId: fixture.branchId } })).toBe(beforeTerms);
        writeFileSync(testInfo.outputPath("ops09-scoped-counts.json"), JSON.stringify({ termsBefore: beforeTerms,
            termsAfter: await db.membershipTerm.count({ where: { branchId: fixture.branchId } }),
            staffStudents: true, staffManageBranch: false, staffViewPayments: false }, null, 2));
    } finally { await context.close(); }
});

test("OPS-01/02/07 allocation-only staff sees scoped identities and complete bundle availability", async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "One desktop allocation-only journey verifies the scoped selector and bundle seat map.");
    await checkedDatabase();
    const staffState = process.env.PLAYWRIGHT_STAFF_AUTH_STATE;
    if (!staffState) throw new Error("Verified staff development authentication is required");
    const member = await db.staff.findUniqueOrThrow({ where: { userId_branchId: { userId: fixture.staffId, branchId: fixture.branchId } } });
    expect(member.role).toBe("STAFF");
    const permissionKey = { staffId_action: { staffId: member.id, action: "STUDENTS" as const } };
    const previousStudents = await db.staffPermissionOverride.findUnique({ where: permissionKey });
    const before = await scopedCounts();
    const foreignBefore = await db.student.count({ where: { branchId: fixture.foreignBranchId } });
    const suffix = randomUUID().slice(0, 12);
    const ids = {
        active: `audit-ops02-${suffix}-active`, occupant: `audit-ops02-${suffix}-occupant`,
        inactive: `audit-ops02-${suffix}-inactive`, foreign: `audit-ops02-${suffix}-foreign`,
        seat: `audit-ops02-${suffix}-seat`, inactiveShift: `audit-ops02-${suffix}-inactive-shift`,
        complete: `audit-ops02-${suffix}-complete`, incomplete: `audit-ops02-${suffix}-incomplete`,
        occupancy: `audit-ops02-${suffix}-occupancy`,
    };
    const names = { active: `Allocation sample ${suffix}`, occupant: `Occupant sample ${suffix}`,
        inactive: `Inactive sample ${suffix}`, foreign: `Foreign sample ${suffix}`,
        complete: `Complete bundle ${suffix}`, incomplete: `Inactive bundle ${suffix}`, seat: `Union-${suffix}` };
    let seeded = false;
    let overrideTouched = false;
    let context: Awaited<ReturnType<typeof browser.newContext>> | null = null;
    let ownerContext: Awaited<ReturnType<typeof browser.newContext>> | null = null;
    try {
        await db.$transaction(async tx => {
            await tx.student.createMany({ data: [
                { id: ids.active, branchId: fixture.branchId, name: names.active, monthlyFee: 0 },
                { id: ids.occupant, branchId: fixture.branchId, name: names.occupant, monthlyFee: 0 },
                { id: ids.inactive, branchId: fixture.branchId, name: names.inactive, status: "INACTIVE", monthlyFee: 0 },
                { id: ids.foreign, branchId: fixture.foreignBranchId, name: names.foreign, monthlyFee: 0 },
            ] });
            await tx.seat.create({ data: { id: ids.seat, branchId: fixture.branchId, label: names.seat } });
            await tx.shift.create({ data: { id: ids.inactiveShift, branchId: fixture.branchId,
                name: `Inactive component ${suffix}`, startTime: "00:00", endTime: "05:59", status: "INACTIVE" } });
            await tx.multiShift.createMany({ data: [
                { id: ids.complete, branchId: fixture.branchId, name: names.complete },
                { id: ids.incomplete, branchId: fixture.branchId, name: names.incomplete },
            ] });
            await tx.multiShiftComponent.createMany({ data: [
                { branchId: fixture.branchId, multiShiftId: ids.complete, shiftId: "dashboard-shift-0", order: 0 },
                { branchId: fixture.branchId, multiShiftId: ids.complete, shiftId: "dashboard-shift-1", order: 1 },
                { branchId: fixture.branchId, multiShiftId: ids.incomplete, shiftId: "dashboard-shift-0", order: 0 },
                { branchId: fixture.branchId, multiShiftId: ids.incomplete, shiftId: ids.inactiveShift, order: 1 },
            ] });
            await tx.seatAllocation.create({ data: { id: ids.occupancy, branchId: fixture.branchId,
                studentId: ids.occupant, seatId: ids.seat, shiftId: "dashboard-shift-1" } });
        }, { timeout: 60_000 });
        seeded = true;
        await db.staffPermissionOverride.upsert({ where: permissionKey,
            create: { staffId: member.id, action: "STUDENTS", allowed: false }, update: { allowed: false } });
        overrideTouched = true;
        expect(await scopedCounts()).toEqual({ ...before, students: before.students + 3, seats: before.seats + 1,
            shifts: before.shifts + 1, multiShifts: before.multiShifts + 2,
            components: before.components + 4, allocations: before.allocations + 1 });
        expect(await db.student.count({ where: { branchId: fixture.foreignBranchId } })).toBe(foreignBefore + 1);

        context = await browser.newContext({ baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3117",
            storageState: staffState, viewport: testInfo.project.name === "mobile" ? { width: 390, height: 844 } : { width: 1491, height: 1055 } });
        const page = await context.newPage();
        await page.route(providerDomains, route => route.abort("blockedbyclient"));
        await refreshDevelopmentSession(page);
        const profile = await request(page, "/api/users/me");
        expect((await profile.json() as { id: string }).id).toBe(fixture.staffId);
        const access = await request(page, `/api/branches/${fixture.branchId}/access`);
        expect(access.status()).toBe(200);
        expect((await access.json() as { permissions: object }).permissions).toMatchObject({ students: false, seat_allocation: true });
        const selector = await request(page, `/api/branches/${fixture.branchId}/seat-allocations/students`);
        expect(selector.status()).toBe(200);
        const body = await selector.json() as { items: { id: string; name: string }[]; canLinkFee: boolean };
        expect(body.canLinkFee).toBe(false);
        expect(body.items).toContainEqual({ id: ids.active, name: names.active });
        expect(body.items.map(item => item.id)).not.toContain(ids.inactive);
        expect(body.items.map(item => item.id)).not.toContain(ids.foreign);
        expect(body.items.every(item => Object.keys(item).sort().join(",") === "id,name")).toBe(true);
        expect((await request(page, `/api/branches/${fixture.branchId}/students?status=ACTIVE`)).status()).toBe(403);

        const capacity = await request(page, `/api/branches/${fixture.branchId}/shifts/capacity?studentId=${ids.active}`);
        expect(capacity.status()).toBe(200);
        const choices = await capacity.json() as { type: string; shiftId: string }[];
        expect(choices.some(choice => choice.type === "MULTISHIFT" && choice.shiftId === ids.complete)).toBe(true);
        expect(choices.some(choice => choice.shiftId === ids.incomplete)).toBe(false);
        const soloMap = await request(page, `/api/branches/${fixture.branchId}/shifts/dashboard-shift-0/seat-map`);
        const bundleMap = await request(page, `/api/branches/${fixture.branchId}/shifts/dashboard-shift-0/seat-map?multiShiftId=${ids.complete}`);
        expect(soloMap.status()).toBe(200);
        expect(bundleMap.status()).toBe(200);
        type MapBody = { seats: { seatId: string; occupied: boolean }[] };
        expect((await soloMap.json() as MapBody).seats.find(seat => seat.seatId === ids.seat)?.occupied).toBe(false);
        expect((await bundleMap.json() as MapBody).seats.find(seat => seat.seatId === ids.seat)?.occupied).toBe(true);

        expect((await open(page, `/branch/${fixture.branchId}/allocations`))?.status()).toBe(200);
        await page.getByRole("button", { name: "Allocate seat", exact: true }).first().click();
        const dialog = page.getByRole("dialog", { name: "Allocate seat", exact: true });
        await expect(dialog.getByRole("button", { name: names.active, exact: true })).toBeVisible();
        await expect(dialog.getByRole("button", { name: names.inactive, exact: true })).toHaveCount(0);
        await expect(dialog.getByRole("button", { name: names.foreign, exact: true })).toHaveCount(0);
        await dialog.getByRole("button", { name: names.active, exact: true }).click();
        const bundle = dialog.locator('button[aria-pressed]').filter({ hasText: names.complete });
        await expect(bundle).toBeVisible();
        await expect(dialog.getByText(names.incomplete, { exact: true })).toHaveCount(0);
        await bundle.click();
        await expect(dialog.getByText("Showing seats free across all component shifts. A seat is available only if it is unoccupied in every shift of this multi-shift.")).toBeVisible();
        await expect(dialog.getByRole("button", { name: names.seat, exact: true })).toBeDisabled();
        await expect(dialog.getByText(/^Link monthly fee to/)).toHaveCount(0);
        await page.screenshot({ path: testInfo.outputPath(`ops01-02-07-${testInfo.project.name}.png`), fullPage: true });

        const ownerState = process.env.PLAYWRIGHT_OWNER_AUTH_STATE;
        if (!ownerState) throw new Error("Verified owner development authentication is required");
        ownerContext = await browser.newContext({ baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3117",
            storageState: ownerState, viewport: { width: 1491, height: 1055 } });
        const ownerPage = await ownerContext.newPage();
        await ownerPage.route(providerDomains, route => route.abort("blockedbyclient"));
        await refreshDevelopmentSession(ownerPage);
        expect((await open(ownerPage, `/branch/${fixture.branchId}/students`))?.status()).toBe(200);
        await ownerPage.getByRole("button", { name: "Add student", exact: true }).click();
        const admission = ownerPage.getByRole("dialog", { name: "Add new student" });
        const allocateNow = admission.getByLabel("Allocate seat now (Optional)");
        await allocateNow.focus();
        await allocateNow.press("Space");
        await expect(allocateNow).toBeChecked();
        const picker = admission.getByRole("group", { name: "Seat allocation" });
        const admissionBundle = picker.locator('button[aria-pressed]').filter({ hasText: names.complete });
        const bundleMapResponse = ownerPage.waitForResponse(response => {
            const url = new URL(response.url());
            return url.pathname === `/api/branches/${fixture.branchId}/shifts/dashboard-shift-0/seat-map`
                && url.searchParams.get("multiShiftId") === ids.complete;
        });
        await admissionBundle.click();
        expect((await bundleMapResponse).status()).toBe(200);
        await expect(picker.getByRole("button", { name: names.seat, exact: true })).toBeDisabled();
        await ownerPage.screenshot({ path: testInfo.outputPath("ops01-admission-bundle-picker.png"), fullPage: true });
        await admission.getByRole("button", { name: "Cancel", exact: true }).click();
        expect(await scopedCounts()).toEqual({ ...before, students: before.students + 3, seats: before.seats + 1,
            shifts: before.shifts + 1, multiShifts: before.multiShifts + 2,
            components: before.components + 4, allocations: before.allocations + 1 });
    } finally {
        await ownerContext?.close();
        await context?.close();
        if (overrideTouched) {
            if (previousStudents) await db.staffPermissionOverride.update({ where: permissionKey, data: { allowed: previousStudents.allowed } });
            else await db.staffPermissionOverride.deleteMany({ where: { staffId: member.id, action: "STUDENTS" } });
        }
        if (seeded) await db.$transaction(async tx => {
            await tx.seatAllocation.deleteMany({ where: { id: ids.occupancy, branchId: fixture.branchId } });
            await tx.multiShiftComponent.deleteMany({ where: { multiShiftId: { in: [ids.complete, ids.incomplete] }, branchId: fixture.branchId } });
            await tx.multiShift.deleteMany({ where: { id: { in: [ids.complete, ids.incomplete] }, branchId: fixture.branchId } });
            await tx.shift.deleteMany({ where: { id: ids.inactiveShift, branchId: fixture.branchId } });
            await tx.seat.deleteMany({ where: { id: ids.seat, branchId: fixture.branchId } });
            await tx.student.deleteMany({ where: { id: { in: [ids.active, ids.occupant, ids.inactive] }, branchId: fixture.branchId } });
            await tx.student.deleteMany({ where: { id: ids.foreign, branchId: fixture.foreignBranchId } });
        }, { timeout: 60_000 });
        const after = await scopedCounts();
        const foreignAfter = await db.student.count({ where: { branchId: fixture.foreignBranchId } });
        const restoredStudents = await db.staffPermissionOverride.findUnique({ where: permissionKey });
        writeFileSync(testInfo.outputPath("ops01-02-07-scoped-counts.json"), JSON.stringify({ before,
            foreignBefore, after, foreignAfter, staffStudentsOverrideBefore: previousStudents?.allowed ?? null,
            staffStudentsOverrideAfter: restoredStudents?.allowed ?? null }, null, 2));
        expect(after).toEqual(before);
        expect(foreignAfter).toBe(foreignBefore);
        expect(restoredStudents?.allowed ?? null).toBe(previousStudents?.allowed ?? null);
    }
});

test("OPS-05 restricted staff deactivation keeps debt selected and cannot waive it", async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "One desktop restricted-staff dialog verifies the denied waiver boundary.");
    await checkedDatabase();
    const staffState = process.env.PLAYWRIGHT_STAFF_AUTH_STATE;
    if (!staffState) throw new Error("Verified staff development authentication is required");
    const member = await db.staff.findUniqueOrThrow({ where: { userId_branchId: { userId: fixture.staffId, branchId: fixture.branchId } } });
    expect(member.role).toBe("STAFF");
    const permissionKey = { staffId_action: { staffId: member.id, action: "VIEW_PAYMENTS" as const } };
    const previous = await db.staffPermissionOverride.findUnique({ where: permissionKey });
    expect(previous?.allowed).toBe(false);
    const studentId = fixture.students[0].id;
    const paymentId = "dashboard-payment-0";
    const studentBefore = await db.student.findUniqueOrThrow({ where: { id: studentId }, select: { status: true } });
    const paymentBefore = await db.payment.findUniqueOrThrow({ where: { id: paymentId },
        select: { status: true, amount: true, collectedAmount: true, waivedAmount: true } });
    const eventsBefore = await db.paymentResolutionEvent.count({ where: { paymentId } });
    let changed = false;
    let context: Awaited<ReturnType<typeof browser.newContext>> | null = null;
    try {
        await db.staffPermissionOverride.update({ where: permissionKey, data: { allowed: true } });
        changed = true;
        context = await browser.newContext({ baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3117",
            storageState: staffState, viewport: testInfo.project.name === "mobile" ? { width: 390, height: 844 } : { width: 1491, height: 1055 } });
        const page = await context.newPage();
        await page.route(providerDomains, route => route.abort("blockedbyclient"));
        await refreshDevelopmentSession(page);
        const access = await request(page, `/api/branches/${fixture.branchId}/access`);
        expect(access.status()).toBe(200);
        expect((await access.json() as { permissions: object }).permissions).toMatchObject({
            students: true, view_payments: true, mark_payment_paid: true, waive_payments: false,
        });

        expect((await open(page, `/branch/${fixture.branchId}/students?studentId=${studentId}`))?.status()).toBe(200);
        const record = page.locator(testInfo.project.name === "mobile" ? `#student-grid-${studentId}` : `#student-table-${studentId}`);
        await expect(record).toBeVisible();
        await record.getByRole("button", { name: "Actions", exact: true }).click();
        await page.getByRole("menuitem", { name: "Deactivate", exact: true }).click();
        const dialog = page.getByRole("alertdialog", { name: `Deactivate ${fixture.students[0].name}?` });
        await expect(dialog).toBeVisible();
        await expect(dialog.getByRole("radio", { name: /Keep as Due/ })).toBeChecked();
        await expect(dialog.getByRole("radio", { name: /Collect remaining fees in Cash/ })).toBeVisible();
        await expect(dialog.getByRole("radio", { name: /Mark as Waived/ })).toHaveCount(0);
        await page.screenshot({ path: testInfo.outputPath(`ops05-restricted-${testInfo.project.name}.png`), fullPage: true });
        await dialog.getByRole("button", { name: "Cancel", exact: true }).click();

        const denied = await request(page, `/api/branches/${fixture.branchId}/students`, "PATCH", {
            id: studentId, status: "INACTIVE", dueResolution: "WAIVED",
        });
        expect(denied.status()).toBe(403);
        expect(await db.student.findUniqueOrThrow({ where: { id: studentId }, select: { status: true } })).toEqual(studentBefore);
        expect(await db.payment.findUniqueOrThrow({ where: { id: paymentId },
            select: { status: true, amount: true, collectedAmount: true, waivedAmount: true } })).toEqual(paymentBefore);
        expect(await db.paymentResolutionEvent.count({ where: { paymentId } })).toBe(eventsBefore);
    } finally {
        await context?.close();
        if (changed) await db.staffPermissionOverride.update({ where: permissionKey, data: { allowed: previous!.allowed } });
        const restored = await db.staffPermissionOverride.findUnique({ where: permissionKey });
        writeFileSync(testInfo.outputPath("ops05-scoped-counts.json"), JSON.stringify({
            paymentResolutionEventsBefore: eventsBefore,
            paymentResolutionEventsAfter: await db.paymentResolutionEvent.count({ where: { paymentId } }),
            paymentBefore, paymentAfter: await db.payment.findUniqueOrThrow({ where: { id: paymentId },
                select: { status: true, amount: true, collectedAmount: true, waivedAmount: true } }),
            studentStatusBefore: studentBefore.status,
            studentStatusAfter: (await db.student.findUniqueOrThrow({ where: { id: studentId }, select: { status: true } })).status,
            staffPaymentViewOverrideBefore: previous?.allowed,
            staffPaymentViewOverrideAfter: restored?.allowed,
        }, null, 2));
        expect(restored?.allowed).toBe(previous?.allowed);
        expect(await db.student.findUniqueOrThrow({ where: { id: studentId }, select: { status: true } })).toEqual(studentBefore);
        expect(await db.paymentResolutionEvent.count({ where: { paymentId } })).toBe(eventsBefore);
    }
});

test("OPS-06 imported student without phone edits another profile field and reloads with phone absent", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "The phone-less student edit is exercised at 390px.");
    await checkedDatabase();
    await page.route(providerDomains, route => route.abort("blockedbyclient"));
    await refreshDevelopmentSession(page);
    const profile = await request(page, "/api/users/me");
    expect((await profile.json() as { id: string }).id).toBe(fixture.ownerId);
    const before = await scopedCounts();
    const branchBefore = await db.branch.findUniqueOrThrow({ where: { id: fixture.branchId }, select: { lastDataChange: true } });
    const suffix = randomUUID().slice(0, 12);
    const id = `audit-ops06-${suffix}-student`;
    const initialName = `Imported sample ${suffix}`;
    const editedName = `Updated imported sample ${suffix}`;
    let inserted = false;
    try {
        await db.student.create({ data: { id, branchId: fixture.branchId, name: initialName,
            phone: null, enrollmentSource: "IMPORT", monthlyFee: 0 } });
        inserted = true;
        expect(await scopedCounts()).toEqual({ ...before, students: before.students + 1 });
        expect((await open(page, `/branch/${fixture.branchId}/students?studentId=${id}`))?.status()).toBe(200);
        const record = page.locator(testInfo.project.name === "mobile" ? `#student-grid-${id}` : `#student-table-${id}`);
        await expect(record).toBeVisible();
        await record.getByRole("button", { name: "Actions", exact: true }).click();
        await page.getByRole("menuitem", { name: "Edit Details", exact: true }).click();
        const dialog = page.getByRole("dialog", { name: "Edit student", exact: true });
        await expect(dialog.getByRole("textbox", { name: "Phone Number", exact: true })).toHaveValue("");
        await dialog.getByRole("textbox", { name: "Full Name *", exact: true }).fill(editedName);
        await dialog.getByRole("button", { name: "Save Changes", exact: true }).click();
        await expect(dialog).toHaveCount(0);
        await expect.poll(async () => db.student.findUniqueOrThrow({ where: { id },
            select: { name: true, phone: true, enrollmentSource: true, monthlyFee: true } })).toEqual({
            name: editedName, phone: null, enrollmentSource: "IMPORT", monthlyFee: 0,
        });
        await page.reload({ waitUntil: "domcontentloaded" });
        await expect(record).toContainText(editedName);
        await expect(record).toContainText("No phone");
        await page.screenshot({ path: testInfo.outputPath(`ops06-imported-no-phone-${testInfo.project.name}.png`), fullPage: true });
    } finally {
        if (inserted) await db.student.deleteMany({ where: { id, branchId: fixture.branchId } });
        await db.branch.update({ where: { id: fixture.branchId }, data: { lastDataChange: branchBefore.lastDataChange } });
        const after = await scopedCounts();
        const branchAfter = await db.branch.findUniqueOrThrow({ where: { id: fixture.branchId }, select: { lastDataChange: true } });
        writeFileSync(testInfo.outputPath("ops06-scoped-counts.json"), JSON.stringify({ before, after,
            branchLastDataChangeRestored: branchAfter.lastDataChange?.toISOString() === branchBefore.lastDataChange?.toISOString() }, null, 2));
        expect(after).toEqual(before);
        expect(branchAfter.lastDataChange).toEqual(branchBefore.lastDataChange);
    }
});

test("OPS-08 authenticated setup reaches independent record and student pages beyond 500", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "This large scoped fixture checks desktop paging and then switches to narrow mobile.");
    test.setTimeout(300_000);
    await checkedDatabase();
    await page.route(providerDomains, route => route.abort("blockedbyclient"));
    await refreshDevelopmentSession(page);
    const profile = await request(page, "/api/users/me");
    expect((await profile.json() as { id: string }).id).toBe(fixture.ownerId);
    const before = await scopedCounts();
    const branchBefore = await db.branch.findUniqueOrThrow({ where: { id: fixture.branchId }, select: { lastDataChange: true } });
    const suffix = randomUUID().slice(0, 12);
    const number = (index: number) => String(index).padStart(4, "0");
    const studentId = (index: number) => `audit-ops08-${suffix}-student-${number(index)}`;
    const studentName = (index: number) => `Audit Pager ${number(index)}`;
    const studentIds = Array.from({ length: 505 }, (_, index) => studentId(index));
    const recordIndexes = (last: number) => [...Array.from({ length: last + 1 }, (_, index) => index), 504];
    const expectationIndexes = recordIndexes(502);
    const termIndexes = recordIndexes(500);
    let inserted = false;
    let during: Awaited<ReturnType<typeof scopedCounts>> | null = null;
    try {
        await db.$transaction(async tx => {
            await tx.student.createMany({ data: studentIds.map((id, index) => ({ id,
                branchId: fixture.branchId, name: studentName(index), monthlyFee: 0 })) });
            await tx.attendanceExpectation.createMany({ data: expectationIndexes.map(index => ({
                id: `audit-ops08-${suffix}-expectation-${number(index)}`, branchId: fixture.branchId,
                studentId: studentId(index), weekdays: [1, 2, 3, 4, 5], expectedBy: "08:00",
            })) });
            await tx.membershipTerm.createMany({ data: termIndexes.map(index => ({
                id: `audit-ops08-${suffix}-term-${number(index)}`, branchId: fixture.branchId,
                studentId: studentId(index), label: `Audit term ${number(index)}`,
                startDate: "2030-10-01", endDate: "2030-10-31",
            })) });
        }, { timeout: 60_000 });
        inserted = true;
        during = await scopedCounts();
        expect(during).toEqual({ ...before, students: before.students + 505,
            expectations: before.expectations + 504, terms: before.terms + 502 });

        expect((await open(page, `/branch/${fixture.branchId}/dashboard-settings?section=terms`))?.status()).toBe(200);
        await expect(page.getByRole("button", { name: "Membership terms", exact: true })).toHaveAttribute("aria-pressed", "true");
        const nextTerms = page.getByRole("button", { name: "Next Membership terms", exact: true });
        for (let index = 0; index < 10; index++) await nextTerms.click();
        await expect(page.getByRole("cell", { name: "Audit term 0504", exact: true })).toBeVisible();
        await expect(nextTerms).toBeDisabled();

        const nextStudents = page.getByRole("button", { name: "Next Students", exact: true });
        for (let index = 0; index < 10; index++) await nextStudents.click();
        await expect(nextStudents).toBeDisabled();
        await expect(page.getByRole("cell", { name: "Audit term 0504", exact: true })).toBeVisible();
        await page.getByRole("combobox", { name: "Student", exact: true }).click();
        await page.getByRole("option", { name: studentName(504), exact: true }).click();
        await expect(page.getByRole("cell", { name: "Audit term 0504", exact: true })).toBeVisible();
        const focusedTerms = await request(page, `/api/branches/${fixture.branchId}/dashboard/terms?studentId=${studentId(504)}&limit=50`);
        expect(focusedTerms.status()).toBe(200);
        expect((await focusedTerms.json() as { selectedStudent: { id: string }; selectedItem: { label: string } })).toMatchObject({
            selectedStudent: { id: studentId(504) }, selectedItem: { label: "Audit term 0504" },
        });

        expect((await open(page, `/branch/${fixture.branchId}/dashboard-settings?section=expectations`))?.status()).toBe(200);
        await expect(page.getByRole("button", { name: "Attendance expectations", exact: true })).toHaveAttribute("aria-pressed", "true");
        const nextExpectations = page.getByRole("button", { name: "Next Attendance expectations", exact: true });
        for (let index = 0; index < 10; index++) await nextExpectations.click();
        await expect(page.getByRole("rowheader", { name: studentName(504), exact: true })).toBeVisible();
        await expect(nextExpectations).toBeDisabled();
        await page.setViewportSize({ width: 390, height: 844 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.screenshot({ path: testInfo.outputPath("ops08-final-page-mobile.png"), fullPage: true });
    } finally {
        if (inserted) await db.$transaction(async tx => {
            await tx.membershipTerm.deleteMany({ where: { id: { in: termIndexes.map(index => `audit-ops08-${suffix}-term-${number(index)}`) }, branchId: fixture.branchId } });
            await tx.attendanceExpectation.deleteMany({ where: { id: { in: expectationIndexes.map(index => `audit-ops08-${suffix}-expectation-${number(index)}`) }, branchId: fixture.branchId } });
            await tx.student.deleteMany({ where: { id: { in: studentIds }, branchId: fixture.branchId } });
        }, { timeout: 60_000 });
        await db.branch.update({ where: { id: fixture.branchId }, data: { lastDataChange: branchBefore.lastDataChange } });
        const after = await scopedCounts();
        const branchAfter = await db.branch.findUniqueOrThrow({ where: { id: fixture.branchId }, select: { lastDataChange: true } });
        writeFileSync(testInfo.outputPath("ops08-scoped-counts.json"), JSON.stringify({ before, during, inserted, after,
            branchLastDataChangeRestored: branchAfter.lastDataChange.toISOString() === branchBefore.lastDataChange.toISOString() }, null, 2));
        expect(after).toEqual(before);
        expect(branchAfter.lastDataChange).toEqual(branchBefore.lastDataChange);
    }
});

test("OPS-03 committed move survives a real denied fee edit and retries only the fee", async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "One desktop partial-failure dialog covers committed move and fee-only retry.");
    await checkedDatabase();
    const staffState = process.env.PLAYWRIGHT_STAFF_AUTH_STATE;
    if (!staffState) throw new Error("Verified staff development authentication is required");
    const member = await db.staff.findUniqueOrThrow({ where: { userId_branchId: { userId: fixture.staffId, branchId: fixture.branchId } } });
    expect(member.role).toBe("STAFF");
    const permissionKey = { staffId_action: { staffId: member.id, action: "STUDENTS" as const } };
    const previousPermission = await db.staffPermissionOverride.findUnique({ where: permissionKey });
    expect(previousPermission?.allowed ?? true).toBe(true);
    const branchBefore = await db.branch.findUniqueOrThrow({ where: { id: fixture.branchId }, select: { lastDataChange: true } });
    const before = await scopedCounts();
    const suffix = randomUUID().slice(0, 12);
    const studentId = `audit-ops03-${suffix}-student`;
    const oldSeatId = `audit-ops03-${suffix}-seat-old`;
    const newSeatId = `audit-ops03-${suffix}-seat-new`;
    const oldAllocationId = `audit-ops03-${suffix}-allocation-old`;
    const studentName = `Partial move ${suffix}`;
    const oldSeatLabel = `Old-${suffix}`;
    const newSeatLabel = `New-${suffix}`;
    let seeded = false;
    let permissionTouched = false;
    let allocationPatches = 0;
    let feePatches = 0;
    let during: Awaited<ReturnType<typeof scopedCounts>> | null = null;
    let context: Awaited<ReturnType<typeof browser.newContext>> | null = null;
    const restorePermission = async () => {
        if (!permissionTouched) return;
        if (previousPermission) await db.staffPermissionOverride.update({ where: permissionKey, data: { allowed: previousPermission.allowed } });
        else await db.staffPermissionOverride.deleteMany({ where: { staffId: member.id, action: "STUDENTS" } });
        permissionTouched = false;
    };
    try {
        await db.$transaction(async tx => {
            await tx.student.create({ data: { id: studentId, branchId: fixture.branchId,
                name: studentName, monthlyFee: 500 } });
            await tx.seat.createMany({ data: [
                { id: oldSeatId, branchId: fixture.branchId, label: oldSeatLabel },
                { id: newSeatId, branchId: fixture.branchId, label: newSeatLabel },
            ] });
            await tx.seatAllocation.create({ data: { id: oldAllocationId, branchId: fixture.branchId,
                studentId, seatId: oldSeatId, shiftId: "dashboard-shift-0" } });
        });
        seeded = true;
        context = await browser.newContext({ baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3117",
            storageState: staffState, viewport: { width: 1491, height: 1055 } });
        const page = await context.newPage();
        await page.route(providerDomains, route => route.abort("blockedbyclient"));
        await refreshDevelopmentSession(page);
        const profile = await request(page, "/api/users/me");
        expect((await profile.json() as { id: string }).id).toBe(fixture.staffId);
        expect((await open(page, `/branch/${fixture.branchId}/allocations?allocationId=${oldAllocationId}`))?.status()).toBe(200);
        await page.getByRole("button", { name: "Table view" }).click();
        const oldRow = page.locator(`#allocation-record-${oldAllocationId}-row`);
        await expect(oldRow).toBeVisible();
        await oldRow.getByRole("button", { name: "Change", exact: true }).click();
        const dialog = page.getByRole("dialog", { name: "Change seat or shift" });
        await dialog.locator("#update-allocation-fee").fill("650");
        await dialog.getByRole("button", { name: newSeatLabel, exact: true }).click();
        await page.route(`**/api/branches/${fixture.branchId}/students`, async route => {
            if (route.request().method() === "PATCH" &&
                (route.request().postDataJSON() as { id?: string }).id === studentId) {
                feePatches++;
                if (feePatches === 1) {
                    await db.staffPermissionOverride.upsert({ where: permissionKey,
                        create: { staffId: member.id, action: "STUDENTS", allowed: false }, update: { allowed: false } });
                    permissionTouched = true;
                }
            }
            await route.continue();
        });
        page.on("request", outgoing => {
            if (outgoing.method() === "PATCH" && new URL(outgoing.url()).pathname.startsWith("/api/seat-allocations/")) allocationPatches++;
        });
        const deniedFee = page.waitForResponse(response => response.request().method() === "PATCH" &&
            new URL(response.url()).pathname === `/api/branches/${fixture.branchId}/students` && response.status() === 403);
        await dialog.getByRole("button", { name: "Update", exact: true }).click();
        await deniedFee;
        await expect(dialog.getByText("Seat and shifts updated.", { exact: true })).toBeVisible();
        await expect(dialog.getByRole("button", { name: "Retry fee update", exact: true })).toBeVisible();
        await expect(dialog.getByRole("group", { name: "Seat and shift selection" })).toHaveCount(0);
        expect(allocationPatches).toBe(1);
        expect(feePatches).toBe(1);
        const moved = await db.seatAllocation.findMany({ where: { studentId, branchId: fixture.branchId },
            select: { id: true, seatId: true, endDate: true } });
        expect(moved).toHaveLength(2);
        expect(moved.find(row => row.id === oldAllocationId)?.endDate).not.toBeNull();
        const replacement = moved.find(row => row.id !== oldAllocationId);
        expect(replacement).toMatchObject({ seatId: newSeatId, endDate: null });
        expect((await db.student.findUniqueOrThrow({ where: { id: studentId }, select: { monthlyFee: true } })).monthlyFee).toBe(500);
        during = await scopedCounts();
        expect(during).toEqual({ ...before, students: before.students + 1, seats: before.seats + 2,
            allocations: before.allocations + 2 });
        await page.screenshot({ path: testInfo.outputPath("ops03-committed-move-fee-denied.png"), fullPage: true });

        await restorePermission();
        await dialog.getByRole("button", { name: "Retry fee update", exact: true }).click();
        await expect(dialog).toHaveCount(0);
        expect(allocationPatches).toBe(1);
        expect(feePatches).toBe(2);
        expect((await db.student.findUniqueOrThrow({ where: { id: studentId }, select: { monthlyFee: true } })).monthlyFee).toBe(650);
        expect(await db.seatAllocation.count({ where: { studentId, branchId: fixture.branchId } })).toBe(2);
        expect((await open(page, `/branch/${fixture.branchId}/allocations`))?.status()).toBe(200);
        await page.reload({ waitUntil: "domcontentloaded" });
        await page.getByRole("button", { name: "Table view" }).click();
        const reloaded = page.getByRole("table", { name: "Loaded seat allocations" }).getByRole("row").filter({ hasText: studentName });
        await expect(reloaded).toHaveCount(1);
        await expect(reloaded).toContainText(newSeatLabel);
    } finally {
        await context?.close();
        await restorePermission();
        if (seeded) await db.$transaction(async tx => {
            await tx.seatAllocation.deleteMany({ where: { studentId, branchId: fixture.branchId } });
            await tx.student.deleteMany({ where: { id: studentId, branchId: fixture.branchId } });
            await tx.seat.deleteMany({ where: { id: { in: [oldSeatId, newSeatId] }, branchId: fixture.branchId } });
        });
        await db.branch.update({ where: { id: fixture.branchId }, data: { lastDataChange: branchBefore.lastDataChange } });
        const after = await scopedCounts();
        const permissionAfter = await db.staffPermissionOverride.findUnique({ where: permissionKey });
        const branchAfter = await db.branch.findUniqueOrThrow({ where: { id: fixture.branchId }, select: { lastDataChange: true } });
        writeFileSync(testInfo.outputPath("ops03-scoped-counts.json"), JSON.stringify({ before, during, after,
            allocationPatches, feePatches, staffPermissionBefore: previousPermission?.allowed ?? null,
            staffPermissionAfter: permissionAfter?.allowed ?? null,
            branchLastDataChangeRestored: branchAfter.lastDataChange.toISOString() === branchBefore.lastDataChange.toISOString() }, null, 2));
        expect(after).toEqual(before);
        expect(permissionAfter?.allowed ?? null).toBe(previousPermission?.allowed ?? null);
        expect(branchAfter.lastDataChange).toEqual(branchBefore.lastDataChange);
    }
});

test("OPS-09 Hindi preference keeps a renewal notice on the terms section", async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "One desktop Hindi preference journey covers translated same-route navigation.");
    await checkedDatabase();
    const staffState = process.env.PLAYWRIGHT_STAFF_AUTH_STATE;
    if (!staffState) throw new Error("Verified staff development authentication is required");
    const previous = await db.user.findUniqueOrThrow({ where: { id: fixture.staffId }, select: { interfaceLanguage: true } });
    expect(previous.interfaceLanguage).toBe("en");
    const termsBefore = await db.membershipTerm.count({ where: { branchId: fixture.branchId } });
    let context: Awaited<ReturnType<typeof browser.newContext>> | null = null;
    try {
        context = await browser.newContext({ baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3117",
            storageState: staffState, viewport: { width: 1491, height: 1055 } });
        const page = await context.newPage();
        await page.route(providerDomains, route => route.abort("blockedbyclient"));
        await refreshDevelopmentSession(page);
        expect((await open(page, `/branch/${fixture.branchId}/dashboard-settings?section=expectations`))?.status()).toBe(200);
        await page.getByRole("combobox", { name: "Interface language", exact: true }).selectOption("hi");
        await expect.poll(async () => (await db.user.findUniqueOrThrow({ where: { id: fixture.staffId },
            select: { interfaceLanguage: true } })).interfaceLanguage).toBe("hi");
        await expect(page.getByRole("button", { name: "अपेक्षित हाजिरी", exact: true })).toHaveAttribute("aria-pressed", "true");
        await page.getByRole("button", { name: "सूचनाएँ", exact: true }).click();
        const dialog = page.getByRole("dialog", { name: "सूचनाएँ", exact: true });
        await dialog.getByLabel("सभी सूचनाएँ दिखाएँ").check();
        const destination = `/branch/${fixture.branchId}/dashboard-settings?section=terms`;
        const link = dialog.getByRole("link", { name: /^आने वाले नवीनीकरण/ });
        await expect(link).toHaveAttribute("href", destination);
        await link.click();
        await expect(page).toHaveURL(new RegExp(`/branch/${fixture.branchId}/dashboard-settings\\?section=terms$`));
        await expect(page.getByRole("button", { name: "सदस्यता अवधि", exact: true })).toHaveAttribute("aria-pressed", "true");
        await expect(page.getByRole("button", { name: "सदस्यता अवधि सेव करें", exact: true })).toBeDisabled();
        expect(await db.membershipTerm.count({ where: { branchId: fixture.branchId } })).toBe(termsBefore);
        await page.screenshot({ path: testInfo.outputPath("ops09-hindi-terms.png"), fullPage: true });
    } finally {
        await context?.close();
        await db.user.update({ where: { id: fixture.staffId }, data: { interfaceLanguage: previous.interfaceLanguage } });
        const restored = await db.user.findUniqueOrThrow({ where: { id: fixture.staffId }, select: { interfaceLanguage: true } });
        const termsAfter = await db.membershipTerm.count({ where: { branchId: fixture.branchId } });
        writeFileSync(testInfo.outputPath("ops09-hindi-scoped-counts.json"), JSON.stringify({
            interfaceLanguageBefore: previous.interfaceLanguage, interfaceLanguageAfter: restored.interfaceLanguage,
            termsBefore, termsAfter,
        }, null, 2));
        expect(restored.interfaceLanguage).toBe(previous.interfaceLanguage);
        expect(termsAfter).toBe(termsBefore);
    }
});
