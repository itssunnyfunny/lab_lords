import { readBranchSnapshotForAI } from "../readers/branch.reader"
import { detectBranchRisks } from "../riskDetection/branchRiskDetector"
import { suggestActionsForBranch } from "../actionSuggestions/branchActionSuggester"
import { generateBranchHealthReport } from "../branchHealthReport"
import { AIBranchReportSnapshot, AIStructuredBranchReport } from "../contracts/structuredReport.contract"
import { prisma } from "@/lib/prisma"
import type { Prisma } from "@/app/generated/prisma/client"
import { startOfDay } from "date-fns"


export interface BranchAIResponse {
    version: "1.0"

    meta: {
        branchId: string
        branchName: string
        generatedAt: string
        paymentOverdueRuleVersion: string
    }

    hasPendingChanges?: boolean
    nextAllowedCallAt?: string

    report: AIStructuredBranchReport
    snapshot?: AIBranchReportSnapshot

    // Legacy fields kept for compatibility if needed, but 'report' is now the main structured object
    risks: {
        total: number
        items: unknown[]
    }

    actions: {
        total: number
        items: unknown[]
    }

}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const STUCK_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes - force reset if stuck running
const PAYMENT_OVERDUE_RULE_VERSION = "due-after-7-days-any-due-v2";

function buildReportSnapshot(snapshot: Awaited<ReturnType<typeof readBranchSnapshotForAI>>): AIBranchReportSnapshot {
    return {
        branchName: snapshot.branchName,
        asOf: snapshot.asOf.toISOString(),
        seats: {
            total: snapshot.seats.total,
            occupied: snapshot.seats.occupied,
            available: snapshot.seats.available,
            utilizationPercent: snapshot.seats.utilizationPercent,
            shiftBreakdown: snapshot.seats.shiftBreakdown.map((shift) => ({
                shiftName: shift.shiftName,
                used: shift.used,
                capacity: shift.capacity,
                occupancyPercent: shift.occupancyPercent,
            })),
        },
        students: {
            total: snapshot.students.total,
            active: snapshot.students.active,
            inactive: snapshot.students.inactive,
        },
        payments: {
            dueCount: snapshot.payments.dueCount,
            paidCount: snapshot.payments.paidCount,
            overdueCount: snapshot.payments.overdueCount,
            overdueAmount: snapshot.payments.overduePayments.reduce((total, payment) => total + payment.amount, 0),
        },
    };
}

