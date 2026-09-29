import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/app/generated/prisma/client";
import { AccessPolicy, type BranchAccessContext } from "@/services/accessPolicy.service";
import { EntitlementService } from "@/services/entitlement.service";
import { buildStaffPermissions } from "@/services/branchActionPolicy";
import { attendanceTimezone } from "@/lib/attendance";
import { dashboardDateOffset, dashboardDayStart, dashboardLocalTime, dashboardMonth, dashboardRate, dashboardToday } from "@/lib/dashboardMath";
import { dashboardExpectationSchema, dashboardFollowUpPatchSchema, dashboardFollowUpQuerySchema, dashboardNotificationSchema,
    dashboardSettingsSchema, dashboardTaskPatchSchema, dashboardTaskQuerySchema, dashboardTaskSchema, dashboardTermSchema,
    type DashboardActivity, type DashboardFollowUp, type DashboardNotification, type DashboardOverview, type DashboardSource,
    type DashboardTask, type DashboardTerm } from "@/lib/dashboardContracts";
import type { z } from "zod";

type Tx = Prisma.TransactionClient;
export class DashboardInputError extends Error {}
export class DashboardNotFoundError extends Error { constructor() { super("Not found"); } }
const followUpSelect = { id: true, studentId: true, type: true, periodStart: true, note: true, outcome: true,
    nextFollowUpAt: true, completedAt: true, updatedAt: true, student: { select: { name: true, phone: true } } } as const;
const taskSelect = { id: true, title: true, status: true, dueAt: true, assigneeId: true, createdAt: true, updatedAt: true,
    assignee: { select: { name: true } } } as const;
