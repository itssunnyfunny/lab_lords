/**
 * Harness-only theme gate. `mode=baseline` renders the current application
 * contract without the unapproved pilot marker; every other mode renders the
 * scoped pilot. Production routing remains untouched.
 */
export function isApplicationDesignPilotPath(pathname: string | null | undefined) {
    void pathname;
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("mode") !== "baseline";
}
