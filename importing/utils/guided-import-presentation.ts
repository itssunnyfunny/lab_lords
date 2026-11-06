import type { ImportIssue, ImportNormalizedRow } from "../contracts/import-session.contract";
import type { CurrentMonthOutcome } from "./current-month-import";
import { importReadiness, unresolvedImportDecisions } from "./import-readiness";

export type StudentTask = "joining" | "fee" | "shift" | "seat" | "payment" | "identity" | "source" | "details";
export function guidedSavedFields(ids: Record<string, unknown> | null | undefined) {
    return { student: typeof ids?.studentId === "string" && !!ids.studentId.trim(),
        payment: Array.isArray(ids?.paymentIds) && ids.paymentIds.some(id => typeof id === "string" && !!id.trim()),
        seating: Array.isArray(ids?.allocationIds) && ids.allocationIds.some(id => typeof id === "string" && !!id.trim()) };
}
export const studentTaskLabels = {
    joining: "Confirm joining date", fee: "Confirm monthly fee", shift: "Choose timings", seat: "Choose a seat",
    payment: "Confirm payment information", identity: "Check an existing student", source: "Check source columns", details: "Check student details",
} as const satisfies Record<StudentTask, string>;
type StudentRecord = { status: string; skipped: boolean; normalizedData: ImportNormalizedRow | null; issues: ImportIssue[]; warnings: ImportIssue[]; paymentOutcome?: CurrentMonthOutcome };
export function guidedStudentTasks(row: StudentRecord): StudentTask[] {
    if (importReadiness(row) !== "attention") return [];
    const tasks = new Set<StudentTask>();
    for (const issue of unresolvedImportDecisions(row)) {
        const field = issue.field ?? "", code = issue.code;
        if (code === "SOURCE_COLUMN_REVIEW") tasks.add("source");
        else if (/DUPLICATE_(?:EXISTING|STUDENT|PHONE|IMPORT)|EXISTING_IDENTITY/.test(code)) tasks.add("identity");
        else if (/JOIN/.test(code) || field === "student.joinedAt") tasks.add("joining");
        else if (field === "student.monthlyFee" || /STUDENT_FEE|MONTHLY_FEE/.test(code)) tasks.add("fee");
        else if (/PAYMENT/.test(code) || field.startsWith("payment.")) tasks.add("payment");
        else if (/SEAT|ALLOCATION|CONFLICT|OVERLAP/.test(code) || field === "allocation.seatLabel") tasks.add("seat");
        else if (/SHIFT/.test(code) || /shift|multiShift/i.test(field)) tasks.add("shift");
        else if (issue.severity === "error") tasks.add("details");
    }
    if (!tasks.size && !["READY", "WARNING"].includes(row.status)) tasks.add("details");
    return [...tasks];
}

export type FinancialKind = "due" | "paid" | "waived" | "existing" | "future" | "none" | "review";
export type FinancialOutcome = { state: string; status?: string; amount: number | null; dueDate?: string | null };
export type FinancialSummary = Record<FinancialKind, { count: number; amount: number }>;
export function financialKind(outcome: FinancialOutcome): FinancialKind {
    if (outcome.state === "EXISTING") return "existing";
    if (outcome.state === "GENERATE_LATER") return "future";
    if (outcome.state === "NO_DUE") return "none";
    if (outcome.state !== "CREATE_NOW") return "review";
    return outcome.status === "PAID" ? "paid" : outcome.status === "WAIVED" ? "waived" : outcome.status === "DUE" ? "due" : "review";
}
export const financialLabels = {
    due: "Outstanding dues to create", paid: "Record as already paid", waived: "Record as waived", existing: "Existing fee records",
    future: "Future dues", none: "No eligible due this month", review: "Fees need your confirmation",
} as const satisfies Record<FinancialKind, string>;
export const financialOutcomeLabels = {
    due: "Outstanding due will be created", paid: "Payment will be recorded as already paid", waived: "Fee will be recorded as waived",
    existing: "Existing fee record will not be duplicated", future: "Normal generation on {date}", none: "No eligible due this month",
    review: "Fees need your confirmation",
} as const satisfies Record<FinancialKind, string>;
export function summarizeGuidedFinancials(outcomes: FinancialOutcome[]): FinancialSummary {
    const summary = Object.fromEntries(Object.keys(financialLabels).map(kind => [kind, { count: 0, amount: 0 }])) as FinancialSummary;
    for (const outcome of outcomes) {
        const kind = financialKind(outcome);
        summary[kind].count++;
        if (!["none", "review"].includes(kind) && Number.isSafeInteger(outcome.amount) && outcome.amount! >= 0) summary[kind].amount += outcome.amount!;
    }
    return summary;
}
export function hasFinancialIssue(row: { issues?: unknown; warnings?: unknown }) {
    const issues = [...(Array.isArray(row.issues) ? row.issues : []), ...(Array.isArray(row.warnings) ? row.warnings : [])] as ImportIssue[];
    return issues.some(issue => issue.severity === "error" && (/PAYMENT|STUDENT_FEE|MONTHLY_FEE/.test(issue.code)
        || issue.field?.startsWith("payment.") || issue.field === "student.monthlyFee"));
}
