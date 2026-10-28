import { prisma } from "@/lib/prisma";
import { decodeDateIdCursor, encodeDateIdCursor } from "@/lib/cursorPagination";
import { OrganizationService } from "@/services/organization.service";

/** Read-only evidence browsing; never changes provider state or entitlements. */
export class BillingHistoryService {
    static async page(actorId: string, organizationId: string, kind: "invoices" | "history", value?: string | null) {
        await OrganizationService.getOrganizationForOwnerAccess(organizationId, actorId);
        const cursor = decodeDateIdCursor(value);
        const where = { organizationId, ...(cursor ? { OR: [
            { createdAt: { lt: cursor.sort } }, { createdAt: cursor.sort, id: { lt: cursor.id } },
        ] } : {}) };
        const orderBy = [{ createdAt: "desc" as const }, { id: "desc" as const }];
        const rows = kind === "invoices"
            ? await prisma.organizationSubscriptionInvoice.findMany({ where, orderBy, take: 21,
                select: { id: true, razorpayInvoiceId: true, status: true, amountSubunits: true, currency: true, paidAt: true, createdAt: true, providerMode: true } })
            : (await prisma.organizationSubscriptionHistory.findMany({ where, orderBy, take: 21,
                select: { id: true, razorpaySubscriptionId: true, plan: true, fromStatus: true, toStatus: true, source: true, amountSubunits: true, currency: true, createdAt: true,
                    organizationSubscription: { select: { providerMode: true } } } }))
                .map(({ organizationSubscription, ...row }) => ({ ...row, providerMode: organizationSubscription?.providerMode ?? null }));
        const items = rows.slice(0, 20);
        const last = items.at(-1);
        return { items, nextCursor: rows.length > 20 && last ? encodeDateIdCursor({ sort: last.createdAt, id: last.id }) : null };
    }
}
