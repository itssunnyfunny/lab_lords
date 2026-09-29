import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement, ReactNode } from "react";
import { DashboardSettingsContent } from "@/components/dashboard-features/DashboardSettingsContent";
import { STAFF_ACTIONS, type BranchAccess, type StaffAction } from "@/types";

const mocks = vi.hoisted(() => ({
    query: "", replace: vi.fn(), request: vi.fn(),
    cursor: 0, state: [] as unknown[],
}));
vi.mock("next/navigation", () => ({
    useSearchParams: () => new URLSearchParams(mocks.query),
    useRouter: () => ({ replace: mocks.replace }),
}));
// Preserve state across direct component renders, so a mount-only query read
// cannot pass the same-route navigation regression. No DOM or I/O is used.
vi.mock("react", async original => ({
    ...await original<typeof import("react")>(),
    useState: (initial: unknown) => {
        const index = mocks.cursor++;
        if (!(index in mocks.state)) mocks.state[index] = initial;
        return [mocks.state[index], (value: unknown) => { mocks.state[index] = value; }];
    },
}));
vi.mock("@/components/settings/LocalizedText", () => ({
    useTranslation: () => Object.assign((value: string) => value, {
        owned: (value: string) => value, error: (value: string) => value,
    }),
}));
vi.mock("@/components/dashboard-features/shared", () => ({
    useDashboardResource: () => ({ data: null, loading: false, error: null, reload: vi.fn() }),
    dashboardRequest: mocks.request, inputClass: "", ResourceError: () => null,
}));

type Element = ReactElement<{
    children?: ReactNode;
    onClick?: () => void;
    "aria-pressed"?: boolean;
    writable?: boolean;
}>;
function elements(node: ReactNode): Element[] {
    if (!node || typeof node !== "object") return [];
    if (Array.isArray(node)) return node.flatMap(elements);
    const element = node as Element;
    return [element, ...elements(element.props?.children)];
}
function access(allowed: StaffAction[]): BranchAccess {
    return {
        branchId: "branch_1", branchName: "Branch", organizationId: "org_1",
        isOwner: false, role: "STAFF", effectivePlan: "BASIC", entitlements: [],
        permissions: Object.fromEntries(STAFF_ACTIONS.map(action => [action, allowed.includes(action)])) as BranchAccess["permissions"],
    };
}
function render(allowed: StaffAction[] = ["students", "seat_allocation", "manage_branch"]) {
    mocks.cursor = 0;
    return elements(DashboardSettingsContent({ branchId: "branch_1", access: access(allowed) }));
}
function tab(view: Element[], label: string) {
    const control = view.find(element => element.props.children === label && element.props["aria-pressed"] !== undefined);
    if (!control) throw new Error(`Missing setup tab: ${label}`);
    return control;
}
function terms(view: Element[]) {
    return view.find(element => typeof element.type === "function" && element.type.name === "Terms");
}

beforeEach(() => {
    vi.clearAllMocks();
    mocks.query = "";
    mocks.cursor = 0;
    mocks.state = [];
    mocks.replace.mockImplementation((url: string) => { mocks.query = url.split("?")[1] ?? ""; });
});

describe("dashboard setup destination navigation", () => {
    it("opens membership terms when a notification changes the query on the mounted setup route", () => {
        mocks.query = "section=utilization";
        expect(tab(render(), "Utilization review").props["aria-pressed"]).toBe(true);

        mocks.query = "section=terms";
        const view = render();
        expect(tab(view, "Membership terms").props["aria-pressed"]).toBe(true);
        expect(tab(view, "Utilization review").props["aria-pressed"]).toBe(false);
        expect(terms(view)).toBeDefined();
        expect(mocks.request).not.toHaveBeenCalled();
    });

    it("keeps tab selection in the URL while preserving the focused student", () => {
        mocks.query = "section=terms&studentId=student_1";
        tab(render(), "Utilization review").props.onClick!();
        expect(mocks.replace).toHaveBeenCalledWith(
            "/branch/branch_1/dashboard-settings?section=utilization&studentId=student_1", { scroll: false }
        );
        expect(tab(render(), "Utilization review").props["aria-pressed"]).toBe(true);

        mocks.query = "section=terms&studentId=student_1";
        expect(tab(render(), "Membership terms").props["aria-pressed"]).toBe(true);
        expect(mocks.request).not.toHaveBeenCalled();
    });

    it("opens terms for a student reader without granting management controls", () => {
        mocks.query = "section=terms";
        const view = render(["students"]);
        expect(tab(view, "Membership terms").props["aria-pressed"]).toBe(true);
        expect(terms(view)?.props.writable).toBe(false);
        expect(view.some(element => element.props.children === "Utilization review")).toBe(false);
    });

    it("does not activate a forbidden terms destination for a seats-only reader", () => {
        mocks.query = "section=terms";
        const view = render(["seat_allocation"]);
        expect(terms(view)).toBeUndefined();
        expect(tab(view, "Utilization review").props["aria-pressed"]).toBe(true);
    });

    it.each(["", "section=unknown"])("selects an available default tab for a student-only reader at %j", query => {
        mocks.query = query;
        expect(tab(render(["students"]), "Attendance expectations").props["aria-pressed"]).toBe(true);
    });
});
