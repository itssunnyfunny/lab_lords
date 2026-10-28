import path from "node:path";

/** Keep repeat audit captures separate from preserved design-review evidence. */
export function reviewEvidencePath(relative: string) {
    const auditId = process.env.AUDIT_BROWSER_RUN_ID;
    const root = process.env.PLAYWRIGHT_REVIEW_EVIDENCE_DIR || process.env.REFERENCE_DASHBOARD_EVIDENCE_DIR
        || (auditId && /^20260930-[a-z0-9-]+$/.test(auditId) ? path.resolve(".clerk", "audit-browser-runs", auditId, "review-evidence") : null);
    if (!root) return relative;
    if (!relative.startsWith("docs/redesign/")) throw new Error("Unexpected review evidence path");
    const destination = path.resolve(root, relative.slice("docs/redesign/".length));
    if (!destination.startsWith(`${path.resolve(root)}${path.sep}`)) throw new Error("Review evidence escaped its output directory");
    return destination;
}
