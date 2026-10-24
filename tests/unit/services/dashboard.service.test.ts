import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
    const table = () => ({ findMany: vi.fn(), findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), findFirst: vi.fn(), count: vi.fn(),
        aggregate: vi.fn(), groupBy: vi.fn(), create: vi.fn(), createMany: vi.fn(), update: vi.fn(), upsert: vi.fn() });
    const db = { branch: table(), student: table(), payment: table(), feeCollection: table(), renewalFollowUp: table(), membershipTerm: table(),
        attendanceExpectation: table(), seat: table(), shift: table(), seatAllocation: table(), occupancySnapshot: table(), dashboardSettings: table(),
        dashboardEvent: table(), dashboardTask: table(), dashboardNotificationState: table(), organization: table(), staff: table(), staffInvite: table(), auditLog: table(),
        $transaction: vi.fn(), $queryRaw: vi.fn(), $executeRaw: vi.fn() };
    return { db, resolve: vi.fn(), authorize: vi.fn(), capability: vi.fn(), profile: vi.fn(), capacity: vi.fn() };
});
vi.mock("@/lib/prisma", () => ({ prisma: mocks.db }));
vi.mock("@/services/accessPolicy.service", () => ({ AccessPolicy: { resolveBranch: mocks.resolve, authorizeAction: mocks.authorize, authorizeCapability: mocks.capability } }));
vi.mock("@/services/entitlement.service", () => ({ EntitlementService: { getOrganizationProfile: mocks.profile } }));
vi.mock("@/services/seat.service", () => ({ SeatService: { getShiftsCapacity: mocks.capacity } }));
import { DashboardService, DashboardNotFoundError } from "@/services/dashboard.service";
const permissions = { view_payments: false, students: false, seat_allocation: false, analytics: false, manage_branch: false };
const access = () => ({ branchId: "branch", actorId: "actor", organizationId: "org", permissions: { ...permissions } });

