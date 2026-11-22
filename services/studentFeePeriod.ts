import type { Prisma } from "@/app/generated/prisma/client";
import { dueCyclesThrough } from "@/utils/studentBillingCycles";

/** Preserve completed free anniversaries when a positive monthly fee starts. */
export function billingStartAfterFreePeriods(
    student: { monthlyFee: number; joinedAt: Date; billingStartAt: Date | null },
    nextFee: number | undefined,
    now = new Date(),
) {
    if (student.monthlyFee !== 0 || nextFee === undefined || nextFee <= 0) return undefined;
    return dueCyclesThrough(student.joinedAt, now, student.billingStartAt).at(-1)?.periodEnd;
}

export async function updateLinkedStudentFees(
    tx: Prisma.TransactionClient,
    where: { branchId: string } & ({ feeLinkedShiftId: string } | { feeLinkedMultiShiftId: string }),
    monthlyFee: number,
) {
    if (monthlyFee > 0) {
        const freeStudents = await tx.student.findMany({
            where: { ...where, monthlyFee: 0 },
            select: { id: true, monthlyFee: true, joinedAt: true, billingStartAt: true },
        });
        const now = new Date();
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
    }
    await tx.student.updateMany({ where, data: { monthlyFee } });
}
