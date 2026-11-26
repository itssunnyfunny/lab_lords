import { billingRecordScope, lockBillingCoordinator, billingCoordinator, withSystemBillingScope } from "@/services/billingAgreementScope.service";
import type { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  BillingMutationService,
} from "@/services/billingMutation.service";
import { recordBillingMutationAudit } from "@/services/billingMutationAudit.service";
import { BillingReconciliationService } from "@/services/billingReconciliation.service";
import { suppressExpiredBranchWork } from "@/services/branchPremiumWork.service";
import { BranchService } from "@/services/branch.service";
import { OwnerTrialService } from "@/services/ownerTrial.service";
import { areRazorpayBillingWritesEnabled } from "@/lib/billingFeature";
import { isPaymentRecoveryAuthorization, TERMINAL_STATUSES } from "@/lib/billingState";
import { isSupportedProviderPaymentMethod } from "@/services/billingPaymentMethod.service";
import {
  BillingReplacementService,
  isCandidateCancellationReconciliationCode,
} from "@/services/billingReplacement.service";
import {
  BillingService,
  cancelLapsedInitialAuthorization,
  isInitialAuthorizationDue,
} from "@/services/billing.service";

const RECONCILE_AFTER_MS = 6 * 60 * 60 * 1000;
const MAX_AUTOMATIC_ATTEMPTS = 3;
export const REPLACEMENT_DEADLINE_PAGE_SIZE = 100;

const OPEN_REPLACEMENT_STATUSES = ["AWAITING_PAYMENT", "SCHEDULED"] as const;
const TERMINAL_REPLACEMENT_STATUSES = ["FAILED", "UNDONE", "SUPERSEDED"] as const;

// A lost create response can precede the local subscription binding. Only
// reconcile the original durable dispatch. A fresh create needs owner intent.
const unboundProvisioning: Prisma.OrganizationBillingChangeWhereInput = {
  status: "FAILED", resolvedAt: null, failureCategory: "MANUAL_REVIEW_REQUIRED",
  OR: [
    { type: "SUBSCRIPTION_AUTHORIZATION", provisioningIntentVersion: 1, organizationSubscriptionId: null },
    { provisioningIntentVersion: 2, replacementSubscriptionId: null },
  ],
  providerActions: { some: { purpose: "CREATE" } },
};

export function isReplacementMandateConfirmed(change: {
  operationStatus: string;
  providerConfirmedAt: Date | null;
}) {
  return change.providerConfirmedAt != null
    && ["SCHEDULED", "APPLIED"].includes(change.operationStatus);
}

