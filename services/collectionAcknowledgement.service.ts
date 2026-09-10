import type { Prisma } from "@/app/generated/prisma/client";

/** A voided receipt must never be acknowledged again after its fee is recollected. */
export async function collectionAcknowledgementIsCurrent(tx: Pick<Prisma.TransactionClient, "feeCollection">, event: {
    paymentId: string; branchId: string; amount: number; details: Prisma.JsonValue | null;
    payment: { ledgerBacked?: boolean; studentId: string };
}) {
    if (!event.payment.ledgerBacked) return true;
    const details = event.details;
    if (!details || typeof details !== "object" || Array.isArray(details) || typeof details.collectionId !== "string") return false;
    return Boolean(await tx.feeCollection.findFirst({ where: {
        id: details.collectionId, branchId: event.branchId, studentId: event.payment.studentId, voidedAt: null,
        allocations: { some: { paymentId: event.paymentId, amount: event.amount } },
    }, select: { id: true } }));
}
