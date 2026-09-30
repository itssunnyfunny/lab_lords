import { createHash } from "node:crypto";
import type { Prisma } from "@/app/generated/prisma/client";
import { getOverduePayments } from "@/analytics/payment.analytics";
import { prisma } from "@/lib/prisma";

export type OverdueDebtPayment = Awaited<ReturnType<typeof getOverduePayments>>["payments"][number];
export type DraftDebtReader = Pick<Prisma.TransactionClient, "payment" | "student">;
export type DraftDebtSource = {
    payments: OverdueDebtPayment[];
    fingerprintsByStudentId: Map<string, string>;
};

const SOURCE_MARKER = ":SOURCE_V1:";
const SHA256 = /^[a-f0-9]{64}$/;

/** Select one semantic variant, including its pre-fingerprint cache entry. */
export function draftActionFamilyWhere(baseAction: string): Prisma.MessageDraftWhereInput {
    return { OR: [{ action: baseAction }, { action: { startsWith: `${baseAction}${SOURCE_MARKER}` } }] };
}

export function draftSourceFingerprint(storedAction: string, baseAction: string): string | null {
    const prefix = `${baseAction}${SOURCE_MARKER}`;
    if (!storedAction.startsWith(prefix)) return null;
    const fingerprint = storedAction.slice(prefix.length);
    return SHA256.test(fingerprint) ? fingerprint : null;
}

export function versionedDraftAction(baseAction: string, fingerprint: string): string {
    if (!SHA256.test(fingerprint)) throw new Error("Message draft source is unavailable");
    return `${baseAction}${SOURCE_MARKER}${fingerprint}`;
}

export function isDraftSourceOutdated(storedAction: string, baseAction: string, currentFingerprint: string | undefined): boolean {
    const storedFingerprint = draftSourceFingerprint(storedAction, baseAction);
    return !currentFingerprint || !storedFingerprint || storedFingerprint !== currentFingerprint;
}

/**
 * Hash the exact overdue input, not an aggregate or Student.updatedAt alone.
 * Elapsed days are included because they are supplied to the prompt. The marker
 * is advisory freshness evidence only; it is never an authorization decision.
 */
export function buildDraftDebtFingerprints(
    branchId: string,
    payments: readonly OverdueDebtPayment[],
    students: readonly { id: string; updatedAt: Date }[],
): Map<string, string> {
    const revisions = new Map(students.map(student => [student.id, student.updatedAt]));
    const byStudent = new Map<string, OverdueDebtPayment[]>();
    for (const payment of payments) {
        const current = byStudent.get(payment.studentId) ?? [];
        current.push(payment); byStudent.set(payment.studentId, current);
    }
    const fingerprints = new Map<string, string>();
    for (const [studentId, rows] of byStudent) {
        const revision = revisions.get(studentId);
        // Missing scoped student evidence cannot establish a current draft.
        if (!revision) continue;
        const facts = [...rows].sort((left, right) => left.paymentId < right.paymentId ? -1 : left.paymentId > right.paymentId ? 1 : 0)
            .map(payment => [payment.paymentId, payment.studentName, payment.phone, payment.dueDate.toISOString(), payment.amount, payment.daysOverdue]);
        fingerprints.set(studentId, createHash("sha256")
            .update(JSON.stringify([1, branchId, studentId, revision.toISOString(), facts])).digest("hex"));
    }
    return fingerprints;
}

/** The caller may supply its transaction for a coherent, fenced source re-read. */
export async function loadDraftDebtSource(branchId: string, asOf: Date, client: DraftDebtReader = prisma): Promise<DraftDebtSource> {
    const { payments } = await getOverduePayments(branchId, asOf, client);
    const ids = [...new Set(payments.map(payment => payment.studentId))];
    const students = ids.length ? await client.student.findMany({
        where: { branchId, id: { in: ids } }, select: { id: true, updatedAt: true },
    }) : [];
    return { payments, fingerprintsByStudentId: buildDraftDebtFingerprints(branchId, payments, students) };
}
