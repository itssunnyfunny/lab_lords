import type { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export const PAYMENT_OVERDUE_POLICY_SELECT = { paymentGraceDays: true, timezone: true } as const;

export async function readBranchPaymentOverduePolicy(branchId: string, client: Pick<Prisma.TransactionClient, "branch"> = prisma) {
    const branch = await client.branch.findUniqueOrThrow({
        where: { id: branchId },
        select: { organization: { select: PAYMENT_OVERDUE_POLICY_SELECT } },
    });
    return branch.organization;
}
