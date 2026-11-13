import { afterEach, describe, expect, it, vi } from "vitest";
import { canNavigateWorkspace, installWorkspaceHistoryGuard, registerWorkspaceHistoryGuard, WORKSPACE_NAVIGATION_REQUEST } from "@/lib/workspaceNavigationGuard";
afterEach(() => vi.unstubAllGlobals());
describe("programmatic workspace navigation", () => {
    it("honors a mounted draft guard before navigating and permits navigation after cleanup", () => {
        const target = new EventTarget(); vi.stubGlobal("window", target);
        const block = (event: Event) => event.preventDefault();
        target.addEventListener(WORKSPACE_NAVIGATION_REQUEST, block);
        expect(canNavigateWorkspace()).toBe(false);
        target.removeEventListener(WORKSPACE_NAVIGATION_REQUEST, block);
        expect(canNavigateWorkspace()).toBe(true);
    });
    it("supplies the requested continuation without running it before approval", () => {
        const target = new EventTarget(); vi.stubGlobal("window", target);
        const navigate = vi.fn();
        let resume: (() => void) | undefined;
        target.addEventListener(WORKSPACE_NAVIGATION_REQUEST, event => {
            event.preventDefault();
            resume = (event as CustomEvent<{ resume: () => void }>).detail.resume;
        });
        expect(canNavigateWorkspace(navigate)).toBe(false);
        expect(navigate).not.toHaveBeenCalled();
        resume?.();
        expect(navigate).toHaveBeenCalledOnce();
    });
    it("does not require a browser during server rendering", () => { expect(canNavigateWorkspace()).toBe(true); });
});


describe("root history guard ordering", () => {
    it("blocks router listeners before they can discard the current form, then unregisters cleanly", () => {
        const target = new EventTarget(); vi.stubGlobal("window", target);
        const releaseRoot = installWorkspaceHistoryGuard();
        const router = vi.fn();
        target.addEventListener("popstate", router);
        const releaseDraft = registerWorkspaceHistoryGuard(event => event.stopImmediatePropagation());
        target.dispatchEvent(new Event("popstate"));
        expect(router).not.toHaveBeenCalled();
        releaseDraft();
        target.dispatchEvent(new Event("popstate"));
        expect(router).toHaveBeenCalledOnce();
        releaseRoot();
    });
});
