import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { AttendanceService as S } from "@/services/attendance.service";
import { attendanceDay, type AttendanceCommand } from "@/lib/attendance";
import { createTestWorld, createStudent, createUser, createStaff, createSeat, createShift, createPayment } from "@/tests/factories";
import { testPrisma as db, resetDatabase, disconnectDatabase } from "@/tests/setup/db";
import type { Prisma } from "@/app/generated/prisma/client";

async function fixture() {
    const w = await createTestWorld(), student = await createStudent({ branchId: w.branch.id });
    return { ...w, student, today: attendanceDay(new Date(), "Asia/Kolkata") };
}
type F = Awaited<ReturnType<typeof fixture>>;
const command = (f: F, input: AttendanceCommand) => S.command(f.user.id, f.branch.id, input);
const mark = (f: F, status: "PRESENT" | "ABSENT" | "NOT_MARKED", version = 0, reason = "", date = f.today): AttendanceCommand => ({ kind: "MARK", key: randomUUID(), date, status, reason, students: [{ studentId: f.student.id, version }] });
const checkIn = (f: F): AttendanceCommand => ({ kind: "CHECK_IN", studentId: f.student.id, key: randomUUID(), source: "QR" });
const visit = (f: F) => db.attendanceVisit.findFirstOrThrow({ where: { studentId: f.student.id }, orderBy: { checkIn: "desc" } });
const history = (f: F, from = "2026-01-01", to = "2026-03-31") => S.history(f.user.id, f.branch.id, { studentId: f.student.id, from, to });

