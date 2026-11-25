import { reportBranchScopeMatches, WhatsAppOrganizationReportMetricsSchema } from "@/lib/whatsappReportMetrics";
import { Prisma } from "@/app/generated/prisma/client";
import { EntitlementService, type OrganizationEntitlementProfile } from "@/services/entitlement.service";
import { WhatsAppServiceNoticeService } from "@/services/whatsappServiceNotice.service";

type Transaction = Prisma.TransactionClient;

function canSend(profile: OrganizationEntitlementProfile) {
  return profile.canWrite && profile.entitlements.includes("WHATSAPP_AUTOMATION");
}

/** Billing mutations take this same agreement lock before changing access.
 * Organization reports take every participating agreement lock in ID order. */
export async function lockBranchBillingForSend(tx: Transaction, organizationId: string, branchId: string | null) {
  if (branchId === null) {
    // Branch creation and conversion lock the tenant before changing the
    // covered set. A row lock on existing agreements alone misses an insertion.
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Organization" WHERE "id" = ${organizationId} FOR SHARE`);
  }
  return tx.$queryRaw<{branchId: string; whatsAppEligibleSince: Date | null}[]>(Prisma.sql`
    SELECT "branchId", "whatsAppEligibleSince" FROM "BranchBillingAgreement"
    WHERE "organizationId" = ${organizationId}
      ${branchId === null ? Prisma.empty : Prisma.sql`AND "branchId" = ${branchId}`}
    ORDER BY "branchId" FOR UPDATE
  `);
}

async function suppressUnsubmitted(tx: Transaction, organizationId: string, scope: Prisma.Sql) {
  const messages = await tx.$queryRaw<{serviceNoticeId: string | null}[]>(Prisma.sql`
    UPDATE "WhatsAppMessage"
    SET "status" = 'SUPPRESSED', "suppressedAt" = clock_timestamp(),
        "failureCode" = 'BRANCH_ELIGIBILITY_CHANGED',
        "budgetState" = CASE WHEN "budgetState" = 'RESERVED' THEN 'RELEASED'::"WhatsAppBudgetState" ELSE "budgetState" END,
        "leaseToken" = NULL, "leaseUntil" = NULL, "updatedAt" = clock_timestamp()
    WHERE "organizationId" = ${organizationId} AND (${scope})
      AND "status" IN ('SCHEDULED', 'CLAIMED', 'SUBMITTING')
      AND "providerCallAdmittedAt" IS NULL AND "providerMessageId" IS NULL AND "acceptedAt" IS NULL
    RETURNING "serviceNoticeId"
  `);
  for (const id of new Set(messages.map(row => row.serviceNoticeId))) {
    if (id) await WhatsAppServiceNoticeService.reconcileStatusInTransaction({ tx, noticeId: id });
  }
  return messages.length;
}

/** Called under the agreement lock in the same transaction as the evidence or
 * lifecycle change. Work admitted before this boundary retains its real outcome. */
export async function reconcileBranchPremiumWork(
  tx: Transaction, organizationId: string, branchId: string,
  before: Awaited<ReturnType<typeof EntitlementService.getBranchProfile>>
) {
  const after = await EntitlementService.getBranchProfile(branchId, tx);
  if (!before.independent || !after.independent || before.branchId !== branchId
    || after.organizationId !== organizationId || before.organizationId !== organizationId) {
    throw new Error("Branch agreement not found");
  }
  const changed = canSend(before) !== canSend(after);
  if (!changed && canSend(after)) return;
  if (changed) {
    await tx.$executeRaw(Prisma.sql`
      UPDATE "BranchBillingAgreement" SET "whatsAppEligibleSince" = clock_timestamp()
      WHERE "organizationId" = ${organizationId} AND "branchId" = ${branchId}
    `);
  }
  await suppressUnsubmitted(tx, organizationId, Prisma.sql`
    "branchId" = ${branchId}
    ${changed ? Prisma.sql`OR ("branchId" IS NULL AND "purpose" = 'DAILY_ORGANIZATION_REPORT')` : Prisma.empty}
  `);
}

/** The prepared message's receiver scope is read from the persisted row.
 * A stale claim never gains authority by presenting another branch ID. */
export async function checkFinalBranchSendScope(tx: Transaction, input: {
  messageId: string; branchId: string | null; organizationId: string; leaseToken: string;
}) {
  const locks = await lockBranchBillingForSend(tx, input.organizationId, input.branchId);
  const message = await tx.whatsAppMessage.findFirst({
    where: {id: input.messageId, organizationId: input.organizationId, branchId: input.branchId,
      status: "SUBMITTING", leaseToken: input.leaseToken, providerCallAdmittedAt: null, providerMessageId: null},
    select: {createdAt: true, organization: {select: {billingModelVersion: true}},
      dailyReportSnapshot: {select: {metrics: true, scheduledCutoffAt: true}}},
  });
  if (!message) return "STALE";
  if (message.organization.billingModelVersion !== "BRANCH_V3") return "READY";
  const sourceTime = message.dailyReportSnapshot?.scheduledCutoffAt ?? message.createdAt;
  let eligible = locks.length > 0 && !locks.some(row =>
    row.whatsAppEligibleSince && row.whatsAppEligibleSince >= sourceTime);
  if (eligible && input.branchId) {
    const profile = await EntitlementService.getBranchProfile(input.branchId, tx);
    eligible = profile.organizationId === input.organizationId && canSend(profile);
  } else if (eligible) {
    const scope = await EntitlementService.getEligibleBranchScope(input.organizationId, "WHATSAPP_AUTOMATION", tx);
    const parsed = WhatsAppOrganizationReportMetricsSchema.safeParse(message.dailyReportSnapshot?.metrics);
    eligible = scope.included.length > 0 && parsed.success && reportBranchScopeMatches(parsed.data, scope);
  }
  if (eligible) return "READY";
  await suppressUnsubmitted(tx, input.organizationId, Prisma.sql`"id" = ${input.messageId} AND "leaseToken" = ${input.leaseToken}`);
  return "SUPPRESSED";
}