type FollowUpRecord = Prisma.RenewalFollowUpGetPayload<{ select: typeof followUpSelect }>;
type TaskRecord = Prisma.DashboardTaskGetPayload<{ select: typeof taskSelect }>;
function followUpView(row: FollowUpRecord): DashboardFollowUp {
    return { id: row.id, studentId: row.studentId, studentName: row.student.name, phone: row.student.phone,
        type: row.type, periodStart: row.periodStart.toISOString(), note: row.note, outcome: row.outcome,
        nextFollowUpAt: row.nextFollowUpAt?.toISOString().slice(0, 10) ?? null, completedAt: row.completedAt?.toISOString() ?? null,
        updatedAt: row.updatedAt.toISOString() };
}
function taskView(row: TaskRecord): DashboardTask {
    return { id: row.id, title: row.title, status: row.status as DashboardTask["status"], dueAt: row.dueAt?.toISOString() ?? null,
        assigneeId: row.assigneeId, assigneeName: row.assignee?.name ?? null, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}
function termView(row: { id: string; studentId: string; label: string; startDate: string; endDate: string; student: { name: string } }, today: string): DashboardTerm {
    return { id: row.id, studentId: row.studentId, studentName: row.student.name, label: row.label, startDate: row.startDate,
        endDate: row.endDate, daysLeft: Math.round((Date.parse(row.endDate) - Date.parse(today)) / 86_400_000) };
}
async function branchClock(branchId: string, tx: Tx = prisma, now = new Date()) {
    const branch = await tx.branch.findUniqueOrThrow({ where: { id: branchId }, select: { organization: { select: { timezone: true } } } });
    const timezone = attendanceTimezone(branch.organization.timezone);
    return { timezone, today: dashboardToday(now, timezone) };
}
async function completeReads<const T extends readonly unknown[]>(reads: T): Promise<{ -readonly [P in keyof T]: Awaited<T[P]> }> {
    const results = await Promise.allSettled(reads);
    const failure = results.find(result => result.status === "rejected");
    if (failure?.status === "rejected") throw failure.reason;
    return results.map(result => (result as PromiseFulfilledResult<unknown>).value) as { -readonly [P in keyof T]: Awaited<T[P]> };
}
async function source<T>(tx: Tx, allowed: boolean, fn: () => Promise<T>, locked = false): Promise<DashboardSource<T>> {
    if (!allowed) return { status: "restricted", data: null };
    if (locked) return { status: "locked", data: null };
    // One aggregate snapshot, with independent SQL errors recovered by savepoint.
    // Source queries settle before rollback; no old pending query crosses into
    // the next source. The savepoint identifier is a constant, never input.
    await tx.$executeRaw`SAVEPOINT dashboard_source`;
    try {
        const data = await fn();
        await tx.$executeRaw`RELEASE SAVEPOINT dashboard_source`;
        return { status: "success", data };
    } catch {
        await tx.$executeRaw`ROLLBACK TO SAVEPOINT dashboard_source`;
        await tx.$executeRaw`RELEASE SAVEPOINT dashboard_source`;
        return { status: "error", data: null };
    }
}
async function event(tx: Tx, access: BranchAccessContext, kind: string, sourceId: string, detail: string) {
    await tx.dashboardEvent.create({ data: { branchId: access.branchId, actorId: access.actorId, kind, sourceId, detail } });
}
async function studentExists(tx: Tx, branchId: string, studentId: string) {
    if (!await tx.student.findFirst({ where: { id: studentId, branchId }, select: { id: true } })) throw new DashboardNotFoundError();
}
async function checkAssignee(tx: Tx, access: BranchAccessContext, assigneeId?: string | null) {
    if (!assigneeId) return;
    const organization = await tx.organization.findUniqueOrThrow({ where: { id: access.organizationId }, select: { ownerId: true } });
    if (organization.ownerId === assigneeId) return;
    const staff = await tx.staff.findUnique({ where: { userId_branchId: { userId: assigneeId, branchId: access.branchId } },
        select: { role: true, permissionOverrides: { select: { action: true, allowed: true } } } });
    if (!staff || !buildStaffPermissions(staff.role, staff.permissionOverrides).manage_branch)
        throw new DashboardInputError("Choose a current branch member with task access");
}

export class DashboardService {
    static async overview(actorId: string, branchId: string, month?: string, now = new Date()): Promise<DashboardOverview> {
        return prisma.$transaction(async tx => {
            const access = await AccessPolicy.resolveBranch(actorId, branchId, tx);
            const { timezone, today } = await branchClock(branchId, tx, now);
            const selectedMonth = month ?? today.slice(0, 7);
            const profile = await EntitlementService.getOrganizationProfile(access.organizationId, tx);
            const chartLocked = !profile.entitlements.includes("ADVANCED_ANALYTICS");
            const money = await source(tx, access.permissions.view_payments, () => this.money(branchId, timezone, today, tx));
            const students = await source(tx, access.permissions.students, async () => ({ active: await tx.student.count({ where: { branchId, status: "ACTIVE" } }), comparison: null }));
            const followUps = await source(tx, access.permissions.view_payments, () => this.followUpSummary(branchId, today, tx));
            const terms = await source(tx, access.permissions.students, () => this.termSummary(branchId, today, tx));
            const collections = await source(tx, access.permissions.analytics && access.permissions.view_payments, () => this.collections(branchId, selectedMonth, timezone, tx), chartLocked);
            const seating = await source(tx, access.permissions.seat_allocation, () => this.seating(branchId, today, tx));
            const attendance = await source(tx, access.permissions.students, () => this.attendance(branchId, timezone, today, now, tx));
            const activity = await source(tx, access.permissions.students || access.permissions.view_payments || access.permissions.seat_allocation || access.permissions.manage_branch,
                () => this.activity(access, tx));
            return { branchId, timezone, today, updatedAt: now.toISOString(), money, students, followUps, terms, collections, seating, attendance,
                activity: activity.data ?? [], activityStatus: activity.status === "locked" ? "restricted" : activity.status };
        }, { isolationLevel: "RepeatableRead", timeout: 30_000 });
    }

    private static async money(branchId: string, timezone: string, today: string, client: Tx = prisma) {
        const month = dashboardMonth(today.slice(0, 7), timezone);
        const overdueBefore = dashboardDayStart(dashboardDateOffset(today, -7), timezone);
        const through = dashboardDayStart(dashboardDateOffset(today, 1), timezone);
        const [collections, legacy, pending, overdue, students] = await completeReads([
            client.feeCollection.aggregate({ where: { branchId, voidedAt: null, collectedAt: { gte: month.start, lt: month.end } }, _sum: { amount: true } }),
            client.payment.aggregate({ where: { branchId, ledgerBacked: false, status: "PAID", paidAt: { gte: month.start, lt: month.end } }, _sum: { amount: true } }),
            client.payment.aggregate({ where: { branchId, status: "DUE", dueDate: { lt: through } }, _sum: { amount: true, collectedAmount: true, waivedAmount: true } }),
            client.payment.aggregate({ where: { branchId, status: "DUE", dueDate: { lt: overdueBefore } }, _sum: { amount: true, collectedAmount: true, waivedAmount: true } }),
            client.student.count({ where: { branchId, payments: { some: { branchId, status: "DUE", dueDate: { lt: overdueBefore } } } } }),
        ]);
        const remaining = (value: typeof pending) => (value._sum.amount ?? 0) - (value._sum.collectedAmount ?? 0) - (value._sum.waivedAmount ?? 0);
        return { collectedThisMonth: (collections._sum.amount ?? 0) + (legacy._sum.amount ?? 0), pendingDues: remaining(pending),
            overdueAmount: remaining(overdue), overdueStudents: students, comparisonPercent: null };
    }

    private static async collections(branchId: string, month: string, timezone: string, client: Tx = prisma) {
        const range = dashboardMonth(month, timezone);
        // At most 31 aggregate rows. Current fee settlement, grouped by due day;
        // never fabricated historical cash flow or a ratio across different cohorts.
        const rows = await client.$queryRaw<{ day: string; billed: bigint; collected: bigint; pending: bigint; waived: bigint }[]>(Prisma.sql`
            SELECT to_char("dueDate" AT TIME ZONE 'UTC' AT TIME ZONE ${timezone}, 'YYYY-MM-DD') AS day,
                SUM(amount)::bigint AS billed,
                SUM(CASE WHEN "ledgerBacked" THEN "collectedAmount" WHEN status = 'PAID' THEN amount ELSE 0 END)::bigint AS collected,
                SUM(CASE WHEN status = 'DUE' THEN amount - "collectedAmount" - "waivedAmount" ELSE 0 END)::bigint AS pending,
                SUM(CASE WHEN "ledgerBacked" THEN "waivedAmount" WHEN status = 'WAIVED' THEN amount ELSE 0 END)::bigint AS waived
            FROM "Payment" WHERE "branchId" = ${branchId} AND "dueDate" >= ${range.start} AND "dueDate" < ${range.end}
            GROUP BY day ORDER BY day`);
        const byDay = new Map(rows.map(row => [row.day, row]));
        let billed = 0, collected = 0, pending = 0, waived = 0;
        const points = range.days.map(date => {
            const row = byDay.get(date);
            const dayBilled = Number(row?.billed ?? 0), dayCollected = Number(row?.collected ?? 0), dayPending = Number(row?.pending ?? 0);
            billed += dayBilled; collected += dayCollected; pending += dayPending; waived += Number(row?.waived ?? 0);
            return { date, billed: dayBilled, collected: dayCollected, pending: dayPending, collectionRate: dashboardRate(collected, billed, waived) };
        });
        return { month, billed, collected, pending, waived, rate: dashboardRate(collected, billed, waived), points };
    }

    private static async followUpSummary(branchId: string, today: string, client: Tx = prisma) {
        const due = { branchId, completedAt: null, nextFollowUpAt: { lt: new Date(`${dashboardDateOffset(today, 1)}T00:00:00Z`) } };
        const [pending, dueToday, rows] = await completeReads([
            client.renewalFollowUp.count({ where: { branchId, completedAt: null } }), client.renewalFollowUp.count({ where: due }),
            client.renewalFollowUp.findMany({ where: { branchId, completedAt: null }, select: followUpSelect,
                orderBy: [{ nextFollowUpAt: { sort: "asc", nulls: "last" } }, { id: "asc" }], take: 4 }),
        ]);
        return { pending, dueToday, items: rows.map(followUpView) };
    }
    private static async termSummary(branchId: string, today: string, client: Tx = prisma) {
        const where = { branchId, endDate: { gte: today, lte: dashboardDateOffset(today, 7) }, student: { status: "ACTIVE" as const } };
        const [configured, renewalsThisWeek, rows] = await completeReads([
            client.membershipTerm.count({ where: { branchId } }), client.membershipTerm.count({ where }),
            client.membershipTerm.findMany({ where, include: { student: { select: { name: true } } }, orderBy: [{ endDate: "asc" }, { id: "asc" }], take: 3 }),
        ]);
        return { configured: configured > 0, renewalsThisWeek, items: rows.map(row => termView(row, today)) };
    }

    private static async attendance(branchId: string, timezone: string, today: string, now: Date, client: Tx = prisma) {
        const date = new Date(`${today}T00:00:00Z`);
        const weekday = date.getUTCDay();
        const time = dashboardLocalTime(now, timezone);
        const qualified = { OR: [{ attendanceMarks: { some: { branchId, date, status: "PRESENT" as const } } },
            { attendanceVisits: { some: { branchId, date, voidedAt: null } } }] };
        const expectation = { branchId, enabled: true, weekdays: { has: weekday }, student: { status: "ACTIVE" as const } };
        const gapWhere = { ...expectation, expectedBy: { lte: time }, student: { status: "ACTIVE" as const, NOT: qualified } };
        const [configured, expectedToday, attendedToday, gaps, rows] = await completeReads([
            client.attendanceExpectation.count({ where: { branchId, enabled: true } }),
            client.attendanceExpectation.count({ where: expectation }), client.student.count({ where: { branchId, ...qualified } }),
            client.attendanceExpectation.count({ where: gapWhere }), client.attendanceExpectation.findMany({ where: gapWhere,
                select: { studentId: true, expectedBy: true, student: { select: { name: true } } }, orderBy: { expectedBy: "asc" }, take: 8 }),
        ]);
        return { configured: configured > 0, expectedToday, attendedToday, gaps,
            gapsStudents: rows.map(row => ({ id: row.studentId, name: row.student.name, expectedBy: row.expectedBy })) };
    }

    private static async seating(branchId: string, today: string, client: Tx = prisma) {
        const first = dashboardDateOffset(today, -6);
        const [seats, shifts, allocations, snapshots, settings, coverage, seatRows] = await completeReads([
            client.seat.count({ where: { branchId } }), client.shift.findMany({ where: { branchId, status: "ACTIVE" }, select: { id: true, name: true, startTime: true, endTime: true }, orderBy: { startTime: "asc" } }),
            client.seatAllocation.groupBy({ by: ["shiftId"], where: { branchId, endDate: null, shift: { status: "ACTIVE" }, student: { status: "ACTIVE" } }, _count: true }),
            client.occupancySnapshot.findMany({ where: { branchId, date: { gte: first, lte: today } }, orderBy: { date: "asc" } }),
            client.dashboardSettings.findUnique({ where: { branchId } }),
            client.occupancySnapshot.findFirst({ where: { branchId }, orderBy: { recordedAt: "asc" }, select: { recordedAt: true } }),
            client.seat.findMany({ where: { branchId }, select: { id: true, label: true, _count: { select: { seatAllocations: { where: { endDate: null, shift: { status: "ACTIVE" }, student: { status: "ACTIVE" } } } } } }, orderBy: { label: "asc" }, take: 80 }),
        ]);
        const physicalSeatsInUse = await client.seat.count({ where: { branchId, seatAllocations: { some: { endDate: null, shift: { status: "ACTIVE" }, student: { status: "ACTIVE" } } } } });
        const occupied = allocations.reduce((sum, row) => sum + row._count, 0), capacity = seats * shifts.length;
        const threshold = settings?.utilizationThreshold ?? 35;
        const days = Array.from({ length: 7 }, (_, index) => dashboardDateOffset(first, index));
        const rows = shifts.map(shift => ({ ...shift, cells: days.map(date => {
            if (date === today) return { date, capacity: seats, occupied: allocations.find(a => a.shiftId === shift.id)?._count ?? 0, recordedAt: null };
            const record = snapshots.find(s => s.shiftId === shift.id && s.date === date);
            return { date, capacity: record?.capacity ?? null, occupied: record?.occupied ?? null, recordedAt: record?.recordedAt.toISOString() ?? null };
        }) }));
        const utilizationPercent = capacity ? Math.round(occupied / capacity * 100) : null;
        return { seats, shifts: shifts.length, capacity, occupied, physicalSeatsInUse, utilizationPercent, threshold,
            lowUtilization: capacity > 0 && occupied / capacity * 100 < threshold, coverageStartedAt: coverage?.recordedAt.toISOString() ?? null,
            days, rows, seatsPreview: seatRows.map(row => ({ id: row.id, label: row.label, occupiedShifts: row._count.seatAllocations })) };
    }

    static async captureOccupancy(actorId: string, branchId: string, now = new Date()) {
        return prisma.$transaction(async tx => {
            await AccessPolicy.authorizeAction(actorId, branchId, "seat_allocation", tx, true);
            const { timezone, today } = await branchClock(branchId, tx, now);
            const [capacity, shifts, counts] = await completeReads([tx.seat.count({ where: { branchId } }),
                tx.shift.findMany({ where: { branchId, status: "ACTIVE" }, select: { id: true, name: true, startTime: true, endTime: true } }),
                tx.seatAllocation.groupBy({ by: ["shiftId"], where: { branchId, endDate: null, shift: { status: "ACTIVE" }, student: { status: "ACTIVE" } }, _count: true })]);
            return tx.occupancySnapshot.createMany({ data: shifts.map(shift => ({ branchId, date: today, timezone, shiftId: shift.id,
                shiftName: shift.name, startTime: shift.startTime, endTime: shift.endTime, capacity,
                occupied: counts.find(row => row.shiftId === shift.id)?._count ?? 0, recordedAt: now })), skipDuplicates: true });
        }, { isolationLevel: "RepeatableRead" });
    }

    private static async activity(access: BranchAccessContext, client: Tx = prisma): Promise<DashboardActivity[]> {
        const { branchId, permissions } = access;
        const href = `/branch/${encodeURIComponent(branchId)}`;
        const [collections, students, attendance, events, allocations] = await completeReads([
            permissions.view_payments ? client.feeCollection.findMany({ where: { branchId, voidedAt: null }, select: { id: true, collectedAt: true, amount: true, student: { select: { name: true } } }, orderBy: { collectedAt: "desc" }, take: 5 }) : [],
            permissions.students ? client.student.findMany({ where: { branchId }, select: { id: true, name: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 5 }) : [],
            permissions.students ? client.auditLog.findMany({ where: { branchId, action: "ATTENDANCE_CHANGED" }, select: { id: true, createdAt: true, student: { select: { name: true } }, action: true }, orderBy: { createdAt: "desc" }, take: 5 }) : [],
            client.dashboardEvent.findMany({ where: { branchId, kind: { in: [...(permissions.view_payments ? ["FOLLOW_UP"] : []), ...(permissions.manage_branch ? ["TASK", "CONFIGURATION"] : [])] } }, orderBy: { occurredAt: "desc" }, take: 5 }),
            permissions.seat_allocation ? client.seatAllocation.findMany({ where: { branchId }, select: { id: true, startDate: true, seat: { select: { label: true } } }, orderBy: { startDate: "desc" }, take: 5 }) : [],
        ]);
        return [
            ...collections.map(r => ({ id: `collection:${r.id}`, kind: "COLLECTION" as const, occurredAt: r.collectedAt.toISOString(), studentName: r.student.name, amount: r.amount, href: `${href}/payments` })),
            ...students.map(r => ({ id: `student:${r.id}`, kind: "STUDENT" as const, occurredAt: r.createdAt.toISOString(), studentName: r.name, href: `${href}/students` })),
            ...attendance.map(r => ({ id: `attendance:${r.id}`, kind: "ATTENDANCE" as const, occurredAt: r.createdAt.toISOString(), studentName: r.student?.name, detail: r.action, href: `${href}/attendance` })),
            ...events.map(r => ({ id: `event:${r.id}`, kind: r.kind as DashboardActivity["kind"], occurredAt: r.occurredAt.toISOString(), detail: r.detail, href: `${href}/${r.kind === "FOLLOW_UP" ? "follow-ups" : r.kind === "TASK" ? "tasks" : "dashboard-settings"}` })),
            ...allocations.map(r => ({ id: `allocation:${r.id}`, kind: "ALLOCATION" as const, occurredAt: r.startDate.toISOString(), detail: r.seat.label, href: `${href}/allocations` })),
        ].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)).slice(0, 8);
    }

    static async listTasks(actorId: string, branchId: string, input: z.input<typeof dashboardTaskQuerySchema>) {
        const query = dashboardTaskQuerySchema.parse(input);
        const access = await AccessPolicy.authorizeAction(actorId, branchId, "manage_branch");
        const { timezone } = await branchClock(branchId);
        const [rows, organization, staff] = await completeReads([
            prisma.dashboardTask.findMany({ where: { branchId, ...(query.status !== "ALL" ? { status: query.status } : {}),
                ...(query.search ? { title: { contains: query.search, mode: "insensitive" } } : {}), ...(query.cursor ? { id: { gt: query.cursor } } : {}) },
                select: taskSelect, orderBy: { id: "asc" }, take: query.limit + 1 }),
            prisma.organization.findUniqueOrThrow({ where: { id: access.organizationId }, select: { owner: { select: { id: true, name: true } } } }),
            prisma.staff.findMany({ where: { branchId }, select: { role: true, permissionOverrides: { select: { action: true, allowed: true } },
                user: { select: { id: true, name: true } } }, take: 100 }),
        ]);
        const hasMore = rows.length > query.limit; if (hasMore) rows.pop();
        return { timezone, items: rows.map(taskView), assignees: [organization.owner,
            ...staff.filter(s => buildStaffPermissions(s.role, s.permissionOverrides).manage_branch).map(s => s.user)], nextCursor: hasMore ? rows.at(-1)!.id : null };
    }
    static async createTask(actorId: string, branchId: string, input: z.input<typeof dashboardTaskSchema>) {
        const data = dashboardTaskSchema.parse(input);
        return prisma.$transaction(async tx => {
            const access = await AccessPolicy.authorizeAction(actorId, branchId, "manage_branch", tx, true);
            await checkAssignee(tx, access, data.assigneeId);
            const task = await tx.dashboardTask.create({ data: { ...data, branchId, creatorId: actorId,
                dueAt: data.dueAt ? new Date(data.dueAt) : null }, select: taskSelect });
            await event(tx, access, "TASK", task.id, "CREATED"); return taskView(task);
        });
    }
    static async updateTask(actorId: string, branchId: string, taskId: string, input: z.input<typeof dashboardTaskPatchSchema>) {
        const data = dashboardTaskPatchSchema.parse(input);
        return prisma.$transaction(async tx => {
            const access = await AccessPolicy.authorizeAction(actorId, branchId, "manage_branch", tx, true);
            const found = await tx.dashboardTask.findFirst({ where: { branchId, id: taskId }, select: { id: true } });
            if (!found) throw new DashboardNotFoundError();
            await checkAssignee(tx, access, data.assigneeId);
            const task = await tx.dashboardTask.update({ where: { id: found.id }, data: { ...data,
                ...(data.dueAt !== undefined ? { dueAt: data.dueAt ? new Date(data.dueAt) : null } : {}) }, select: taskSelect });
            await event(tx, access, "TASK", task.id, data.status ?? "UPDATED"); return taskView(task);
        });
    }
    static async listFollowUps(actorId: string, branchId: string, input: z.input<typeof dashboardFollowUpQuerySchema>, now = new Date()) {
        const query = dashboardFollowUpQuerySchema.parse(input);
        await AccessPolicy.authorizeAction(actorId, branchId, "view_payments");
        const { today } = await branchClock(branchId, prisma, now);
        const summary = await this.followUpSummary(branchId, today);
        const rows = await prisma.renewalFollowUp.findMany({ where: { branchId,
            ...(query.filter === "COMPLETED" ? { completedAt: { not: null } } : { completedAt: null }),
            ...(query.filter === "DUE" ? { nextFollowUpAt: { lt: new Date(`${dashboardDateOffset(today, 1)}T00:00:00Z`) } } : {}),
            ...(query.search ? { student: { name: { contains: query.search, mode: "insensitive" } } } : {}), ...(query.cursor ? { id: { gt: query.cursor } } : {}) },
            select: followUpSelect, orderBy: { id: "asc" }, take: query.limit + 1 });
        const hasMore = rows.length > query.limit; if (hasMore) rows.pop();
        return { items: rows.map(followUpView), counts: { pending: summary.pending, dueToday: summary.dueToday,
            completed: await prisma.renewalFollowUp.count({ where: { branchId, completedAt: { not: null } } }) }, nextCursor: hasMore ? rows.at(-1)!.id : null };
    }
    static async updateFollowUp(actorId: string, branchId: string, followUpId: string, input: z.input<typeof dashboardFollowUpPatchSchema>, now = new Date()) {
        const data = dashboardFollowUpPatchSchema.parse(input);
        return prisma.$transaction(async tx => {
            const access = await AccessPolicy.authorizeCapability(actorId, branchId, "paymentsRecord", tx);
            const found = await tx.renewalFollowUp.findFirst({ where: { id: followUpId, branchId }, select: { id: true } });
            if (!found) throw new DashboardNotFoundError();
            const row = await tx.renewalFollowUp.update({ where: { id: found.id }, data: { authorId: actorId,
                ...(data.note !== undefined ? { note: data.note } : {}), ...(data.outcome !== undefined ? { outcome: data.outcome } : {}),
                ...(data.nextFollowUpAt !== undefined ? { nextFollowUpAt: data.nextFollowUpAt ? new Date(`${data.nextFollowUpAt}T00:00:00Z`) : null } : {}),
                ...(data.completed !== undefined ? { completedAt: data.completed ? now : null } : {}) }, select: followUpSelect });
            await event(tx, access, "FOLLOW_UP", found.id, data.completed === true ? "COMPLETED" : "UPDATED"); return followUpView(row);
        });
    }

    static async settings(actorId: string, branchId: string) {
        await AccessPolicy.authorizeAction(actorId, branchId, "manage_branch");
        return await prisma.dashboardSettings.findUnique({ where: { branchId }, select: { utilizationThreshold: true } }) ?? { utilizationThreshold: 35 };
    }
    static async saveSettings(actorId: string, branchId: string, input: z.input<typeof dashboardSettingsSchema>) {
        const data = dashboardSettingsSchema.parse(input);
        return prisma.$transaction(async tx => {
            const access = await AccessPolicy.authorizeAction(actorId, branchId, "manage_branch", tx, true);
            const settings = await tx.dashboardSettings.upsert({ where: { branchId }, create: { branchId, ...data }, update: data });
            await event(tx, access, "CONFIGURATION", branchId, "UTILIZATION_THRESHOLD"); return settings;
        });
    }
    static async expectations(actorId: string, branchId: string) {
        await AccessPolicy.authorizeAction(actorId, branchId, "manage_branch");
        await AccessPolicy.authorizeAction(actorId, branchId, "students");
        const [items, students] = await completeReads([
            prisma.attendanceExpectation.findMany({ where: { branchId }, select: { studentId: true, weekdays: true, expectedBy: true, enabled: true }, take: 500 }),
            prisma.student.findMany({ where: { branchId, status: "ACTIVE" }, select: { id: true, name: true }, orderBy: { name: "asc" }, take: 500 }),
        ]);
        return { items, students };
    }
    static async saveExpectation(actorId: string, branchId: string, input: z.input<typeof dashboardExpectationSchema>) {
        const data = dashboardExpectationSchema.parse(input);
        return prisma.$transaction(async tx => {
            const access = await AccessPolicy.authorizeAction(actorId, branchId, "manage_branch", tx, true);
            await AccessPolicy.authorizeAction(actorId, branchId, "students", tx);
            await studentExists(tx, branchId, data.studentId);
            const row = await tx.attendanceExpectation.upsert({ where: { studentId: data.studentId }, create: { branchId, ...data }, update: data });
            await event(tx, access, "CONFIGURATION", row.id, "ATTENDANCE_EXPECTATION"); return row;
        });
    }
    static async terms(actorId: string, branchId: string, now = new Date()) {
        await AccessPolicy.authorizeAction(actorId, branchId, "students");
        const { today } = await branchClock(branchId, prisma, now);
        const [items, students] = await completeReads([
            prisma.membershipTerm.findMany({ where: { branchId }, include: { student: { select: { name: true } } }, orderBy: [{ endDate: "desc" }, { id: "asc" }], take: 500 }),
            prisma.student.findMany({ where: { branchId, status: "ACTIVE" }, select: { id: true, name: true }, orderBy: { name: "asc" }, take: 500 }),
        ]);
        return { items: items.map(row => termView(row, today)), students };
    }
    static async saveTerm(actorId: string, branchId: string, input: z.input<typeof dashboardTermSchema>, now = new Date()) {
        const data = dashboardTermSchema.parse(input);
        return prisma.$transaction(async tx => {
            const access = await AccessPolicy.authorizeAction(actorId, branchId, "manage_branch", tx, true);
            await AccessPolicy.authorizeAction(actorId, branchId, "students", tx);
            await studentExists(tx, branchId, data.studentId);
            const overlap = await tx.membershipTerm.findFirst({ where: { branchId, studentId: data.studentId,
                startDate: { lte: data.endDate }, endDate: { gte: data.startDate } }, select: { id: true } });
            if (overlap) throw new DashboardInputError("A membership term already covers these dates");
            const term = await tx.membershipTerm.create({ data: { branchId, ...data }, include: { student: { select: { name: true } } } });
            await event(tx, access, "CONFIGURATION", term.id, "MEMBERSHIP_TERM");
            const { today } = await branchClock(branchId, tx, now); return termView(term, today);
        }, { isolationLevel: "Serializable" });
    }

    static async notifications(actorId: string, branchId: string, now = new Date()) {
        const access = await AccessPolicy.resolveBranch(actorId, branchId);
        const { today, timezone } = await branchClock(branchId, prisma, now);
        const candidates: Omit<DashboardNotification, "read" | "snoozedUntil" | "dismissed">[] = [];
        const href = `/branch/${encodeURIComponent(branchId)}`;
        const add = (kind: DashboardNotification["kind"], count: number, identity: unknown, destination: string) => {
            if (count > 0) candidates.push({ key: `${kind}:${createHash("sha256").update(JSON.stringify(identity)).digest("hex")}`, kind, count, href: `${href}/${destination}` });
        };
        if (access.permissions.view_payments) {
            const [money, followUps] = await completeReads([this.money(branchId, timezone, today), this.followUpSummary(branchId, today)]);
            add("OVERDUE", money.overdueStudents, [money.overdueStudents, money.overdueAmount], "overdue");
            add("FOLLOW_UP", followUps.dueToday, [today, followUps.dueToday, followUps.items.map(r => [r.id, r.updatedAt])], "follow-ups?filter=DUE");
        }
        if (access.permissions.students) {
            const [attendance, terms] = await completeReads([this.attendance(branchId, timezone, today, now), this.termSummary(branchId, today)]);
            add("ATTENDANCE", attendance.gaps, [today, attendance.gaps, attendance.gapsStudents.map(r => r.id)], "attendance");
            add("RENEWAL", terms.renewalsThisWeek, terms.items.map(r => [r.id, r.endDate]), "dashboard-settings?section=terms");
        }
        if (access.permissions.manage_branch) {
            const where = { branchId, status: "OPEN", dueAt: { lte: now }, OR: [{ assigneeId: actorId }, { assigneeId: null }] };
            const [due, count] = await completeReads([
                prisma.dashboardTask.findMany({ where, select: { id: true, updatedAt: true }, orderBy: [{ updatedAt: "desc" }, { id: "asc" }], take: 100 }),
                prisma.dashboardTask.count({ where }),
            ]);
            add("TASK", count, [count, due.map(r => [r.id, r.updatedAt.toISOString()])], "tasks");
        }
        const states = await prisma.dashboardNotificationState.findMany({ where: { branchId, userId: actorId, key: { in: candidates.map(c => c.key) } } });
        const items = candidates.map(candidate => {
            const state = states.find(s => s.key === candidate.key);
            return { ...candidate, read: Boolean(state?.readAt), snoozedUntil: state?.snoozedUntil?.toISOString() ?? null, dismissed: Boolean(state?.dismissedAt) };
        });
        return { items, unreadCount: items.filter(item => !item.read && !item.dismissed && (!item.snoozedUntil || Date.parse(item.snoozedUntil) <= now.getTime())).length };
    }
    static async updateNotification(actorId: string, branchId: string, input: z.input<typeof dashboardNotificationSchema>, now = new Date()) {
        const data = dashboardNotificationSchema.parse(input);
        const current = await this.notifications(actorId, branchId, now);
        if (!current.items.some(item => item.key === data.key)) throw new DashboardNotFoundError();
        const snooze = data.snoozeUntil ? new Date(data.snoozeUntil) : new Date(now.getTime() + 86_400_000);
        if (data.action === "SNOOZE" && (snooze <= now || snooze.getTime() > now.getTime() + 30 * 86_400_000)) throw new DashboardInputError("Choose a snooze time within 30 days");
        return prisma.$transaction(async tx => {
            const kind = current.items.find(item => item.key === data.key)!.kind;
            await AccessPolicy.authorizeAction(actorId, branchId, kind === "TASK" ? "manage_branch" : kind === "FOLLOW_UP" || kind === "OVERDUE" ? "view_payments" : "students", tx, true);
            const values = data.action === "READ" ? { readAt: now } : data.action === "SNOOZE" ? { snoozedUntil: snooze } : { dismissedAt: now };
            await tx.dashboardNotificationState.upsert({ where: { userId_branchId_key: { userId: actorId, branchId, key: data.key } },
                create: { userId: actorId, branchId, key: data.key, ...values }, update: values });
            return { saved: true };
        });
    }
}
