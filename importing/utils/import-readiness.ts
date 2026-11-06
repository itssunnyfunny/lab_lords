import type { ImportRowStatus } from "@/app/generated/prisma/enums";
import type { ImportIssue } from "../contracts/import-session.contract";

// Validation publishes these states; every queue and consumer uses the same
// partition. WARNING retains useful information without requiring a decision.
export const readyImportStatuses: ImportRowStatus[] = ["READY", "WARNING"];
export const actionableImportStatuses: ImportRowStatus[] = ["NEEDS_REVIEW", "BLOCKED", "DUPLICATE", "CONFLICT", "FAILED"];
type Row = { status: string; skipped?: boolean };
export function importReadiness(row: Row): "ready" | "attention" | "imported" | "skipped" {
    if (row.skipped || row.status === "SKIPPED") return "skipped";
    if (row.status === "IMPORTED") return "imported";
    return readyImportStatuses.includes(row.status as ImportRowStatus) ? "ready" : "attention";
}
export function warningRequiresDecision(issue: ImportIssue) {
    return issue.severity !== "info" && /DUPLICATE|UNKNOWN|REQUIRED|UNCONFIRMED|AMBIGUOUS|MISSING_ALLOCATION/.test(issue.code);
}
export function unresolvedImportDecisions(row: Row & { issues: ImportIssue[]; warnings: ImportIssue[] }): ImportIssue[] {
    if (importReadiness(row) !== "attention") return [];
    const reasons = [...row.issues, ...row.warnings.filter(warningRequiresDecision)];
    return [...new Map(reasons.map(issue => [`${issue.code}:${issue.field ?? ""}`, issue])).values()];
}
export function importSaveOutcome(before: Parameters<typeof unresolvedImportDecisions>[0], after: Parameters<typeof unresolvedImportDecisions>[0]) {
    const remaining = unresolvedImportDecisions(after);
    const keys = new Set(remaining.map(issue => `${issue.code}:${issue.field ?? ""}`));
    return { readiness: importReadiness(after), remaining,
        resolved: unresolvedImportDecisions(before).filter(issue => !keys.has(`${issue.code}:${issue.field ?? ""}`)) };
}
