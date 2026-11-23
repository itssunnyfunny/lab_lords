import type { Prisma } from "@/app/generated/prisma/client";
import { addDays } from "date-fns";
import { AccessPolicy } from "@/services/accessPolicy.service";
import { eligibleMonthlyAccruals } from "@/services/branchFeeAccrual";
import { dueCyclesThrough, studentFeeDay } from "@/utils/studentBillingCycles";

export const STUDENT_GENERATION_BATCH_SIZE = 250;
export const PAYMENT_INSERT_BATCH_SIZE = 1000;
const billingStudentSelect = { id: true, branchId: true, joinedAt: true, rejoinedOn: true, billingStartAt: true, monthlyFee: true } as const;
type BillingStudent = Prisma.StudentGetPayload<{ select: typeof billingStudentSelect }>;

/** Both scheduled generation and rate edits recognize the typed cycle and the legacy due day. */
export async function missingMonthlyFees(
    client: Pick<Prisma.TransactionClient, "payment">, students: BillingStudent[], asOf: Date, branchId?: string,
) {
    const candidates = students.flatMap(student => student.monthlyFee > 0
        ? dueCyclesThrough(student.joinedAt, asOf, student.billingStartAt, student.rejoinedOn).map(cycle => ({
            branchId: student.branchId, studentId: student.id, amount: student.monthlyFee,
            type: "MONTHLY" as const, status: "DUE" as const,
            dueDate: cycle.dueDate, periodStart: cycle.periodStart, periodEnd: cycle.periodEnd,
        })) : []);
    if (!candidates.length) return [];

    const latestDue = candidates.reduce((latest, payment) => payment.dueDate > latest ? payment.dueDate : latest, candidates[0].dueDate);
    const existing = await client.payment.findMany({
        where: {
            branchId, studentId: { in: students.map(student => student.id) }, type: "MONTHLY",
            OR: [{ dueDate: { lt: addDays(latestDue, 1) } }, { periodStart: { lt: latestDue } }],
        },
        select: { studentId: true, dueDate: true, periodStart: true },
    });
    const periodStarts = new Set(existing.map(row => `${row.studentId}:${row.periodStart.getTime()}`));
    const byStudent = new Map(students.map(student => [student.id, student]));
    const dueDays = new Set(existing.map(row => `${row.studentId}:${studentFeeDay(byStudent.get(row.studentId)!, row.dueDate).getTime()}`));
    return candidates.filter(row => !periodStarts.has(`${row.studentId}:${row.periodStart.getTime()}`)
        && !dueDays.has(`${row.studentId}:${row.dueDate.getTime()}`));
}

/** The rate update holds the student write locks. Its old positive rate is still authoritative for accrued dues. */
export async function preserveAccruedMonthlyFees(
    tx: Prisma.TransactionClient, actorId: string, branchId: string, students: BillingStudent[], asOf: Date,
) {
    let authorized = false;
    for (let offset = 0; offset < students.length; offset += STUDENT_GENERATION_BATCH_SIZE) {
        const batch = students.slice(offset, offset + STUDENT_GENERATION_BATCH_SIZE);
        const byStudent = new Map(batch.map(student => [student.id, student]));
        const missing = await eligibleMonthlyAccruals(
            tx, await missingMonthlyFees(tx, batch, asOf, branchId), asOf,
            (studentId, date) => studentFeeDay(byStudent.get(studentId)!, date),
        );
        if (!missing.length) continue;
        if (!authorized) {
            await AccessPolicy.authorizeAction(actorId, branchId, "generate_payments", tx, true);
            authorized = true;
        }
        for (let i = 0; i < missing.length; i += PAYMENT_INSERT_BATCH_SIZE) {
            await tx.payment.createMany({ data: missing.slice(i, i + PAYMENT_INSERT_BATCH_SIZE), skipDuplicates: true });
        }
    }
}

/** Preserve completed free anniversaries when a positive monthly fee starts. */
export function billingStartAfterFreePeriods(
    student: { monthlyFee: number; joinedAt: Date; billingStartAt: Date | null; rejoinedOn?: Date | null },
    nextFee: number | undefined,
    now = new Date(),
) {
    if (student.monthlyFee !== 0 || nextFee === undefined || nextFee <= 0) return undefined;
    return dueCyclesThrough(student.joinedAt, now, student.billingStartAt, student.rejoinedOn).at(-1)?.periodEnd;
}

export async function updateLinkedStudentFees(
    tx: Prisma.TransactionClient,
    actorId: string,
    where: { branchId: string } & ({ feeLinkedShiftId: string } | { feeLinkedMultiShiftId: string }),
    monthlyFee: number,
) {
    const now = new Date();
    if (monthlyFee === 0) {
        const previouslyPaid = await tx.student.findMany({
            where: { ...where, monthlyFee: { gt: 0 }, status: "ACTIVE" },
            select: billingStudentSelect,
        });
        await tx.student.updateMany({ where, data: { monthlyFee } });
        await preserveAccruedMonthlyFees(tx, actorId, where.branchId, previouslyPaid, now);
    } else {
        const freeStudents = await tx.student.findMany({
            where: { ...where, monthlyFee: 0 },
            select: { id: true, monthlyFee: true, joinedAt: true, billingStartAt: true, rejoinedOn: true },
        });
        const studentsByCutoff = new Map<number, string[]>();
        for (const student of freeStudents) {
            const billingStartAt = billingStartAfterFreePeriods(student, monthlyFee, now);
            if (!billingStartAt) continue;
            const cutoff = billingStartAt.getTime();
            const ids = studentsByCutoff.get(cutoff);
            if (ids) ids.push(student.id);
            else studentsByCutoff.set(cutoff, [student.id]);
        }
        for (const [cutoff, ids] of studentsByCutoff) {
            await tx.student.updateMany({
                where: { ...where, id: { in: ids }, monthlyFee: 0 },
                data: { billingStartAt: new Date(cutoff) },
            });
        }
        await tx.student.updateMany({ where, data: { monthlyFee } });
    }
}
