import { remainingFee } from "@/lib/feeBalance";
import { addDays, endOfDay, parseISO, startOfDay } from "date-fns";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/app/generated/prisma/client";
import { AccessPolicy } from "@/services/accessPolicy.service";
import { upcomingCyclesBetween } from "@/utils/studentBillingCycles";
import {
    followUpSchema, renewalCategories, renewalKey, renewalOrderKey, renewalQuerySchema,
    type FollowUpInput, type RenewalPage, type RenewalQuery, type RenewalRow,
    type RenewalFollowUp,
} from "@/lib/renewals";

const BATCH = 250;
const studentSelect = { id: true, name: true, phone: true, status: true } as const;
const followUpSelect = {
    studentId: true, type: true, periodStart: true, note: true, outcome: true,
    nextFollowUpAt: true, updatedAt: true, author: { select: { name: true } },
} as const;

export class RenewalInputError extends Error {}

function decodeCursor(query: RenewalQuery): string | null {
    if (!query.cursor) return null;
    try {
        const value = JSON.parse(Buffer.from(query.cursor, "base64url").toString());
        if (value.search !== query.search || value.filter !== query.filter || value.days !== query.days
            || typeof value.key !== "string" || value.key.length > 500) throw new Error();
        return value.key;
    } catch { throw new RenewalInputError("Invalid queue cursor"); }
}

export class RenewalsService {
    static async list(actorId: string, branchId: string, input: RenewalQuery, asOf = new Date()): Promise<RenewalPage> {
        const query = renewalQuerySchema.parse(input);
        const after = decodeCursor(query);
        return prisma.$transaction(async tx => {
            const access = await AccessPolicy.authorizeAction(actorId, branchId, "view_payments", tx);
            const today = startOfDay(asOf);
            const through = endOfDay(addDays(today, query.days));
            const search: Prisma.StudentWhereInput = query.search ? { OR: [
                { name: { contains: query.search, mode: "insensitive" } },
                { phone: { contains: query.search } },
            ] } : {};
            const result: RenewalPage = {
                items: [], counts: { ALL: 0, TODAY: 0, UPCOMING: 0, OUTSTANDING: 0, OVERDUE: 0 },
                outstandingAmount: 0, expectedAmount: 0, nextCursor: null, asOf: today.toISOString(),
            };
            // Stream bounded batches, keeping only one output page in memory.
            const offer = (row: RenewalRow) => {
                const categories = renewalCategories(row, today, query.days);
                for (const category of categories) result.counts[category]++;
                if (categories.includes("OUTSTANDING")) result.outstandingAmount += row.amount;
                if (row.expected) result.expectedAmount += row.amount;
                if (!categories.includes(query.filter) || (after && renewalOrderKey(row) <= after)) return;
                result.items.push(row);
                result.items.sort((a, b) => renewalOrderKey(a) < renewalOrderKey(b) ? -1 : 1);
                if (result.items.length > query.limit + 1) result.items.pop();
            };
            let paymentCursor: string | undefined;
            while (true) {
                const payments = await tx.payment.findMany({
                    where: { branchId, status: "DUE", dueDate: { lte: through }, student: { branchId, ...search } },
                    select: { id: true, studentId: true, type: true, periodStart: true, periodEnd: true,
                        dueDate: true, amount: true, collectedAmount: true, waivedAmount: true, student: { select: studentSelect } },
                    orderBy: { id: "asc" }, take: BATCH,
                    ...(paymentCursor ? { cursor: { id: paymentCursor }, skip: 1 } : {}),
                });
                for (const payment of payments) offer({
                    key: renewalKey(payment.studentId, payment.type, payment.periodStart),
                    studentId: payment.studentId, studentName: payment.student.name, phone: payment.student.phone,
                    studentStatus: payment.student.status, paymentId: payment.id, type: payment.type,
                    periodStart: payment.periodStart.toISOString(), periodEnd: payment.periodEnd.toISOString(),
                    dueDate: payment.dueDate.toISOString(), amount: remainingFee(payment), expected: false,
                    allocations: [], followUp: null,
                });
                if (payments.length < BATCH) break;
                paymentCursor = payments[payments.length - 1].id;
            }
            let studentCursor: string | undefined;
            while (true) {
                const students = await tx.student.findMany({
                    where: { branchId, status: "ACTIVE", ...search },
                    select: { ...studentSelect, joinedAt: true, billingStartAt: true, monthlyFee: true },
                    orderBy: { id: "asc" }, take: BATCH,
                    ...(studentCursor ? { cursor: { id: studentCursor }, skip: 1 } : {}),
                });
                const projections = students.flatMap(student => upcomingCyclesBetween(
                    student.joinedAt, today, through, student.billingStartAt
                ).map(cycle => ({ student, cycle })));
                // At most one anniversary per student in this <=7-day window.
                // Match BOTH typed identity and the legacy due-date guard used by generation.
                const existing = projections.length ? await tx.payment.groupBy({
                    by: ["studentId"],
                    where: { branchId, type: "MONTHLY", OR: projections.map(({ student, cycle }) => ({
                        studentId: student.id, OR: [{ periodStart: cycle.periodStart },
                            { dueDate: { gte: cycle.dueDate, lt: addDays(cycle.dueDate, 1) } }],
                    })) },
                    orderBy: { studentId: "asc" }, take: BATCH,
                }) : [];
                const suppressedStudents = new Set(existing.map(p => p.studentId));
                for (const { student, cycle } of projections) {
                    const key = renewalKey(student.id, "MONTHLY", cycle.periodStart);
                    if (suppressedStudents.has(student.id)) continue;
                    offer({ key, studentId: student.id, studentName: student.name, phone: student.phone,
                        studentStatus: student.status, paymentId: null, type: "MONTHLY",
                        periodStart: cycle.periodStart.toISOString(), periodEnd: cycle.periodEnd.toISOString(),
                        dueDate: cycle.dueDate.toISOString(), amount: student.monthlyFee, expected: true,
                        allocations: [], followUp: null });
                }
                if (students.length < BATCH) break;
                studentCursor = students[students.length - 1].id;
            }
            if (result.items.length > query.limit) {
                result.items.pop();
                result.nextCursor = Buffer.from(JSON.stringify({
                    search: query.search, filter: query.filter, days: query.days,
                    key: renewalOrderKey(result.items[result.items.length - 1]),
                })).toString("base64url");
            }
            if (result.items.length) {
                const followUps = await tx.renewalFollowUp.findMany({
                    where: { branchId, OR: result.items.map(row => ({ studentId: row.studentId,
                        type: row.type, periodStart: new Date(row.periodStart) })) },
                    select: followUpSelect, take: query.limit,
                });
                const byKey = new Map(followUps.map(f => [renewalKey(f.studentId, f.type, f.periodStart), {
                    note: f.note, outcome: f.outcome, nextFollowUpAt: f.nextFollowUpAt?.toISOString() ?? null,
                    updatedAt: f.updatedAt.toISOString(), author: f.author,
                } as RenewalFollowUp]));
                const students = access.permissions.students || access.permissions.seat_allocation
                    ? await tx.student.findMany({
                        where: { branchId, id: { in: result.items.map(row => row.studentId) } },
                        select: { id: true, seatAllocations: { where: { branchId, endDate: null },
                            select: { seat: { select: { label: true } }, shift: { select: { name: true } } },
                            orderBy: { id: "asc" }, take: 20 } }, take: query.limit,
                    }) : [];
                const allocations = new Map(students.map(s => [s.id, s.seatAllocations.map(a => ({ seat: a.seat.label, shift: a.shift.name }))]));
                result.items = result.items.map(row => ({ ...row, followUp: byKey.get(row.key) ?? null,
                    allocations: allocations.get(row.studentId) ?? [] }));
            }
            return result;
        }, { isolationLevel: "RepeatableRead", timeout: 30_000 });
    }

