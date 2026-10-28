import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BranchWorkspaceControls } from "@/components/layout/WorkspaceSwitcher";
import type { WorkspaceDirectory, WorkspaceDirectoryBranch } from "@/types";

function branch(overrides: Partial<WorkspaceDirectoryBranch> = {}): WorkspaceDirectoryBranch {
    return { id: "branch_1", name: "Central Branch", organizationId: "org_1", organizationName: "North Star Labs", role: "MANAGER", permissions: { students: true, view_payments: true }, entitlements: [], href: "/branch/branch_1", ...overrides };
}

const render = (directory: WorkspaceDirectory | null, pathname = "/branch/branch_1/tasks", error = false) => renderToStaticMarkup(
    <BranchWorkspaceControls directory={directory} pathname={pathname} error={error} onNavigate={() => undefined} />
);

describe("single organization workspace header", () => {
    it("shows the current organization once and limits switching to its branches", () => {
        const markup = render({ organizations: [], staffBranches: [branch(), branch({ id: "branch_2", name: "Second Branch", href: "/branch/branch_2" }), branch({ id: "branch_3", name: "Other Branch", organizationId: "org_2", organizationName: "Other organization", href: "/branch/branch_3" })], defaultHref: "/branch/branch_1" });
        expect(markup).toContain('aria-label="Current organization"');
        expect(markup).not.toContain('aria-label="Switch organization"');
        expect(markup).toContain('aria-label="Switch branch"');
        expect(markup).toContain('value="branch_2"');
        expect(markup).not.toContain('value="branch_3"');
        expect(markup).not.toContain("Other organization");
        expect(markup).not.toContain("Account settings");
        expect(markup.match(/<select /g)).toHaveLength(1);
    });

    it("keeps authorized branches reachable from organization pages", () => {
        const directory: WorkspaceDirectory = { organizations: [{ id: "org_1", name: "North Star Labs", role: "OWNER", href: "/org/org_1", branches: [branch({ role: "OWNER" })] }], staffBranches: [], defaultHref: "/account" };
        for (const path of ["/org/org_1", "/org/org_1/settings"]) {
            const markup = render(directory, path);
            expect(markup).toContain("North Star Labs");
            expect(markup).toContain("Central Branch");
            expect(markup).not.toContain('value="/account"');
            expect(markup).not.toContain('value="/org/org_1"');
        }
    });

    it("keeps loading, unavailable and empty directories disabled", () => {
        expect(render(null)).toContain("Loading workspaces");
        expect(render(null, "/app", true)).toContain("Workspaces unavailable");
        expect(render({ organizations: [], staffBranches: [], defaultHref: "/account" })).toContain("No workspaces available");
        for (const markup of [render(null), render(null, "/app", true), render({ organizations: [], staffBranches: [], defaultHref: "/account" })]) {
            expect(markup).toContain('disabled=""');
        }
    });
});