export async function runBranchAI(
    branchId: string
): Promise<BranchAIResponse> {
    const now = new Date();

    // 0️⃣ Check Caching & Rate Limiting & Concurrency
    const branch = await prisma.branch.findUnique({
        where: { id: branchId },
        select: { lastDataChange: true, name: true, aiLastCalledAt: true, aiStatus: true, aiEnabled: true }
    });

    if (!branch) throw new Error("Branch not found");
    if (!branch.aiEnabled) throw new Error("AI is disabled for this branch");

    const lastReport = await prisma.branchAIReport.findFirst({
        where: { branchId },
        orderBy: { createdAt: 'desc' }
    });
    const lastReportData = lastReport?.data as { meta?: { paymentOverdueRuleVersion?: string } } | undefined;
    const lastReportUsesCurrentPaymentRule =
        lastReportData?.meta?.paymentOverdueRuleVersion === PAYMENT_OVERDUE_RULE_VERSION;

    const lastCalledAt = branch.aiLastCalledAt ? branch.aiLastCalledAt.getTime() : 0;
    const timeSinceLastCall = now.getTime() - lastCalledAt;

    // Status Calculations
    const isRateLimited = timeSinceLastCall < CACHE_TTL_MS;
    const hasDataChanged = branch.lastDataChange.getTime() > lastCalledAt;
    const lastReportIsFromToday = lastReport
        ? startOfDay(lastReport.createdAt).getTime() === startOfDay(now).getTime()
        : false;

    // Check if currently running (and not stuck)
    const isRunning = branch.aiStatus === "RUNNING";
    const runsForTooLong = isRunning && timeSinceLastCall > STUCK_TIMEOUT_MS;
    const actuallyRunning = isRunning && !runsForTooLong;

    // Derived fields for response
    const nextAllowedCallAt = new Date(lastCalledAt + CACHE_TTL_MS).toISOString();
    const responseExtras = {
        hasPendingChanges: hasDataChanged,
        nextAllowedCallAt: isRateLimited ? nextAllowedCallAt : now.toISOString()
    };

    let shouldRun = true;

    if (actuallyRunning) {
        console.log(`[AI CONCURRENCY] Blocked for ${branchId} (Already IDLE -> RUNNING)`);
        // If running, we MUST return cached report if available, else error/wait
        if (lastReport) {
            return {
                ...lastReport.data as unknown as BranchAIResponse,
                ...responseExtras // Update extras
            };
        }
        throw new Error("AI is currently generating. Please wait.");
    }

    if (isRateLimited && lastReportIsFromToday && lastReportUsesCurrentPaymentRule && !runsForTooLong) {
        // Normal rate limit block
        console.log(`[AI RATE LIMIT] Blocked for ${branchId} (Wait ${((CACHE_TTL_MS - timeSinceLastCall) / 1000).toFixed(0)}s)`);
        shouldRun = false;
    } else if (!hasDataChanged && lastReport && lastReportIsFromToday && lastReportUsesCurrentPaymentRule && !runsForTooLong) {
        console.log(`[AI STALENESS] Blocked for ${branchId} (No data change since last AI call)`);
        shouldRun = false;
    }

    // 🛑 CONCURRENCY LOCK ACQUISITION
    // If we decided to run, we must transition IDLE -> RUNNING atomically
    if (shouldRun) {
        // If it was "stuck" (runsForTooLong), we reset it. 
        // Or if it was IDLE, we set it to RUNNING.
        const updateResult = await prisma.branch.updateMany({
            where: {
                id: branchId,
                // Optimistic lock: ensure it matches what we read (unless we are forcing a reset of a stuck job)
                aiStatus: runsForTooLong ? "RUNNING" : "IDLE"
            },
            data: {
                aiStatus: "RUNNING",
                aiLastCalledAt: now // Update timestamp to mark start of this run
            }
        });

        if (updateResult.count === 0 && !runsForTooLong) {
            console.log(`[AI CONCURRENCY] Blocked for ${branchId} (Race condition: IDLE check failed)`);
            shouldRun = false;
        }
    }

    if (!shouldRun && lastReport) {
        return {
            ...lastReport.data as unknown as BranchAIResponse,
            ...responseExtras
        };
    }

    console.log(`[AI RUNNING] Generating new AI result for ${branchId}`);

    try {
        // 1️⃣ [DETERMINISTIC] Read analytics snapshot
        const snapshot = await readBranchSnapshotForAI(branchId)

        // 2️⃣ [DETERMINISTIC] Detect risks (Legacy/Parallel)
        const risks = detectBranchRisks(snapshot)

        // 3️⃣ [DETERMINISTIC] Suggest actions (Legacy/Parallel)
        const actions = suggestActionsForBranch(risks)

        // 4️⃣ [AI - GEMINI] Generate STRUCTURED health report
        const structuredReport = await generateBranchHealthReport(snapshot)

        const result: BranchAIResponse = {
            version: "1.0",

            meta: {
                branchId,
                branchName: snapshot.branchName,
                generatedAt: new Date().toISOString(),
                paymentOverdueRuleVersion: PAYMENT_OVERDUE_RULE_VERSION,
            },

            ...responseExtras,
            // After run, pending changes are cleared (conceptually, though specifically we check timestamps next time)
            hasPendingChanges: false,

            report: structuredReport,
            snapshot: buildReportSnapshot(snapshot),

            risks: {
                total: risks.length,
                items: risks,
            },

            actions: {
                total: actions.length,
                items: actions,
            },
        }

        // Save report to DB
        await prisma.branchAIReport.create({
            data: {
                branchId,
                data: result as unknown as Prisma.InputJsonValue
            }
        });

        return result;

    } finally {
        // 🏁 RELEASE LOCK -> IDLE
        // Only release if WE were the ones running it (which we know because we got past the lock check)
        if (shouldRun) {
            await prisma.branch.update({
                where: { id: branchId },
                data: { aiStatus: "IDLE" }
            });
        }
    }
}
