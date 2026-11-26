import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/app/generated/prisma/client";
import { BillingValidationError } from "@/lib/billingErrors";
import { OrganizationAccessNotFoundError } from "@/lib/organizationErrors";
import { isCheckoutBillingPlanId, type CheckoutBillingPlanId } from "@/lib/billingPlans";

const TRIAL_DAYS = 30;

function addTrialDays(start: Date) {
  return new Date(start.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
}

export class OwnerTrialService {
  static async startOnboardingTrial(
    tx: Prisma.TransactionClient,
    ownerId: string,
    organizationId: string,
    now = new Date(),
    trialPlan: CheckoutBillingPlanId = "STANDARD"
  ) {
    if (!isCheckoutBillingPlanId(trialPlan)) throw new BillingValidationError("Choose Basic, Standard or Pro for your trial.");
    const owner = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "User" WHERE "id" = ${ownerId} FOR UPDATE
    `;
    if (owner.length === 0) throw new Error("Owner not found");

    const existing = await tx.ownerTrialGrant.findUnique({ where: { ownerId } });
    if (existing) return null;

    return tx.ownerTrialGrant.create({
      data: {
        ownerId,
        organizationId,
        source: "ONBOARDING",
        status: "ACTIVE",
        trialPlan,
        claimedAt: now,
        trialStartedAt: now,
        trialEndsAt: addTrialDays(now),
        consumedAt: now,
      },
    });
  }

  static async claimMigratedTrial(
    ownerId: string,
    organizationId: string,
    now = new Date()
  ) {
    return prisma.$transaction(async tx => {
      const owner = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "User" WHERE "id" = ${ownerId} FOR UPDATE
      `;
      if (owner.length === 0) throw new Error("Owner not found");

      const target = await tx.$queryRaw<Array<{ billingModelVersion: string }>>`
        SELECT "billingModelVersion" FROM "Organization" WHERE id=${organizationId} AND "ownerId"=${ownerId} AND "billingModelVersion"='BRANCH_V3' FOR UPDATE
      `;
      if (!target.length) throw new OrganizationAccessNotFoundError();
      // Checkout serializes on the agreement lock. Lock every agreement before changing the common trial boundary.
      await tx.$queryRaw`SELECT "branchId" FROM "BranchBillingAgreement" WHERE "organizationId"=${organizationId} ORDER BY "branchId" FOR UPDATE`;
      const busy = await tx.branchBillingAgreement.findFirst({ where: { organizationId, OR: [
        { billingMutationLeaseToken: { not: null } },
        { changes: { some: { type: "SUBSCRIPTION_AUTHORIZATION", resolvedAt: null } } },
      ] }, select: { branchId: true } });
      if (busy) throw new BillingValidationError("Resolve the pending branch checkout before claiming the owner trial");
      const organization = await tx.organization.findFirst({
        where: { id: organizationId, ownerId },
        select: {
          id: true,
          subscription: { select: { id: true } },
          _count: { select: { subscriptionHistory: true, subscriptions: true } },
        },
      });
      if (!organization) throw new OrganizationAccessNotFoundError();
      if (organization.subscription || organization._count.subscriptions > 0 || organization._count.subscriptionHistory > 0) {
        throw new BillingValidationError("Only a never-billed organization can claim this trial");
      }

      const grant = await tx.ownerTrialGrant.findUnique({ where: { ownerId } });
      if (!grant || grant.source !== "MIGRATION" || grant.status !== "AVAILABLE") {
        throw new BillingValidationError("No migrated trial is available");
      }

      const claimed = await tx.ownerTrialGrant.update({
        where: { id: grant.id },
        data: {
          organizationId,
          status: "ACTIVE",
          claimedAt: now,
          trialStartedAt: now,
          trialEndsAt: addTrialDays(now),
          consumedAt: now,
        },
      });
      await tx.branch.updateMany({
        where: { organizationId, billingStatus: "PENDING_ACTIVATION", billingAgreement: { is: { organizationId } } },
        data: { billingStatus: "ACTIVE", billingActivatedAt: now },
      });
      return claimed;
    });
  }

  static async expireDueTrials(now = new Date()) {
    return prisma.ownerTrialGrant.updateMany({
      where: { status: "ACTIVE", trialEndsAt: { lte: now } },
      data: { status: "EXPIRED" },
    });
  }
}

export { TRIAL_DAYS };
