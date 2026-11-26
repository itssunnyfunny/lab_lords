import { AsyncLocalStorage } from "node:async_hooks";
import { prisma } from "@/lib/prisma";
import { accountBillingProcessingHref, accountBillingOperationReturn } from "@/lib/accountNavigation";
import type { Prisma, SaasPlan } from "@/app/generated/prisma/client";
import { OrganizationAccessNotFoundError } from "@/lib/organizationErrors";
import { BillingResourceNotFoundError, BillingValidationError } from "@/lib/billingErrors";
import { OrganizationService } from "@/services/organization.service";
import { isHistoricalBillingFixture } from "@/lib/billingHistoricalFixtures";

type Agreement = { organizationId: string; branchId: string };
const activeAgreement = new AsyncLocalStorage<Agreement>();
const historicalReceiptOrg = new AsyncLocalStorage<string>();

export function isRetiredAggregateReceipt(organizationId: string) {
  return historicalReceiptOrg.getStore() === organizationId;
}

export function reconcileAggregateReceipt<T>(organizationId: string, run: () => Promise<T>) {
  return historicalReceiptOrg.run(organizationId, run);
}

/** A single immutable scope follows a command through provider reads, retries
 * and finalization. Only the owner entry point and trusted receipt/job lookup
 * establish it. Every ledger query also filters the stored agreement identity.
 */
export function billingRecordScope() {
  return { agreementBranchId: activeAgreement.getStore()?.branchId ?? null };
}

export function withSystemBillingScope<T>(scope: Agreement, run: () => Promise<T>) {
  return activeAgreement.run({ branchId: scope.branchId, organizationId: scope.organizationId }, run);
}

export async function withOwnerBillingScope<T>(
  userId: string, organizationId: string, branchId: string | null, run: () => Promise<T>
) {
  await OrganizationService.getOrganizationForOwnerAccess(organizationId, userId);
  if (!branchId) throw new BillingValidationError("Select a branch to manage its subscription");
  const agreement = await prisma.branchBillingAgreement.findFirst({
    where: { branchId, organizationId, branch: { organization: { ownerId: userId, billingModelVersion: "BRANCH_V3" } } },
    select: { branchId: true, organizationId: true },
  });
  if (!agreement) throw new BillingResourceNotFoundError();
  return activeAgreement.run(agreement, run);
}

function agreementFor(organizationId: string) {
  const agreement = activeAgreement.getStore();
  if (agreement && agreement.organizationId !== organizationId) throw new BillingResourceNotFoundError();
  return agreement;
}

/** A consumed owner trial follows its original workspace binding. */
export function trialForBillingWorkspace<T extends { ownerId: string; organizationId: string | null }>(owner: {
  id: string; ownerId: string; billingModelVersion: string; ownerTrialGrant: T | null;
}): T | null {
  const grant = owner.ownerTrialGrant;
  if (owner.billingModelVersion !== "BRANCH_V3") return grant;
  return grant?.ownerId === owner.ownerId && grant.organizationId === owner.id ? grant : null;
}

export async function getBillingOwner(organizationId: string, userId: string) {
  const owner = await OrganizationService.getOrganizationForOwnerAccess(organizationId, userId);
  const scope = agreementFor(organizationId);
  if (!scope && owner.billingModelVersion !== "BRANCH_V3" && isHistoricalBillingFixture(organizationId)) {
    return { ...owner, billingBranchStatus: null, legacyCoverageEndsAt: null };
  }
  if (!scope) throw new BillingValidationError("Select a branch to manage its subscription");
  if (owner.billingModelVersion !== "BRANCH_V3") throw new BillingResourceNotFoundError();
  const agreement = await prisma.branchBillingAgreement.findFirst({
    where: { ...scope, branch: { organization: { ownerId: userId } } },
    include: { subscription: true, branch: { select: { billingStatus: true } } },
  });
  if (!agreement) throw new BillingResourceNotFoundError();
  return { ...owner, ownerTrialGrant: trialForBillingWorkspace(owner), billingBranchStatus: agreement.branch.billingStatus, legacyCoverageEndsAt: agreement.legacyCoverageEndsAt, subscription: agreement.subscription, selectedPostTrialPlan: agreement.selectedPlan,
    billingMutationSequence: agreement.billingMutationSequence, billingMutationLeaseToken: agreement.billingMutationLeaseToken,
    billingMutationLeaseUntil: agreement.billingMutationLeaseUntil };
}

