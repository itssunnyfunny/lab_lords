import type { ImportColumnMapping, ImportIssue, ImportNormalizedRow } from "../contracts/import-session.contract";
import { evaluatedCurrentMonthOutcome, type CurrentMonthOutcome } from "./current-month-import";
import { guidedSavedFields } from "./guided-import-presentation";

type Row = { id: string; rowNumber: number; status: string; skipped: boolean; rawData: unknown; normalizedData: unknown; issues: unknown; createdEntityIds: unknown };
export type GuidedPaymentChoice = {
    rowId: string; rowNumber: number; name: string; outcome: CurrentMonthOutcome;
    dueEligible: boolean; paidEligible: boolean; reason: string; saved: boolean;
    decision?: "KEEP_DUE" | "CONFIRMED_PAID";
};
export function guidedPaymentChoice(row: Row, mappings: ImportColumnMapping[], asOf: Date): GuidedPaymentChoice {
    const data = (row.normalizedData ?? {}) as ImportNormalizedRow;
    const payment = data.payment;
    const outcome = evaluatedCurrentMonthOutcome(data, (row.issues ?? []) as ImportIssue[], asOf);
    const source = mappings.some(column => column.targetField.startsWith("payment.")
        && String((row.rawData as Record<string, unknown>)?.[column.sourceColumn] ?? "").trim());
    const paymentFacts = !!payment && Object.entries(payment).some(([key, value]) => key !== "decision" && value !== undefined && value !== "");
    const batchDue = payment?.decision === "KEEP_DUE" && payment.status === "DUE"
        && payment.amount === undefined && !payment.rawStatus && !payment.method && !payment.referenceId;
    const saved = row.status === "IMPORTED" || guidedSavedFields(row.createdEntityIds as Record<string, unknown>).payment;
    const protectedFacts = source || (paymentFacts && !batchDue) || payment?.decision === "CONFIRMED_PAID";
    const eligible = !row.skipped && !saved && !protectedFacts && outcome.state === "CREATE_NOW" && outcome.status === "DUE";
    const reason = row.skipped ? "Left out of this import" : saved ? "Already imported; saved payment facts stay unchanged"
        : protectedFacts ? "Source or confirmed payment: review individually"
        : outcome.state === "GENERATE_LATER" || outcome.state === "NO_DUE" ? "Not due yet; normal generation will handle it later"
        : outcome.state === "NEEDS_REVIEW" ? "Resolve the payment or joining-date questions first"
        : batchDue ? "Confirmed Due; record collections later or review as Paid" : "No payment recorded; eligible fee will start as Due";
    return { rowId: row.id, rowNumber: row.rowNumber, name: data.student?.name ?? "Student details to confirm", outcome,
        dueEligible: eligible && !batchDue, paidEligible: eligible, reason, saved, decision: payment?.decision };
}
export type GuidedPaymentReview = { draftRevision: number; businessDate: string; rows: GuidedPaymentChoice[] };
export type GuidedPaymentResolution = { expectedRevision: number; businessDate: string } & (
    { action: "DUE"; rowIds: string[] } | { action: "PAID"; payments: Array<{ rowId: string; method: "CASH" | "UPI" | "BANK_TRANSFER"; referenceId?: string }> }
);
