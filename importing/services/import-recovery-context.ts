import type { Prisma } from "@/app/generated/prisma/client";
import type { ImportPlanSnapshot } from "../contracts/import-v2.contract";

/** Original financial review survives cleared run-item payloads and month changes. */
export async function guidedRecoveryDates(db: Pick<Prisma.TransactionClient, "importRunItem" | "importPlan">, branchId: string, sessionId: string) {
    const students = await db.importRunItem.findMany({ where: { kind: "STUDENT", status: "SUCCEEDED",
        run: { branchId, importSessionId: sessionId, kind: "COMMIT" } },
        select: { importRowId: true, run: { select: { importPlanId: true } } }, orderBy: { createdAt: "asc" } });
    if (!students.length) return new Map<string, string>();
    const ids = [...new Set(students.flatMap(item => item.run.importPlanId ? [item.run.importPlanId] : []))];
    const plans = await db.importPlan.findMany({ where: { id: { in: ids }, importSessionId: sessionId, session: { branchId } }, select: { id: true, snapshot: true } });
    const byId = new Map(plans.map(plan => [plan.id, plan.snapshot as unknown as ImportPlanSnapshot]));
    const result = new Map<string, string>();
    for (const item of students) {
        if (!item.importRowId || result.has(item.importRowId)) continue;
        const date = byId.get(item.run.importPlanId ?? "")?.currentMonthReview?.businessDate;
        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Original financial review is unavailable; preserve this import for recovery.");
        result.set(item.importRowId, date);
    }
    return result;
}

export function reviewedDate(value: string | undefined, fallback = new Date()) {
    return value ? new Date(`${value}T12:00:00`) : fallback;
}
