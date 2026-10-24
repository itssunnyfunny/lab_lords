import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import RouteLoading from "@/components/ui/RouteLoading";
import BranchPageLoading from "@/app/branch/[branchId]/loading";
import ErrorBoundary from "@/app/error";

const route = vi.hoisted(() => ({ pathname: "/branch/branch_1" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname }));

describe("selected application route boundaries", () => {
    it("uses the light workspace theme for migrated cold loading routes", () => {
        for (const pathname of ["/org", "/onboarding", "/invite/token_1"]) {
            route.pathname = pathname;
            expect(renderToStaticMarkup(<RouteLoading />)).toContain('data-app-design-pilot="workspace"');
        }
    });

    it("announces branch page loading in the selected theme below the workspace layout", () => {
        for (const pathname of ["/branch/branch_1", "/branch/branch_1/payments", "/branch/branch_1/ai/reports"]) {
            route.pathname = pathname;
            const markup = renderToStaticMarkup(<BranchPageLoading />);
            expect(markup).toContain('data-app-design-pilot="workspace"');
            expect(markup).toContain('role="status"');
            expect(markup).toContain('aria-live="polite"');
            expect(markup).toContain("Loading page");
            expect(markup).toContain('class="ui-route-loading"');
        }
    });

    it("leaves authentication loading unchanged", () => {
        for (const pathname of ["/sign-in", "/sign-up"]) {
            route.pathname = pathname;
            expect(renderToStaticMarkup(<RouteLoading />)).not.toContain("data-app-design-pilot");
        }
    });

    it("themes selected errors without exposing raw details, preserving the public fallback", () => {
        const error = new Error("Synthetic internal detail");
        route.pathname = "/org/org_1/settings";
        const selected = renderToStaticMarkup(<ErrorBoundary error={error} reset={() => undefined} />);
        expect(selected).toContain('data-app-design-pilot="workspace"');
        expect(selected).not.toContain(error.message);

        route.pathname = "/features";
        const publicError = renderToStaticMarkup(<ErrorBoundary error={error} reset={() => undefined} />);
        expect(publicError).not.toContain("data-app-design-pilot");
        expect(publicError).toContain(error.message);
    });
});
