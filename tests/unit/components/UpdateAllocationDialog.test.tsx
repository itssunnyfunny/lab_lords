import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ComponentProps, ReactElement, ReactNode } from "react";
import { UpdateAllocationDialog } from "@/components/allocations/UpdateAllocationDialog";
import { SeatPicker, type ShiftCapacity } from "@/components/allocations/SeatPicker";
import { AllocationsTable } from "@/components/allocations/AllocationsTable";
import AllocationsPage from "@/app/branch/[branchId]/allocations/page";
import { STAFF_ACTIONS, type BranchAccess } from "@/types";

const mocks = vi.hoisted(() => ({
    cursor: 0, values: [] as unknown[], effects: [] as Array<() => void>,
    resetFieldErrors: vi.fn(), list: vi.fn(), replace: vi.fn(),
}));
// Exercise real component callbacks and effects while keeping React state across
// renders. This suite has no browser, database, or external HTTP dependency.
vi.mock("react", async original => ({
    ...await original<typeof import("react")>(),
    useState: (initial: unknown) => {
        const index = mocks.cursor++;
        if (!(index in mocks.values)) mocks.values[index] = typeof initial === "function" ? initial() : initial;
        return [mocks.values[index], (value: unknown) => {
            mocks.values[index] = typeof value === "function" ? value(mocks.values[index]) : value;
        }];
    },
    useRef: (initial: unknown) => {
        const index = mocks.cursor++;
        if (!(index in mocks.values)) mocks.values[index] = { current: initial };
        return mocks.values[index];
    },
    useEffect: (effect: () => void, dependencies: unknown[]) => {
        const index = mocks.cursor++;
        const previous = mocks.values[index] as unknown[] | undefined;
        if (!previous || dependencies.some((value, i) => value !== previous[i])) mocks.effects.push(effect);
        mocks.values[index] = dependencies;
    },
    useMemo: (factory: () => unknown) => factory(),
    useCallback: (callback: unknown, dependencies: unknown[]) => {
        const index = mocks.cursor++;
        const previous = mocks.values[index] as { dependencies: unknown[]; callback: unknown } | undefined;
        if (!previous || dependencies.some((value, i) => value !== previous.dependencies[i])) {
            mocks.values[index] = { dependencies, callback };
        }
        return (mocks.values[index] as { callback: unknown }).callback;
    },
}));
vi.mock("next/navigation", () => ({
    useParams: () => ({ branchId: "branch_1" }),
    useSearchParams: () => new URLSearchParams(),
    useRouter: () => ({ replace: mocks.replace }),
}));
vi.mock("@/components/settings/LocalizedText", () => ({
    useTranslation: () => Object.assign((value: string) => value, { owned: (value: string) => value, error: (value: string) => value }),
    LocalizedError: () => null,
}));
vi.mock("@/components/ui/InlineFieldError", async original => ({
    ...await original<typeof import("@/components/ui/InlineFieldError")>(),
    useInlineFieldErrors: () => ({ markTouched: vi.fn(), markSubmitted: vi.fn(), resetFieldErrors: mocks.resetFieldErrors, visibleError: () => undefined }),
}));
vi.mock("@/hooks/useDataViewMode", () => ({ useDataViewMode: () => ["table", vi.fn()] }));
vi.mock("@/lib/api/seats", () => ({ seats: { listAllocations: mocks.list } }));
vi.mock("@/lib/api/branches", () => ({ branches: { getShifts: async () => [], getMultiShifts: async () => [] } }));

