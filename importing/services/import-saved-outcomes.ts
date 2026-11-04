import type { Prisma } from "@/app/generated/prisma/client";
import type { ImportPlanSnapshot } from "../contracts/import-v2.contract";
import { summarizeGuidedFinancials, type FinancialOutcome } from "../utils/guided-import-presentation";

/** Historical outcomes of successful import operations, not today's balances.
 * Read only this authorized session's ledger and immutable plans. Never derive
 * a successful payment from a successful student or a prepared preview. */
export async function guidedSavedOutcomes(db: Pick<Prisma.TransactionClient, "importRunItem" | "importPlan">, branchId: string, sessionId: string) {
    const items = await db.importRunItem.findMany({ where: { kind: { in: ["STUDENT", "PAYMENT_CYCLE"] }, status: "SUCCEEDED",
        run: { branchId, importSessionId: sessionId, kind: "COMMIT" } }, orderBy: { createdAt: "asc" },
        select: { kind: true, importRowId: true, result: true, run: { select: { importPlanId: true } } } });
    const planIds = [...new Set(items.flatMap(item => item.run.importPlanId ? [item.run.importPlanId] : []))];
    const plans = planIds.length ? await db.importPlan.findMany({ where: { id: { in: planIds }, importSessionId: sessionId, session: { branchId } }, select: { id: true, snapshot: true } }) : [];
    const byId = new Map(plans.map(plan => [plan.id, plan.snapshot as unknown as ImportPlanSnapshot]));
    const payments = new Map<string, FinancialOutcome>(), students = new Map<string, FinancialOutcome>();
    const paidRows = new Set<string>();
    for (const item of items) {
        if (!item.importRowId || !item.result || typeof item.result !== "object" || Array.isArray(item.result)) continue;
        const ids = item.result.entityIds;
        if (!Array.isArray(ids) || !ids.some(id => typeof id === "string")) continue;
        const outcome = byId.get(item.run.importPlanId ?? "")?.currentMonthReview?.rows.find(row => row.rowId === item.importRowId);
        if (!outcome) continue; // Legacy plans have no guided financial metadata.
        if (item.kind === "STUDENT" && !students.has(item.importRowId)) students.set(item.importRowId, outcome);
        if (item.kind === "PAYMENT_CYCLE" && outcome.state === "CREATE_NOW") {
            for (const id of ids) if (typeof id === "string" && !payments.has(id)) payments.set(id, outcome);
            paidRows.add(item.importRowId);
        }
    }
    return summarizeGuidedFinancials([...payments.values(), ...[...students].flatMap(([rowId, outcome]) =>
        !paidRows.has(rowId) && ["GENERATE_LATER", "NO_DUE"].includes(outcome.state) ? [outcome] : [])]);
}
