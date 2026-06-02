import { describe, expect, it } from "vitest";
import { dedupeImportQuestionDrafts } from "@/importing/utils/import-question-dedupe";

describe("dedupeImportQuestionDrafts", () => {
    it("collapses repeated global import decisions while preserving distinct questions", () => {
        const questions = dedupeImportQuestionDrafts([
            {
                rowId: "row_1",
                field: "payment.period",
                question: "Which payment cycle should this file represent?",
                options: ["CURRENT_MONTH", "SKIP_PAYMENTS"],
            },
            {
                rowId: "row_2",
                field: "payment.period",
                question: "Which payment cycle should this file represent?",
                options: ["CURRENT_MONTH", "SKIP_PAYMENTS"],
            },
            {
                rowId: "row_1",
                field: "seat.label",
                question: "Create missing seat \"A1\" during import?",
                options: ["YES_CREATE_SEATS", "NO_SKIP_ALLOCATIONS"],
            },
            {
                rowId: "row_2",
                field: "seat.label",
                question: "Create missing seat \"A2\" during import?",
                options: ["YES_CREATE_SEATS", "NO_SKIP_ALLOCATIONS"],
            },
        ]);

        expect(questions).toHaveLength(3);
        expect(questions.find(question => question.field === "payment.period")?.rowId).toBeUndefined();
        expect(questions.map(question => question.question)).toContain("Create missing seat \"A1\" during import?");
        expect(questions.map(question => question.question)).toContain("Create missing seat \"A2\" during import?");
    });
});
