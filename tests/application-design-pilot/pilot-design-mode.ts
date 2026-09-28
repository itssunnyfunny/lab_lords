/**
 * Harness-only theme gate. `mode=baseline` renders the current application
 * contract without the unapproved pilot marker; every other mode renders the
 * scoped pilot. Production routing remains untouched.
 */
import { isSelectedApplicationSurfacePath as isActualSelectedApplicationSurfacePath } from "../../lib/applicationDesignPilot";

export function isApplicationDesignPilotPath(pathname: string | null | undefined) {
    void pathname;
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("mode") !== "baseline";
}

export function isSelectedApplicationSurfacePath(pathname: string | null | undefined) {
    if (typeof window === "undefined" || new URLSearchParams(window.location.search).get("mode") === "baseline") return false;
    return isActualSelectedApplicationSurfacePath(pathname);
}