type Element = ReactElement<{
    children?: ReactNode; footer?: ReactNode; id?: string; type?: string; role?: string;
    disabled?: boolean; variant?: string; onClick?: () => Promise<void> | void;
    onChange?: (event: { target: { value: string; checked: boolean } }) => void;
}>;
function elements(node: ReactNode): Element[] {
    if (!node || typeof node !== "object") return [];
    if (Array.isArray(node)) return node.flatMap(elements);
    const element = node as Element;
    return [element, ...elements(element.props?.children), ...elements(element.props?.footer)];
}
function text(node: ReactNode): string {
    if (typeof node === "string") return node;
    if (Array.isArray(node)) return node.map(text).join(" ");
    if (node && typeof node === "object" && "props" in node) return text((node as Element).props.children);
    return "";
}
function renderState<T>(component: () => T): T {
    mocks.cursor = 0;
    mocks.effects = [];
    const view = component();
    mocks.effects.forEach(effect => effect());
    return view;
}
function dialog(canManageStudentFees = true) {
    const onSuccess = vi.fn();
    const onClose = vi.fn();
    const props = {
        isOpen: true, branchId: "branch_1", allocationId: "old_1", allocationIds: ["old_1"],
        studentId: "student_1", studentName: "Student", currentSeatId: "seat_1", currentFee: 500,
        currentShiftIds: ["morning"], canManageStudentFees, onSuccess, onClose,
    };
    const render = () => elements(renderState(() => UpdateAllocationDialog(props)));
    const picker = () => render().find(element => element.type === SeatPicker) as ReactElement<ComponentProps<typeof SeatPicker>>;
    const confirm = () => render().find(element => element.props.variant === "primary")!;
    const input = () => render().find(element => element.props.id === "update-allocation-fee");
    const fee = (value: string) => input()!.props.onChange!({ target: { value, checked: false } });
    render();
    return { render, picker, confirm, input, fee, onSuccess, onClose, props };
}
const ok = () => new Response("{}", { status: 200 });
const forbidden = () => new Response(JSON.stringify({ error: "Permission denied" }), { status: 403 });
let request: ReturnType<typeof vi.fn>;
beforeEach(() => {
    vi.clearAllMocks();
    mocks.cursor = 0;
    mocks.values = [];
    mocks.effects = [];
    request = vi.fn();
    vi.stubGlobal("fetch", request);
});
afterEach(() => vi.unstubAllGlobals());

