import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/app/generated/prisma/client";

type Kind = "REPORT" | "DRAFTS";
const LEASE_MS = 5 * 60_000;

export async function claimGeneration(branchId: string, kind: Kind, cooldownMs: number,
  now = new Date(), expectedReportStart?: Date | null) {
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "Branch" WHERE "id" = ${branchId} FOR UPDATE`;
    const branch = await tx.branch.findUniqueOrThrow({ where: { id: branchId } });
    if (kind === "REPORT" && branch.aiLastCalledAt?.getTime() !== expectedReportStart?.getTime()) return null;
    const previous = await tx.branchGenerationLease.findUnique({ where: { branchId_kind: { branchId, kind } } });
    if (previous && ((previous.token && previous.leaseUntil && previous.leaseUntil > now)
      || previous.lastStartedAt.getTime() + cooldownMs > now.getTime())) return null;
    const token = randomUUID();
    await tx.branchGenerationLease.upsert({ where: { branchId_kind: { branchId, kind } },
      create: { branchId, kind, token, lastStartedAt: now, leaseUntil: new Date(now.getTime() + LEASE_MS) },
      update: { token, lastStartedAt: now, leaseUntil: new Date(now.getTime() + LEASE_MS) } });
    if (kind === "REPORT") await tx.branch.update({ where: { id: branchId }, data: { aiStatus: "RUNNING", aiLastCalledAt: now } });
    return token;
  });
}

export async function publishGeneration<T>(branchId: string, kind: Kind, token: string,
  publish: (tx: Prisma.TransactionClient) => Promise<T>) {
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "Branch" WHERE "id" = ${branchId} FOR UPDATE`;
    const lease = await tx.branchGenerationLease.findUnique({ where: { branchId_kind: { branchId, kind } } });
    if (lease?.token !== token || !lease.leaseUntil || lease.leaseUntil <= new Date()) {
      throw new Error("AI generation ownership expired or changed");
    }
    const result = await publish(tx);
    await tx.branchGenerationLease.update({ where: { id: lease.id }, data: { token: null, leaseUntil: null } });
    if (kind === "REPORT") await tx.branch.update({ where: { id: branchId }, data: { aiStatus: "IDLE" } });
    return result;
  });
}

export class DraftSourceChangedError extends Error {
  constructor() {
    super("The overdue source changed. Refresh the drafts before generating again.");
    this.name = "DraftSourceChangedError";
  }
}

export class DraftPublicationBusyError extends Error {
  constructor() {
    super("The overdue source is being updated. Refresh and try again.");
    this.name = "DraftPublicationBusyError";
  }
}

function isLockUnavailable(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; meta?: {
    code?: unknown; driverAdapterError?: { cause?: { originalCode?: unknown } };
  }; cause?: { code?: unknown } };
  return candidate.code === "55P03" || candidate.meta?.code === "55P03"
    || candidate.meta?.driverAdapterError?.cause?.originalCode === "55P03"
    || candidate.cause?.code === "55P03";
}

/**
 * DRAFTS-only source fence. Fee writers lock the Student before their fee and
 * Branch writes, while inserts referencing the Student take an FK key-share
 * lock. NOWAIT avoids waiting in the reverse direction behind an existing
 * writer. The source is checked again immediately before commit so a date
 * boundary cannot silently validate an earlier overdue snapshot.
 */
export async function publishDraftGeneration<T>(
  branchId: string,
  token: string,
  studentIds: string[],
  assertCurrentSource: (tx: Prisma.TransactionClient, now: Date) => Promise<void>,
  publish: (tx: Prisma.TransactionClient) => Promise<T>,
) {
  const ids = [...new Set(studentIds)].sort();
  if (ids.length === 0) throw new DraftSourceChangedError();
  try {
    return await prisma.$transaction(async tx => {
      const lockedStudents = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "Student"
        WHERE "branchId" = ${branchId} AND "id" IN (${Prisma.join(ids)})
        ORDER BY "id" FOR UPDATE NOWAIT
      `;
      if (lockedStudents.length !== ids.length) throw new DraftSourceChangedError();

      const lockedBranch = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "Branch" WHERE "id" = ${branchId} FOR UPDATE NOWAIT
      `;
      if (lockedBranch.length !== 1) throw new DraftSourceChangedError();
      const branch = await tx.branch.findUnique({
        where: { id: branchId },
        select: { aiEnabled: true, billingStatus: true },
      });
      if (!branch?.aiEnabled || branch.billingStatus !== "ACTIVE") throw new DraftSourceChangedError();

      const lease = await tx.branchGenerationLease.findUnique({
        where: { branchId_kind: { branchId, kind: "DRAFTS" } },
      });
      if (lease?.token !== token || !lease.leaseUntil || lease.leaseUntil <= new Date()) {
        throw new DraftSourceChangedError();
      }

      await assertCurrentSource(tx, new Date());
      const result = await publish(tx);
      await assertCurrentSource(tx, new Date());
      await tx.branchGenerationLease.update({
        where: { id: lease.id },
        data: { token: null, leaseUntil: null },
      });
      return result;
    });
  } catch (error) {
    if (isLockUnavailable(error)) throw new DraftPublicationBusyError();
    throw error;
  }
}

export async function releaseGeneration(branchId: string, kind: Kind, token: string) {
  await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "Branch" WHERE "id" = ${branchId} FOR UPDATE`;
    const released = await tx.branchGenerationLease.updateMany({ where: { branchId, kind, token },
      data: { token: null, leaseUntil: null } });
    if (released.count && kind === "REPORT") await tx.branch.update({ where: { id: branchId }, data: { aiStatus: "IDLE" } });
  });
}
