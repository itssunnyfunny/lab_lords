import { z } from "zod";
import { dashboardDateOffset, dashboardDayStart, dashboardToday } from "@/lib/dashboardMath";
import { overdueCutoffForDay, type PaymentOverduePolicy } from "@/lib/utils/paymentStatus";

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
export function renewalCalendar(asOf: Date, days: number, policy: PaymentOverduePolicy) {
    const localDay = dashboardToday(asOf, policy.timezone);
    const start = (offset: number) => dashboardDayStart(dashboardDateOffset(localDay, offset), policy.timezone);
    return {
        today: start(0),
        tomorrow: start(1),
        through: new Date(start(days + 1).getTime() - 1),
        overdueBefore: overdueCutoffForDay(policy, localDay),
    };
}

export function renewalCategories(
    row: Pick<RenewalRow, "dueDate" | "expected" | "amount">,
    { today, tomorrow, through, overdueBefore }: ReturnType<typeof renewalCalendar>,
): RenewalFilter[] {
    if (row.amount <= 0) return [];
    const due = new Date(row.dueDate);
    const result: RenewalFilter[] = ["ALL"];
    if (due >= today && due < tomorrow) result.push("TODAY");
    if (due >= tomorrow && due <= through) result.push("UPCOMING");
    if (!row.expected && due < tomorrow) result.push("OUTSTANDING");
    if (!row.expected && due < overdueBefore) result.push("OVERDUE");
    return result;
}
export function renewalOrderKey(row: Pick<RenewalRow, "dueDate" | "key">) {
    return `${row.dueDate}|${row.key}`;
}