describe("allocation move partial success", () => {
    it("retains confirmed move success after a fee rejection and retries only the exact fee request", async () => {
        request.mockResolvedValueOnce(ok()).mockResolvedValueOnce(forbidden()).mockResolvedValueOnce(ok());
        const view = dialog();
        view.picker().props.onSelectSeat("seat_2");
        view.fee("650");
        await view.confirm().props.onClick!();

        expect(view.onSuccess).toHaveBeenCalledTimes(1);
        expect(view.onClose).not.toHaveBeenCalled();
        expect(view.render().some(element => element.props.role === "status" && text(element).includes("Seat and shifts updated."))).toBe(true);
        expect(view.picker()).toBeUndefined();
        expect(view.input()).toBeUndefined();
        expect(text(view.confirm())).toBe("Retry fee update");

        await view.confirm().props.onClick!();
        expect(request.mock.calls.map(([url]) => url)).toEqual([
            "/api/seat-allocations/old_1", "/api/branches/branch_1/students", "/api/branches/branch_1/students",
        ]);
        expect(JSON.parse(request.mock.calls[1][1].body)).toEqual({ id: "student_1", monthlyFee: 650, feeLinkedShiftId: null, feeLinkedMultiShiftId: null });
        expect(request.mock.calls[2][1].body).toBe(request.mock.calls[1][1].body);
        expect(view.onSuccess).toHaveBeenCalledTimes(2);
        expect(view.onClose).toHaveBeenCalledTimes(1);
    });

    it("does not claim the fee is unchanged when its response is lost; closing preserves the move and refreshes", async () => {
        request.mockResolvedValueOnce(ok()).mockRejectedValueOnce(new TypeError("Failed to fetch"));
        const view = dialog();
        view.picker().props.onSelectSeat("seat_2");
        view.fee("650");
        await view.confirm().props.onClick!();
        expect(text(view.render().find(element => element.props.role === "status"))).toContain("Seat and shifts updated.");
        expect(view.render().some(element => text(element).includes("The fee update could not be confirmed."))).toBe(true);
        expect(view.onSuccess).toHaveBeenCalledOnce();
        const close = view.render().find(element => element.props.variant === "ghost")!;
        expect(text(close)).toBe("Close");
        close.props.onClick!();
        expect(view.onClose).toHaveBeenCalledOnce();
        expect(request).toHaveBeenCalledTimes(2);
    });

    it.each([false, true])("preserves the original linked fee source on retry (bundle: %s)", async bundle => {
        request.mockResolvedValueOnce(ok()).mockResolvedValueOnce(forbidden()).mockResolvedValueOnce(ok());
        const view = dialog();
        if (bundle) view.picker().props.onToggleShift({
            type: "MULTISHIFT", shiftId: "full_day", name: "Full day", componentShiftIds: ["morning", "evening"],
        } as ShiftCapacity);
        view.picker().props.onSelectSeat("seat_2");
        view.render().find(element => element.props.type === "checkbox")!.props.onChange!({ target: { checked: true, value: "" } });
        await view.confirm().props.onClick!();
        // Parent rerenders with a new array must not reset completed progress.
        view.props.currentShiftIds = ["morning"];
        await view.confirm().props.onClick!();
        expect(request.mock.calls.map(([url]) => url)).toEqual([
            "/api/seat-allocations/old_1", "/api/branches/branch_1/students", "/api/branches/branch_1/students",
        ]);
        expect(JSON.parse(request.mock.calls[2][1].body)).toEqual({
            id: "student_1", feeLinkedShiftId: bundle ? null : "morning", feeLinkedMultiShiftId: bundle ? "full_day" : null,
        });
        expect(request.mock.calls[2][1].body).toBe(request.mock.calls[1][1].body);
    });

    it("keeps recovery available after repeated fee failures including a non-JSON error response", async () => {
        request.mockResolvedValueOnce(ok()).mockResolvedValueOnce(new Response("Unavailable", { status: 503 }))
            .mockResolvedValueOnce(forbidden()).mockResolvedValueOnce(ok());
        const view = dialog();
        view.picker().props.onSelectSeat("seat_2");
        view.fee("0");
        await view.confirm().props.onClick!();
        await view.confirm().props.onClick!();
        expect(view.onClose).not.toHaveBeenCalled();
        expect(text(view.confirm())).toBe("Retry fee update");
        await view.confirm().props.onClick!();
        expect(request.mock.calls.filter(([url]) => url.includes("/seat-allocations/"))).toHaveLength(1);
        expect(JSON.parse(request.mock.calls[3][1].body).monthlyFee).toBe(0);
        expect(view.onSuccess).toHaveBeenCalledTimes(3);
        expect(view.onClose).toHaveBeenCalledOnce();
    });

    it("keeps the move editable and never patches fees when the move is rejected", async () => {
        request.mockResolvedValueOnce(forbidden()).mockResolvedValueOnce(ok()).mockResolvedValueOnce(ok());
        const view = dialog();
        view.picker().props.onSelectSeat("seat_2");
        view.fee("650");
        await view.confirm().props.onClick!();
        expect(view.picker()).toBeDefined();
        expect(view.onSuccess).not.toHaveBeenCalled();
        expect(request).toHaveBeenCalledTimes(1);
        view.picker().props.onSelectSeat("seat_3");
        await view.confirm().props.onClick!();
        expect(JSON.parse(request.mock.calls[1][1].body).seatId).toBe("seat_3");
        expect(view.onClose).toHaveBeenCalledOnce();
    });

    it("moves without requesting a fee update when none was selected", async () => {
        request.mockResolvedValueOnce(ok());
        const view = dialog();
        view.picker().props.onSelectSeat("seat_2");
        await view.confirm().props.onClick!();
        expect(request).toHaveBeenCalledOnce();
        expect(view.onSuccess).toHaveBeenCalledOnce();
        expect(view.onClose).toHaveBeenCalledOnce();
    });

    it("hides optional student fee controls from an allocation-only operator", async () => {
        request.mockResolvedValueOnce(ok());
        const view = dialog(false);
        expect(view.input()).toBeUndefined();
        view.picker().props.onSelectSeat("seat_2");
        await view.confirm().props.onClick!();
        expect(request).toHaveBeenCalledOnce();
        expect(view.onClose).toHaveBeenCalledOnce();
    });

    it("blocks repeated confirmation while a move is in flight and while its fee request is pending", async () => {
        let resolveMove!: (response: Response) => void;
        let resolveFee!: (response: Response) => void;
        request.mockReturnValueOnce(new Promise<Response>(resolve => { resolveMove = resolve; }))
            .mockReturnValueOnce(new Promise<Response>(resolve => { resolveFee = resolve; }));
        const view = dialog();
        view.picker().props.onSelectSeat("seat_2");
        view.fee("650");
        const initial = view.confirm().props.onClick!;
        const pending = initial();
        void initial();
        expect(request).toHaveBeenCalledTimes(1);
        resolveMove(ok());
        await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(2));
        expect(view.confirm().props.disabled).toBe(true);
        void view.confirm().props.onClick!();
        expect(request).toHaveBeenCalledTimes(2);
        resolveFee(forbidden());
        await pending;
        expect(view.onClose).not.toHaveBeenCalled();
    });
});

