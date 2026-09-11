import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { AccessPolicy } from "@/services/accessPolicy.service";
import { attendanceCommandSchema, attendanceDay, attendanceHistorySchema, attendanceQuerySchema,
    attendanceTimezone, effectiveAttendance, type AttendanceCommand, type AttendancePage, type AttendanceHistory, type AttendanceAuditFacts } from "@/lib/attendance";
import { decodeDateIdCursor, pageFromRows } from "@/lib/cursorPagination";

export class AttendanceError extends Error {
    constructor(message: string, public readonly status = 400) { super(message); }
}
const missing = () => new AttendanceError("Attendance record not found", 404);
const stale = () => new AttendanceError("Attendance changed. Refresh before trying again.", 409);
const dayDate = (day: string) => new Date(`${day}T00:00:00Z`);
const actorSelect = { select: { name: true } } as const;
const markSelect = { date: true, status: true, version: true, note: true, source: true, correctedAt: true, updatedAt: true, actor: actorSelect } as const;
const visitSelect = { id: true, date: true, timezone: true, checkIn: true, checkOut: true, source: true, version: true, note: true,
    correctedAt: true, voidedAt: true, actor: actorSelect } as const;
const json = <T>(value: unknown): T => JSON.parse(JSON.stringify(value));

async function timezoneFor(tx: Prisma.TransactionClient, branchId: string) {
    const branch = await tx.branch.findUniqueOrThrow({ where: { id: branchId }, select: { organization: { select: { timezone: true } } } });
    return attendanceTimezone(branch.organization.timezone);
}
async function audit(tx: Prisma.TransactionClient, actorId: string, branchId: string, studentId: string,
    kind: string, before: unknown, after: unknown, reason: string, key: string) {
    await tx.auditLog.create({ data: { branchId, studentId, userId: actorId, action: "ATTENDANCE_CHANGED",
        details: json<Prisma.InputJsonValue>({ kind, before, after, reason, key }) } });
}

