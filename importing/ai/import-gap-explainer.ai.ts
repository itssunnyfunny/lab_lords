import type { ImportIssue } from "@/importing/contracts/import-session.contract";

export function explainImportGaps(issues: ImportIssue[]) {
    const blockers = issues.filter(issue => issue.severity === "error");
    if (blockers.length > 0) {
        return `Fix ${blockers.length} blocking issue${blockers.length === 1 ? "" : "s"} before this row can be imported.`;
    }

    const warnings = issues.filter(issue => issue.severity === "warning");
    if (warnings.length > 0) {
        return `Review ${warnings.length} warning${warnings.length === 1 ? "" : "s"} before final import.`;
    }

    return "This row is ready for import.";
}