describe("dashboard scoped service boundary", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        mocks.resolve.mockResolvedValue(access()); mocks.authorize.mockResolvedValue(access()); mocks.capability.mockResolvedValue(access());
        mocks.profile.mockResolvedValue({ entitlements: [] });
        mocks.db.$transaction.mockImplementation((fn: (tx: typeof mocks.db) => unknown) => fn(mocks.db));
        mocks.db.branch.findUniqueOrThrow.mockResolvedValue({ organization: { timezone: "Asia/Kolkata" } });
        mocks.db.dashboardEvent.findMany.mockResolvedValue([]);
        mocks.capacity.mockResolvedValue([]);
    });
    it("does not read or return forbidden aggregate counts", async () => {
        const data = await DashboardService.overview("actor", "branch");
        for (const key of ["money", "students", "followUps", "terms", "collections", "seating", "attendance"] as const)
            expect(data[key]).toEqual({ status: "restricted", data: null });
        expect(mocks.db.payment.aggregate).not.toHaveBeenCalled(); expect(mocks.db.student.count).not.toHaveBeenCalled();
        expect(mocks.db.$queryRaw).not.toHaveBeenCalled();
        expect(mocks.db.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "RepeatableRead", timeout: 30_000 });
    });
    it("keeps charts plan-locked without suppressing authorized operational counts", async () => {
        mocks.resolve.mockResolvedValue({ ...access(), permissions: { ...permissions, analytics: true, view_payments: true } });
        mocks.db.feeCollection.aggregate.mockResolvedValue({ _sum: { amount: 1900 } });
        mocks.db.payment.aggregate.mockResolvedValue({ _sum: { amount: 0, collectedAmount: 0, waivedAmount: 0 } });
        mocks.db.student.count.mockResolvedValue(0); mocks.db.renewalFollowUp.count.mockResolvedValue(0);
        mocks.db.renewalFollowUp.findMany.mockResolvedValue([]); mocks.db.feeCollection.findMany.mockResolvedValue([]);
        const data = await DashboardService.overview("actor", "branch", "2026-09", new Date("2026-09-27T12:00:00Z"));
        expect(data.collections.status).toBe("locked"); expect(data.money.data?.collectedThisMonth).toBe(1900);
        expect(mocks.db.$queryRaw).not.toHaveBeenCalled(); expect(data.money.data?.comparisonPercent).toBeNull();
    });
    it("isolates source failures and never converts them into a zero metric", async () => {
        mocks.resolve.mockResolvedValue({ ...access(), permissions: { ...permissions, students: true } });
        mocks.db.student.count.mockRejectedValue(new Error("database details"));
        const data = await DashboardService.overview("actor", "branch");
        expect(data.students).toEqual({ status: "error", data: null }); expect(data.money.status).toBe("restricted");
        expect(JSON.stringify(data)).not.toContain("database details");
        expect(data.activityStatus).toBe("error");
        const commands = mocks.db.$executeRaw.mock.calls.map(call => String(call[0]));
        expect(commands).toContain("ROLLBACK TO SAVEPOINT dashboard_source");
    });
    it("checks writable authorization before touching a task", async () => {
        mocks.authorize.mockRejectedValue(new Error("branch is archived"));
        await expect(DashboardService.updateTask("actor", "branch", "task", { status: "DONE" })).rejects.toThrow("archived");
        expect(mocks.db.dashboardTask.findFirst).not.toHaveBeenCalled(); expect(mocks.db.dashboardTask.update).not.toHaveBeenCalled();
    });
    it("makes foreign and absent task identifiers indistinguishable", async () => {
        mocks.db.dashboardTask.findFirst.mockResolvedValue(null);
        for (const id of ["foreign-task", "missing-task"])
            await expect(DashboardService.updateTask("actor", "branch", id, { status: "DONE" })).rejects.toBeInstanceOf(DashboardNotFoundError);
        expect(mocks.db.dashboardTask.findFirst).toHaveBeenCalledWith({ where: { branchId: "branch", id: "foreign-task" }, select: { id: true } });
        expect(mocks.db.dashboardTask.update).not.toHaveBeenCalled();
    });
    it("rejects a foreign student before writing an attendance expectation", async () => {
        mocks.db.student.findFirst.mockResolvedValue(null);
        await expect(DashboardService.saveExpectation("actor", "branch", { studentId: "foreign", weekdays: [1], expectedBy: "09:00", enabled: true })).rejects.toBeInstanceOf(DashboardNotFoundError);
        expect(mocks.authorize).toHaveBeenCalledWith("actor", "branch", "manage_branch", mocks.db, true);
        expect(mocks.authorize).toHaveBeenCalledWith("actor", "branch", "students", mocks.db);
        expect(mocks.db.attendanceExpectation.upsert).not.toHaveBeenCalled();
    });
    it("only assigns manual tasks to a current member of the same branch", async () => {
        mocks.db.organization.findUniqueOrThrow.mockResolvedValue({ ownerId: "owner" }); mocks.db.staff.findUnique.mockResolvedValue(null);
        await expect(DashboardService.createTask("actor", "branch", { title: "Task", assigneeId: "foreign" })).rejects.toThrow("current branch member");
        expect(mocks.db.dashboardTask.create).not.toHaveBeenCalled();
    });
    it("does not assign a task to a member who cannot open the task area", async () => {
        mocks.db.organization.findUniqueOrThrow.mockResolvedValue({ ownerId: "owner" });
        mocks.db.staff.findUnique.mockResolvedValue({ role: "STAFF", permissionOverrides: [] });
        await expect(DashboardService.createTask("actor", "branch", { title: "Task", assigneeId: "staff" })).rejects.toThrow("with task access");
        expect(mocks.db.dashboardTask.create).not.toHaveBeenCalled();
    });
    it("records explicit follow-up completion without settling or waiving a fee", async () => {
        mocks.db.renewalFollowUp.findFirst.mockResolvedValue({ id: "follow" });
        const now = new Date("2026-09-27T12:00:00Z");
        mocks.db.renewalFollowUp.update.mockResolvedValue({ id: "follow", studentId: "student", student: { name: "Example", phone: null }, type: "MONTHLY",
            periodStart: now, note: "", outcome: "CONTACTED", nextFollowUpAt: null, completedAt: now, updatedAt: now });
        await DashboardService.updateFollowUp("actor", "branch", "follow", { completed: true }, now);
        expect(mocks.db.payment.update).not.toHaveBeenCalled(); expect(mocks.db.feeCollection.create).not.toHaveBeenCalled();
        expect(mocks.db.dashboardEvent.create).toHaveBeenCalledWith({ data: { branchId: "branch", actorId: "actor", kind: "FOLLOW_UP", sourceId: "follow", detail: "COMPLETED" } });
    });
    it("records a same-branch immutable first snapshot without reconstructing previous days", async () => {
        mocks.db.seat.count.mockResolvedValue(16);
        mocks.db.shift.findMany.mockResolvedValue([{ id: "shift", name: "Morning", startTime: "06:00", endTime: "12:00" }]);
        mocks.db.seatAllocation.groupBy.mockResolvedValue([{ shiftId: "shift", _count: 2 }]);
        const now = new Date("2026-09-26T20:00:00Z");
        await DashboardService.captureOccupancy("actor", "branch", now);
        expect(mocks.authorize).toHaveBeenCalledWith("actor", "branch", "seat_allocation", mocks.db, true);
        expect(mocks.db.occupancySnapshot.createMany).toHaveBeenCalledWith({ data: [{ branchId: "branch", date: "2026-09-27", timezone: "Asia/Kolkata",
            shiftId: "shift", shiftName: "Morning", startTime: "06:00", endTime: "12:00", capacity: 16, occupied: 2, recordedAt: now }], skipDuplicates: true });
        expect(mocks.db.occupancySnapshot.update).not.toHaveBeenCalled();
    });
    it("rejects an obsolete notification condition without acknowledging the new condition", async () => {
        const spy = vi.spyOn(DashboardService, "notifications").mockResolvedValue({ items: [{ key: "TASK:new", kind: "TASK", count: 1,
            href: "/branch/branch/tasks", read: false, snoozedUntil: null, dismissed: false }], unreadCount: 1 });
        try {
            await expect(DashboardService.updateNotification("actor", "branch", { key: "TASK:old", action: "READ" })).rejects.toBeInstanceOf(DashboardNotFoundError);
            expect(mocks.db.dashboardNotificationState.upsert).not.toHaveBeenCalled();
        } finally { spy.mockRestore(); }
    });
    it("rechecks notification source authorization and writable state within the transaction", async () => {
        const spy = vi.spyOn(DashboardService, "notifications").mockResolvedValue({ items: [{ key: "TASK:current", kind: "TASK", count: 1,
            href: "/branch/branch/tasks", read: false, snoozedUntil: null, dismissed: false }], unreadCount: 1 });
        try {
            mocks.authorize.mockRejectedValue(new Error("branch is read-only"));
            await expect(DashboardService.updateNotification("actor", "branch", { key: "TASK:current", action: "READ" })).rejects.toThrow("read-only");
            expect(mocks.authorize).toHaveBeenCalledWith("actor", "branch", "manage_branch", mocks.db, true);
            expect(mocks.db.dashboardNotificationState.upsert).not.toHaveBeenCalled();
        } finally { spy.mockRestore(); }
    });
    it("does not hide overdue tasks beyond the bounded notification identity sample", async () => {
        mocks.resolve.mockResolvedValue({ ...access(), permissions: { ...permissions, manage_branch: true } });
        mocks.db.dashboardTask.findMany.mockResolvedValue([{ id: "task", updatedAt: new Date("2026-09-27T00:00:00Z") }]);
        mocks.db.dashboardTask.count.mockResolvedValue(145); mocks.db.dashboardNotificationState.findMany.mockResolvedValue([]);
        const result = await DashboardService.notifications("actor", "branch");
        expect(result.items[0].count).toBe(145); expect(result.unreadCount).toBe(1);
        expect(mocks.db.dashboardNotificationState.findMany).toHaveBeenCalledWith({ where: { branchId: "branch", userId: "actor", key: { in: [result.items[0].key] } } });
    });
    it("links a student's renewal notification to membership terms without changing its personal state", async () => {
        mocks.resolve.mockResolvedValue({ ...access(), permissions: { ...permissions, students: true } });
        mocks.db.attendanceExpectation.count.mockResolvedValue(0);
        mocks.db.attendanceExpectation.findMany.mockResolvedValue([]);
        mocks.db.student.count.mockResolvedValue(0);
        mocks.db.membershipTerm.count.mockResolvedValue(1);
        mocks.db.membershipTerm.findMany.mockResolvedValue([{
            id: "term", studentId: "student", label: "Monthly membership",
            startDate: "2026-09-01", endDate: "2026-09-30", student: { name: "Student" },
        }]);
        mocks.db.dashboardNotificationState.findMany.mockResolvedValue([]);
        const now = new Date("2026-09-29T12:00:00Z");

        const first = await DashboardService.notifications("actor", "branch", now);
        expect(first.items).toHaveLength(1);
        expect(first.items[0]).toMatchObject({ kind: "RENEWAL", count: 1, href: "/branch/branch/dashboard-settings?section=terms" });

        mocks.db.dashboardNotificationState.findMany.mockResolvedValue([{
            key: first.items[0].key, readAt: now, dismissedAt: now, snoozedUntil: null,
        }]);
        const next = await DashboardService.notifications("actor", "branch", now);
        expect(next.items[0]).toMatchObject({ key: first.items[0].key, read: true, dismissed: true });
        expect(next.unreadCount).toBe(0);
        expect(mocks.db.membershipTerm.create).not.toHaveBeenCalled();
        expect(mocks.db.payment.update).not.toHaveBeenCalled();
    });
    it("does not read or advertise membership terms without student permission", async () => {
        mocks.db.dashboardNotificationState.findMany.mockResolvedValue([]);
        expect((await DashboardService.notifications("actor", "branch")).items).toEqual([]);
        expect(mocks.db.membershipTerm.count).not.toHaveBeenCalled();
        expect(mocks.db.membershipTerm.findMany).not.toHaveBeenCalled();
    });
    it("pages every current attendance gap using the same agreed-day and recorded-attendance predicate", async () => {
        mocks.db.attendanceExpectation.count.mockResolvedValue(12);
        mocks.db.attendanceExpectation.findMany.mockResolvedValue(["s2", "s3", "s4"].map(studentId => ({ studentId, expectedBy: "09:00", student: { name: studentId } })));
        const page = await DashboardService.attendanceGaps("actor", "branch", { cursor: "s1", limit: 2 }, new Date("2026-10-22T06:00:00Z"));
        expect(page).toMatchObject({ total: 12, nextCursor: "s3", items: [{ id: "s2" }, { id: "s3" }] });
        expect(mocks.authorize).toHaveBeenCalledWith("actor", "branch", "students");
        expect(mocks.db.attendanceExpectation.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({ branchId: "branch", enabled: true, studentId: { gt: "s1" }, weekdays: { has: 4 }, expectedBy: { lte: "11:30" }, student: expect.objectContaining({ status: "ACTIVE", NOT: expect.any(Object) }) }), take: 3,
        }));
    });
    it("denies attendance gaps before reading the branch clock or any student record", async () => {
        mocks.authorize.mockRejectedValue(new Error("Unauthorized"));
        await expect(DashboardService.attendanceGaps("actor", "foreign", {})).rejects.toThrow("Unauthorized");
        expect(mocks.db.branch.findUniqueOrThrow).not.toHaveBeenCalled();
        expect(mocks.db.attendanceExpectation.findMany).not.toHaveBeenCalled();
    });
    it("restores allocation, capacity and invitation alerts without reading invitation tokens", async () => {
        mocks.resolve.mockResolvedValue({ ...access(), permissions: { ...permissions, students: true, seat_allocation: true, manage_branch: true, staff_management: true } });
        mocks.profile.mockResolvedValue({ entitlements: ["STAFF_MANAGEMENT"] });
        mocks.db.attendanceExpectation.count.mockResolvedValue(0); mocks.db.attendanceExpectation.findMany.mockResolvedValue([]);
        mocks.db.student.count.mockResolvedValue(2); mocks.db.student.findFirst.mockResolvedValue({ id: "unassigned" });
        mocks.db.membershipTerm.count.mockResolvedValue(0); mocks.db.membershipTerm.findMany.mockResolvedValue([]);
        mocks.db.dashboardTask.findMany.mockResolvedValue([]); mocks.db.dashboardTask.count.mockResolvedValue(0);
        mocks.capacity.mockResolvedValue([{ shiftId: "full", totalSeats: 10, used: 10, isFull: true, occupancyPercent: 100 }, { shiftId: "near", totalSeats: 10, used: 9, isFull: false, occupancyPercent: 90 }]);
        mocks.db.staffInvite.count.mockResolvedValue(1); mocks.db.staffInvite.findMany.mockResolvedValue([{ id: "invite", expiresAt: new Date("2026-11-01T00:00:00Z") }]);
        mocks.db.dashboardNotificationState.findMany.mockResolvedValue([]);
        const result = await DashboardService.notifications("actor", "branch");
        expect(result.items.map(item => item.kind)).toEqual(["UNASSIGNED", "SHIFT_FULL", "SHIFT_NEAR_FULL", "INVITES"]);
        expect(mocks.db.staffInvite.findMany).toHaveBeenCalledWith(expect.objectContaining({ select: { id: true, expiresAt: true }, where: expect.objectContaining({ branchId: "branch", acceptedAt: null }) }));
        expect(mocks.capacity).toHaveBeenCalledWith("actor", "branch");
    });
    it("does not read capacity, unassigned students or invites without their independent permissions", async () => {
        mocks.db.dashboardNotificationState.findMany.mockResolvedValue([]);
        await DashboardService.notifications("actor", "branch");
        expect(mocks.capacity).not.toHaveBeenCalled(); expect(mocks.db.staffInvite.count).not.toHaveBeenCalled(); expect(mocks.db.student.findFirst).not.toHaveBeenCalled();
    });
    it("searches authorized follow-ups by phone as well as name", async () => {
        mocks.db.renewalFollowUp.count.mockResolvedValue(0); mocks.db.renewalFollowUp.findMany.mockResolvedValue([]);
        await DashboardService.listFollowUps("actor", "branch", { search: "5550100" });
        expect(mocks.db.renewalFollowUp.findMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: expect.objectContaining({ branchId: "branch", student: { OR: [{ name: { contains: "5550100", mode: "insensitive" } }, { phone: { contains: "5550100" } }] } }) }));
    });
    it("finds a linked completed follow-up within its branch even when the list filter is due", async () => {
        mocks.db.renewalFollowUp.count.mockResolvedValue(0); mocks.db.renewalFollowUp.findMany.mockResolvedValue([]);
        await DashboardService.listFollowUps("actor", "branch", { followUpId: "linked", filter: "DUE", search: "other", cursor: "later" });
        expect(mocks.db.renewalFollowUp.findMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: { branchId: "branch", id: "linked" } }));
    });
    it("links recorded activity to exact authorized records and resolves configuration IDs to students", async () => {
        mocks.resolve.mockResolvedValue({ ...access(), permissions: { ...permissions, students: true, view_payments: true, seat_allocation: true, manage_branch: true } });
        const now = new Date("2026-10-22T06:00:00Z");
        mocks.db.student.count.mockResolvedValue(1);
        mocks.db.student.findMany.mockResolvedValue([{ id: "student", name: "Stored name", status: "INACTIVE", createdAt: now, joinedAt: now }]);
        mocks.db.feeCollection.findMany.mockResolvedValue([{ id: "receipt", collectedAt: now, amount: 50, student: { name: "Stored name" } }]);
        mocks.db.auditLog.findMany.mockResolvedValue([{ id: "audit", studentId: "student", createdAt: now, student: { name: "Stored name" }, action: "ATTENDANCE_CHANGED" }]);
        mocks.db.seatAllocation.findMany.mockResolvedValue([{ id: "allocation", startDate: now, seat: { label: "A1" } }]);
        mocks.db.dashboardEvent.findMany.mockResolvedValue([
            { id: "follow-event", kind: "FOLLOW_UP", sourceId: "follow", occurredAt: now, detail: "COMPLETED" },
            { id: "task-event", kind: "TASK", sourceId: "task", occurredAt: now, detail: "DONE" },
            { id: "expectation-event", kind: "CONFIGURATION", sourceId: "expectation", occurredAt: now, detail: "ATTENDANCE_EXPECTATION" },
            { id: "term-event", kind: "CONFIGURATION", sourceId: "term", occurredAt: now, detail: "MEMBERSHIP_TERM" },
        ]);
        mocks.db.attendanceExpectation.findMany.mockImplementation((query: { select: { studentId?: boolean } }) => Promise.resolve(query.select.studentId ? [{ id: "expectation", studentId: "student" }] : []));
        mocks.db.membershipTerm.findMany.mockImplementation((query: { select: { studentId?: boolean } }) => Promise.resolve(query.select.studentId ? [{ id: "term", studentId: "student" }] : []));
        const result = await DashboardService.overview("actor", "branch", "2026-10", now);
        expect(result.activityStatus).toBe("success");
        expect(result.activity.map(row => row.href)).toEqual([
            "/branch/branch/payments?collectionId=receipt", "/branch/branch/students?studentId=student&status=INACTIVE",
            "/branch/branch/attendance?studentId=student", "/branch/branch/follow-ups?followUpId=follow",
            "/branch/branch/tasks?taskId=task", "/branch/branch/dashboard-settings?section=expectations&studentId=student",
            "/branch/branch/dashboard-settings?section=terms&studentId=student", "/branch/branch/allocations?allocationId=allocation",
        ]);
        expect(result.students.data?.recent).toEqual([expect.objectContaining({ id: "student", joinedAt: now.toISOString() })]);
    });
    it("rechecks both invitation permissions inside a notification-state write", async () => {
        const spy = vi.spyOn(DashboardService, "notifications").mockResolvedValue({ items: [{ key: "INVITES:current", kind: "INVITES", count: 1,
            href: "/branch/branch/staff", read: false, snoozedUntil: null, dismissed: false }], unreadCount: 1 });
        try {
            await DashboardService.updateNotification("actor", "branch", { key: "INVITES:current", action: "READ" });
            expect(mocks.authorize).toHaveBeenCalledWith("actor", "branch", "staff_management", mocks.db, true);
            expect(mocks.authorize).toHaveBeenCalledWith("actor", "branch", "manage_branch", mocks.db, true);
        } finally { spy.mockRestore(); }
    });
});
