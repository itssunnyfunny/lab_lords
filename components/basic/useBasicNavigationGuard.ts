"use client";
import { useEffect, useRef } from "react";
import { WORKSPACE_NAVIGATION_REQUEST, registerWorkspaceHistoryGuard, type WorkspaceNavigationRequest } from "@/lib/workspaceNavigationGuard";

/** Restore the current history entry before showing an asynchronous leave dialog.
 * Only an approved continuation may replay the requested Back/Forward action. */
export function useBasicNavigationGuard(allow: (resume: () => void) => boolean, needsWarning: boolean, historyKey = "basicIndex") {
    const allowRef = useRef(allow);
    const warningRef = useRef(needsWarning);
    useEffect(() => { allowRef.current = allow; warningRef.current = needsWarning; });
    useEffect(() => {
        const originalPush = history.pushState, originalReplace = history.replaceState;
        let index = typeof history.state?.[historyKey] === "number" ? history.state[historyKey] : 0;
        let current = location.href, restoring = false;
        let afterRestore: (() => void) | undefined;
        let mounted = true;
        originalReplace.call(history, { ...history.state, [historyKey]: index }, "", current);
        const push: History["pushState"] = function (state, title, url) {
            index++;
            current = new URL(String(url ?? current), location.href).href;
            originalPush.call(history, { ...state, [historyKey]: index }, title, url);
        };
        const replace: History["replaceState"] = function (state, title, url) {
            current = new URL(String(url ?? current), location.href).href;
            originalReplace.call(history, { ...state, [historyKey]: index }, title, url);
        };
        history.pushState = push;
        history.replaceState = replace;
        function pop(event: PopStateEvent) {
            if (restoring) {
                restoring = false;
                event.stopImmediatePropagation();
                const resume = afterRestore;
                afterRestore = undefined;
                resume?.();
                return;
            }
            const next = event.state?.[historyKey];
            const destination = location.href;
            const delta = typeof next === "number" ? next - index : 0;
            const resume = () => {
                if (!mounted) return;
                const navigate = () => delta ? history.go(delta) : location.assign(destination);
                if (restoring) afterRestore = navigate;
                else navigate();
            };
            if (warningRef.current) {
                event.stopImmediatePropagation();
                // A state update while the URL still points at the destination can
                // make router subscribers render that route and discard the draft.
                // Restore first, then ask; cancellation never renders the destination.
                const request = () => { if (mounted && allowRef.current(resume)) resume(); };
                if (delta) {
                    restoring = true;
                    afterRestore = request;
                    history.go(-delta);
                } else {
                    originalPush.call(history, { ...history.state, [historyKey]: index }, "", current);
                    request();
                }
                return;
            }
            if (typeof next === "number") index = next;
            current = location.href;
        }
        const unregisterHistoryGuard = registerWorkspaceHistoryGuard(pop);
        return () => {
            mounted = false;
            unregisterHistoryGuard();
            if (history.pushState === push) history.pushState = originalPush;
            if (history.replaceState === replace) history.replaceState = originalReplace;
        };
    }, [historyKey]);
    useEffect(() => {
        // Browser close/reload still requires the browser-owned beforeunload prompt.
        function unload(event: BeforeUnloadEvent) {
            if (needsWarning) { event.preventDefault(); event.returnValue = ""; }
        }
        function programmatic(event: Event) {
            const resume = (event as CustomEvent<WorkspaceNavigationRequest>).detail?.resume ?? (() => {});
            if (!allowRef.current(resume)) event.preventDefault();
        }
        function link(event: MouseEvent) {
            const anchor = (event.target as Element).closest?.("a[href]");
            if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
                || !(anchor instanceof HTMLAnchorElement) || (anchor.target && anchor.target !== "_self") || anchor.hasAttribute("download")) return;
            if (anchor.hash && anchor.pathname === location.pathname && anchor.search === location.search) return;
            if (!allowRef.current(() => { if (anchor.isConnected) anchor.click(); })) {
                event.preventDefault();
                event.stopPropagation();
            }
        }
        window.addEventListener("beforeunload", unload);
        document.addEventListener("click", link, true);
        window.addEventListener(WORKSPACE_NAVIGATION_REQUEST, programmatic);
        return () => {
            window.removeEventListener("beforeunload", unload);
            document.removeEventListener("click", link, true);
            window.removeEventListener(WORKSPACE_NAVIGATION_REQUEST, programmatic);
        };
    }, [needsWarning]);
}
