import { describe, expect, it } from "vitest";
import { importReadiness, importSaveOutcome } from "@/importing/utils/import-readiness";
import { guidedStudentTasks } from "@/importing/utils/guided-import-presentation";

const missingPhone = { code: "MISSING_PHONE", severity: "warning" as const, message: "Phone is optional.", field: "student.phone" };
const date = { code: "CONFIRM_JOINING_DATE", severity: "error" as const, message: "Confirm original joining date.", field: "student.joinedAt" };
const fee = { code: "CONFIRM_STUDENT_FEE", severity: "error" as const, message: "Confirm monthly fee.", field: "student.monthlyFee" };
const row = { status: "WARNING", skipped: false, normalizedData: null, issues: [], warnings: [missingPhone] };
describe("one import readiness decision", () => {
    it("keeps optional warnings ready and out of the actionable task list", () => {
        expect(importReadiness(row)).toBe("ready");
        expect(guidedStudentTasks(row)).toEqual([]);
        expect(importReadiness({ ...row, skipped: true })).toBe("skipped");
    });
    it("reports what actually resolved and keeps the other reason", () => {
        const outcome = importSaveOutcome({ ...row, status: "BLOCKED", issues: [date, fee] }, { ...row, status: "BLOCKED", issues: [fee] });
        expect(outcome).toEqual({ readiness: "attention", resolved: [date], remaining: [fee] });
        expect(guidedStudentTasks({ ...row, status: "BLOCKED", issues: [fee] })).toEqual(["fee"]);
    });
    it("a saved unchanged problem is not reported resolved", () => {
        const blocked = { ...row, status: "BLOCKED", issues: [date] };
        expect(importSaveOutcome(blocked, blocked)).toEqual({ readiness: "attention", resolved: [], remaining: [date] });
    });
});
