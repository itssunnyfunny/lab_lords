import type { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { WhatsAppResourceNotFoundError } from "@/lib/whatsappHttp";
import { EntitlementService, BillingReadOnlyError, SubscriptionEntitlementError } from "@/services/entitlement.service";

type PrismaClient = Prisma.TransactionClient | typeof prisma;

export class WhatsAppAuthorizationService {
  static async assertOwner(
    actorUserId: string,
    organizationId: string,
    client: PrismaClient = prisma
  ) {
    const organization = await client.organization.findFirst({
      where: { id: organizationId, ownerId: actorUserId },
      select: { id: true },
    });
    if (!organization) throw new WhatsAppResourceNotFoundError();
    return organization;
  }

  static async assertOwnerEntitled(
    actorUserId: string,
    organizationId: string,
    client: PrismaClient = prisma
  ) {
    const organization = await this.assertOwner(actorUserId, organizationId, client);
    const scope = await EntitlementService.getOrganizationFeatureScope(
      organizationId,
      "WHATSAPP_AUTOMATION",
      client
    );
    if (!scope.entitled) throw new SubscriptionEntitlementError("WhatsApp requires the Pro plan.");
    return { ...organization, ...scope };
  }

  static async assertOwnerCanWrite(
    actorUserId: string,
    organizationId: string,
    client: PrismaClient = prisma
  ) {
    const organization = await this.assertOwnerEntitled(actorUserId, organizationId, client);
    if (!organization.canWrite) throw new BillingReadOnlyError("WhatsApp changes require a writable Pro branch.");
    return organization;
  }
}