export class AttendanceService {
    static async command(actorId: string, branchId: string, input: AttendanceCommand) {
        const data = attendanceCommandSchema.parse(input);
        for (let attempt = 0; ; attempt++) {
            try { return await prisma.$transaction(tx => this.commandInTransaction(actorId, branchId, data, tx),
                { isolationLevel: "Serializable", timeout: 20000 }); }
            catch (error) {
                if (attempt < 4 && error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") continue;
                throw error;
            }
        }
    }

    static async commandInTransaction(actorId: string, branchId: string, input: AttendanceCommand, tx: Prisma.TransactionClient, now = new Date()) {
        const data = attendanceCommandSchema.parse(input);
        await AccessPolicy.authorizeCapability(actorId, branchId, "attendanceRecord", tx);
        await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${`attendance:${branchId}:${data.key}`}, 0))`;
        const canonical = data.kind === "MARK" ? { ...data, students: [...data.students].sort((a, b) => a.studentId.localeCompare(b.studentId)) } : data;
        const requestHash = createHash("sha256").update(JSON.stringify({ actorId, ...canonical })).digest("hex");
        const previous = await tx.attendanceCommand.findUnique({ where: { branchId_key: { branchId, key: data.key } } });
        if (previous) {
            if (previous.requestHash !== requestHash) throw new AttendanceError("This retry key belongs to a different attendance request", 409);
            return previous.result;
        }
        const ids = data.kind === "MARK" ? data.students.map(s => s.studentId).sort() : [data.studentId];
        if (new Set(ids).size !== ids.length) throw new AttendanceError("Select each student only once");
        const locked = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "Student"
            WHERE "branchId" = ${branchId} AND "id" IN (${Prisma.join(ids)}) ORDER BY "id" FOR UPDATE`);
        if (locked.length !== ids.length) throw missing();
        await AccessPolicy.authorizeCapability(actorId, branchId, "attendanceRecord", tx);
        const timezone = await timezoneFor(tx, branchId), today = attendanceDay(now, timezone);
        const students = await tx.student.findMany({ where: { branchId, id: { in: ids } }, select: { id: true, name: true, status: true, joinedAt: true } });
        const validDay = (day: string, joinedAt: Date) => {
            if (day > today || day < attendanceDay(joinedAt, timezone)) throw new AttendanceError("Attendance date must be between the joining date and today");
        };
        const correct = async () => {
            await AccessPolicy.authorizeCapability(actorId, branchId, "attendanceCorrect", tx);
            if (!data.reason) throw new AttendanceError("Enter a reason for this correction");
        };
        let result: unknown;
        if (data.kind === "MARK") {
            const date = dayDate(data.date);
            if (data.date !== today) await correct();
            for (const student of students) {
                validDay(data.date, student.joinedAt);
                const before = await tx.attendanceMark.findUnique({ where: { branchId_studentId_date: { branchId, studentId: student.id, date } } });
                if ((before?.version ?? 0) !== data.students.find(s => s.studentId === student.id)!.version) throw stale();
                if (before || data.status === "NOT_MARKED") await correct();
                if (data.date === today && student.status !== "ACTIVE") await correct();
                const hasVisit = await tx.attendanceVisit.findFirst({ where: { branchId, studentId: student.id, date, voidedAt: null }, select: { id: true } });
                if (hasVisit && data.status !== "PRESENT") throw new AttendanceError("A valid visit establishes Present. Correct or void the visit before marking Absent or clearing attendance.", 409);
                const after = await tx.attendanceMark.upsert({ where: { branchId_studentId_date: { branchId, studentId: student.id, date } },
                    create: { branchId, studentId: student.id, date, status: data.status, actorId, note: data.note || null,
                        ...(data.date !== today || data.status === "NOT_MARKED" ? { correctedAt: now } : {}) },
                    update: { status: data.status, note: data.note || null, actorId, version: { increment: 1 }, correctedAt: now } });
                await audit(tx, actorId, branchId, student.id, data.kind, before, after, data.reason, data.key);
            }
            result = { message: `${students.length} selected student(s) marked ${data.status.toLowerCase().replaceAll("_", " ")}`, count: students.length };
        } else {
            const student = students[0];
            if (data.kind === "ISSUE_QR") {
                const existing = await tx.attendanceCredential.findUnique({ where: { studentId: student.id } });
                const credential = existing ?? await tx.attendanceCredential.create({ data: { id: randomUUID(), branchId, studentId: student.id } });
                if (!existing) await audit(tx, actorId, branchId, student.id, data.kind, null, { issued: true }, "", data.key);
                result = { student: { id: student.id, name: student.name }, qr: credential.id, message: "Attendance QR ready" };
            } else if (data.kind === "CHECK_IN") {
                if (student.status !== "ACTIVE") throw new AttendanceError("Inactive students cannot check in");
                validDay(today, student.joinedAt);
                const open = await tx.attendanceVisit.findFirst({ where: { branchId, studentId: student.id, checkOut: null, voidedAt: null } });
                if (open) result = { student: { id: student.id, name: student.name }, visitId: open.id, message: "Already checked in", checkIn: open.checkIn };
                else {
                    const date = dayDate(today);
                    const mark = await tx.attendanceMark.findUnique({ where: { branchId_studentId_date: { branchId, studentId: student.id, date } } });
                    if (mark?.status === "ABSENT") throw new AttendanceError("Student is explicitly Absent. A manager must correct that mark before check-in.", 409);
                    if (await tx.attendanceVisit.count({ where: { branchId, studentId: student.id, date } }) >= 100) throw new AttendanceError("Daily visit limit reached");
                    await this.assertNoOverlap(tx, branchId, student.id, now, null);
                    const visit = await tx.attendanceVisit.create({ data: { branchId, studentId: student.id, date, timezone, checkIn: now,
                        actorId, source: data.source, note: data.note || null } });
                    await audit(tx, actorId, branchId, student.id, data.kind, null, visit, "", data.key);
                    result = { student: { id: student.id, name: student.name }, visitId: visit.id, message: "Checked in", checkIn: visit.checkIn };
                }
            } else {
                const before = await tx.attendanceVisit.findFirst({ where: { branchId, studentId: student.id, id: data.visitId } });
                if (!before) throw missing();
                if (before.version !== data.version || before.voidedAt) throw stale();
                let after;
                if (data.kind === "VOID_VISIT") {
                    await correct();
                    after = await tx.attendanceVisit.update({ where: { id: before.id }, data: { voidedAt: now, correctedAt: now, version: { increment: 1 } } });
                } else {
                    if (data.kind === "CHECK_OUT" && before.checkOut) throw stale();
                    if (data.kind === "CORRECT_VISIT") await correct();
                    const checkIn = data.kind === "CORRECT_VISIT" ? new Date(data.checkIn) : before.checkIn;
                    const checkOut = data.kind === "CORRECT_VISIT" ? (data.checkOut ? new Date(data.checkOut) : null) : now;
                    // Preserve the original attribution timezone for an existing visit.
                    const localDay = attendanceDay(checkIn, before.timezone);
                    if (checkIn > now || (checkOut && (checkOut > now || checkOut < checkIn))) throw new AttendanceError("Times must be in the past, with checkout at or after check-in");
                    if (localDay < attendanceDay(student.joinedAt, before.timezone)) throw new AttendanceError("Attendance cannot precede the joining date");
                    const date = dayDate(localDay);
                    if (date.getTime() !== before.date.getTime() && await tx.attendanceVisit.count({ where: { branchId, studentId: student.id, date } }) >= 100) throw new AttendanceError("Daily visit limit reached on the destination date");
                    const mark = await tx.attendanceMark.findUnique({ where: { branchId_studentId_date: { branchId, studentId: student.id, date } } });
                    if (mark?.status === "ABSENT") throw new AttendanceError("Correct the Absent mark on the destination date first", 409);
                    await this.assertNoOverlap(tx, branchId, student.id, checkIn, checkOut, before.id);
                    after = await tx.attendanceVisit.update({ where: { id: before.id }, data: { date, checkIn, checkOut,
                        ...(data.kind === "CORRECT_VISIT" ? { correctedAt: now, note: data.note || null } : data.note ? { note: data.note } : {}), version: { increment: 1 } } });
                }
                await audit(tx, actorId, branchId, student.id, data.kind, before, after, data.reason, data.key);
                result = { student: { id: student.id, name: student.name }, visitId: after.id,
                    message: data.kind === "CHECK_OUT" ? "Checked out" : data.kind === "VOID_VISIT" ? "Visit voided" : "Visit corrected" };
            }
        }
        const saved = json<Prisma.InputJsonValue>(result);
        await tx.attendanceCommand.create({ data: { branchId, actorId, key: data.key, requestHash, result: saved } });
        return saved;
    }

    private static async assertNoOverlap(tx: Prisma.TransactionClient, branchId: string, studentId: string, start: Date, end: Date | null, except?: string) {
        const overlap = await tx.attendanceVisit.findFirst({ where: { branchId, studentId, voidedAt: null,
            ...(except ? { id: { not: except } } : {}), ...(end ? { checkIn: { lt: end } } : {}),
            OR: [{ checkOut: null }, { checkOut: { gt: start } }] }, select: { id: true } });
        if (overlap) throw new AttendanceError("Recorded visits cannot overlap", 409);
    }

    static async lookup(actorId: string, branchId: string, qr: string) {
        await AccessPolicy.authorizeCapability(actorId, branchId, "attendanceView");
        if (!/^[0-9a-f-]{36}$/i.test(qr)) throw missing();
        const credential = await prisma.attendanceCredential.findFirst({ where: { id: qr, branchId }, select: { student: { select: {
            id: true, name: true, status: true, attendanceVisits: { where: { branchId, checkOut: null, voidedAt: null }, select: visitSelect, take: 1 },
        } } } });
        if (!credential) throw missing();
        return { student: { id: credential.student.id, name: credential.student.name, status: credential.student.status }, openVisit: credential.student.attendanceVisits[0] ?? null };
    }

    static async list(actorId: string, branchId: string, input: unknown, now = new Date()): Promise<AttendancePage> {
        const q = attendanceQuerySchema.parse(input), cursor = decodeDateIdCursor(q.cursor);
        return prisma.$transaction(async tx => {
            const access = await AccessPolicy.authorizeCapability(actorId, branchId, "attendanceView", tx);
            const timezone = await timezoneFor(tx, branchId), today = attendanceDay(now, timezone), date = q.date ?? today;
            if (date > today) throw new AttendanceError("Choose today or an earlier date");
            if (q.shiftId && (!access.permissions.seat_allocation || date !== today)) throw new AttendanceError("Current shift filters are only available on today's roster");
            const day = dayDate(date);
            const present: Prisma.StudentWhereInput = { OR: [{ attendanceMarks: { some: { branchId, date: day, status: "PRESENT" } } },
                { attendanceVisits: { some: { branchId, date: day, voidedAt: null } } }] };
            const absent: Prisma.StudentWhereInput = { attendanceMarks: { some: { branchId, date: day, status: "ABSENT" } } };
            const unmarked: Prisma.StudentWhereInput = { NOT: { OR: [present, absent] } };
            const facts: Prisma.StudentWhereInput = { OR: [{ attendanceMarks: { some: { branchId, date: day } } }, { attendanceVisits: { some: { branchId, date: day } } }] };
            const open: Prisma.StudentWhereInput = { attendanceVisits: { some: { branchId, voidedAt: null, checkOut: null } } };
            const base: Prisma.StudentWhereInput = { branchId, AND: [q.open === "true" ? open : date === today ? { OR: [{ status: "ACTIVE", joinedAt: { lte: now } }, facts] } : facts,
                ...(q.search ? [{ OR: [{ name: { contains: q.search, mode: "insensitive" as const } }, { phone: { contains: q.search } }] }] : []),
                ...(q.shiftId ? [{ seatAllocations: { some: { branchId, shiftId: q.shiftId, endDate: null } } }] : [])] };
            const filtered: Prisma.StudentWhereInput = { AND: [base, q.status === "PRESENT" ? present : q.status === "ABSENT" ? absent : q.status === "NOT_MARKED" ? unmarked : {}] };
            const [rows, total, attended, explicitlyAbsent, notMarked, openCount, shifts] = await Promise.all([
                tx.student.findMany({ where: { AND: [filtered, ...(cursor ? [{ OR: [{ createdAt: { lt: cursor.sort } }, { createdAt: cursor.sort, id: { lt: cursor.id } }] }] : [])] },
                    select: { id: true, name: true, phone: true, status: true, createdAt: true,
                        attendanceMarks: { where: { branchId, date: day }, select: markSelect, take: 1 },
                        attendanceVisits: { where: { branchId, OR: [{ date: day }, { checkOut: null, voidedAt: null }] }, select: visitSelect, orderBy: { checkIn: "desc" }, take: 101 },
                        seatAllocations: { where: { branchId, endDate: null, ...(!access.permissions.seat_allocation ? { id: { in: [] } } : {}) }, select: { seat: { select: { label: true } }, shift: { select: { name: true } } }, take: 100 } },
                    orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: q.limit + 1 }),
                tx.student.count({ where: filtered }), tx.student.count({ where: { AND: [base, present] } }),
                tx.student.count({ where: { AND: [base, absent] } }), tx.student.count({ where: { AND: [base, unmarked] } }),
                tx.attendanceVisit.count({ where: { branchId, voidedAt: null, checkOut: null } }),
                access.permissions.seat_allocation ? tx.shift.findMany({ where: { branchId, status: "ACTIVE" }, select: { id: true, name: true }, orderBy: { name: "asc" }, take: 100 }) : [],
            ]);
            const page = pageFromRows(rows, q.limit, total, r => ({ sort: r.createdAt, id: r.id }));
            return json<AttendancePage>({ ...page, date, today, timezone, counts: { attended, absent: explicitlyAbsent, notMarked: date === today ? notMarked : null, open: openCount }, shifts,
                items: page.items.map(r => { const visits = r.attendanceVisits.filter(v => v.date.getTime() === day.getTime()); return {
                    id: r.id, name: r.name, phone: r.phone, status: r.status, mark: r.attendanceMarks[0] ?? null,
                    attendance: effectiveAttendance(r.attendanceMarks[0]?.status, visits.filter(v => !v.voidedAt).length), visits,
                    openVisit: r.attendanceVisits.find(v => !v.checkOut && !v.voidedAt) ?? null,
                    currentAllocations: (r.seatAllocations ?? []).map(a => ({ seat: a.seat.label, shift: a.shift.name })),
                }; }) });
        }, { isolationLevel: "RepeatableRead", timeout: 15000 });
    }

    static async history(actorId: string, branchId: string, input: unknown, now = new Date()): Promise<AttendanceHistory> {
        const q = attendanceHistorySchema.parse(input), cursor = decodeDateIdCursor(q.cursor);
        const auditCursor = decodeDateIdCursor(q.auditCursor);
        return prisma.$transaction(async tx => {
            await AccessPolicy.authorizeCapability(actorId, branchId, "attendanceView", tx);
            const student = await tx.student.findFirst({ where: { id: q.studentId, branchId }, select: { id: true, name: true, status: true } });
            if (!student) throw missing();
            const timezone = await timezoneFor(tx, branchId), today = attendanceDay(now, timezone);
            const from = q.from ?? attendanceDay(new Date(now.getTime() - 30 * 86400000), timezone), to = q.to ?? today;
            if (to < from || dayDate(to).getTime() - dayDate(from).getTime() > 92 * 86400000) throw new AttendanceError("Choose a date range of at most 93 days");
            const date = { gte: dayDate(from), lte: dayDate(to) };
            const [marks, visits, credential, audits] = await Promise.all([
                tx.attendanceMark.findMany({ where: { branchId, studentId: student.id, date }, select: markSelect, orderBy: { date: "desc" }, take: 93 }),
                tx.attendanceVisit.findMany({ where: { branchId, studentId: student.id, date,
                    ...(cursor ? { OR: [{ checkIn: { lt: cursor.sort } }, { checkIn: cursor.sort, id: { lt: cursor.id } }] } : {}) }, select: visitSelect,
                    orderBy: [{ checkIn: "desc" }, { id: "desc" }], take: 51 }),
                tx.attendanceCredential.findFirst({ where: { branchId, studentId: student.id }, select: { id: true } }),
                tx.auditLog.findMany({ where: { branchId, studentId: student.id, action: "ATTENDANCE_CHANGED",
                    ...(auditCursor ? { OR: [{ createdAt: { lt: auditCursor.sort } }, { createdAt: auditCursor.sort, id: { lt: auditCursor.id } }] } : {}) },
                    select: { id: true, details: true, createdAt: true, user: { select: { name: true } } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 51 }),
            ]);
            const page = pageFromRows(visits, 50, 0, v => ({ sort: v.checkIn, id: v.id }));
            const auditPage = pageFromRows(audits, 50, 0, a => ({ sort: a.createdAt, id: a.id }));
            const facts = (value: AttendanceAuditFacts | null) => value ? Object.fromEntries(Object.entries(value).filter(([key]) => ["date", "status", "checkIn", "checkOut", "note", "voidedAt"].includes(key))) : null;
            return json<AttendanceHistory>({ student, timezone, today, from, to, marks, visits: page.items, nextCursor: page.nextCursor, qr: credential?.id ?? null,
                audits: auditPage.items.map(a => { const d = a.details as { kind: string; reason: string; before: AttendanceAuditFacts | null; after: AttendanceAuditFacts | null };
                    return { id: a.id, createdAt: a.createdAt, actor: a.user.name, kind: d.kind, reason: d.reason, before: facts(d.before), after: facts(d.after) }; }), auditNextCursor: auditPage.nextCursor });
        }, { isolationLevel: "RepeatableRead" });
    }
}
