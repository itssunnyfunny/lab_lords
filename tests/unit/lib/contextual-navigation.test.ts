import { describe, expect, it } from "vitest";
import { resolveContextualParent, workspaceReturnPath } from "@/lib/contextualNavigation";

describe("resolveContextualParent", () => {
    it("returns no back destination for workspace roots", () => {
        expect(resolveContextualParent("/app")).toBeNull();
        expect(resolveContextualParent("/branch/branch_1")).toBeNull();
        expect(resolveContextualParent("/org/org_1")).toBeNull();
    });

    it("routes branch child pages to their dashboard", () => {
        expect(resolveContextualParent("/branch/branch_1/payments")).toEqual({
            href: "/branch/branch_1",
            label: "Back to branch dashboard",
        });
    });

    it("routes nested imports to import history", () => {
        expect(resolveContextualParent("/branch/branch%201/onboarding/import/session_1")).toEqual({
            href: "/branch/branch%201/onboarding/import",
            label: "Back to import history",
        });
    });

    it("routes organization children and billing processing safely", () => {
        expect(resolveContextualParent("/org/org_1/settings")?.href).toBe("/org/org_1");
        expect(resolveContextualParent("/org/org_1/billing/processing/change_1")).toEqual({
            href: "/org/org_1/billing",
            label: "Back to billing settings",
        });
    });

    it("does not route Account through the legacy organization chooser", () => {
        expect(resolveContextualParent("/account")).toBeNull();
    });

    it("accepts only internal workspace return paths", () => {
        expect(workspaceReturnPath("/branch/branch_1/payments")).toBe("/branch/branch_1/payments");
        expect(workspaceReturnPath("/org/org_1/settings")).toBe("/org/org_1/settings");
        for (const value of [null, "/app", "/org", "//evil.test/org/1", "https://evil.test", "/branch/x\\evil", "/branch/x?redirect=https://evil.test", "/branch/../account"]) {
            expect(workspaceReturnPath(value)).toBeNull();
        }
    });
});