export async function recoverExpiredBillingMutationLease(
  organization: { id: string; billingMutationLeaseToken: string | null },
  now: Date
) {
  return prisma.$transaction(async tx => {
    await lockBillingCoordinator(tx, organization.id);
    const current = await billingCoordinator(tx).findUnique({
      where: { id: organization.id },
      select: { billingMutationLeaseToken: true, billingMutationLeaseUntil: true },
    });
    if (!current
      || current.billingMutationLeaseToken !== organization.billingMutationLeaseToken
      || !current.billingMutationLeaseUntil
      || current.billingMutationLeaseUntil > now) {
      return false;
    }

    const processing = await tx.organizationBillingChange.findFirst({
      where: { ...billingRecordScope(), organizationId: organization.id, status: "PROCESSING" },
      orderBy: { sequence: "asc" },
      select: {
        id: true,
        organizationSubscriptionId: true,
        attemptCount: true,
        processingStartedAt: true,
        failureCode: true,
        operationStatus: true,
      },
    });
    if (processing) {
      const scheduledUndo = processing.failureCode === "SCHEDULED_UNDO_PROCESSING"
        || processing.failureCode === "SCHEDULED_UNDO_RETRY_PROCESSING";
      const candidateCancellation = processing.failureCode === "CANDIDATE_CANCELLATION_PROCESSING";
      const replacementUndoCancellation = processing.failureCode
        ?.startsWith("REPLACEMENT_UNDO_CANCELLATION_PROCESSING_") === true;
      const failureCode = scheduledUndo
        ? "SCHEDULED_UNDO_LEASE_EXPIRED"
        : candidateCancellation
          ? "CANDIDATE_CANCELLATION_LEASE_EXPIRED"
          : replacementUndoCancellation
            ? processing.failureCode!.replace("_PROCESSING_", "_LEASE_EXPIRED_")
            : processing.failureCode === "SOURCE_CANCELLATION_PROCESSING"
              ? "SOURCE_CANCELLATION_LEASE_EXPIRED"
              : "PROVIDER_MUTATION_LEASE_EXPIRED";
      const quarantined = await tx.organizationBillingChange.updateMany({
        where: {
          ...billingRecordScope(),
          id: processing.id,
          status: "PROCESSING",
          attemptCount: processing.attemptCount,
          processingStartedAt: processing.processingStartedAt,
        },
        data: {
          status: "FAILED",
          operationStatus: candidateCancellation || replacementUndoCancellation
            ? processing.operationStatus
            : "FAILED",
          failedAt: now,
          resolvedAt: null,
          failureCategory: "MANUAL_REVIEW_REQUIRED",
          failureCode,
          lastError: scheduledUndo
            ? "Scheduled-change undo lease expired with an unresolved provider outcome"
            : candidateCancellation || replacementUndoCancellation
              ? "Replacement candidate cancellation lease expired with an unresolved provider outcome"
              : "Provider mutation lease expired with an unresolved outcome",
        },
      });
      if (quarantined.count === 1) {
        await recordBillingMutationAudit(tx, {
          changeId: processing.id,
          organizationId: organization.id,
          organizationSubscriptionId: processing.organizationSubscriptionId,
          attemptCount: processing.attemptCount,
          outcome: "MANUAL_REVIEW_REQUIRED",
          failureCode,
        });
      }
    }
    const released = await billingCoordinator(tx).updateMany({
      where: {
        id: organization.id,
        billingMutationLeaseToken: organization.billingMutationLeaseToken,
        billingMutationLeaseUntil: { lte: now },
      },
      data: { billingMutationLeaseToken: null, billingMutationLeaseUntil: null },
    });
    return released.count === 1;
  });
}

