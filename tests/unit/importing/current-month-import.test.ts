import { describe, expect, it, vi } from "vitest";
import { addMonths, format } from "date-fns";
import { currentMonthOutcome, guidedImportOptions, assertCurrentMonthPlanDate } from "@/importing/utils/current-month-import";
import { buildImportPaymentPlan } from "@/importing/utils/import-payment-plan";
import { dueCyclesThrough } from "@/utils/studentBillingCycles";
import { compileImportPlanSnapshot } from "@/importing/utils/import-plan-compiler";
import { buildFallbackMappings } from "@/importing/utils/column-normalizer";
import type { ImportNormalizedRow } from "@/importing/contracts/import-session.contract";

const today = new Date(2026, 10, 2, 12);
const row = (date: string): ImportNormalizedRow => ({ student: { name: "Synthetic Student", monthlyFee: 1000, joinedAt: new Date(date + "T12:00:00").toISOString(), joinedAtSource: "UPLOADED" } });
const options = guidedImportOptions();
describe("guided current-month import policy", () => {
    it.each([["2026-01-01", "CREATE_NOW", "2026-11-01"], ["2026-01-02", "CREATE_NOW", "2026-11-02"], ["2026-01-15", "GENERATE_LATER", "2026-11-15"], ["2026-11-01", "NO_DUE", "2026-12-01"]] as const)("%s retains its true anniversary", (date, state, due) => {
        const outcome = currentMonthOutcome(row(date), today);
        expect(outcome.state).toBe(state);
        expect(format(new Date(outcome.dueDate!), "yyyy-MM-dd")).toBe(due);
        const plan = buildImportPaymentPlan(row(date), options, today);
        expect(plan.items).toHaveLength(state === "CREATE_NOW" ? 1 : 0);
        expect(plan.billingStartAt?.toISOString()).toBe(outcome.billingStartAt);
        const future = dueCyclesThrough(new Date(row(date).student!.joinedAt!), new Date(2027, 0, 20), plan.billingStartAt);
        expect(future.every(cycle => format(cycle.dueDate, "yyyy-MM") >= "2026-11")).toBe(true);
        expect(future.length).toBeGreaterThan(0);
    });
    it("uses original month-end anchors, including leap years", () => {
        const student = row("2024-01-31");
        const result = currentMonthOutcome(student, new Date(2024, 1, 29, 12));
        expect(result.state).toBe("CREATE_NOW");
        expect(format(new Date(result.dueDate!), "yyyy-MM-dd")).toBe("2024-02-29");
        expect(format(new Date(result.billingStartAt!), "yyyy-MM-dd")).toBe("2024-01-31");
        const march = currentMonthOutcome(student, new Date(2024, 2, 30, 12));
        expect(march.state).toBe("GENERATE_LATER");
        expect(format(new Date(march.dueDate!), "yyyy-MM-dd")).toBe("2024-03-31");
    });
    it("does not guess joining date or branch-default fee", () => {
        expect(currentMonthOutcome({ student: { name: "Test" } }, today).issues.map(i => i.code)).toEqual(["CONFIRM_JOINING_DATE", "CONFIRM_STUDENT_FEE"]);
    });
    it.each(["PAID", "WAIVED"] as const)("retains explicit %s only for an eligible due", status => {
        const student = { ...row("2026-01-01"), payment: { status, method: "UPI" as const, amount: 1000 } };
        expect(currentMonthOutcome(student, today).state).toBe("CREATE_NOW");
        expect(buildImportPaymentPlan(student, options, today).items[0].status).toBe(status);
        expect(currentMonthOutcome({ ...student, student: row("2026-01-15").student }, today).state).toBe("NEEDS_REVIEW");
    });
    it("holds partial, unknown and missing-method facts, without making a smaller unpaid due", () => {
        expect(currentMonthOutcome({ ...row("2026-01-01"), payment: { amount: 300, status: "PAID", method: "CASH" } }, today).issues[0].code).toBe("PARTIAL_PAYMENT_REVIEW");
        expect(buildImportPaymentPlan({ ...row("2026-01-01"), payment: { amount: 300, status: "PAID" } }, options, today).items).toEqual([]);
        expect(currentMonthOutcome({ ...row("2026-01-01"), payment: { status: "PAID" } }, today).issues[0].code).toBe("CONFIRM_PAYMENT_METHOD");
        expect(currentMonthOutcome({ ...row("2026-01-01"), payment: { rawStatus: "half received", status: "UNCLEAR" } }, today).state).toBe("NEEDS_REVIEW");
        expect(currentMonthOutcome({ ...row("2026-01-15"), payment: { status: "DUE", amount: 1000 } }, today).state).toBe("GENERATE_LATER");
    });
    it("freezes reviewed payment outcomes into the plan hash and fences date crossings", () => {
        const input = { sessionId: "session", targetRevision: 1, goal: "FULL" as const, readinessPolicy: "READY_ROWS_ONLY" as const,
            mapping: { columnMappings: [], entityTypesDetected: ["STUDENT" as const], importOptions: options }, summary: null,
            hasOpenQuestions: false, expectedRowCount: 1, evaluations: [{ id: "evaluation", rowId: "row", rowNumber: 1,
                status: "READY" as const, skipped: false, normalizedData: row("2026-01-15"), warnings: [] }] };
        const plan = compileImportPlanSnapshot({ ...input, asOf: today });
        expect(plan.snapshot.items).toHaveLength(1);
        expect(plan.snapshot.items[0].payload?.billingStartAt).toBe(currentMonthOutcome(row("2026-01-15"), today).billingStartAt);
        expect(() => assertCurrentMonthPlanDate(plan.snapshot, today)).not.toThrow();
        expect(() => assertCurrentMonthPlanDate(plan.snapshot, addMonths(today, 1))).toThrow("business date changed");
        expect(() => assertCurrentMonthPlanDate({ schemaVersion: 2 }, addMonths(today, 1))).not.toThrow();
    });
    it("keeps collected amounts separate from monthly fees", () => {
        expect(buildFallbackMappings(["Monthly Fee", "Paid Amount"]).map(m => m.targetField)).toEqual(["student.monthlyFee", "payment.amount"]);
    });
    it("uses one captured business date even when compilation crosses midnight", () => {
        vi.useFakeTimers(); vi.setSystemTime(today);
        const student = row("2026-01-02").student!;
        const joined = student.joinedAt;
        Object.defineProperty(student, "joinedAt", { enumerable: true, get() { vi.setSystemTime(new Date(2026, 10, 3, 12)); return joined; } });
        try {
            const plan = compileImportPlanSnapshot({ sessionId: "session", targetRevision: 1, goal: "FULL", readinessPolicy: "READY_ROWS_ONLY",
                mapping: { columnMappings: [], entityTypesDetected: ["STUDENT"], importOptions: options }, summary: null, hasOpenQuestions: false, expectedRowCount: 1,
                evaluations: [{ id: "evaluation", rowId: "row", rowNumber: 1, status: "READY", skipped: false, normalizedData: { student }, warnings: [] }] });
            expect(plan.snapshot.currentMonthReview?.businessDate).toBe("2026-11-02");
            expect(plan.snapshot.currentMonthReview?.rows[0].state).toBe("CREATE_NOW");
        } finally { vi.useRealTimers(); }
    });
});
