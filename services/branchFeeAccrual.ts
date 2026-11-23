import { Prisma } from "@/app/generated/prisma/client";
import type { BranchBillingStatus } from "@/app/generated/prisma/enums";
import { startOfDay } from "date-fns";

const branchStateSelect = { id: true, organizationId: true, billingStatus: true, billingActivatedAt: true } as const;
type BranchFeeState = Prisma.BranchGetPayload<{ select: typeof branchStateSelect }>;
type MonthlyAccrualWindow = { closesAt: Date | null; reopenedAt: Date | null };
const operatingStatuses: BranchBillingStatus[] = ["ACTIVE", "REMOVAL_SCHEDULED"];

async function monthlyAccrualWindows(tx: Prisma.TransactionClient, branches: BranchFeeState[], asOf: Date) {
    const eligible = new Map<string, MonthlyAccrualWindow>(
        branches.filter(branch => branch.billingStatus === "ACTIVE").map(branch => [branch.id, { closesAt: null, reopenedAt: null }]),
    );
    const scheduled = branches.filter(branch => branch.billingStatus === "REMOVAL_SCHEDULED");
    if (scheduled.length) {
        const changes = await tx.organizationBillingChange.findMany({
            where: {
                type: "BRANCH_REMOVAL",
                OR: scheduled.map(branch => ({ branchId: branch.id, organizationId: branch.organizationId })),
            },
            orderBy: { sequence: "desc" },
            distinct: ["branchId"],
            select: { branchId: true, effectiveAt: true, status: true },
        });
        for (const change of changes) {
            if (change.branchId && change.effectiveAt && asOf < change.effectiveAt &&
                ["QUEUED", "PROCESSING", "AWAITING_PAYMENT", "SCHEDULED", "FAILED"].includes(change.status)) {
                eligible.set(change.branchId, { closesAt: change.effectiveAt, reopenedAt: null });
            }
        }
    }

    // Activation timestamps are also used when branches first open. Only
    // an applied removal proves a closed period and prevents later catch-up.
    const activations = new Map<string, Date>();
    const previouslyClosedCandidates = branches.flatMap(branch => {
        if (!branch.billingActivatedAt || !eligible.has(branch.id)) return [];
        activations.set(branch.id, branch.billingActivatedAt);
        return [{
            branchId: branch.id, organizationId: branch.organizationId,
            effectiveAt: { lte: branch.billingActivatedAt },
        }];
    });
    if (previouslyClosedCandidates.length) {
        const previouslyClosed = await tx.organizationBillingChange.findMany({
            where: { type: "BRANCH_REMOVAL", status: "APPLIED", OR: previouslyClosedCandidates },
            distinct: ["branchId"], select: { branchId: true },
        });
        for (const { branchId } of previouslyClosed) {
            const window = branchId && eligible.get(branchId);
            if (branchId && window) window.reopenedAt = activations.get(branchId) ?? null;
        }
    }
    return eligible;
}

/** Read a window after authorization. Expected cycles use the same boundary as writes. */
export async function readMonthlyAccrualWindow(tx: Prisma.TransactionClient, branchId: string, organizationId: string, asOf: Date) {
    const branch = await tx.branch.findFirst({
        where: { id: branchId, organizationId, billingStatus: { in: operatingStatuses } }, select: branchStateSelect,
    });
    return branch ? (await monthlyAccrualWindows(tx, [branch], asOf)).get(branch.id) : undefined;
}

export function canAccrueMonthlyDue(window: MonthlyAccrualWindow, dueDate: Date, feeDay: (instant: Date) => Date) {
    return (!window.reopenedAt || dueDate >= feeDay(window.reopenedAt))
        && (!window.closesAt || dueDate <= feeDay(new Date(window.closesAt.getTime() - 1)));
}

export async function eligibleMonthlyAccruals<T extends { branchId: string; studentId: string; dueDate: Date | string }>(
    tx: Prisma.TransactionClient, payments: T[], asOf: Date,
    feeDay: (studentId: string, date: Date) => Date = (_studentId, date) => startOfDay(date),
) {
    if (!payments.length) return payments;
    const branchIds = [...new Set(payments.map(payment => payment.branchId))];
    // Scheduling, undoing and applying a removal write the same branch row
    // in their transaction. Hold that row until the generation batch commits.
    const branches = await tx.$queryRaw<BranchFeeState[]>(Prisma.sql`
        SELECT "id", "organizationId", "billingStatus", "billingActivatedAt" FROM "Branch"
        WHERE "id" IN (${Prisma.join(branchIds)})
          AND "billingStatus" IN ('ACTIVE', 'REMOVAL_SCHEDULED')
        ORDER BY "id" FOR UPDATE
    `);
    const windows = await monthlyAccrualWindows(tx, branches, asOf);
    return payments.filter(payment => {
        const window = windows.get(payment.branchId);
        return window !== undefined && canAccrueMonthlyDue(window, new Date(payment.dueDate), date => feeDay(payment.studentId, date));
    });
}
