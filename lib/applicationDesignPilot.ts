const PILOT_BRANCH_SEGMENTS = new Set(["students", "seats"]);

/**
 * Keeps the unapproved application theme on the representative pilot routes.
 * Collection owns its overlay scope separately because it can open elsewhere.
 */
export function isApplicationDesignPilotPath(pathname: string | null | undefined) {
    const segments = pathname?.split("/").filter(Boolean) ?? [];
    if (segments[0] !== "branch" || !segments[1]) return false;
    if (segments.length === 2) return true;
    return segments.length === 3 && PILOT_BRANCH_SEGMENTS.has(segments[2]);
}
