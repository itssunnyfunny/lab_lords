import fs from "node:fs";
import { expect, test } from "@playwright/test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/app/generated/prisma/client";
import { assertDisposableTestDatabaseTarget } from "../setup/testDatabaseSafety";
import { refreshDevelopmentSession } from "./helpers/development-session";
import type { AttendancePage } from "@/lib/attendance";

const statePath = process.env.PLAYWRIGHT_OWNER_AUTH_STATE;
const available = Boolean(statePath && fs.existsSync(statePath) && process.env.TEST_DATABASE_URL);
test.use({ storageState: available ? statePath : { cookies: [], origins: [] } });
test("signed-in manual marks, visits, history and correction use the real isolated service", async ({ page }) => {
    test.skip(!available, "Requires existing development authentication and an explicitly confirmed disposable local database.");
    test.setTimeout(120000);
    const target = assertDisposableTestDatabaseTarget(process.env.TEST_DATABASE_URL, process.env);
    // Dedicated browser database: never truncate or connect to the integration runner's DB.
    if (!target.databaseName.includes("browser_test")) throw new Error("Connected browser test requires its separate browser_test database");
    const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.TEST_DATABASE_URL! }) });
    try {
        const identity = await db.$queryRaw<Array<{ name: string }>>`SELECT current_database() AS name`;
        expect(identity[0].name).toBe(target.databaseName);
        await refreshDevelopmentSession(page);
        const profile = await page.evaluate(async () => { const response = await fetch("/api/users/me"); if (!response.ok) throw new Error("Development session unavailable"); const user = await response.json(); return { id: user.id }; });
        // A real Clerk session must resolve to this exact local database before fixture writes.
        expect(await db.user.count({ where: { id: profile.id } })).toBe(1);
        const org = await db.organization.create({ data: { name: "Attendance isolated smoke", ownerId: profile.id, billingModelVersion: "LEGACY", timezone: "Asia/Kolkata" } });
        const branch = await db.branch.create({ data: { organizationId: org.id, name: "Attendance smoke" } });
        const student = await db.student.create({ data: { branchId: branch.id, name: "Attendance smoke student", joinedAt: new Date(Date.now() - 86400000) } });
        await page.goto(`/branch/${branch.id}/attendance`);
        const row = page.getByRole("article", { name: "Attendance for Attendance smoke student" });
        await expect(row).toBeVisible();
        await page.screenshot({ path: `test-results/attendance-roster-${test.info().project.name}.png`, fullPage: true });
        await row.getByRole("button", { name: "Mark Present", exact: true }).click();
        await page.getByRole("button", { name: "Confirm", exact: true }).click();
        await expect(row.getByText("Present", { exact: true })).toBeVisible();
        expect(await db.attendanceVisit.count({ where: { branchId: branch.id } })).toBe(0);
        await row.getByRole("button", { name: "Check in", exact: true }).click(); await page.getByRole("button", { name: "Confirm", exact: true }).click();
        await expect(row.getByRole("button", { name: "Check out", exact: true })).toBeVisible();
        await row.getByRole("button", { name: "Check out", exact: true }).click(); await page.getByRole("button", { name: "Confirm", exact: true }).click();
        await expect(row.getByRole("button", { name: "Check in", exact: true })).toBeVisible();
        await row.getByRole("button", { name: "Check in", exact: true }).click(); await page.getByRole("button", { name: "Confirm", exact: true }).click();
        await expect(row.getByRole("button", { name: "Check out", exact: true })).toBeVisible();
        await row.getByRole("button", { name: "History & QR" }).click();
        await page.getByRole("button", { name: "Correct / close missed checkout" }).click();
        const departure = new Date().toISOString();
        await page.getByLabel("Check-out timestamp", { exact: true }).fill(departure);
        await page.getByLabel("Correction reason", { exact: true }).fill("Verified departure at the front desk");
        await page.getByRole("button", { name: "Confirm", exact: true }).click();
        await expect(page.getByText("Visit corrected", { exact: true })).toBeVisible();
        await expect(page.getByText("QR", { exact: true })).toHaveCount(0);
        const snapshot = await page.evaluate(async branchId => (await (await fetch(`/api/branches/${branchId}/attendance`)).json()) as AttendancePage, branch.id);
        expect(snapshot.counts).toEqual({ attended: 1, absent: 0, notMarked: 0, open: 0 });
        expect(await db.attendanceVisit.count({ where: { branchId: branch.id } })).toBe(2);
        expect(await db.auditLog.count({ where: { branchId: branch.id, action: "ATTENDANCE_CHANGED" } })).toBe(5);
        expect(await db.payment.count({ where: { branchId: branch.id } })).toBe(0);
        expect(await db.seatAllocation.count({ where: { branchId: branch.id } })).toBe(0);
        expect((await db.student.findUniqueOrThrow({ where: { id: student.id } })).status).toBe("ACTIVE");
        await page.screenshot({ path: `test-results/attendance-connected-${test.info().project.name}.png`, fullPage: true });
        await page.getByRole("dialog").getByRole("button", { name: "Close dialog", exact: true }).click();
        await page.goto(`/branch/${branch.id}/students`);
        await expect(page.getByRole("button", { name: "Actions", exact: true }).first()).toBeVisible();
        await page.getByRole("button", { name: "Actions", exact: true }).first().click();
        await page.getByRole("menuitem", { name: "Attendance & QR" }).click();
        await expect(page.getByRole("heading", { name: "Attendance history & QR" })).toBeVisible();
        await expect(page.getByText("Present", { exact: false }).first()).toBeVisible();
    } finally { await db.$disconnect(); }
});