export class BillingDeadlineService {
  static async run(now = new Date()) {
    const expiredTrials = await OwnerTrialService.expireDueTrials(now);
    const total = {
      expiredTrials: expiredTrials.count, recoveredLeases: 0, retriedMutations: 0,
      submittedCancellations: 0, archivedBranches: 0, confirmedCheckouts: 0,
      timedOutCheckouts: 0, lapsedAuthorizations: 0, reconciledSubscriptions: 0,
      reconciledReplacements: 0, promotedReplacements: 0, retriedReplacementCancellations: 0,
      errors: [] as Array<{ organizationId: string; branchId?: string; message: string }>,
    };
    const unsubmitted: Prisma.WhatsAppMessageWhereInput = {
      status: { in: ["SCHEDULED", "CLAIMED", "SUBMITTING"] },
      providerCallAdmittedAt: null, providerMessageId: null, acceptedAt: null,
    };
    let cursor: string | undefined;
    for (;;) {
      const agreements = await prisma.branchBillingAgreement.findMany({
        where: { branch: { organization: { billingModelVersion: "BRANCH_V3" } },
          OR: [
            { branch: { whatsAppMessages: { some: unsubmitted } } },
            { pendingSubscriptionReplacement: { isNot: null } },
            { billingMutationLeaseUntil: { lte: now } },
            { changes: { some: { OR: [
              unboundProvisioning,
              { type: "SUBSCRIPTION_AUTHORIZATION", operationStatus: { in: ["CHECKOUT_OPEN", "VERIFYING", "AWAITING_PROVIDER_CONFIRMATION"] }, confirmationDeadlineAt: { lte: now } },
              { type: "CANCELLATION", status: "QUEUED", undoCutoffAt: { lte: now } },
              { type: "BRANCH_REMOVAL", status: "SCHEDULED", effectiveAt: { lte: now } },
              { status: "FAILED", failureCategory: { in: ["PROVIDER_REJECTED", "PRE_PROVIDER_FAILURE"] }, attemptCount: { lt: MAX_AUTOMATIC_ATTEMPTS } },
            ] } } },
            { subscription: { is: { OR: [
              { paidThrough: null, status: { in: ["CREATED", "AUTHENTICATED", "ACTIVE"] }, OR: [
                { authorizationExpiresAt: { lte: now } }, { providerStartAt: { lte: now } },
              ] },
              { status: { in: ["ACTIVE", "PENDING", "HALTED", "PAUSED", "CANCELLED", "COMPLETED"] }, OR: [
                { lastReconciledAt: null }, { lastReconciledAt: { lt: new Date(now.getTime() - RECONCILE_AFTER_MS) } },
              ] },
            ] } } },
          ] },
        select: { organizationId: true, branchId: true, billingMutationLeaseToken: true, billingMutationLeaseUntil: true,
          branch: { select: { whatsAppMessages: { where: unsubmitted, take: 1, select: { id: true } } } },
        },
        orderBy: { branchId: "asc" }, take: REPLACEMENT_DEADLINE_PAGE_SIZE,
        ...(cursor ? { cursor: { branchId: cursor }, skip: 1 } : {}),
      });
      for (const agreement of agreements) {
        if (agreement.branch.whatsAppMessages.length) {
          try {
            await prisma.$transaction(tx => suppressExpiredBranchWork(tx, agreement.organizationId, agreement.branchId));
          } catch {
            total.errors.push({ organizationId: agreement.organizationId, branchId: agreement.branchId,
              message: "Queued branch messages need an eligibility recheck" });
          }
        }
        try {
          const result = await withSystemBillingScope(agreement, () => this.runScope(now, agreement));
          for (const key of Object.keys(result) as Array<keyof typeof result>) {
            if (key === "errors") total.errors.push(...result.errors.map(error => ({ ...error, branchId: agreement.branchId })));
            else total[key] += result[key];
          }
        } catch (error) {
          total.errors.push({ organizationId: agreement.organizationId, branchId: agreement.branchId,
            message: error instanceof Error ? error.message : "Branch billing reconciliation failed" });
        }
      }
      if (agreements.length < REPLACEMENT_DEADLINE_PAGE_SIZE) break;
      cursor = agreements[agreements.length - 1].branchId;
    }
    // Re-read retirement evidence after each agreement has had a chance to reconcile.
    const archival = await BranchService.archiveDueBillingRemovals(now);
    total.archivedBranches = archival.archived;
    total.errors.push(...(archival.errors ?? []));
    return total;
  }

