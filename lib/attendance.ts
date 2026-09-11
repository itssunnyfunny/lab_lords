import { z } from "zod";

export const attendanceStatuses = ["PRESENT", "ABSENT", "NOT_MARKED"] as const;
export type AttendanceStatus = typeof attendanceStatuses[number];
export const attendanceLabels: Record<AttendanceStatus, string> = { PRESENT: "Present", ABSENT: "Absent", NOT_MARKED: "Not marked" };
const id = z.string().min(1).max(128);
export const attendanceDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => {
    const d = new Date(`${v}T00:00:00Z`);
    return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === v;
}, "Invalid attendance date");
const base = { key: z.uuid(), note: z.string().trim().max(1000).default(""), reason: z.string().trim().max(1000).default("") };
const student = { studentId: id };
const version = z.number().int().min(0);
export const attendanceCommandSchema = z.discriminatedUnion("kind", [
    z.object({ ...base, kind: z.literal("MARK"), date: attendanceDateSchema, status: z.enum(attendanceStatuses),
        students: z.array(z.object({ ...student, version })).min(1).max(50) }),
    z.object({ ...base, ...student, kind: z.literal("CHECK_IN"), source: z.enum(["MANUAL", "QR"]).default("MANUAL") }),
    z.object({ ...base, ...student, kind: z.literal("CHECK_OUT"), visitId: id, version }),
    z.object({ ...base, ...student, kind: z.literal("CORRECT_VISIT"), visitId: id, version,
        checkIn: z.iso.datetime({ offset: true }), checkOut: z.iso.datetime({ offset: true }).nullable() }),
    z.object({ ...base, ...student, kind: z.literal("VOID_VISIT"), visitId: id, version }),
    z.object({ ...base, ...student, kind: z.literal("ISSUE_QR") }),
]);
export type AttendanceCommand = z.input<typeof attendanceCommandSchema>;
export const attendanceQuerySchema = z.object({ date: attendanceDateSchema.optional(), search: z.string().trim().max(100).default(""),
    status: z.enum(["ALL", ...attendanceStatuses]).default("ALL"), shiftId: id.optional(), cursor: z.string().max(512).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(25), open: z.enum(["true", "false"]).default("false") });
export const attendanceHistorySchema = z.object({ studentId: id, from: attendanceDateSchema.optional(), to: attendanceDateSchema.optional(),
    cursor: z.string().max(512).optional(), auditCursor: z.string().max(512).optional() });

export function attendanceTimezone(value?: string | null) {
    try { if (value) { new Intl.DateTimeFormat("en", { timeZone: value }).format(); return value; } } catch { /* legacy invalid setting */ }
    return "Asia/Kolkata";
}
export function attendanceDay(instant: Date, timezone: string) {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: attendanceTimezone(timezone), year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(instant);
    const part = (type: string) => parts.find(p => p.type === type)!.value;
    return `${part("year")}-${part("month")}-${part("day")}`;
}
export function attendanceTime(instant: string, timezone: string) {
    return new Intl.DateTimeFormat("en-IN", { timeZone: timezone, dateStyle: "medium", timeStyle: "short" }).format(new Date(instant));
}
export function recordedMinutes(start: string, end: string | null) {
    return end && Date.parse(end) >= Date.parse(start) ? Math.floor((Date.parse(end) - Date.parse(start)) / 60000) : null;
}
export function effectiveAttendance(mark: AttendanceStatus | undefined, validVisits: number): AttendanceStatus {
    return validVisits > 0 ? "PRESENT" : mark ?? "NOT_MARKED";
}
export type AttendanceVisitView = { id: string; date: string; timezone: string; checkIn: string; checkOut: string | null;
    version: number; source: string; note: string | null; correctedAt: string | null; voidedAt: string | null; actor: { name: string | null } };
export type AttendanceMarkView = { date: string; status: AttendanceStatus; version: number; note: string | null;
    correctedAt: string | null; updatedAt: string; source: string; actor: { name: string | null } };
export type AttendanceRow = { id: string; name: string; phone: string | null; status: "ACTIVE" | "INACTIVE";
    attendance: AttendanceStatus; mark: AttendanceMarkView | null; visits: AttendanceVisitView[]; openVisit: AttendanceVisitView | null;
    currentAllocations: { seat: string; shift: string }[] };
export type AttendancePage = { items: AttendanceRow[]; total: number; nextCursor: string | null; date: string; today: string; timezone: string;
    counts: { attended: number; absent: number; notMarked: number | null; open: number }; shifts: { id: string; name: string }[] };
export type AttendanceHistory = { student: { id: string; name: string; status: string }; timezone: string; today: string; from: string; to: string;
    marks: AttendanceMarkView[]; visits: AttendanceVisitView[]; nextCursor: string | null; qr: string | null;
    audits: { id: string; createdAt: string; actor: string | null; kind: string; reason: string; before: AttendanceAuditFacts | null; after: AttendanceAuditFacts | null }[];
    auditNextCursor: string | null };
export type AttendanceAuditFacts = { date?: string; status?: string; checkIn?: string; checkOut?: string | null; note?: string | null; voidedAt?: string | null };