    static async saveFollowUp(actorId: string, branchId: string, input: FollowUpInput, asOf = new Date()) {
        const data = followUpSchema.parse(input);
        return prisma.$transaction(async tx => {
            await AccessPolicy.authorizeCapability(actorId, branchId, "paymentsRecord", tx);
            const student = await tx.student.findFirst({ where: { id: data.studentId, branchId },
                select: { id: true, status: true, joinedAt: true, billingStartAt: true } });
            if (!student) throw new Error("Student not found");
            const periodStart = new Date(data.periodStart);
            const payment = await tx.payment.findFirst({ where: {
                branchId, studentId: student.id, type: data.type, periodStart,
            }, select: { status: true } });
            if (payment && payment.status !== "DUE") throw new RenewalInputError("This payment is already resolved. Refresh the queue.");
            if (!payment) {
                const cycle = data.type === "MONTHLY" && student.status === "ACTIVE"
                    ? upcomingCyclesBetween(student.joinedAt, startOfDay(asOf), endOfDay(addDays(asOf, 7)), student.billingStartAt)
                        .find(c => c.periodStart.getTime() === periodStart.getTime()) : undefined;
                const coveringPayment = cycle ? await tx.payment.findFirst({ where: {
                    branchId, studentId: student.id, type: "MONTHLY",
                    dueDate: { gte: cycle.dueDate, lt: addDays(cycle.dueDate, 1) },
                }, select: { id: true } }) : null;
                if (!cycle || coveringPayment) {
                    throw new RenewalInputError("This fee is no longer in the queue. Refresh and try again.");
                }
            }
            const values = { note: data.note, outcome: data.outcome,
                nextFollowUpAt: data.nextFollowUpAt ? parseISO(data.nextFollowUpAt) : null, authorId: actorId };
            const saved = await tx.renewalFollowUp.upsert({
                where: { studentId_type_periodStart: { studentId: student.id, type: data.type, periodStart } },
                create: { branchId, studentId: student.id, type: data.type, periodStart, ...values },
                update: values, select: followUpSelect,
            });
            return { note: saved.note, outcome: saved.outcome, nextFollowUpAt: saved.nextFollowUpAt?.toISOString() ?? null,
                updatedAt: saved.updatedAt.toISOString(), author: saved.author } as RenewalFollowUp;
        });
    }
}
