const PILOT_BRANCH_SEGMENTS = new Set(["students", "seats", "follow-ups", "tasks", "reports", "dashboard-settings"]);

/**
 * Approved dashboard visual scope and its supporting branch destinations.
 * Collection owns its overlay scope separately because it can open elsewhere.
 */
export function isApplicationDesignPilotPath(pathname: string | null | undefined) {
    const segments = pathname?.split("/").filter(Boolean) ?? [];
    if (segments[0] !== "branch" || !segments[1]) return false;
    if (segments.length === 2) return true;
    return segments.length === 3 && PILOT_BRANCH_SEGMENTS.has(segments[2]);
}
