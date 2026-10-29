import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BranchWorkspaceShell } from "@/components/layout/BranchWorkspaceShell";
import { OrganizationWorkspaceShell } from "@/components/layout/OrganizationWorkspaceShell";

const auth = vi.hoisted(() => ({ isLoaded: false }));
const reads = vi.hoisted(() => ({ billing: vi.fn(), activation: vi.fn() }));
vi.mock("@clerk/nextjs", () => ({ useUser: () => auth }));
vi.mock("next/navigation", () => ({ usePathname: () => "/branch/example/tasks" }));
vi.mock("@/components/settings/LocalizedText", () => ({ useTranslation: () => Object.assign((key: string) => key, {owned:(key:string)=>key}) }));
vi.mock("@/components/layout/AppShell", () => ({ AppShell: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock("@/components/layout/BranchSidebar", () => ({ BranchSidebar: () => null }));
vi.mock("@/components/layout/OrgSidebar", () => ({ OrgSidebar: () => null }));
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
        expect(markup).toContain('data-app-design-pilot="workspace"');
        expect(markup).toContain("Loading workspaces");
        expect(markup).not.toContain("Add task");
        expect(reads.billing).not.toHaveBeenCalled();
        expect(reads.activation).not.toHaveBeenCalled();
    });

    it("withholds route forms until the server access snapshot arrives after hydration", () => {
        auth.isLoaded = true;
        const markup = renderToStaticMarkup(<BranchWorkspaceShell branchId="example"><button>Add task</button></BranchWorkspaceShell>);
        expect(markup).not.toContain("Add task");
        expect(markup).toContain("Loading workspace");
        expect(markup).not.toContain('aria-busy="true"');
        expect(reads.billing).toHaveBeenCalledOnce();
        expect(reads.activation).not.toHaveBeenCalled();
    });
});

describe("organization workspace identity readiness", () => {
    beforeEach(() => { auth.isLoaded = false; vi.clearAllMocks(); });

    it("withholds billing forms and reads while the initial identity is unresolved", () => {
        const markup = renderToStaticMarkup(<OrganizationWorkspaceShell organizationId="example"><button>Authorize plan</button></OrganizationWorkspaceShell>);
        expect(markup).toContain('aria-busy="true"');
        expect(markup).not.toContain("Authorize plan");
        expect(markup).toContain('data-app-design-pilot="workspace"');
        expect(reads.billing).not.toHaveBeenCalled();
    });

    it("mounts the organization workflow after identity resolution", () => {
        auth.isLoaded = true;
        const markup = renderToStaticMarkup(<OrganizationWorkspaceShell organizationId="example"><button>Authorize plan</button></OrganizationWorkspaceShell>);
        expect(markup).toContain("Authorize plan");
        expect(reads.billing).toHaveBeenCalledOnce();
    });
});
