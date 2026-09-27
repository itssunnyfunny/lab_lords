import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { DashboardService as Dashboard } from "@/services/dashboard.service";
import { FeeCollectionService } from "@/services/feeCollection.service";
import { AttendanceService } from "@/services/attendance.service";
import { RenewalsService } from "@/services/renewals.service";
import { createTestWorld, createStudent, createPayment, createUser, createStaff } from "@/tests/factories";
import { resetDatabase, testPrisma as db, disconnectDatabase } from "@/tests/setup/db";
import { dashboardDateOffset, dashboardToday } from "@/lib/dashboardMath";
import type { Prisma } from "@/app/generated/prisma/client";

async function fixture() {
    const world = await createTestWorld();
    await db.organization.update({ where: { id: world.org.id }, data: { billingModelVersion: "WORKSPACE_V2" } });
    await db.ownerTrialGrant.create({ data: { ownerId: world.user.id, organizationId: world.org.id, source: "ONBOARDING", status: "ACTIVE",
        trialStartedAt: new Date(), trialEndsAt: new Date(Date.now() + 7 * 86_400_000) } });
    const student = await createStudent({ branchId: world.branch.id });
    const today = dashboardToday(new Date(), "Asia/Kolkata");
    return { ...world, student, today };
}

describe("Dashboard operations — real disposable PostgreSQL", () => {
    beforeEach(resetDatabase);
    afterAll(disconnectDatabase);

    it("keeps collected cash, fee cohort balances, waivers and unpaid dues distinct", async () => {
        const f = await fixture();
        const current = await createPayment({ branchId: f.branch.id, studentId: f.student.id, amount: 1200,
            periodStart: new Date(`${f.today.slice(0, 7)}-01T00:00:00+05:30`), periodEnd: new Date(`${dashboardDateOffset(f.today, 1)}T00:00:00+05:30`),
            dueDate: new Date(`${f.today}T00:00:00+05:30`) });
        const earlier = await createPayment({ branchId: f.branch.id, studentId: f.student.id, amount: 800,
            periodStart: new Date("2025-01-01T00:00:00Z"), periodEnd: new Date("2025-02-01T00:00:00Z"), dueDate: new Date("2025-02-01T00:00:00Z") });
        const collection = await FeeCollectionService.collect(f.user.id, f.branch.id, { studentId: f.student.id, paymentIds: [current.id], amount: 700,
            method: "CASH", reference: "", note: "", idempotencyKey: randomUUID() });
        await FeeCollectionService.collect(f.user.id, f.branch.id, { studentId: f.student.id, paymentIds: [earlier.id], amount: 200,
            method: "CASH", reference: "", note: "", idempotencyKey: randomUUID() });
        const snapshot = await Dashboard.overview(f.user.id, f.branch.id);
        expect(snapshot.money).toMatchObject({ status: "success", data: { collectedThisMonth: 900, pendingDues: 1100, overdueAmount: 600, comparisonPercent: null } });
        expect(snapshot.collections).toMatchObject({ status: "success", data: { billed: 1200, collected: 700, pending: 500, waived: 0 } });
        expect(snapshot.collections.data!.points.reduce((sum, point) => sum + point.collected, 0)).toBe(700);
        expect(snapshot.collections.data!.rate).toBeCloseTo(700 / 1200 * 100, 0);
        expect(snapshot.students.data).toEqual({ active: 1, comparison: null });
        await createPayment({ branchId: f.branch.id, studentId: f.student.id, amount: 300, status: "WAIVED",
            periodStart: new Date("2024-01-01T00:00:00Z"), periodEnd: new Date("2024-02-01T00:00:00Z"), dueDate: current.dueDate });
        await createPayment({ branchId: f.branch.id, studentId: f.student.id, amount: 400, status: "PAID", paidAt: new Date(),
            periodStart: new Date("2024-02-01T00:00:00Z"), periodEnd: new Date("2024-03-01T00:00:00Z"), dueDate: current.dueDate });
        const legacy = await Dashboard.overview(f.user.id, f.branch.id);
        expect(legacy.money.data).toMatchObject({ collectedThisMonth: 1300, pendingDues: 1100 });
        expect(legacy.collections.data).toMatchObject({ billed: 1900, collected: 1100, pending: 500, waived: 300, rate: 69 });
        await FeeCollectionService.void(f.user.id, f.branch.id, collection.id, "Correct synthetic duplicate collection");
        const voided = await Dashboard.overview(f.user.id, f.branch.id);
        expect(voided.money.data).toMatchObject({ collectedThisMonth: 600, pendingDues: 1800 });
        expect(voided.collections.data).toMatchObject({ billed: 1900, collected: 400, pending: 1200, waived: 300, rate: 25 });
    });

    it("unknown schedules stay unconfigured and configured gaps never mutate attendance", async () => {
        const f = await fixture();
        expect((await Dashboard.overview(f.user.id, f.branch.id)).attendance.data).toMatchObject({ configured: false, expectedToday: 0, attendedToday: 0, gaps: 0 });
        await Dashboard.saveExpectation(f.user.id, f.branch.id, { studentId: f.student.id, weekdays: [0, 1, 2, 3, 4, 5, 6], expectedBy: "00:00", enabled: true });
        expect((await Dashboard.overview(f.user.id, f.branch.id)).attendance.data).toMatchObject({ configured: true, expectedToday: 1, attendedToday: 0, gaps: 1 });
        expect(await db.attendanceMark.count()).toBe(0);
        await AttendanceService.command(f.user.id, f.branch.id, { kind: "MARK", key: randomUUID(), date: f.today, status: "PRESENT", reason: "",
            students: [{ studentId: f.student.id, version: 0 }] });
        expect((await Dashboard.overview(f.user.id, f.branch.id)).attendance.data).toMatchObject({ expectedToday: 1, attendedToday: 1, gaps: 0 });
        expect(await db.attendanceVisit.count()).toBe(0);
        expect(await db.payment.count()).toBe(0);
    });

    it("attendance deadlines use the configured branch timezone across UTC midnight", async () => {
        const f = await fixture();
        await Dashboard.saveExpectation(f.user.id, f.branch.id, { studentId: f.student.id, weekdays: [0, 1, 2, 3, 4, 5, 6], expectedBy: "00:15", enabled: true });
        const before = await Dashboard.overview(f.user.id, f.branch.id, undefined, new Date("2026-09-26T18:44:59Z"));
        const after = await Dashboard.overview(f.user.id, f.branch.id, undefined, new Date("2026-09-26T18:45:00Z"));
        expect(before.today).toBe("2026-09-27");
        expect(before.attendance.data).toMatchObject({ configured: true, expectedToday: 1, gaps: 0 });
        expect(after.attendance.data).toMatchObject({ configured: true, expectedToday: 1, gaps: 1 });
        expect(await db.attendanceMark.count()).toBe(0);
    });

    it("tasks and follow-up completion persist without settling debt or changing membership", async () => {
        const f = await fixture();
        const payment = await createPayment({ branchId: f.branch.id, studentId: f.student.id, amount: 900,
            periodStart: new Date("2026-08-01T00:00:00Z"), periodEnd: new Date("2026-09-01T00:00:00Z"), dueDate: new Date("2026-09-01T00:00:00Z") });
        await RenewalsService.saveFollowUp(f.user.id, f.branch.id, { studentId: f.student.id, type: "MONTHLY", periodStart: payment.periodStart.toISOString(),
            note: "Call at agreed time", outcome: "CALL_BACK", nextFollowUpAt: f.today });
        const followUp = await db.renewalFollowUp.findFirstOrThrow();
        await Dashboard.updateFollowUp(f.user.id, f.branch.id, followUp.id, { completed: true });
        expect((await Dashboard.listFollowUps(f.user.id, f.branch.id, { filter: "COMPLETED" })).items).toHaveLength(1);
        expect((await Dashboard.overview(f.user.id, f.branch.id)).followUps.data?.pending).toBe(0);
        const task = await Dashboard.createTask(f.user.id, f.branch.id, { title: "Review seating", assigneeId: f.user.id });
        await Dashboard.updateTask(f.user.id, f.branch.id, task.id, { status: "DONE" });
        expect((await Dashboard.listTasks(f.user.id, f.branch.id, { status: "DONE" })).items).toHaveLength(1);
        expect(await db.payment.findUniqueOrThrow({ where: { id: payment.id } })).toMatchObject({ status: "DUE", collectedAmount: 0 });
        expect(await db.student.findUniqueOrThrow({ where: { id: f.student.id } })).toMatchObject({ status: "ACTIVE" });
        expect(await db.dashboardEvent.count({ where: { branchId: f.branch.id } })).toBe(4);
    });

    it("terms are explicit, reject overlapping/foreign rows and never generate fees", async () => {
        const f = await fixture(), other = await createTestWorld();
        const foreign = await createStudent({ branchId: other.branch.id });
        const input = { studentId: f.student.id, label: "Study membership", startDate: f.today, endDate: dashboardDateOffset(f.today, 3) };
        await Dashboard.saveTerm(f.user.id, f.branch.id, input);
        await expect(Dashboard.saveTerm(f.user.id, f.branch.id, input)).rejects.toThrow(/already covers/);
        await expect(Dashboard.saveTerm(f.user.id, f.branch.id, { ...input, studentId: foreign.id })).rejects.toThrow("Not found");
        await expect(Dashboard.saveTerm(f.user.id, f.branch.id, { ...input, studentId: "missing-student" })).rejects.toThrow("Not found");
        expect((await Dashboard.overview(f.user.id, f.branch.id)).terms.data).toMatchObject({ configured: true, renewalsThisWeek: 1 });
        expect(await db.payment.count()).toBe(0);
    });

    it("snapshots preserve prospective coverage and refuse update/delete", async () => {
        const f = await fixture();
        expect((await Dashboard.overview(f.user.id, f.branch.id)).seating.data?.coverageStartedAt).toBeNull();
        await Dashboard.captureOccupancy(f.user.id, f.branch.id);
        await Dashboard.captureOccupancy(f.user.id, f.branch.id);
        expect(await db.occupancySnapshot.count()).toBe(1);
        const row = await db.occupancySnapshot.findFirstOrThrow();
        expect(row).toMatchObject({ capacity: 1, occupied: 0 });
        await expect(db.occupancySnapshot.update({ where: { id: row.id }, data: { occupied: 1 } })).rejects.toThrow();
        await expect(db.occupancySnapshot.delete({ where: { id: row.id } })).rejects.toThrow();
        const seating = (await Dashboard.overview(f.user.id, f.branch.id)).seating.data!;
        expect(seating.coverageStartedAt).not.toBeNull();
        expect(seating.rows[0].cells.filter(cell => cell.date !== f.today).every(cell => cell.capacity === null)).toBe(true);
    });

    it("reminders retain read/snooze/dismiss state for identical conditions", async () => {
        const f = await fixture();
        await Dashboard.saveExpectation(f.user.id, f.branch.id, { studentId: f.student.id, weekdays: [0, 1, 2, 3, 4, 5, 6], expectedBy: "00:00", enabled: true });
        const first = await Dashboard.notifications(f.user.id, f.branch.id);
        const reminder = first.items.find(item => item.kind === "ATTENDANCE")!;
        expect(reminder.read).toBe(false);
        await Dashboard.updateNotification(f.user.id, f.branch.id, { key: reminder.key, action: "READ" });
        expect((await Dashboard.notifications(f.user.id, f.branch.id)).items.find(item => item.key === reminder.key)?.read).toBe(true);
        await Dashboard.updateNotification(f.user.id, f.branch.id, { key: reminder.key, action: "SNOOZE" });
        await Dashboard.updateNotification(f.user.id, f.branch.id, { key: reminder.key, action: "DISMISS" });
        expect((await Dashboard.notifications(f.user.id, f.branch.id)).items.find(item => item.key === reminder.key)).toMatchObject({ read: true, dismissed: true });
        expect(await db.dashboardNotificationState.count()).toBe(1);
        expect((await Dashboard.overview(f.user.id, f.branch.id)).attendance.data?.gaps).toBe(1);
    });

    it("foreign and missing branches/children remain indistinguishable", async () => {
        const f = await fixture(), foreign = await createTestWorld();
        const task = await Dashboard.createTask(f.user.id, f.branch.id, { title: "Private task" });
        const errors = await Promise.all([foreign.branch.id, "missing-branch"].map(async branchId => {
            try { await Dashboard.overview(f.user.id, branchId); return "unexpected access"; } catch (error) { return (error as Error).message; }
        }));
        expect(errors[0]).toBe(errors[1]);
        const secondTask = await db.dashboardTask.create({ data: { branchId: foreign.branch.id, creatorId: foreign.user.id, title: "Private other task" } });
        for (const id of [secondTask.id, "missing-task"]) await expect(Dashboard.updateTask(f.user.id, f.branch.id, id, { status: "DONE" })).rejects.toThrow("Not found");
        expect((await db.dashboardTask.findUniqueOrThrow({ where: { id: task.id } })).status).toBe("OPEN");
    });

    it("restricted users receive no forbidden source data and read-only writes fail", async () => {
        const f = await fixture(), staff = await createUser();
        const membership = await createStaff({ userId: staff.id, branchId: f.branch.id, role: "STAFF" });
        await db.staffPermissionOverride.create({ data: { staffId: membership.id, action: "VIEW_PAYMENTS", allowed: false } });
        const snapshot = await Dashboard.overview(staff.id, f.branch.id);
        expect(snapshot.money).toEqual({ status: "restricted", data: null });
        expect(snapshot.followUps).toEqual({ status: "restricted", data: null });
        await expect(Dashboard.createTask(staff.id, f.branch.id, { title: "Unpermitted task" })).rejects.toThrow();
        await db.ownerTrialGrant.update({ where: { ownerId: f.user.id }, data: { status: "EXPIRED", trialEndsAt: new Date(Date.now() - 1) } });
        await expect(Dashboard.createTask(f.user.id, f.branch.id, { title: "Read-only task" })).rejects.toThrow();
        await expect(Dashboard.saveExpectation(f.user.id, f.branch.id, { studentId: f.student.id, weekdays: [1], expectedBy: "08:00", enabled: true })).rejects.toThrow();
        expect(await db.dashboardTask.count()).toBe(0);
        expect(await db.attendanceExpectation.count()).toBe(0);
    });

    it("a real chart SQL failure rolls back its savepoint and preserves other authorized sources", async () => {
        const f = await fixture();
        const chartSource = Dashboard as unknown as { collections: (branchId: string, month: string, timezone: string, tx: Prisma.TransactionClient) => Promise<unknown> };
        const spy = vi.spyOn(chartSource, "collections").mockImplementation((_branchId, _month, _timezone, tx) => tx.$queryRaw`SELECT 1 / 0`);
        try {
            const snapshot = await Dashboard.overview(f.user.id, f.branch.id);
            expect(snapshot.collections).toEqual({ status: "error", data: null });
            expect(snapshot.money.status).toBe("success");
            expect(snapshot.seating.status).toBe("success");
            expect(snapshot.attendance.status).toBe("success");
        } finally { spy.mockRestore(); }
    });
});
