import { describe, expect, it } from "vitest";
import { allocationDecisionIssues, assignmentState, branchWithImportSetup, emptyImportSetup, parseImportSetup, prepareSupportedAssignment, validateImportSetup } from "@/importing/utils/guided-setup";
import { setupAvailability } from "@/importing/utils/setup-availability";
import { guidedImportOptions } from "@/importing/utils/current-month-import";
import { suggestedWorkspaceName } from "@/lib/onboardingNames";
import type { ImportBranchContext } from "@/importing/contracts/import-session.contract";
const branch: ImportBranchContext = { defaultFee: 0, defaultAdmissionFee: 0, seats: [{ id: "a1", label: "A1" }],
    shifts: [{ id: "am", name: "Morning", startTime: "06:00", endTime: "12:00", price: 700 }, { id: "pm", name: "Afternoon", startTime: "12:00", endTime: "18:00", price: 800 }],
    multiShifts: [{ id: "full", name: "Full day", componentShiftNames: ["Morning", "Afternoon"], price: 1300 }] };
describe("reviewed owner setup", () => {
    it("suggests a parent workspace without requiring another real business name", () => {
        expect(suggestedWorkspaceName(" Shani ")).toBe("Shani’s workspace");
        expect(suggestedWorkspaceName(null)).toBe("My workspace");
    });
    it("keeps old drafts separate and makes missing seating different from explicit deferral", () => {
        expect(allocationDecisionIssues({}, guidedImportOptions())).toEqual([]);
        expect(allocationDecisionIssues({}, guidedImportOptions(undefined, true))).toHaveLength(1);
        expect(allocationDecisionIssues({ allocation: { deferred: true } }, guidedImportOptions(undefined, true))).toEqual([]);
        expect(assignmentState({ normalizedData: {} })).toBe("decision");
        expect(assignmentState({ normalizedData: { allocation: { deferred: true } } })).toBe("deferred");
        expect(guidedImportOptions({ skipConflictingAllocations: true, skipUnknownShiftAllocations: true }, true)).toMatchObject({ skipConflictingAllocations: false, skipUnknownShiftAllocations: false });
    });
    it("matches supplied labels, exact hours and complete component sets without choosing arbitrary seats", () => {
        expect(prepareSupportedAssignment({ seat: { label: "a1" }, shift: { name: "Early study", startTime: "06:00", endTime: "12:00" } }, branch).allocation).toEqual({ seatLabel: "A1", shiftName: "Morning" });
        expect(prepareSupportedAssignment({ multiShift: { name: "Whole day", componentShiftNames: ["Afternoon", "Morning"] } }, branch).allocation).toEqual({ multiShiftName: "Full day" });
        expect(prepareSupportedAssignment({}, branch).allocation).toEqual({});
    });
    it("rejects unsafe configuration and keeps prices separate from individual fees", () => {
        expect(() => parseImportSetup({ ...emptyImportSetup(), seats: ["A1", "a1"] })).toThrow();
        expect(() => parseImportSetup({ ...emptyImportSetup(), shifts: [{ name: "Night", startTime: "18:00", endTime: "23:00" }] })).toThrow();
        expect(() => validateImportSetup({ ...emptyImportSetup(), shifts: [{ name: "Overlap", startTime: "07:00", endTime: "08:00", price: 1 }] }, branch)).toThrow(/overlap/);
        expect(() => validateImportSetup({ ...emptyImportSetup(), multiShifts: [{ name: "Duplicate", componentShiftNames: ["Afternoon", "Morning"], price: 1 }] }, branch)).toThrow(/duplicate/);
        const setup = { ...emptyImportSetup(), shifts: [{ name: "Night", startTime: "18:00", endTime: "23:00", price: 900 }] };
        expect(() => validateImportSetup(setup, branch)).not.toThrow();
        const row = prepareSupportedAssignment({ student: { monthlyFee: 400 }, shift: { name: "Night" } }, branchWithImportSetup(branch, setup));
        expect(row.student?.monthlyFee).toBe(400);
    });
    it("shows combined live occupancy and draft conflicts, including proposed seats", () => {
        const context = branchWithImportSetup(branch, { ...emptyImportSetup(), seats: ["A2"] });
        const rows = [{ id: "r2", rowNumber: 2, status: "READY", skipped: false, normalizedData: { student: { name: "Synthetic" }, allocation: { seatLabel: "A2", shiftName: "Morning" } } }];
        const preview = setupAvailability(context, rows, [{ seatId: "a1", shiftId: "pm", shift: branch.shifts[1] }], { rowId: "r1", multiShiftId: "full" });
        expect(preview.seatMap?.seats.map(s => s.source)).toEqual(["existing", "staged"]);
        expect(preview.seatMap?.availableCount).toBe(0);
    });
});
