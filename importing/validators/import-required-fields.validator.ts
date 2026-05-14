import type { ImportIssue, ImportNormalizedRow } from "@/importing/contracts/import-session.contract";

export type ImportValidationQuestionDraft = {
    rowId?: string;
    field?: string;
    question: string;
    options?: unknown;
};

export type ImportValidatorResult = {
    issues: ImportIssue[];
    warnings: ImportIssue[];
    questions: ImportValidationQuestionDraft[];
};

export function emptyValidatorResult(): ImportValidatorResult {
    return { issues: [], warnings: [], questions: [] };
}

export function validateRequiredImportFields(normalized: ImportNormalizedRow): ImportValidatorResult {
    const result = emptyValidatorResult();

    if (!normalized.student?.name) {
        result.issues.push({
            code: "MISSING_STUDENT_NAME",
            field: "student.name",
            message: "Student name is required to create a student.",
            severity: "error",
        });
    }

    return result;
}

export function mergeValidatorResults(...results: ImportValidatorResult[]): ImportValidatorResult {
    return results.reduce<ImportValidatorResult>((merged, result) => ({
        issues: [...merged.issues, ...result.issues],
        warnings: [...merged.warnings, ...result.warnings],
        questions: [...merged.questions, ...result.questions],
    }), emptyValidatorResult());
}
