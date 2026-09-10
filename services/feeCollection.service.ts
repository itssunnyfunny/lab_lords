import { createHash, randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/app/generated/prisma/client";
import { AccessPolicy } from "@/services/accessPolicy.service";
import { collectionInputSchema, type CollectionInput, type FeeReceiptSnapshot } from "@/lib/feeCollections";
import { allocateCollection, remainingFee } from "@/lib/feeBalance";
import { MESSAGE_DRAFT_ACTION_PREFIX } from "@/lib/messageDrafts";
import { recordPaymentResolutionEvent } from "@/services/paymentResolutionEvent.service";
import { WhatsAppPaymentReconciliationService } from "@/services/whatsappPaymentReconciliation.service";
import { isWhatsAppDeliverySchemaReady } from "@/lib/whatsappSchema";

export class CollectionInputError extends Error {}

/** All interactive fee writers take the student lock before payment/outbox locks. */
export async function lockFeeStudent(tx: Prisma.TransactionClient, studentId: string, branchId: string) {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "Student" WHERE "id" = ${studentId} AND "branchId" = ${branchId} FOR UPDATE
    `;
    if (rows.length !== 1) throw new Error("Payment not found");
}

export async function reconcileFeeBalance(tx: Prisma.TransactionClient, branchId: string, studentId: string, paymentId: string, now: Date) {
    await tx.messageDraft.deleteMany({ where: { branchId, studentId, action: { startsWith: MESSAGE_DRAFT_ACTION_PREFIX } } });
    if (await isWhatsAppDeliverySchemaReady(tx)) {
        await WhatsAppPaymentReconciliationService.reconcileResolutionInTransaction({
            tx, branchId, paymentId, now, reason: "PAYMENT_CONFIRMATION_CORRECTED",
        });
    }
}

export class FeeCollectionService {
    static async collect(actorId: string, branchId: string, input: CollectionInput) {
        const data = collectionInputSchema.parse(input);
        return prisma.$transaction(tx => this.collectInTransaction(actorId, branchId, data, tx), { timeout: 15000 });
    }

    static async collectInTransaction(actorId: string, branchId: string, input: CollectionInput, tx: Prisma.TransactionClient,
        source: "PAYMENT_ACTION" | "STUDENT_INACTIVATION" = "PAYMENT_ACTION", legacyFullAction = false) {
        const data = collectionInputSchema.parse(input);
        await AccessPolicy.authorizeCapability(actorId, branchId, "paymentsRecord", tx);
        await lockFeeStudent(tx, data.studentId, branchId);
        // Serialize the same key even if a changed request names another student.
        await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${`${branchId}:${data.idempotencyKey}`}, 0))`;
        const requestHash = createHash("sha256").update(JSON.stringify({ ...data, paymentIds: [...data.paymentIds].sort() })).digest("hex");
        const previous = await tx.feeCollection.findUnique({ where: { branchId_idempotencyKey: { branchId, idempotencyKey: data.idempotencyKey } } });
        if (previous) {
            if (previous.requestHash !== requestHash) throw new CollectionInputError("This retry key belongs to a different collection request");
            return previous;
        }
        const student = await tx.student.findFirst({ where: { id: data.studentId, branchId }, include: { branch: { include: { organization: true } } } });
        if (!student) throw new Error("Payment not found");
        await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Payment" WHERE "studentId" = ${student.id} AND "branchId" = ${branchId}
            AND "id" IN (${Prisma.join(data.paymentIds)}) ORDER BY "id" FOR UPDATE`);
        const payments = await tx.payment.findMany({ where: { id: { in: data.paymentIds }, studentId: student.id, branchId } });
        if (payments.length !== data.paymentIds.length) throw new Error("Payment not found");
        if (payments.some(p => p.status !== "DUE" || remainingFee(p) <= 0)) throw new CollectionInputError("A selected fee no longer has a collectible balance. Refresh the dues.");
        let allocations;
        try { allocations = allocateCollection(payments, data.amount); }
        catch (error) { throw new CollectionInputError((error as Error).message); }
        const actor = await tx.user.findUniqueOrThrow({ where: { id: actorId }, select: { name: true, id: true } });
        const now = new Date();
        const outstanding = await tx.payment.findMany({ where: { branchId, studentId: student.id, status: "DUE" } });
        const snapshot: FeeReceiptSnapshot = {
            version: 1, branchName: student.branch.name, organizationName: student.branch.organization.name,
            address: [student.branch.address, student.branch.city].filter(Boolean).join(", ") || null, contactPhone: student.branch.contactPhone,
            studentName: student.name, studentId: student.id, recordedBy: actor.name || actor.id, recordedById: actor.id,
            collectedAt: now.toISOString(), amount: data.amount, method: data.method, reference: data.reference, note: data.note,
            remainingBalance: outstanding.reduce((sum, p) => sum + remainingFee(p), 0) - data.amount,
            allocations: allocations.map(({ payment, amount, remaining }) => ({ paymentId: payment.id, type: payment.type,
                periodStart: payment.periodStart.toISOString(), periodEnd: payment.periodEnd.toISOString(), amount, remaining })),
        };
        const collection = await tx.feeCollection.create({ data: {
            branchId, studentId: student.id, actorId, amount: data.amount, method: data.method,
            reference: data.reference || null, note: data.note || null, idempotencyKey: data.idempotencyKey, requestHash,
            receiptNumber: `LL-${now.getUTCFullYear()}-${randomUUID().toUpperCase()}`, snapshot,
            collectedAt: now,
        } });
        await tx.feeCollectionAllocation.createMany({ data: allocations.map(({ payment, amount }) => ({
            collectionId: collection.id, paymentId: payment.id, studentId: student.id, branchId, amount,
        })) });
        for (const { payment, amount, remaining } of allocations) {
            const after = await tx.payment.update({ where: { id: payment.id }, data: {
                ledgerBacked: true, collectedAmount: { increment: amount },
                status: remaining === 0 ? (payment.waivedAmount > 0 ? "WAIVED" : "PAID") : "DUE",
                ...(remaining === 0 ? { paidAt: now, paymentMethod: data.method, referenceId: data.reference || null } : {}),
            } });
            await tx.auditLog.create({ data: { branchId, userId: actorId, paymentId: payment.id, action: legacyFullAction ? "PAYMENT_MARKED_PAID" : "FEE_COLLECTED",
                details: { collectionId: collection.id, receiptNumber: collection.receiptNumber, amount, remaining,
                    from: payment.status, to: after.status, method: data.method, referenceId: data.reference || null } } });
            if (after.status !== "DUE") await recordPaymentResolutionEvent(tx, {
                before: payment, after: { ...after, amount }, actorUserId: actorId, occurredAt: now, source,
                details: { collectionId: collection.id, actualReceived: amount },
            });
            await reconcileFeeBalance(tx, branchId, student.id, payment.id, now);
        }
        await tx.branch.update({ where: { id: branchId }, data: { lastDataChange: now } });
        return collection;
    }

    static async dues(actorId: string, branchId: string, studentId: string) {
        await AccessPolicy.authorizeAction(actorId, branchId, "view_payments");
        const student = await prisma.student.findFirst({ where: { id: studentId, branchId }, select: { id: true, name: true } });
        if (!student) throw new Error("Payment not found");
        const payments = await prisma.payment.findMany({ where: { branchId, studentId, status: "DUE" }, orderBy: [{ dueDate: "asc" }, { id: "asc" }] });
        return { student, payments: payments.filter(p => remainingFee(p) > 0) };
    }

    static async get(actorId: string, branchId: string, collectionId: string) {
        await AccessPolicy.authorizeAction(actorId, branchId, "view_payments");
        const collection = await prisma.feeCollection.findFirst({ where: { id: collectionId, branchId } });
        if (!collection) throw new Error("Payment not found");
        return collection;
    }

    static async list(actorId: string, branchId: string, query: { studentId?: string; search?: string; month?: string; cursor?: string }) {
        await AccessPolicy.authorizeAction(actorId, branchId, "view_payments");
        let after: { collectedAt: string; id: string } | undefined;
        try { if (query.cursor) { after = JSON.parse(Buffer.from(query.cursor, "base64url").toString()); if (!after?.id || !Number.isFinite(Date.parse(after.collectedAt))) throw new Error(); } }
        catch { throw new CollectionInputError("Invalid history cursor"); }
        if (query.month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(query.month)) throw new CollectionInputError("Invalid history month");
        const start = query.month ? new Date(`${query.month}-01T00:00:00+05:30`) : undefined;
        const parts = query.month?.split("-").map(Number);
        const end = parts ? new Date(Date.UTC(parts[0], parts[1], 1) - 330 * 60000) : undefined;
        const where: Prisma.FeeCollectionWhereInput = { branchId, ...(query.studentId ? { studentId: query.studentId } : {}),
            ...(start ? { collectedAt: { gte: start, lt: end } } : {}),
            ...(query.search ? { OR: [{ student: { name: { contains: query.search.slice(0, 100), mode: "insensitive" } } },
                { receiptNumber: { contains: query.search.slice(0, 100), mode: "insensitive" } }, { reference: { contains: query.search.slice(0, 100), mode: "insensitive" } }] } : {}),
        };
        const [rows, total] = await Promise.all([
            prisma.feeCollection.findMany({ where: after ? { AND: [where, { OR: [
                { collectedAt: { lt: new Date(after.collectedAt) } }, { collectedAt: new Date(after.collectedAt), id: { lt: after.id } },
            ] }] } : where, orderBy: [{ collectedAt: "desc" }, { id: "desc" }], take: 51 }),
            prisma.feeCollection.count({ where }),
        ]);
        const items = rows.slice(0, 50), last = items.at(-1);
        return { items, total, nextCursor: rows.length > 50 && last ? Buffer.from(JSON.stringify({ collectedAt: last.collectedAt, id: last.id })).toString("base64url") : null };
    }

    static async void(actorId: string, branchId: string, id: string, reason: string) {
        if (typeof reason !== "string" || !reason.trim() || reason.trim().length > 1000) throw new CollectionInputError("Enter a correction reason (1–1000 characters)");
        return prisma.$transaction(async tx => {
            const access = await AccessPolicy.authorizeCapability(actorId, branchId, "paymentsRecord", tx);
            if (!access.isOwner) throw new Error("Unauthorized: Only the owner can void a collection");
            const initial = await tx.feeCollection.findFirst({ where: { id, branchId } });
            if (!initial) throw new Error("Payment not found");
            await lockFeeStudent(tx, initial.studentId, branchId);
            const collection = await tx.feeCollection.findFirstOrThrow({ where: { id, branchId }, include: { allocations: { include: { payment: true } } } });
            if (collection.voidedAt) return collection;
            const now = new Date();
            for (const allocation of collection.allocations) {
                const p = allocation.payment;
                const collectedAmount = p.collectedAmount - allocation.amount;
                const remaining = p.amount - collectedAmount - p.waivedAmount;
                await tx.payment.update({ where: { id: p.id }, data: { collectedAmount,
                    status: remaining > 0 ? "DUE" : p.waivedAmount > 0 ? "WAIVED" : "PAID",
                    ...(remaining > 0 ? { paidAt: null, paymentMethod: null, referenceId: null } : {}),
                } });
                await tx.auditLog.create({ data: { branchId, userId: actorId, paymentId: p.id, action: "FEE_COLLECTION_VOIDED",
                    details: { collectionId: id, amount: allocation.amount, reason: reason.trim(), remaining,
                        from: p.status, to: remaining > 0 ? "DUE" : p.waivedAmount > 0 ? "WAIVED" : "PAID" } } });
                await reconcileFeeBalance(tx, branchId, collection.studentId, p.id, now);
            }
            await tx.branch.update({ where: { id: branchId }, data: { lastDataChange: now } });
            return tx.feeCollection.update({ where: { id }, data: { voidedAt: now, voidedById: actorId, voidReason: reason.trim() } });
        }, { timeout: 15000 });
    }
}
