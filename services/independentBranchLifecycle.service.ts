import type { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { projectedBillableStatuses, TERMINAL_STATUSES } from "@/lib/billingState";
import { BillingChangeInProgressError, BillingResourceNotFoundError, BillingValidationError } from "@/lib/billingErrors";
import { assertRazorpayBillingWritesEnabled } from "@/lib/billingFeature";
import { resolveRazorpayMode } from "@/lib/razorpay";
import { accountBillingHref } from "@/lib/accountNavigation";
import { EntitlementService } from "./entitlement.service";
import { reconcileBranchPremiumWork } from "./branchPremiumWork.service";
import { BILLING_PAID_EVIDENCE_INCLUDE, resolveTrustedPaidThrough } from "./billingPaidEvidence.service";
import { withOwnerBillingScope } from "./billingAgreementScope.service";
import { BillingMutationService } from "./billingMutation.service";

type Scope = { branchId: string; organizationId: string };

async function lockedAgreement(tx: Prisma.TransactionClient, scope: Scope, userId?: string) {
    // The organization lock serializes the final-billable-branch rule. Agreement
    // mutations and final message admission serialize on the second row lock.
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "Organization" WHERE id=${scope.organizationId} AND "billingModelVersion"='BRANCH_V3'
          AND (${userId ?? null}::text IS NULL OR "ownerId"=${userId ?? null}) FOR UPDATE`;
    if (!rows.length) throw new BillingResourceNotFoundError();
    await tx.$queryRaw`SELECT "branchId" FROM "BranchBillingAgreement" WHERE "branchId"=${scope.branchId}
        AND "organizationId"=${scope.organizationId} FOR UPDATE`;
    const agreement = await tx.branchBillingAgreement.findFirst({
        where: scope, include: { branch: { include: { organization: { select: { ownerId: true, ownerTrialGrant: true } } } },
            subscription: { include: BILLING_PAID_EVIDENCE_INCLUDE }, pendingSubscriptionReplacement: true },
    });
    if (!agreement) throw new BillingResourceNotFoundError();
    return agreement;
}

async function nextSequence(tx: Prisma.TransactionClient, scope: Scope) {
    const row = await tx.branchBillingAgreement.update({
        where: { branchId_organizationId: scope }, data: { billingMutationSequence: { increment: 1 } },
        select: { billingMutationSequence: true },
    });
    return row.billingMutationSequence;
}

async function assertIdle(tx: Prisma.TransactionClient, agreement: Awaited<ReturnType<typeof lockedAgreement>>) {
    const open = await tx.organizationBillingChange.findFirst({ where: {
        organizationId: agreement.organizationId, agreementBranchId: agreement.branchId, resolvedAt: null,
        status: { in: ["QUEUED", "PROCESSING", "AWAITING_PAYMENT", "SCHEDULED", "FAILED"] },
    }, select: { id: true } });
    if (agreement.billingMutationLeaseToken || agreement.pendingSubscriptionReplacement || open) {
        throw new BillingChangeInProgressError(open?.id ?? null, "Resolve the current branch billing operation first.");
    }
}

async function assertOtherBillableBranch(tx: Prisma.TransactionClient, scope: Scope) {
    const count = await tx.branch.count({ where: { organizationId: scope.organizationId,
        id: { not: scope.branchId }, billingStatus: { in: projectedBillableStatuses } } });
    if (!count) throw new BillingValidationError("The final billable branch cannot be removed");
}

function cancellationKey(removalKey: string) { return `branch-removal-cancellation:${removalKey}`; }

function activeTrialEnd(agreement: Awaited<ReturnType<typeof lockedAgreement>>, now: Date) {
    const { ownerId, ownerTrialGrant: trial } = agreement.branch.organization;
    return trial?.organizationId === agreement.organizationId && trial.ownerId === ownerId
        && trial.status === "ACTIVE" && trial.trialEndsAt && trial.trialEndsAt > now ? trial.trialEndsAt : null;
}

export class IndependentBranchLifecycle {
    static async schedule(userId: string, scope: Scope, idempotencyKey: string) {
        const removal = await prisma.$transaction(async tx => {
            const agreement = await lockedAgreement(tx, scope, userId);
            const base = { ...scope, agreementBranchId: scope.branchId, createdByUserId: userId };
            const replay = await tx.organizationBillingChange.findUnique({ where: { idempotencyKey } });
            if (replay) {
                if (replay.agreementBranchId !== scope.branchId || replay.organizationId !== scope.organizationId || replay.type !== "BRANCH_REMOVAL") throw new BillingValidationError("Request key already used.");
                return { branch: agreement.branch, change: replay, action: "PROCESSING" as const };
            }
            if (agreement.branch.billingStatus !== "ACTIVE") throw new BillingValidationError("Only an active branch can be removed");
            await assertOtherBillableBranch(tx, scope);
            await assertIdle(tx, agreement);
            const before = await EntitlementService.getBranchProfile(scope.branchId, tx);
            const now = new Date();
            const source = agreement.subscription;
            if (source && source.providerMode !== resolveRazorpayMode()) throw new BillingValidationError("Provider mode mismatch");
            const paid = resolveTrustedPaidThrough(source, now);
            const trialEnd = activeTrialEnd(agreement, now);
            const cancellationBoundary = paid ?? source?.currentEnd ?? trialEnd;
            const effectiveAt = new Date(Math.max(now.getTime(), cancellationBoundary?.getTime() ?? 0,
                trialEnd?.getTime() ?? 0, before.legacyCoverageEndsAt?.getTime() ?? 0));
            const needsCancellation = source && !TERMINAL_STATUSES.has(source.status);
            const undoCutoffAt = needsCancellation && cancellationBoundary
                ? new Date(cancellationBoundary.getTime() - 86400000) : effectiveAt;
            if (needsCancellation) {
                assertRazorpayBillingWritesEnabled();
                if (!cancellationBoundary) throw new BillingValidationError("Reconcile this mandate before scheduling removal.");
                await tx.organizationBillingChange.create({ data: {
                    ...base, organizationSubscriptionId: source.id,
                    sequence: await nextSequence(tx, scope), idempotencyKey: cancellationKey(idempotencyKey),
                    type: "CANCELLATION", status: "QUEUED", operationStatus: "SCHEDULED", effectiveAt: cancellationBoundary,
                    undoCutoffAt,
                } });
            }
            const change = await tx.organizationBillingChange.create({ data: {
                ...base, idempotencyKey, sequence: await nextSequence(tx, scope), type: "BRANCH_REMOVAL",
                organizationSubscriptionId: needsCancellation ? source.id : null,
                status: "SCHEDULED", operationStatus: "SCHEDULED", effectiveAt,
                undoCutoffAt,
            } });
            const branch = await tx.branch.update({ where: { id: scope.branchId }, data: { billingStatus: "REMOVAL_SCHEDULED" } });
            await reconcileBranchPremiumWork(tx, scope.organizationId, scope.branchId, before);
            return { branch, change, action: "PROCESSING" as const };
        });
        if (removal.change.organizationSubscriptionId && removal.change.status === "SCHEDULED"
            && removal.change.undoCutoffAt && removal.change.undoCutoffAt <= new Date()) {
            const cancellation = await prisma.organizationBillingChange.findFirst({ where: {
                ...scope, agreementBranchId: scope.branchId, type: "CANCELLATION", status: "QUEUED",
                organizationSubscriptionId: removal.change.organizationSubscriptionId,
                sequence: removal.change.sequence - 1, idempotencyKey: cancellationKey(idempotencyKey),
            }, select: { id: true } });
            if (cancellation) await withOwnerBillingScope(userId, scope.organizationId, scope.branchId,
                () => BillingMutationService.processNext(scope.organizationId));
        }
        return removal;
    }

    static async undo(userId: string, scope: Scope, expectedChangeId?: string) {
        return prisma.$transaction(async tx => {
            const agreement = await lockedAgreement(tx, scope, userId);
            const change = await tx.organizationBillingChange.findFirst({ where: {
                ...scope, agreementBranchId: scope.branchId, id: expectedChangeId, type: "BRANCH_REMOVAL", status: "SCHEDULED",
            } });
            if (!change || agreement.branch.billingStatus !== "REMOVAL_SCHEDULED") throw new BillingResourceNotFoundError();
            const now = new Date();
            const cancellation = change.organizationSubscriptionId ? await tx.organizationBillingChange.findFirstOrThrow({ where: {
                ...scope, agreementBranchId: scope.branchId, type: "CANCELLATION", organizationSubscriptionId: change.organizationSubscriptionId,
                sequence: change.sequence - 1, idempotencyKey: cancellationKey(change.idempotencyKey),
            } }) : null;
            if (!change.undoCutoffAt || now >= change.undoCutoffAt || agreement.billingMutationLeaseToken
                || (cancellation && (cancellation.status !== "QUEUED" || cancellation.providerMutationAdmittedAt))) {
                throw new BillingChangeInProgressError(change.id, "The cancellation can no longer be undone.");
            }
            const before = await EntitlementService.getBranchProfile(scope.branchId, tx);
            await tx.organizationBillingChange.updateMany({ where: { ...scope, agreementBranchId: scope.branchId,
                id: { in: cancellation ? [change.id, cancellation.id] : [change.id] } },
                data: { status: "UNDONE", operationStatus: "ABANDONED", resolvedAt: now, undoneAt: now } });
            await tx.branch.update({ where: { id: scope.branchId }, data: { billingStatus: "ACTIVE" } });
            await reconcileBranchPremiumWork(tx, scope.organizationId, scope.branchId, before);
            return { undone: true };
        });
    }

    static async archive(scope: Scope, changeId: string, now: Date) {
        return prisma.$transaction(async tx => {
            const agreement = await lockedAgreement(tx, scope);
            const change = await tx.organizationBillingChange.findFirst({ where: {
                ...scope, agreementBranchId: scope.branchId, id: changeId, type: "BRANCH_REMOVAL",
                status: "SCHEDULED", effectiveAt: { lte: now },
            } });
            if (!change || agreement.branch.billingStatus !== "REMOVAL_SCHEDULED") return false;
            await assertOtherBillableBranch(tx, scope);
            const source = agreement.subscription;
            const cancellation = change.organizationSubscriptionId ? await tx.organizationBillingChange.findFirstOrThrow({
                where: { ...scope, agreementBranchId: scope.branchId, type: "CANCELLATION", organizationSubscriptionId: change.organizationSubscriptionId,
                    sequence: change.sequence - 1, idempotencyKey: cancellationKey(change.idempotencyKey) },
                include: { providerActions: { select: { status: true } } },
            }) : null;
            if (agreement.pendingSubscriptionReplacement || agreement.billingMutationLeaseToken) return false;
            if (source && (source.providerMode !== resolveRazorpayMode() || !TERMINAL_STATUSES.has(source.status) || !source.lastReconciledAt)) return false;
            if (cancellation && (cancellation.organizationSubscriptionId !== source?.id || cancellation.agreementBranchId !== scope.branchId
                || !source?.lastReconciledAt || source.lastReconciledAt < change.createdAt)) return false;
            if (cancellation && !cancellation.resolvedAt) {
                // The source can retire independently before local dispatch. A known
                // terminal source closes the local schedule, but cannot resolve a
                // missing or uncertain outbound action on its own.
                const actions = cancellation.providerActions;
                if ((cancellation.providerMutationAdmittedAt && !actions.length)
                    || actions.some(action => action.status !== "CONFIRMED" && action.status !== "REJECTED")) return false;
                const submitted = actions.some(action => action.status === "CONFIRMED");
                await tx.organizationBillingChange.update({ where: { id: cancellation.id }, data: submitted
                    ? { status: "APPLIED", operationStatus: "APPLIED", providerConfirmedAt: source!.lastReconciledAt, appliedAt: now, resolvedAt: now }
                    : { status: "SUPERSEDED", operationStatus: "ABANDONED", resolvedAt: now },
                });
            }
            await tx.organizationBillingChange.update({ where: { id: change.id }, data: { status: "APPLIED", operationStatus: "APPLIED", appliedAt: now, resolvedAt: now } });
            await tx.branch.update({ where: { id: scope.branchId }, data: { billingStatus: "ARCHIVED", billingArchivedAt: now } });
            return true;
        });
    }

    static async reactivate(userId: string, scope: Scope, idempotencyKey: string) {
        return prisma.$transaction(async tx => {
            const agreement = await lockedAgreement(tx, scope, userId);
            const processingUrl = accountBillingHref(scope.organizationId, scope.branchId);
            const replay = await tx.organizationBillingChange.findUnique({ where: { idempotencyKey } });
            if (replay) {
                if (replay.agreementBranchId !== scope.branchId || replay.organizationId !== scope.organizationId || replay.type !== "BRANCH_REACTIVATION") throw new BillingValidationError("Request key already used.");
                return { change: replay, action: "PROCESSING" as const, processingUrl };
            }
            if (agreement.branch.billingStatus !== "ARCHIVED") throw new BillingValidationError("Only an archived branch can reopen.");
            await assertIdle(tx, agreement);
            const now = new Date();
            const trialOpen = activeTrialEnd(agreement, now);
            const before = await EntitlementService.getBranchProfile(scope.branchId, tx);
            await tx.branch.update({ where: { id: scope.branchId }, data: {
                billingStatus: trialOpen ? "ACTIVE" : "PENDING_ACTIVATION", billingActivatedAt: trialOpen ? now : null,
                billingArchivedAt: null,
            } });
            const change = await tx.organizationBillingChange.create({ data: { ...scope,
                agreementBranchId: scope.branchId, type: "BRANCH_REACTIVATION", sequence: await nextSequence(tx, scope),
                idempotencyKey, status: "APPLIED", operationStatus: "APPLIED", appliedAt: now, resolvedAt: now, createdByUserId: userId,
            } });
            await reconcileBranchPremiumWork(tx, scope.organizationId, scope.branchId, before);
            return { change, action: "PROCESSING" as const, processingUrl };
        });
    }

    static async discard(userId: string, scope: Scope) {
        return prisma.$transaction(async tx => {
            const agreement = await lockedAgreement(tx, scope, userId);
            if (agreement.branch.billingStatus !== "PENDING_ACTIVATION") throw new BillingValidationError("Branch is not pending activation");
            await assertOtherBillableBranch(tx, scope);
            await assertIdle(tx, agreement);
            if (agreement.subscription && !TERMINAL_STATUSES.has(agreement.subscription.status)) {
                throw new BillingValidationError("Resolve the existing mandate in Billing before discarding this branch.");
            }
            await tx.branch.update({ where: { id: scope.branchId }, data: { billingStatus: "ARCHIVED", billingArchivedAt: new Date() } });
            return { archived: true };
        });
    }
}
