import { addDays, endOfDay, startOfDay } from "date-fns";
import { z } from "zod";
import { isOverdue } from "@/lib/utils/paymentStatus";

export const renewalFilters = ["ALL", "TODAY", "UPCOMING", "OUTSTANDING", "OVERDUE"] as const;
export type RenewalFilter = typeof renewalFilters[number];
export const followUpOutcomes = {
    NOT_CONTACTED: "Not contacted",
    ATTEMPTED: "Contact attempted",
    NO_ANSWER: "No answer",
    CONTACTED: "Contacted",
    PROMISED_PAYMENT: "Promised payment",
    CALL_BACK: "Call back",
} as const;
export type FollowUpOutcome = keyof typeof followUpOutcomes;
export type RenewalFollowUp = {
    note: string;
    outcome: FollowUpOutcome;
    nextFollowUpAt: string | null;
    updatedAt: string;
    author: { name: string | null } | null;
};
export type RenewalRow = {
    key: string;
    studentId: string;
    studentName: string;
    phone: string | null;
    studentStatus: string;
    paymentId: string | null;
    type: "MONTHLY" | "ADMISSION";
    periodStart: string;
    periodEnd: string;
    dueDate: string;
    amount: number;
    expected: boolean;
    allocations: { seat: string; shift: string }[];
    followUp: RenewalFollowUp | null;
};
export type RenewalPage = {
    items: RenewalRow[];
    counts: Record<RenewalFilter, number>;
    outstandingAmount: number;
    expectedAmount: number;
    nextCursor: string | null;
    asOf: string;
};
export const renewalQuerySchema = z.object({
    filter: z.enum(renewalFilters).default("ALL"),
    days: z.coerce.number().pipe(z.union([z.literal(3), z.literal(7)])).default(7),
    search: z.string().trim().max(100).default(""),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    cursor: z.string().max(2000).optional(),
});
export type RenewalQuery = z.infer<typeof renewalQuerySchema>;
export const followUpSchema = z.object({
    studentId: z.string().min(1).max(128),
    type: z.enum(["MONTHLY", "ADMISSION"]),
    periodStart: z.iso.datetime(),
    note: z.string().trim().max(2000),
    outcome: z.enum(Object.keys(followUpOutcomes) as [FollowUpOutcome, ...FollowUpOutcome[]]),
    nextFollowUpAt: z.iso.date().nullable(),
}).strict();
export type FollowUpInput = z.infer<typeof followUpSchema>;

export function renewalKey(studentId: string, type: string, periodStart: Date | string) {
    return `${studentId}:${type}:${new Date(periodStart).toISOString()}`;
}
export function renewalCategories(row: Pick<RenewalRow, "dueDate" | "expected">, asOf: Date, days: number): RenewalFilter[] {
    const due = new Date(row.dueDate);
    const today = startOfDay(asOf);
    const result: RenewalFilter[] = ["ALL"];
    if (due >= today && due <= endOfDay(today)) result.push("TODAY");
    if (due >= addDays(today, 1) && due <= endOfDay(addDays(today, days))) result.push("UPCOMING");
    if (!row.expected && due <= endOfDay(today)) result.push("OUTSTANDING");
    if (!row.expected && isOverdue(due, today)) result.push("OVERDUE");
    return result;
}
export function renewalOrderKey(row: Pick<RenewalRow, "dueDate" | "key">) {
    return `${row.dueDate}|${row.key}`;
}