export async function lockBillingCoordinator(tx: Prisma.TransactionClient, organizationId: string, ownerId?: string) {
  const scope = agreementFor(organizationId);
  if (!scope && !isRetiredAggregateReceipt(organizationId) && !isHistoricalBillingFixture(organizationId)) {
    throw new BillingValidationError("Select a branch to manage its subscription");
  }
  const rows = scope
    ? await tx.$queryRaw<Array<{ id: string }>>`
        SELECT a."branchId" AS id FROM "BranchBillingAgreement" a JOIN "Organization" o ON o.id=a."organizationId"
        WHERE a."branchId"=${scope.branchId} AND a."organizationId"=${organizationId}
          AND o."billingModelVersion"='BRANCH_V3' AND (${ownerId ?? null}::text IS NULL OR o."ownerId"=${ownerId ?? null})
        FOR UPDATE OF a
      `
    : await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "Organization" WHERE id=${organizationId}
          AND ("billingModelVersion" <> 'BRANCH_V3' OR ${isRetiredAggregateReceipt(organizationId)})
          AND (${ownerId ?? null}::text IS NULL OR "ownerId"=${ownerId ?? null}) FOR UPDATE
      `;
  if (!rows.length) throw new OrganizationAccessNotFoundError();
  return rows;
}

type Where = {
  id: string; ownerId?: string; billingMutationLeaseToken?: string | null;
  billingMutationLeaseUntil?: Prisma.DateTimeNullableFilter;
};
type Write = {
  billingMutationSequence?: Prisma.IntFieldUpdateOperationsInput | number;
  billingMutationLeaseToken?: string | null; billingMutationLeaseUntil?: Date | null;
  selectedPostTrialPlan?: SaasPlan;
};
type Read = { where: Where; select?: Prisma.OrganizationSelect };
type Update = Read & { data: Write };

export function billingCoordinator(db: Prisma.TransactionClient) {
  function agreementWhere(where: Where) {
    const { id, ownerId, ...lease } = where;
    const scope = agreementFor(id);
    if (!scope) throw new BillingResourceNotFoundError();
    return { ...scope, ...lease, branch: { organization: { ownerId, billingModelVersion: "BRANCH_V3" as const } } };
  }
  function agreementWrite(data: Write) {
    const { selectedPostTrialPlan, ...coordination } = data;
    return { ...coordination, selectedPlan: selectedPostTrialPlan };
  }
  async function findFirst({ where }: Read) {
    if (!agreementFor(where.id)) return db.organization.findFirst({ where });
    const state = await db.branchBillingAgreement.findFirst({ where: agreementWhere(where) });
    return state && { ...state, billingModelVersion: "BRANCH_V3" as const };
  }
  return {
    findFirst,
    async findUnique(input: Read) {
      if (!agreementFor(input.where.id)) return db.organization.findUnique({ where: input.where });
      return findFirst(input);
    },
    async findUniqueOrThrow(input: Read) {
      if (!agreementFor(input.where.id)) return db.organization.findUniqueOrThrow({ where: input.where });
      const state = await findFirst(input);
      if (!state) throw new BillingResourceNotFoundError();
      return state;
    },
    async update({ where, data }: Update) {
      if (!agreementFor(where.id)) return db.organization.update({ where, data });
      return db.branchBillingAgreement.update({ where: agreementWhere(where), data: agreementWrite(data) });
    },
    async updateMany({ where, data }: Update) {
      if (!agreementFor(where.id)) return db.organization.updateMany({ where, data });
      return db.branchBillingAgreement.updateMany({ where: agreementWhere(where), data: agreementWrite(data) });
    },
  };
}

export function currentSlot(organizationId: string) {
  const scope = agreementFor(organizationId);
  return scope ? { currentAgreementBranchId: scope.branchId } : { currentOrganizationId: organizationId };
}
export function pendingSlot(organizationId: string) {
  const scope = agreementFor(organizationId);
  return scope ? { pendingAgreementBranchId: scope.branchId } : { pendingReplacementOrganizationId: organizationId };
}
export function isCurrentSlot(subscription: { currentAgreementBranchId?: string | null; currentOrganizationId: string | null }, organizationId: string) {
  const scope = agreementFor(organizationId);
  return scope ? subscription.currentAgreementBranchId === scope.branchId : subscription.currentOrganizationId === organizationId;
}
export function isPendingSlot(subscription: { pendingAgreementBranchId?: string | null; pendingReplacementOrganizationId: string | null }, organizationId: string) {
  const scope = agreementFor(organizationId);
  return scope ? subscription.pendingAgreementBranchId === scope.branchId : subscription.pendingReplacementOrganizationId === organizationId;
}
export function billingProcessingUrl(organizationId: string, changeId: string) {
  const scope = agreementFor(organizationId);
  if (scope) return `${accountBillingProcessingHref(organizationId, changeId)}?branchId=${encodeURIComponent(scope.branchId)}`;
  return `/org/${encodeURIComponent(organizationId)}/billing/processing/${encodeURIComponent(changeId)}`;
}

/** Serialize effective-access changes with final premium-work admission. Legacy
 * transactions retain their existing organization coordination and grants. */
export async function billingTransaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>) {
  const scope = activeAgreement.getStore();
  if (!scope) return prisma.$transaction(work);
  const { EntitlementService } = await import("@/services/entitlement.service");
  const { reconcileBranchPremiumWork } = await import("@/services/branchPremiumWork.service");
  return prisma.$transaction(async tx => {
    const locked = await lockBillingCoordinator(tx, scope.organizationId);
    if (!locked.length) throw new BillingResourceNotFoundError();
    const before = await EntitlementService.getBranchProfile(scope.branchId, tx);
    const result = await work(tx);
    await reconcileBranchPremiumWork(tx, scope.organizationId, scope.branchId, before);
    return result;
  });
}

export async function assertBranchPlanChangeAllowed(db: Prisma.TransactionClient) {
  const scope = activeAgreement.getStore();
  if (!scope) return;
  const branch = await db.branch.findFirst({ where: { id: scope.branchId, organizationId: scope.organizationId },
    select: { billingStatus: true } });
  if (!branch || branch.billingStatus === "ARCHIVED" || branch.billingStatus === "REMOVAL_SCHEDULED") {
    throw new BillingValidationError("Restore the branch before changing its subscription");
  }
}

export function branchBillingReturnPath(organizationId: string, path: unknown) {
  const scope = agreementFor(organizationId);
  if (!scope) return null;
  const value = typeof path === "string" ? path : null;
  const branchInPath = value?.match(/^\/branch\/([^/?#]+)/)?.[1];
  return accountBillingOperationReturn(organizationId, branchInPath && branchInPath !== scope.branchId ? null : value, scope.branchId);
}