describe("allocation page recovery lifetime", () => {
    async function page(studentPermission = true) {
        const access: BranchAccess = {
            branchId: "branch_1", branchName: "Branch", organizationId: "org_1", isOwner: false,
            role: "STAFF", effectivePlan: "BASIC", entitlements: [],
            permissions: Object.fromEntries(STAFF_ACTIONS.map(action => [action, action === "seat_allocation" || (studentPermission && action === "students")])) as BranchAccess["permissions"],
        };
        const guard = AllocationsPage() as ReactElement<{ children: (access: BranchAccess) => ReactElement<{ children: ReactElement }> }>;
        const content = guard.props.children(access).props.children as ReactElement<Record<string, unknown>>;
        const render = () => elements(renderState(() => (content.type as (props: Record<string, unknown>) => ReactNode)(content.props)));
        const row = { id: "old_1", studentId: "student_1", student: { name: "Student", status: "ACTIVE" }, seat: { id: "seat_1", label: "A1" }, shiftId: "morning", shift: { name: "Morning", isReserved: false }, startDate: "2026-09-29", endDate: null, multiShiftId: null };
        mocks.list.mockImplementation(async (_branch: string, query: { status: string }) => ({ items: query.status === "ACTIVE" ? [row] : [], total: 1, nextCursor: null }));
        render();
        await vi.waitFor(() => expect(render().some(element => element.type === AllocationsTable)).toBe(true));
        const table = render().find(element => element.type === AllocationsTable) as ReactElement<ComponentProps<typeof AllocationsTable>>;
        table.props.onUpdateAllocation!(["old_1"], "student_1", "Student", "seat_1", 500, ["morning"], null);
        const update = () => render().find(element => element.type === UpdateAllocationDialog) as ReactElement<ComponentProps<typeof UpdateAllocationDialog>> | undefined;
        return { update, render };
    }

    it("retains the same recovery dialog during and after a failed reload, then exposes reload recovery on close", async () => {
        const view = await page();
        expect(view.update()).toBeDefined();
        const initialKey = view.update()!.key;
        mocks.list.mockRejectedValue(new Error("Reload unavailable"));
        const reload = view.update()!.props.onSuccess();
        expect(view.update()).toBeDefined();
        await reload;
        expect(mocks.list).toHaveBeenCalledTimes(4);
        expect(view.update()!.key).toBe(initialKey);
        view.update()!.props.onClose();
        expect(view.update()).toBeUndefined();
        expect(view.render().some(element => text(element).includes("Allocations did not load"))).toBe(true);
    });

    it("passes the independent student capability to the move dialog", async () => {
        const view = await page(false);
        expect(view.update()!.props.canManageStudentFees).toBe(false);
    });

    it("reloads replacement rows without closing the recovery dialog", async () => {
        const view = await page();
        const replacement = { id: "new_1", endDate: null };
        mocks.list.mockImplementation(async (_branch: string, query: { status: string }) => ({
            items: query.status === "ACTIVE" ? [replacement] : [], total: 1, nextCursor: null,
        }));
        const initialKey = view.update()!.key;
        await view.update()!.props.onSuccess();
        expect(view.update()!.key).toBe(initialKey);
        const table = view.render().find(element => element.type === AllocationsTable) as ReactElement<ComponentProps<typeof AllocationsTable>>;
        expect(table.props.allocations).toEqual([replacement]);
    });
});
