import type { ImportValidationQuestionDraft } from "@/importing/validators/import-required-fields.validator";

function questionKey(question: ImportValidationQuestionDraft) {
    return JSON.stringify({
        field: question.field ?? null,
        question: question.question,
        options: question.options ?? null,
    });
}

export function dedupeImportQuestionDrafts(questionDrafts: ImportValidationQuestionDraft[]) {
    const deduped = new Map<string, ImportValidationQuestionDraft>();

    for (const question of questionDrafts) {
        const key = questionKey(question);
        const existing = deduped.get(key);

        if (!existing) {
            deduped.set(key, question);
            continue;
        }

        deduped.set(key, {
            ...existing,
            rowId: undefined,
        });
    }

    return Array.from(deduped.values());
}
