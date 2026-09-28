const SELECTED_BRANCH_SEGMENTS = new Set(["students", "staff", "seats", "follow-ups", "tasks", "reports", "dashboard-settings", "settings", "renewals", "overdue", "allocations", "shifts", "payments", "attendance"]);

/**
 * Selected application routes adopted so far. Keep the public surface and
 * excluded legacy AI Messages route outside this boundary.
 * Collection owns its overlay scope separately because it can open elsewhere.
 */
export function isApplicationDesignPilotPath(pathname: string | null | undefined) {
    const segments = pathname?.split("/").filter(Boolean) ?? [];
    if (segments[0] !== "branch" || !segments[1]) return false;
    if (segments.length === 2) return true;
    return segments.length === 3 && SELECTED_BRANCH_SEGMENTS.has(segments[2]);
}
