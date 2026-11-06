import { describe, expect, it } from "vitest";
import { financialKind, financialOutcomeLabels, guidedSavedFields, guidedStudentTasks, guidedTaskLabel, hasFinancialIssue, summarizeGuidedFinancials } from "@/importing/utils/guided-import-presentation";
import type { ImportIssue } from "@/importing/contracts/import-session.contract";

describe("student-focused import presentation", () => {
    it.each([
        ["PAYMENT_BEFORE_DUE_REVIEW", "Payment recorded before the due date"],
        ["PARTIAL_PAYMENT_REVIEW", "Payment amount differs from the monthly fee"],
        ["CONFIRM_PAYMENT_METHOD", "Choose the recorded payment method"],
    ])("explains the actual %s decision without changing readiness", (code, label) => {
        const row = { status: "BLOCKED", skipped: false, normalizedData: {}, issues: [{ code, field: "payment.status", severity: "error" as const, message: "Check source" }], warnings: [] };
        expect(guidedTaskLabel(row, "payment")).toBe(label);
        expect(guidedStudentTasks(row)).toEqual(["payment"]);
        expect(guidedStudentTasks({ ...row, status: "IMPORTED" })).toEqual([]);
    });
    it("locks only facts with retained successful entity identifiers", () => {
        expect(guidedSavedFields({ studentId: "student", paymentIds: ["payment"], allocationIds: ["allocation"] })).toEqual({ student: true, payment: true, seating: true });
        expect(guidedSavedFields({ studentId: { id: "untrusted" }, paymentIds: [null, " "], allocationIds: [null] })).toEqual({ student: false, payment: false, seating: false });
        expect(guidedSavedFields(null)).toEqual({ student: false, payment: false, seating: false });
    });
    it.each(["CONFIRM_STUDENT_FEE", "INVALID_MONTHLY_FEE", "SOURCE_INTERPRETATION_CONFLICT"])("retains %s monthly-fee blockers in the held financial summary", code => {
        expect(hasFinancialIssue({ issues: [{ code, field: "student.monthlyFee", severity: "error" }] })).toBe(true);
        expect(hasFinancialIssue({ warnings: [{ code, field: "student.monthlyFee", severity: "warning" }] })).toBe(false);
    });
    it.each(["DUE", "PAID", "WAIVED"])("labels CREATE_NOW %s according to its actual financial outcome", status => {
        const kind = financialKind({ state: "CREATE_NOW", status, amount: 1000 });
        expect(kind).toBe(status === "DUE" ? "due" : status === "PAID" ? "paid" : "waived");
        expect(financialOutcomeLabels[kind]).not.toMatch(status === "DUE" ? /already paid|waived/ : /Outstanding due/);
    });
    it("keeps paid, waived, existing, future and held facts out of new outstanding totals", () => {
        const summary = summarizeGuidedFinancials([
            { state: "CREATE_NOW", status: "DUE", amount: 1000 }, { state: "CREATE_NOW", status: "PAID", amount: 1200 },
            { state: "CREATE_NOW", status: "WAIVED", amount: 800 }, { state: "EXISTING", status: "DUE", amount: 500 },
            { state: "GENERATE_LATER", status: "DUE", amount: 1500 }, { state: "NO_DUE", amount: 1000 }, { state: "NEEDS_REVIEW", amount: 300 },
        ]);
        expect(summary.due).toEqual({ count: 1, amount: 1000 });
        expect(summary.paid.amount).toBe(1200); expect(summary.waived.amount).toBe(800);
        expect(summary.existing).toEqual({ count: 1, amount: 500 });
        expect(summary.future.amount).toBe(1500); expect(summary.none.amount).toBe(0); expect(summary.review.amount).toBe(0);
    });
    it.each([
        ["CONFIRM_JOINING_DATE", "student.joinedAt", "joining"], ["UNKNOWN_SHIFT", "allocation.shiftName", "shift"],
        ["STAGED_ALLOCATION_CONFLICT", "allocation.seatLabel", "seat"], ["PARTIAL_PAYMENT_REVIEW", "payment.amount", "payment"],
        ["SOURCE_COLUMN_REVIEW", "ignore", "source"], ["DUPLICATE_EXISTING_IDENTITY", "student.phone", "identity"],
    ])("links %s to the relevant correction", (code, field, expected) => {
        const issue: ImportIssue = { code, field, severity: "error", message: "Synthetic issue" };
        expect(guidedStudentTasks({ status: "BLOCKED", skipped: false, normalizedData: {}, issues: [issue, issue], warnings: [] })).toEqual([expected]);
    });
    it("deduplicates tasks and leaves imported/excluded students unchanged", () => {
        const row = { status: "BLOCKED", skipped: false, normalizedData: {}, issues: [{ code: "INVALID_PAYMENT_AMOUNT", field: "payment.amount", severity: "error" as const, message: "Check amount" }, { code: "PARTIAL_PAYMENT_REVIEW", field: "payment.amount", severity: "error" as const, message: "Check amount" }], warnings: [] };
        expect(guidedStudentTasks(row)).toEqual(["payment"]);
        expect(guidedStudentTasks({ ...row, skipped: true })).toEqual([]);
        expect(guidedStudentTasks({ ...row, status: "IMPORTED" })).toEqual([]);
    });
});
