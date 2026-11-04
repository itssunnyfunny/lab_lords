import { afterEach, describe, expect, it, vi } from "vitest";
import { canNavigateWorkspace, WORKSPACE_NAVIGATION_REQUEST } from "@/lib/workspaceNavigationGuard";
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
    it("does not require a browser during server rendering", () => { expect(canNavigateWorkspace()).toBe(true); });
});
