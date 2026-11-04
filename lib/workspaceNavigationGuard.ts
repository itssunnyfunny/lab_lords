export const WORKSPACE_NAVIGATION_REQUEST = "lablords:before-workspace-navigation";

/** Programmatic workspace navigation shares the current draft's leave guard. */
export function canNavigateWorkspace() {
    return typeof window === "undefined" || window.dispatchEvent(new Event(WORKSPACE_NAVIGATION_REQUEST, { cancelable: true }));
}
