import { z } from "zod";
import { attendanceDateSchema } from "@/lib/attendance";
import { followUpOutcomes } from "@/lib/renewals";

const id = z.string().min(1).max(128);
export const dashboardQuerySchema = z.object({ month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional() });
export type DashboardSource<T> = { status: "success" | "restricted" | "locked" | "error"; data: T | null };
export type DashboardFollowUp = { id: string; studentId: string; studentName: string; phone: string | null;
    type: "MONTHLY" | "ADMISSION"; periodStart: string; note: string; outcome: string; nextFollowUpAt: string | null;
    completedAt: string | null; updatedAt: string };
export type DashboardTerm = { id: string; studentId: string; studentName: string; label: string; startDate: string;
    endDate: string; daysLeft: number };
export type DashboardTask = { id: string; title: string; status: "OPEN" | "DONE"; dueAt: string | null;
    assigneeId: string | null; assigneeName: string | null; createdAt: string; updatedAt: string };
export type DashboardActivity = { id: string; kind: "COLLECTION" | "STUDENT" | "ATTENDANCE" | "FOLLOW_UP" | "TASK" | "ALLOCATION" | "CONFIGURATION";
    occurredAt: string; studentName?: string; amount?: number; detail?: string; href: string };
export type DashboardNotification = { key: string; kind: "OVERDUE" | "FOLLOW_UP" | "ATTENDANCE" | "RENEWAL" | "TASK";
    count: number; href: string; read: boolean; snoozedUntil: string | null; dismissed: boolean };
export type DashboardOverview = {
    branchId: string; timezone: string; today: string; updatedAt: string;
    money: DashboardSource<{ collectedThisMonth: number; pendingDues: number; overdueAmount: number; overdueStudents: number;
        comparisonPercent: number | null }>;
    students: DashboardSource<{ active: number; comparison: number | null }>;
    followUps: DashboardSource<{ pending: number; dueToday: number; items: DashboardFollowUp[] }>;
    terms: DashboardSource<{ configured: boolean; renewalsThisWeek: number; items: DashboardTerm[] }>;
    collections: DashboardSource<{ month: string; billed: number; collected: number; pending: number; waived: number;
        rate: number | null; points: { date: string; billed: number; collected: number; pending: number; collectionRate: number | null }[] }>;
    seating: DashboardSource<{ seats: number; shifts: number; capacity: number; occupied: number; physicalSeatsInUse: number;
        utilizationPercent: number | null; threshold: number; lowUtilization: boolean; coverageStartedAt: string | null;
        days: string[]; rows: { id: string; name: string; startTime: string | null; endTime: string | null;
            cells: { date: string; capacity: number | null; occupied: number | null; recordedAt: string | null }[] }[];
        seatsPreview: { id: string; label: string; occupiedShifts: number }[] }>;
    attendance: DashboardSource<{ configured: boolean; expectedToday: number; attendedToday: number; gaps: number;
        gapsStudents: { id: string; name: string; expectedBy: string }[] }>;
    activity: DashboardActivity[];
    activityStatus?: "success" | "restricted" | "error";
};

export const dashboardTaskSchema = z.object({ title: z.string().trim().min(1).max(160),
    dueAt: z.iso.datetime({ offset: true }).nullable().default(null), assigneeId: id.nullable().default(null) }).strict();
export const dashboardTaskPatchSchema = dashboardTaskSchema.partial().extend({ status: z.enum(["OPEN", "DONE"]).optional() }).strict();
export const dashboardListSchema = z.object({ search: z.string().trim().max(100).default(""),
    limit: z.coerce.number().int().min(1).max(100).default(50), cursor: id.optional() });
export const dashboardTaskQuerySchema = dashboardListSchema.extend({ status: z.enum(["OPEN", "DONE", "ALL"]).default("ALL") });
export const dashboardFollowUpQuerySchema = dashboardListSchema.extend({ filter: z.enum(["ALL", "DUE", "COMPLETED"]).default("ALL") });
export const dashboardFollowUpPatchSchema = z.object({ note: z.string().trim().max(2000).optional(),
    outcome: z.enum(Object.keys(followUpOutcomes) as [keyof typeof followUpOutcomes, ...(keyof typeof followUpOutcomes)[]]).optional(),
    nextFollowUpAt: attendanceDateSchema.nullable().optional(), completed: z.boolean().optional() }).strict();
export const dashboardSettingsSchema = z.object({ utilizationThreshold: z.number().int().min(1).max(100) }).strict();
export const dashboardExpectationSchema = z.object({ studentId: id, weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7)
    .refine(days => new Set(days).size === days.length), expectedBy: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), enabled: z.boolean() }).strict();
export const dashboardTermSchema = z.object({ studentId: id, label: z.string().trim().min(1).max(80), startDate: attendanceDateSchema,
    endDate: attendanceDateSchema }).strict().refine(data => data.endDate >= data.startDate, "End date must follow start date");
export const dashboardNotificationSchema = z.object({ key: z.string().min(1).max(160), action: z.enum(["READ", "SNOOZE", "DISMISS"]),
    snoozeUntil: z.iso.datetime({ offset: true }).optional() }).strict();
