import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import RouteLoading from "@/components/ui/RouteLoading";
import ErrorBoundary from "@/app/error";

const route = vi.hoisted(() => ({ pathname: "/branch/branch_1" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname }));

describe("selected application route boundaries", () => {
    it("uses the light workspace theme for migrated cold loading routes", () => {
        for (const pathname of ["/branch/branch_1", "/org", "/onboarding", "/invite/token_1"]) {
            route.pathname = pathname;
            expect(renderToStaticMarkup(<RouteLoading />)).toContain('data-app-design-pilot="workspace"');
        }
    });

    it("leaves excluded authentication and AI Messages loading unchanged", () => {
        for (const pathname of ["/sign-in", "/sign-up", "/branch/branch_1/ai/messages"]) {
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
