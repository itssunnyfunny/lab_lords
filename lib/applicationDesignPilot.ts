const SELECTED_BRANCH_SEGMENTS = new Set(["students", "staff", "seats", "follow-ups", "tasks", "reports", "dashboard-settings", "settings", "renewals", "overdue", "allocations", "shifts", "payments", "attendance", "analytics"]);

/**
 * Selected application routes adopted so far. Keep the public surface and
 * excluded legacy AI Messages route outside this boundary.
 * Collection owns its overlay scope separately because it can open elsewhere.
 */
export function isApplicationDesignPilotPath(pathname: string | null | undefined) {
    const segments = pathname?.split("/").filter(Boolean) ?? [];
    if (segments[0] !== "branch" || !segments[1]) return false;
    if (segments.length === 2) return true;
    if (segments.length === 3) return SELECTED_BRANCH_SEGMENTS.has(segments[2]);
    if (segments.length === 4 && segments[2] === "ai" && segments[3] === "reports") return true;
    return segments[2] === "onboarding" && segments[3] === "import" && (segments.length === 4 || segments.length === 5);
}

/** Selected authenticated routes, including entry and organization surfaces. */
export function isSelectedApplicationSurfacePath(pathname: string | null | undefined) {
    if (isApplicationDesignPilotPath(pathname)) return true;
    const segments = pathname?.split("/").filter(Boolean) ?? [];
    if (segments.length === 1) return ["app", "account", "org", "onboarding"].includes(segments[0]);
    if (segments[0] === "invite") return segments.length === 2;
    if (segments[0] !== "org" || !segments[1]) return false;
    if (segments.length === 2) return true;
    if (segments.length === 3) return ["analytics", "settings"].includes(segments[2]);
    return segments.length === 5 && segments[2] === "billing" && segments[3] === "processing";
}