describe("Attendance — isolated PostgreSQL", () => {
    beforeEach(resetDatabase); afterAll(disconnectDatabase);
    it("keeps Present, Absent and Not marked distinct without inventing visit times", async () => {
        const f = await fixture(), other = await createStudent({ branchId: f.branch.id, name: "No seat" });
        await command(f, mark(f, "PRESENT"));
        let p = await S.list(f.user.id, f.branch.id, {});
        expect(p.counts).toEqual({ attended: 1, absent: 0, notMarked: 1, open: 0 });
        expect(p.items.find(s => s.id === f.student.id)).toMatchObject({ attendance: "PRESENT", visits: [], openVisit: null, currentAllocations: [] });
        await command(f, mark(f, "ABSENT", 1, "Wrong mark"));
        p = await S.list(f.user.id, f.branch.id, {}); expect(p.counts.absent).toBe(1);
        await command(f, mark(f, "NOT_MARKED", 2, "Clear mistaken absence"));
        p = await S.list(f.user.id, f.branch.id, {}); expect(p.counts.notMarked).toBe(2);
        expect(p.items.find(s => s.id === other.id)?.attendance).toBe("NOT_MARKED");
        expect(await db.payment.count()).toBe(0); expect(await db.seatAllocation.count()).toBe(0);
        expect(await db.auditLog.count({ where: { action: "ATTENDANCE_CHANGED" } })).toBe(3);
    });
    it("paginates students once despite multiple shifts, searches phone, filters and counts", async () => {
        const f = await fixture(), seat = await createSeat({ branchId: f.branch.id }), a = await createShift({ branchId: f.branch.id }), b = await createShift({ branchId: f.branch.id });
        const multi = await db.multiShift.create({ data: { branchId: f.branch.id, name: "Two shifts", price: 1000 } });
        await db.multiShiftComponent.createMany({ data: [a, b].map(s => ({ branchId: f.branch.id, multiShiftId: multi.id, shiftId: s.id })) });
        await db.seatAllocation.createMany({ data: [a, b].map(s => ({ branchId: f.branch.id, studentId: f.student.id, seatId: seat.id, shiftId: s.id, multiShiftId: multi.id })) });
        await createStudent({ branchId: f.branch.id, name: "Unseated second", phone: "8888877777" });
        const first = await S.list(f.user.id, f.branch.id, { limit: 1 });
        const second = await S.list(f.user.id, f.branch.id, { limit: 1, cursor: first.nextCursor });
        expect(first.total).toBe(2); expect(second.items[0].id).not.toBe(first.items[0].id); expect(second.nextCursor).toBeNull();
        const filtered = await S.list(f.user.id, f.branch.id, { shiftId: a.id });
        expect(filtered.total).toBe(1); expect(filtered.items[0].currentAllocations).toHaveLength(2);
        expect((await S.list(f.user.id, f.branch.id, { search: "77777" })).items[0].name).toBe("Unseated second");
        await command(f, mark(f, "ABSENT")); expect((await S.list(f.user.id, f.branch.id, { status: "ABSENT" })).total).toBe(1);
    });
    it("serializes concurrent scans, recovers lost responses, and binds retry input and actor", async () => {
        const f = await fixture(), input = checkIn(f);
        const results = await Promise.all([command(f, input), command(f, input), command(f, checkIn(f)), command(f, checkIn(f))]);
        expect(results[0]).toEqual(results[1]); expect(await db.attendanceVisit.count()).toBe(1);
        expect(await db.auditLog.count({ where: { action: "ATTENDANCE_CHANGED" } })).toBe(1);
        await expect(command(f, { ...input, note: "changed" })).rejects.toThrow(/different attendance/);
        const staff = await createUser(); await createStaff({ userId: staff.id, branchId: f.branch.id });
        await expect(S.command(staff.id, f.branch.id, input)).rejects.toThrow(/different attendance/);
    });
    it("checkout retry cannot close a later visit and multiple visits count once", async () => {
        const f = await fixture(); await command(f, checkIn(f)); const v = await visit(f);
        const out: AttendanceCommand = { key: randomUUID(), kind: "CHECK_OUT", studentId: f.student.id, visitId: v.id, version: v.version };
        const result = await command(f, out); await command(f, checkIn(f)); const newer = await visit(f);
        expect(await command(f, out)).toEqual(result);
        expect((await db.attendanceVisit.findUniqueOrThrow({ where: { id: newer.id } })).checkOut).toBeNull();
        expect((await S.list(f.user.id, f.branch.id, {})).counts).toMatchObject({ attended: 1, open: 1 });
        await expect(command(f, { ...out, key: randomUUID() })).rejects.toThrow(/changed/);
    });
    it("keeps overnight visits on their start date; inactive checkout and history remain available", async () => {
        const f = await fixture();
        await db.$transaction(tx => S.commandInTransaction(f.user.id, f.branch.id, checkIn(f), tx, new Date("2026-07-01T18:29:00Z")));
        const p = await S.list(f.user.id, f.branch.id, { open: "true" }, new Date("2026-07-01T18:31:00Z"));
        expect(p.today).toBe("2026-07-02"); expect(p.items[0].openVisit?.date.slice(0, 10)).toBe("2026-07-01"); expect(p.counts.attended).toBe(0); expect(p.counts.open).toBe(1);
        await db.student.update({ where: { id: f.student.id }, data: { status: "INACTIVE" } });
        await expect(command(f, checkIn(f))).rejects.toThrow(/Inactive/);
        const v = await visit(f); await command(f, { key: randomUUID(), kind: "CHECK_OUT", studentId: f.student.id, visitId: v.id, version: 1 });
        const h = await history(f, "2026-07-01", "2026-07-02"); expect(h.visits).toHaveLength(1); expect(h.visits[0].checkOut).not.toBeNull();
        expect((await S.list(f.user.id, f.branch.id, { date: "2026-07-01" })).counts).toMatchObject({ attended: 1, notMarked: null });
    });
    it("requires explicit conflict resolution, correction reasons and current versions", async () => {
        const f = await fixture(); await command(f, mark(f, "ABSENT"));
        await expect(command(f, checkIn(f))).rejects.toThrow(/Absent/);
        await expect(command(f, mark(f, "PRESENT", 1))).rejects.toThrow(/reason/);
        await command(f, mark(f, "PRESENT", 1, "Student arrived")); await command(f, checkIn(f));
        await expect(command(f, mark(f, "ABSENT", 2, "Mistake"))).rejects.toThrow(/valid visit/);
        await expect(command(f, mark(f, "NOT_MARKED", 2, "Mistake"))).rejects.toThrow(/valid visit/);
        const v = await visit(f), input: AttendanceCommand = { kind: "VOID_VISIT", key: randomUUID(), studentId: f.student.id, visitId: v.id, version: 1, reason: "Wrong person" };
        await command(f, input); await command(f, input);
        await expect(command(f, { ...input, key: randomUUID() })).rejects.toThrow(/changed/);
        await command(f, mark(f, "ABSENT", 2, "Void completed"));
        expect((await visit(f)).voidedAt).not.toBeNull();
        const audits = await db.auditLog.findMany({ where: { action: "ATTENDANCE_CHANGED" } });
        expect(JSON.stringify(audits)).toContain("Wrong person"); expect(JSON.stringify(audits)).toContain('"before"');
        await expect(db.auditLog.delete({ where: { id: audits[0].id } })).rejects.toThrow(/immutable/);
    });
    it("rejects impossible/future/before-join corrections and overlapping visits", async () => {
        const f = await fixture();
        await expect(command(f, mark(f, "PRESENT", 0, "Backdated", "2025-12-31"))).rejects.toThrow(/joining date/);
        await expect(command(f, mark(f, "PRESENT", 0, "Future", "2099-01-01"))).rejects.toThrow(/joining date/);
        await db.$transaction(tx => S.commandInTransaction(f.user.id, f.branch.id, checkIn(f), tx, new Date("2026-02-02T04:00:00Z")));
        const v = await visit(f), correction: AttendanceCommand = { key: randomUUID(), kind: "CORRECT_VISIT", studentId: f.student.id, visitId: v.id, version: 1, reason: "Missed checkout", checkIn: v.checkIn.toISOString(), checkOut: "2026-02-02T06:00:00Z" };
        await expect(command(f, { ...correction, checkOut: "2026-02-02T03:00:00Z" })).rejects.toThrow(/Times/);
        await expect(command(f, { ...correction, checkOut: "2099-02-02T03:00:00Z" })).rejects.toThrow(/Times/);
        await expect(command(f, { ...correction, checkIn: "2025-12-31T03:00:00Z" })).rejects.toThrow(/joining/);
        await command(f, correction); await command(f, correction);
        await db.$transaction(tx => S.commandInTransaction(f.user.id, f.branch.id, checkIn(f), tx, new Date("2026-02-02T07:00:00Z")));
        await expect(command(f, { ...correction, key: randomUUID(), version: 2, checkOut: "2026-02-02T08:00:00Z" })).rejects.toThrow(/overlap/);
        await expect(command(f, { ...correction, key: randomUUID() })).rejects.toThrow(/changed/);
        expect((await history(f)).visits).toHaveLength(2);
    });
    it("scopes QR, students and visits; denies students permission and read-only writes", async () => {
        const f = await fixture(), foreign = await fixture();
        const issued = await command(f, { kind: "ISSUE_QR", key: randomUUID(), studentId: f.student.id }) as { qr: string };
        const again = await command(f, { kind: "ISSUE_QR", key: randomUUID(), studentId: f.student.id }) as { qr: string };
        expect(again.qr).toBe(issued.qr); expect(issued.qr).toMatch(/^[0-9a-f-]{36}$/);
        expect((await S.lookup(f.user.id, f.branch.id, issued.qr)).student.id).toBe(f.student.id);
        for (const code of [issued.qr, randomUUID(), "invalid"]) await expect(S.lookup(foreign.user.id, foreign.branch.id, code)).rejects.toThrow("Attendance record not found");
        for (const id of [foreign.student.id, "nonexistent"]) await expect(command(f, { kind: "CHECK_IN", key: randomUUID(), studentId: id })).rejects.toThrow("Attendance record not found");
        const staff = await createUser(); const membership = await createStaff({ userId: staff.id, branchId: f.branch.id });
        await db.staffPermissionOverride.create({ data: { staffId: membership.id, action: "STUDENTS", allowed: false } });
        await expect(S.list(staff.id, f.branch.id, {})).rejects.toThrow(/Unauthorized/);
        await db.branch.update({ where: { id: f.branch.id }, data: { billingStatus: "ARCHIVED" } });
        await expect(command(f, checkIn(f))).rejects.toThrow();
        expect((await S.list(f.user.id, f.branch.id, {})).total).toBe(1);
    });
    it("uses students alone for normal work and manage_branch for corrections; no financial leaks", async () => {
        const f = await fixture(), staff = await createUser(), membership = await createStaff({ userId: staff.id, branchId: f.branch.id, role: "STAFF" });
        const payment = await createPayment({ branchId: f.branch.id, studentId: f.student.id, amount: 1200, status: "DUE", periodStart: new Date("2026-01-01"), periodEnd: new Date("2026-02-01"), dueDate: new Date("2026-02-01") });
        await db.staffPermissionOverride.createMany({ data: ["VIEW_PAYMENTS", "SEAT_ALLOCATION"].map(action => ({ staffId: membership.id, action: action as "VIEW_PAYMENTS" | "SEAT_ALLOCATION", allowed: false })) });
        await S.command(staff.id, f.branch.id, mark(f, "PRESENT"));
        const response = await S.list(staff.id, f.branch.id, {});
        expect(response.items[0].currentAllocations).toEqual([]);
        const serialized = JSON.stringify(response); for (const key of ["monthlyFee", "payments", "amount", "collectedAmount", "feeLinked"]) expect(serialized).not.toContain(key);
        await expect(S.command(staff.id, f.branch.id, mark(f, "ABSENT", 1, "Correct"))).rejects.toThrow(/manage_branch/);
        await S.command(staff.id, f.branch.id, checkIn(f));
        expect(await db.payment.findUnique({ where: { id: payment.id } })).toEqual(payment);
    });
    it("bulk is all-or-nothing, exactly selected, rejects duplicates and bounds", async () => {
        const f = await fixture(), b = await createStudent({ branchId: f.branch.id }), c = await createStudent({ branchId: f.branch.id });
        const base = mark(f, "PRESENT"); if (base.kind !== "MARK") throw new Error();
        await expect(command(f, { ...base, students: [...base.students, { studentId: "missing", version: 0 }] })).rejects.toThrow(/not found/);
        expect(await db.attendanceMark.count()).toBe(0);
        await expect(command(f, { ...base, students: [...base.students, ...base.students] })).rejects.toThrow(/only once/);
        await command(f, { ...base, students: [...base.students, { studentId: b.id, version: 0 }] });
        expect(await db.attendanceMark.count()).toBe(2); expect(await db.attendanceMark.count({ where: { studentId: c.id } })).toBe(0);
        await expect(S.history(f.user.id, f.branch.id, { studentId: f.student.id, from: "2026-01-01", to: "2026-12-31" })).rejects.toThrow(/93 days/);
        await expect(S.list(f.user.id, f.branch.id, { limit: 500 })).rejects.toThrow();
    });
    it("audit failure rolls back mark/visit and retry receipt; database enforces tenant and open identity", async () => {
        const f = await fixture();
        await expect(db.$transaction(async tx => {
            const failing = new Proxy(tx, { get(target, key) { if (key === "auditLog") return { create: () => { throw new Error("forced audit failure"); } }; const v = Reflect.get(target, key); return typeof v === "function" ? v.bind(target) : v; } }) as Prisma.TransactionClient;
            await S.commandInTransaction(f.user.id, f.branch.id, checkIn(f), failing);
        })).rejects.toThrow("forced audit failure");
        expect(await db.attendanceVisit.count()).toBe(0); expect(await db.attendanceCommand.count()).toBe(0);
        await command(f, checkIn(f)); const v = await visit(f), foreign = await fixture();
        await expect(db.attendanceVisit.create({ data: { ...v, id: randomUUID() } })).rejects.toThrow();
        await expect(db.attendanceVisit.create({ data: { ...v, id: randomUUID(), branchId: foreign.branch.id } })).rejects.toThrow();
        await expect(db.auditLog.create({ data: { branchId: f.branch.id, userId: f.user.id, action: "PAYMENT_WAIVED", details: {} } })).rejects.toThrow();
    });
    it("uses configured timezone for visits, roster and default history and preserves original attribution", async () => {
        const f = await fixture();
        await db.organization.update({ where: { id: f.branch.organizationId }, data: { timezone: "America/New_York" } });
        const now = new Date("2026-03-08T04:30:00Z");
        await db.$transaction(tx => S.commandInTransaction(f.user.id, f.branch.id, checkIn(f), tx, now));
        const p = await S.list(f.user.id, f.branch.id, {}, now);
        expect(p.today).toBe("2026-03-07"); expect(p.items[0].openVisit?.timezone).toBe("America/New_York");
        const h = await S.history(f.user.id, f.branch.id, { studentId: f.student.id }, now);
        expect(h.to).toBe("2026-03-07"); expect(h.visits).toHaveLength(1);
        await db.organization.update({ where: { id: f.branch.organizationId }, data: { timezone: "Asia/Kolkata" } });
        const v = await visit(f);
        await command(f, { kind: "CORRECT_VISIT", key: randomUUID(), studentId: f.student.id, visitId: v.id, version: 1, reason: "Missed departure", checkIn: v.checkIn.toISOString(), checkOut: "2026-03-08T06:00:00Z" });
        expect((await visit(f)).date.toISOString().slice(0, 10)).toBe("2026-03-07");
    });
    it("concurrent corrections cannot overwrite a newer mark and conflicts on a moved visit are explicit", async () => {
        const f = await fixture(); await command(f, mark(f, "PRESENT"));
        const attempts = await Promise.allSettled([command(f, mark(f, "ABSENT", 1, "Correction A")), command(f, mark(f, "NOT_MARKED", 1, "Correction B"))]);
        expect(attempts.filter(a => a.status === "fulfilled")).toHaveLength(1);
        expect(await db.attendanceMark.findFirst({ where: { studentId: f.student.id } })).toMatchObject({ version: 2 });
        await command(f, mark(f, "ABSENT", 0, "Historical register", "2026-02-02"));
        await db.$transaction(tx => S.commandInTransaction(f.user.id, f.branch.id, checkIn(f), tx, new Date("2026-02-03T04:00:00Z")));
        const v = await visit(f);
        await expect(command(f, { kind: "CORRECT_VISIT", key: randomUUID(), studentId: f.student.id, visitId: v.id, version: 1, reason: "Move to prior date", checkIn: "2026-02-02T04:00:00Z", checkOut: "2026-02-02T06:00:00Z" })).rejects.toThrow(/Absent mark/);
        await command(f, mark(f, "NOT_MARKED", 1, "Resolve recorded absence", "2026-02-02"));
        await command(f, { kind: "CORRECT_VISIT", key: randomUUID(), studentId: f.student.id, visitId: v.id, version: 1, reason: "Move to prior date", checkIn: "2026-02-02T04:00:00Z", checkOut: "2026-02-02T06:00:00Z" });
        expect((await S.list(f.user.id, f.branch.id, { date: "2026-02-02" })).counts.attended).toBe(1);
    });
});
