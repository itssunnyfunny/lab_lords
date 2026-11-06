import { format, isBefore, startOfDay, startOfMonth } from "date-fns";
import { studentBillingCycle, currentMonthJoinedCycle, isCycleDue } from "@/utils/studentBillingCycles";
import type { ImportIssue, ImportNormalizedRow, ImportOptions } from "../contracts/import-session.contract";

export const GUIDED_IMPORT_EXPERIENCE = "GUIDED_CURRENT_MONTH_V1" as const;
export function isGuidedImport(source: unknown) {
    return !!source && typeof source === "object" && "experience" in source && [GUIDED_IMPORT_EXPERIENCE, "GUIDED_SETUP_V2"].includes(String(source.experience));
}
/** Keep the established billing helper's runtime-local calendar convention. */
export function importBusinessDate(asOf = new Date()) { return format(asOf, "yyyy-MM-dd"); }
export function guidedImportOptions(options?: ImportOptions, setup = false): ImportOptions {
    return { ...options, paymentPolicy: "CURRENT_CALENDAR_MONTH", paymentCycle: "USE_JOINED_AT_ANNIVERSARY",
        paymentAction: "IMPORT_PAID_UNPAID", paymentHistoryMode: "START_CURRENT_JOINED_CYCLE",
        createUnknownSeats: false, createUnknownShifts: false, createUnknownMultiShifts: false,
        configurationBatchApproved: setup && options?.configurationBatchApproved === true,
        ...(setup ? { allocationPolicy: "EXPLICIT_DECISION" as const, preparedSetup: options?.preparedSetup,
            skipUnknownSeatAllocations: false, skipUnknownShiftAllocations: false,
            skipUnknownMultiShiftAllocations: false, skipMissingShiftAllocations: false, skipConflictingAllocations: false,
        } : { allocationPolicy: undefined, preparedSetup: undefined }),
        ...(options?.paymentMapping ? { paymentMapping: { ...options.paymentMapping, defaultMethod: undefined } } : {}) };
}
export type CurrentMonthOutcome = {
    state: "CREATE_NOW" | "GENERATE_LATER" | "NO_DUE" | "NEEDS_REVIEW" | "EXISTING";
    businessDate: string;
    dueDate: string | null;
    billingStartAt: string | null;
    amount: number | null;
    status: string;
    issues: ImportIssue[];
};
export function currentMonthOutcome(row: ImportNormalizedRow, asOf = new Date()): CurrentMonthOutcome {
    const result: CurrentMonthOutcome = { state: "NEEDS_REVIEW", businessDate: importBusinessDate(asOf), dueDate: null,
        billingStartAt: null, amount: row.student?.monthlyFee ?? null, status: row.payment?.status ?? "DUE", issues: [] };
    const issue = (code: string, field: string, message: string) => result.issues.push({ code, field, message, severity: "error" });
    const joinedAt = row.student?.joinedAt ? new Date(row.student.joinedAt) : null;
    if (!joinedAt || Number.isNaN(joinedAt.getTime()) || row.student?.joinedAtSource === "TODAY_DEFAULT") {
        issue("CONFIRM_JOINING_DATE", "student.joinedAt", "Confirm the original joining date. It will not be guessed.");
    }
    if (!Number.isSafeInteger(row.student?.monthlyFee) || row.student!.monthlyFee! < 0) {
        issue("CONFIRM_STUDENT_FEE", "student.monthlyFee", "Confirm the student's monthly fee, including an intentional zero.");
    }
    if (result.issues.length || !joinedAt) return result;
    const monthStart = startOfMonth(asOf);
    let firstTrackedCycle = null;
    for (let index = 0; index < 600; index++) {
        const cycle = studentBillingCycle(joinedAt, index);
        if (!isBefore(cycle.dueDate, monthStart)) { firstTrackedCycle = cycle; break; }
    }
    if (!firstTrackedCycle) {
        issue("JOINING_DATE_BILLING_RANGE", "student.joinedAt", "This joining date is outside the supported billing range. Review it before importing."); return result;
    }
    // billingStartAt filters PERIOD STARTS, not due dates. Persist this even
    // when no due is created; normal generation must never backfill old cycles.
    result.billingStartAt = firstTrackedCycle.periodStart.toISOString();
    const cycle = currentMonthJoinedCycle(joinedAt, asOf);
    result.dueDate = (cycle ?? firstTrackedCycle).dueDate.toISOString();
    const payment = row.payment;
    const financialSource = Boolean(payment?.rawStatus || payment?.status || payment?.amount !== undefined);
    const status = payment?.status;
    if ((status && !["DUE", "PAID", "WAIVED"].includes(status)) || (!status && financialSource)) {
        issue("PAYMENT_INFORMATION_REVIEW", "payment.status", "Payment information needs review. Confirm what this month's source value means.");
    }
    // An amount smaller than the fee may describe a partial collection. Never
    // rewrite it as a smaller full due or silently discard a recorded amount.
    if (payment?.amount !== undefined && payment.amount !== row.student!.monthlyFee) {
        issue("PARTIAL_PAYMENT_REVIEW", "payment.amount", "The payment amount differs from the monthly fee. Review the partial or unclear payment before importing this student.");
    }
    if ((status === "PAID" || payment?.method !== undefined) && !["CASH", "UPI", "BANK_TRANSFER"].includes(payment?.method ?? "")) {
        issue("CONFIRM_PAYMENT_METHOD", "payment.method", "Confirm the recorded payment method. A method will not be invented.");
    }
    if ((!cycle || !isCycleDue(cycle, asOf)) && (status === "PAID" || status === "WAIVED" || (status !== "DUE" && financialSource && payment?.amount !== undefined && payment.amount > 0))) {
        issue("PAYMENT_BEFORE_DUE_REVIEW", "payment.status", "The source records a payment before an eligible due. Review this row; an early due or advance payment will not be created.");
    }
    if (result.issues.length) return result;
    result.state = !cycle ? "NO_DUE" : isCycleDue(cycle, startOfDay(asOf)) ? "CREATE_NOW" : "GENERATE_LATER";
    return result;
}

export function evaluatedCurrentMonthOutcome(row: ImportNormalizedRow, issues: ImportIssue[], asOf = new Date()): CurrentMonthOutcome {
    const outcome = currentMonthOutcome(row, asOf);
    const unresolved = issues.filter(issue => issue.code === "DUPLICATE_EXISTING_IDENTITY" || (issue.severity === "error"
        && (issue.code === "SOURCE_COLUMN_REVIEW" || /^(payment\.|student\.(joinedAt|monthlyFee))/.test(issue.field ?? ""))));
    return unresolved.length ? { ...outcome, state: "NEEDS_REVIEW", issues: [...outcome.issues, ...unresolved] } : outcome;
}

/** Applied to new commits only. Started runs retain their immutable outcomes. */
export function assertCurrentMonthPlanDate(snapshot: unknown, asOf = new Date()) {
    const plan = snapshot as { currentMonthReview?: { businessDate: string } } | null;
    if (plan?.currentMonthReview && plan.currentMonthReview.businessDate !== importBusinessDate(asOf)) {
        throw Object.assign(new Error("The business date changed. Refresh payment outcomes and review a new plan before importing."), { code: "IMPORT_BUSINESS_DATE_CHANGED" });
    }
}
