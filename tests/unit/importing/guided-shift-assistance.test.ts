import { describe, expect, it } from "vitest";
import { buildGuidedShiftAssistance, validGuidedShiftProposals } from "@/importing/utils/guided-shift-assistance";
const branch = { defaultFee: 1000, defaultAdmissionFee: 0, seats: [], shifts: [{ id: "private-shift-id", name: "Private Full Day", price: 1000, startTime: null, endTime: null }], multiShifts: [] };
const rows = [{ id: "private-row-id", skipped: false, status: "NEEDS_REVIEW", normalizedData: { allocation: { shiftName: "F.D." } } }];
describe("alias-based guided shift proposals", () => {
    it("keeps the confirmed relationship without exposing values or IDs", () => {
        const { context } = buildGuidedShiftAssistance(rows, branch, [{ field: "allocation.shiftName", source: "FD", target: "Private Full Day", affected: 12 }]);
        const proposal = { sourceAlias: "source_1", choiceAlias: "choice_1", answerAlias: "answer_1" };
        expect(validGuidedShiftProposals([proposal], context)).toEqual([proposal]);
        const text = JSON.stringify(context);
        for (const secret of ["private-shift-id", "private-row-id", "Private Full Day", "F.D.", '"FD"', "1000"]) expect(text).not.toContain(secret);
        expect(context.groups[0].meaningAlias).toBe(context.answers[0].meaningAlias);
    });
    it("rejects unsupported sources, invented choices, foreign answers and contradictory meanings", () => {
        const { context } = buildGuidedShiftAssistance([...rows, { ...rows[0], id: "other", normalizedData: { allocation: { shiftName: "Other" } } }], branch,
            [{ field: "allocation.shiftName", source: "FD", target: "Private Full Day", affected: 1 }]);
        const proposal = { sourceAlias: "source_1", choiceAlias: "choice_1", answerAlias: "answer_1" };
        expect(validGuidedShiftProposals([{ ...proposal, sourceAlias: "source_2" }, { ...proposal, choiceAlias: "foreign-id" }, { ...proposal, answerAlias: "answer_2" }], context)).toEqual([]);
        context.answers.push({ answerAlias: "answer_2", meaningAlias: context.answers[0].meaningAlias, choiceAlias: "choice_2" });
        expect(validGuidedShiftProposals([proposal], context)).toEqual([]);
    });
});
