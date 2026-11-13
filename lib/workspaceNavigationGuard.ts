export const WORKSPACE_NAVIGATION_REQUEST = "lablords:before-workspace-navigation";
export type WorkspaceNavigationRequest = { resume?: () => void };

/** A draft guard can defer this exact navigation until its dialog is confirmed. */
export function canNavigateWorkspace(resume?: () => void) {
    return typeof window === "undefined" || window.dispatchEvent(new CustomEvent<WorkspaceNavigationRequest>(WORKSPACE_NAVIGATION_REQUEST, {
        cancelable: true, detail: { resume },
    }));
}

const historyGuards = new Set<(event: PopStateEvent) => void>();
let historyOwners = 0;
const dispatchHistoryGuard = (event: PopStateEvent) => Array.from(historyGuards).at(-1)?.(event);

/** Mount in the root layout phase, before the router's passive popstate listener.
 * Window is the event target: capture=true does not outrank earlier listeners. */
export function installWorkspaceHistoryGuard() {
    if (historyOwners++ === 0) window.addEventListener("popstate", dispatchHistoryGuard);
    return () => {
        if (--historyOwners === 0) window.removeEventListener("popstate", dispatchHistoryGuard);
    };
}

export function registerWorkspaceHistoryGuard(guard: (event: PopStateEvent) => void) {
    historyGuards.add(guard);
    return () => { historyGuards.delete(guard); };
}