  private static async runScope(now: Date, scope: {
    branchId: string; organizationId: string; billingMutationLeaseUntil: Date | null; billingMutationLeaseToken: string | null;
  }) {
    const errors: Array<{ organizationId: string; branchId?: string; message: string }> = [];
    const staleLeases = scope.billingMutationLeaseUntil && scope.billingMutationLeaseUntil <= now
      ? [{ id: scope.organizationId, billingMutationLeaseToken: scope.billingMutationLeaseToken }] : [];
    let recoveredLeases = 0;
    for (const organization of staleLeases) {
      const recovered = await recoverExpiredBillingMutationLease(organization, now);
      if (recovered) recoveredLeases += 1;
    }

    const retryableFailures = await prisma.organizationBillingChange.findMany({
      where: {
        ...billingRecordScope(),
        status: "FAILED",
        type: { notIn: ["SUBSCRIPTION_AUTHORIZATION", "UNSUPPORTED_METHOD_CANCELLATION"] },
        replacementSubscriptionId: null,
        failureCategory: { in: ["PROVIDER_REJECTED", "PRE_PROVIDER_FAILURE"] },
        attemptCount: { lt: MAX_AUTOMATIC_ATTEMPTS },
        organization: { billingModelVersion: "BRANCH_V3" },
      },
      orderBy: [{ organizationId: "asc" }, { sequence: "asc" }],
      distinct: ["organizationId"],
    });
    let retriedMutations = 0;
    for (const change of retryableFailures) {
      if (!areRazorpayBillingWritesEnabled()) {
        continue;
      }
      try {
        await BillingMutationService.retry(change.id);
        retriedMutations += 1;
      } catch (error) {
        errors.push({
          organizationId: change.organizationId,
          message: error instanceof Error ? error.message : "Mutation retry failed",
        });
      }
    }

    const dueCancellations = await prisma.organizationBillingChange.findMany({
      where: {
        ...billingRecordScope(),
        type: "CANCELLATION",
        status: "QUEUED",
        undoCutoffAt: { lte: now },
        organization: { billingModelVersion: "BRANCH_V3" },
      },
      select: { organizationId: true },
      distinct: ["organizationId"],
    });
    for (const { organizationId } of dueCancellations) {
      try {
        await BillingMutationService.processNext(organizationId, now);
      } catch (error) {
        errors.push({
          organizationId,
          message: error instanceof Error ? error.message : "Cancellation submission failed",
        });
      }
    }

    let reconciledReplacements = 0;
    let promotedReplacements = 0;
    let retriedReplacementCancellations = 0;
    const lostCreates = await prisma.organizationBillingChange.findMany({
      where: { ...billingRecordScope(), organizationId: scope.organizationId, ...unboundProvisioning },
      select: { id: true, organizationId: true, createdByUserId: true, provisioningIntentVersion: true },
    });
    for (const change of lostCreates) {
      try {
        if (change.provisioningIntentVersion === 2) {
          await BillingReplacementService.reconcileProvisioning(change.id, now);
          reconciledReplacements += 1;
        } else if (change.createdByUserId) {
          await BillingService.reconcileMutation(change.createdByUserId, change.organizationId, change.id);
        }
      } catch {
        errors.push({ organizationId: change.organizationId, message: "The original subscription creation still needs reconciliation." });
      }
    }
    let replacementCursor: string | undefined;
    while (true) {
      const replacementPage = await prisma.organizationBillingChange.findMany({
        where: {
          ...billingRecordScope(),
          replacementSubscriptionId: { not: null },
          organization: { billingModelVersion: "BRANCH_V3" },
          OR: [
            {
              status: { in: [...OPEN_REPLACEMENT_STATUSES] },
              OR: [
                { failureCategory: null },
                { failureCategory: { not: "MANUAL_REVIEW_REQUIRED" } },
              ],
            },
            {
              status: { in: [...TERMINAL_REPLACEMENT_STATUSES] },
              OR: [
                {
                  failureCode: {
                    in: [
                      "CANDIDATE_CANCELLATION_PENDING",
                      "CANDIDATE_CANCELLATION_OUTCOME_UNKNOWN",
                      "CANDIDATE_CANCELLATION_PROVIDER_REJECTED",
                      "CANDIDATE_CANCELLATION_LEASE_EXPIRED",
                    ],
                  },
                },
                { failureCode: { startsWith: "REPLACEMENT_UNDO_CANCELLATION_OUTCOME_UNKNOWN_" } },
                { failureCode: { startsWith: "REPLACEMENT_UNDO_CANCELLATION_PROVIDER_REJECTED_" } },
                { failureCode: { startsWith: "REPLACEMENT_UNDO_CANCELLATION_LEASE_EXPIRED_" } },
                  { failureCode: { in: ["SOURCE_CANCELLATION_OUTCOME_UNKNOWN", "SOURCE_CANCELLATION_LEASE_EXPIRED"] } },
              ],
              replacementSubscription: {
                is: { pendingAgreementBranchId: scope.branchId },
              },
            },
          ],
        },
        include: { organizationSubscription: true, replacementSubscription: true },
        orderBy: { id: "asc" },
        take: REPLACEMENT_DEADLINE_PAGE_SIZE,
        ...(replacementCursor ? { cursor: { id: replacementCursor }, skip: 1 } : {}),
      });
      if (replacementPage.length === 0) break;

      for (const change of replacementPage) {
        const candidate = change.replacementSubscription;
        if (!candidate) continue;
        try {
          if (TERMINAL_REPLACEMENT_STATUSES.includes(
            change.status as typeof TERMINAL_REPLACEMENT_STATUSES[number]
          )) {
            if (change.status === "FAILED" && change.failureCode?.startsWith("SOURCE_CANCELLATION_")
              && candidate.pendingAgreementBranchId === scope.branchId) {
              await BillingReplacementService.reconcileSourceCancellation(change.id, now);
              reconciledReplacements += 1;
              continue;
            }
            if (isCandidateCancellationReconciliationCode(change.failureCode)
              && candidate.pendingAgreementBranchId === scope.branchId) {
              await BillingReplacementService.reconcileCandidateCancellation(change.id, now);
              retriedReplacementCancellations += 1;
            }
            continue;
          }
          if (change.failureCategory === "MANUAL_REVIEW_REQUIRED") continue;

          const reconciliation = await BillingReconciliationService.reconcileProviderSubscription(
            candidate.razorpaySubscriptionId,
            { paymentId: change.providerPaymentId, now }
          );
          reconciledReplacements += 1;
          const providerTerminal = ["CANCELLED", "COMPLETED", "EXPIRED"]
            .includes(reconciliation.subscription.status);
          if (providerTerminal) {
            await BillingReplacementService.failReplacementCheckout(
              change.id,
              "FAILED",
              now,
              `Replacement mandate became ${reconciliation.subscription.status.toLowerCase()}`
            );
            continue;
          }

          const access = await BillingReplacementService.syncAuthorizedAccess(change.id, now);
          const refreshed = access.change;
          const mandateConfirmed = isReplacementMandateConfirmed(refreshed);
          if (refreshed.confirmationDeadlineAt
            && refreshed.confirmationDeadlineAt <= now
            && !mandateConfirmed) {
            await BillingReplacementService.failReplacementCheckout(
              change.id,
              "FAILED",
              now,
              "Replacement mandate was not confirmed before the cutover authorization deadline"
            );
            continue;
          }

          let sourceReconciled = false;
          if (mandateConfirmed
            && refreshed.undoCutoffAt
            && refreshed.undoCutoffAt <= now
            && change.organizationSubscription) {
            // scheduleSourceCancellation performs a fresh source reconciliation
            // immediately before its locked provider decision.
            await BillingReplacementService.scheduleSourceCancellation(change.id, now);
            sourceReconciled = true;
          }
          if (reconciliation.confirmedPaidPeriod
            && change.organizationSubscription
            && !sourceReconciled) {
            await BillingReconciliationService.reconcileProviderSubscription(
              change.organizationSubscription.razorpaySubscriptionId,
              { now }
            );
          }
          const promotion = await BillingReplacementService.promoteIfReady(change.id, now);
          if (promotion.promoted) promotedReplacements += 1;
        } catch (error) {
          errors.push({
            organizationId: change.organizationId,
            message: error instanceof Error ? error.message : "Replacement reconciliation failed",
          });
        }
      }

      if (replacementPage.length < REPLACEMENT_DEADLINE_PAGE_SIZE) break;
      replacementCursor = replacementPage.at(-1)!.id;
    }

    const dueBranchChanges = await prisma.organizationBillingChange.findMany({
      where: {
        ...billingRecordScope(),
        type: "BRANCH_REMOVAL",
        status: "SCHEDULED",
        effectiveAt: { lte: now },
        organizationSubscriptionId: { not: null },
      },
      select: { organizationId: true },
      distinct: ["organizationId"],
    });
    for (const { organizationId } of dueBranchChanges) {
      try {
        await BillingReconciliationService.reconcileByOrganization(organizationId, { now });
      } catch (error) {
        errors.push({
          organizationId,
          message: error instanceof Error ? error.message : "Branch reduction reconciliation failed",
        });
      }
    }


    const dueCheckoutConfirmations = await prisma.organizationBillingChange.findMany({
      where: {
        ...billingRecordScope(),
        type: "SUBSCRIPTION_AUTHORIZATION",
        operationStatus: { in: ["CHECKOUT_OPEN", "VERIFYING", "AWAITING_PROVIDER_CONFIRMATION"] },
        confirmationDeadlineAt: { lte: now },
        organization: { billingModelVersion: "BRANCH_V3" },
      },
      include: { organizationSubscription: true },
      orderBy: [{ organizationId: "asc" }, { sequence: "asc" }],
    });
    let confirmedCheckouts = 0;
    let timedOutCheckouts = 0;
    for (const change of dueCheckoutConfirmations) {
      const subscription = change.organizationSubscription;
      if (!subscription) {
        if (change.provisioningIntentVersion != null) {
          if (change.createdByUserId) {
            try {
              await BillingService.reconcileMutation(change.createdByUserId, change.organizationId, change.id);
            } catch {
              errors.push({ organizationId: change.organizationId, message: "The original branch checkout still needs reconciliation." });
            }
          }
          continue;
        }
        const failed = await prisma.organizationBillingChange.updateMany({
          where: {
            ...billingRecordScope(),
            id: change.id,
            operationStatus: { in: ["CHECKOUT_OPEN", "VERIFYING", "AWAITING_PROVIDER_CONFIRMATION"] },
          },
          data: {
            status: "FAILED",
            operationStatus: "FAILED",
            failureCategory: "SUBSCRIPTION_MISSING",
            lastError: "The provider subscription could not be found; start authorization again",
            failedAt: now,
            resolvedAt: now,
          },
        });
        timedOutCheckouts += failed.count;
        continue;
      }

      try {
        const recoveryConfirmation = isPaymentRecoveryAuthorization(change)
          || ["PENDING", "HALTED", "PAUSED"].includes(subscription.status);
        const reconciliation = await BillingReconciliationService.reconcileProviderSubscription(
          subscription.razorpaySubscriptionId,
          { paymentId: recoveryConfirmation ? null : change.providerPaymentId, commercialIntentChangeId: change.id, now }
        );
        const authorizationConfirmed = reconciliation.commercialIntentChangeId === change.id
          && ["AUTHORIZATION_ONLY", "EXACT_SETTLEMENT"].includes(reconciliation.evidenceKind)
          && isSupportedProviderPaymentMethod(reconciliation.subscription.providerPaymentMethod)
          && ["AUTHENTICATED", "ACTIVE"].includes(reconciliation.subscription.status);
        const paidPeriodAdvanced = reconciliation.confirmedPaidPeriod
          && Boolean(reconciliation.subscription.paidThrough)
          && (!subscription.paidThrough || reconciliation.subscription.paidThrough! > subscription.paidThrough);
        const providerConfirmed = authorizationConfirmed && (!recoveryConfirmation || paidPeriodAdvanced);

        if (!providerConfirmed && !TERMINAL_STATUSES.has(reconciliation.subscription.status)) {
          // The browser window can close before bank authorization or recovery settles.
          // Keep the original receipt open until evidence resolves this mandate.
          continue;
        }
        const resolved = await prisma.organizationBillingChange.updateMany({
          where: {
            ...billingRecordScope(),
            id: change.id,
            operationStatus: { in: ["CHECKOUT_OPEN", "VERIFYING", "AWAITING_PROVIDER_CONFIRMATION"] },
          },
          data: providerConfirmed
            ? {
                status: "APPLIED",
                operationStatus: "APPLIED",
                providerPaymentId: reconciliation.payment?.id ?? change.providerPaymentId,
                providerConfirmedAt: now,
                appliedAt: now,
                resolvedAt: now,
                failureCategory: null,
                failureCode: null,
                lastError: null,
              }
            : {
                status: "FAILED",
                operationStatus: "FAILED",
                failureCategory: "CONFIRMATION_TIMEOUT",
                failureCode: null,
                lastError: "This mandate ended before confirmation. Start a new checkout for this branch.",
                failedAt: now,
                resolvedAt: now,
              },
        });
        if (providerConfirmed) {
          confirmedCheckouts += resolved.count;
          if (resolved.count > 0 && reconciliation.payment?.id && !reconciliation.subscription.authPaymentId) {
            await prisma.organizationSubscription.update({
              where: { ...billingRecordScope(), id: reconciliation.subscription.id },
              data: { authPaymentId: reconciliation.payment.id },
            });
          }
        } else {
          timedOutCheckouts += resolved.count;
        }
      } catch (error) {
        // An unreadable provider outcome keeps the existing operation recoverable.
        // Another scheduled pass or an owner retry reconciles the same mandate.
        errors.push({
          organizationId: change.organizationId,
          message: error instanceof Error ? error.message : "Checkout deadline reconciliation failed",
        });
      }
    }

    const deadlineSubscriptions = await prisma.organizationSubscription.findMany({
      where: {
        ...billingRecordScope(),
        currentAgreementBranchId: scope.branchId,
        organization: { billingModelVersion: "BRANCH_V3" },
        paidThrough: null,
        status: { in: ["CREATED", "AUTHENTICATED", "ACTIVE"] },
        OR: [
          { authorizationExpiresAt: { lte: now } },
          { providerStartAt: { lte: now } },
        ],
        billingChanges: {
          none: {
            type: "SUBSCRIPTION_AUTHORIZATION",
            operationStatus: { in: ["CHECKOUT_OPEN", "VERIFYING", "AWAITING_PROVIDER_CONFIRMATION"] },
            confirmationDeadlineAt: { gt: now },
          },
        },
      },
      select: {
        id: true,
        organizationId: true,
        status: true,
        authorizationExpiresAt: true,
        providerPaymentMethod: true,
        providerStartAt: true,
      },
    });
    let lapsedAuthorizations = 0;
    for (const subscription of deadlineSubscriptions) {
      if (!isInitialAuthorizationDue(subscription, now)) continue;
      try {
        const reconciled = await BillingReconciliationService.reconcileByOrganization(
          subscription.organizationId,
          { now }
        );
        if (!reconciled.subscription.paidThrough
          && areRazorpayBillingWritesEnabled()) {
          const lapsed = await cancelLapsedInitialAuthorization(subscription.id, now, subscription);
          if (lapsed) lapsedAuthorizations += 1;
        }
      } catch (error) {
        errors.push({
          organizationId: subscription.organizationId,
          message: error instanceof Error ? error.message : "Authorization deadline reconciliation failed",
        });
      }
    }

    const staleBefore = new Date(now.getTime() - RECONCILE_AFTER_MS);
    const staleSubscriptions = await prisma.organizationSubscription.findMany({
      where: {
        ...billingRecordScope(),
        currentAgreementBranchId: scope.branchId,
        organization: { billingModelVersion: "BRANCH_V3" },
        status: { in: ["ACTIVE", "PENDING", "HALTED", "PAUSED", "CANCELLED", "COMPLETED"] },
        OR: [{ lastReconciledAt: null }, { lastReconciledAt: { lt: staleBefore } }],
        id: { notIn: deadlineSubscriptions.map(subscription => subscription.id) },
      },
      select: { organizationId: true },
      take: 100,
    });
    let reconciledSubscriptions = 0;
    for (const subscription of staleSubscriptions) {
      try {
        await BillingReconciliationService.reconcileByOrganization(subscription.organizationId, { now });
        reconciledSubscriptions += 1;
      } catch (error) {
        errors.push({
          organizationId: subscription.organizationId,
          message: error instanceof Error ? error.message : "Scheduled reconciliation failed",
        });
      }
    }

    return {
      recoveredLeases,
      retriedMutations,
      submittedCancellations: dueCancellations.length,
      confirmedCheckouts,
      timedOutCheckouts,
      lapsedAuthorizations,
      reconciledSubscriptions,
      reconciledReplacements,
      promotedReplacements,
      retriedReplacementCancellations,
      errors,
    };
  }
}
