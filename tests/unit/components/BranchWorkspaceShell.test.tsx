import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BranchWorkspaceShell } from "@/components/layout/BranchWorkspaceShell";

const auth = vi.hoisted(() => ({ isLoaded: false }));
const reads = vi.hoisted(() => ({ billing: vi.fn(), activation: vi.fn() }));
vi.mock("@clerk/nextjs", () => ({ useUser: () => auth }));
vi.mock("next/navigation", () => ({ usePathname: () => "/branch/example/tasks" }));
vi.mock("@/components/settings/LocalizedText", () => ({ useTranslation: () => (key: string) => key }));
vi.mock("@/components/layout/AppShell", () => ({ AppShell: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock("@/components/layout/BranchSidebar", () => ({ BranchSidebar: () => null }));
vi.mock("@/components/billing/BillingExperienceProvider", () => ({
    BillingExperienceProvider: ({ children }: { children: ReactNode }) => { reads.billing(); return <>{children}</>; },
}));
vi.mock("@/components/billing/BranchActivationGate", () => ({
    BranchActivationGate: ({ children }: { children: ReactNode }) => { reads.activation(); return <>{children}</>; },
}));

describe("branch workspace identity readiness", () => {
    beforeEach(() => { auth.isLoaded = false; vi.clearAllMocks(); });

    it("withholds mutable forms and branch reads until the initial client identity resolves", () => {
        const markup = renderToStaticMarkup(<BranchWorkspaceShell branchId="example"><button>Add task</button></BranchWorkspaceShell>);
        expect(markup).toContain('role="status"');
        expect(markup).toContain('aria-busy="true"');
        expect(markup).toContain("Loading workspaces");
        expect(markup).not.toContain("Add task");
        expect(reads.billing).not.toHaveBeenCalled();
        expect(reads.activation).not.toHaveBeenCalled();
    });

    it("mounts the ordinary billing and activation boundaries after authentication hydration", () => {
        auth.isLoaded = true;
        const markup = renderToStaticMarkup(<BranchWorkspaceShell branchId="example"><button>Add task</button></BranchWorkspaceShell>);
        expect(markup).toContain("Add task");
        expect(markup).not.toContain('aria-busy="true"');
        expect(reads.billing).toHaveBeenCalledOnce();
        expect(reads.activation).toHaveBeenCalledOnce();
    });
});
