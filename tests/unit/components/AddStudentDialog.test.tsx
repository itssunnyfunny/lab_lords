import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ComponentProps, ReactElement, ReactNode } from "react";
import { AddStudentDialog } from "@/app/branch/[branchId]/students/AddStudentDialog";
import { SeatPicker, type ShiftCapacity } from "@/components/allocations/SeatPicker";

const hooks = vi.hoisted(() => ({
    current: { cursor: 0, values: [] as unknown[], effects: [] as Array<() => void>, collectEffects: false },
}));
vi.mock("react", async original => ({
    ...await original<typeof import("react")>(),
    useState: (initial: unknown) => {
        const state = hooks.current;
        const index = state.cursor++;
        if (!(index in state.values)) state.values[index] = initial;
        return [state.values[index], (value: unknown) => {
            state.values[index] = typeof value === "function" ? value(state.values[index]) : value;
        }];
    },
    useEffect: (effect: () => void) => {
        if (hooks.current.collectEffects) hooks.current.effects.push(effect);
    },
}));
vi.mock("@/components/settings/LocalizedText", () => ({
    useTranslation: () => Object.assign((value: string) => value, { owned: (value: string) => value, error: (value: string) => value }),
    LocalizedError: () => null,
}));
vi.mock("@/components/ui/InlineFieldError", async original => ({
    ...await original<typeof import("@/components/ui/InlineFieldError")>(),
    useInlineFieldErrors: () => ({ markTouched: vi.fn(), markSubmitted: vi.fn(), resetFieldErrors: vi.fn(), visibleError: () => undefined }),
}));
vi.mock("@/lib/api/students", () => ({ students: { create: vi.fn() } }));

type Element = ReactElement<{ children?: ReactNode; type?: string; disabled?: boolean; onChange?: (event: { target: { checked: boolean } }) => void }>;
function elements(node: ReactNode): Element[] {
    if (!node || typeof node !== "object") return [];
    if (Array.isArray(node)) return node.flatMap(elements);
    const element = node as Element;
    return [element, ...elements(element.props?.children)];
}
const bundle = {
    type: "MULTISHIFT", shiftId: "full_day", componentShiftIds: ["morning", "evening"],
} as ShiftCapacity;
const morning = { type: "PRIMARY", shiftId: "morning" } as ShiftCapacity;

function admission() {
    const state = { cursor: 0, values: [] as unknown[], effects: [] as Array<() => void>, collectEffects: false };
    const render = () => {
        hooks.current = state;
        state.cursor = 0;
        return elements(AddStudentDialog({
            isOpen: true, branchId: "branch_1", onClose: vi.fn(), onSuccess: vi.fn(),
            allocationDecision: { allowed: true, blocker: null, reason: null, recoveryHref: null },
        }));
    };
    const checkbox = render().find(element => element.type === "input" && element.props.type === "checkbox");
    if (!checkbox?.props.onChange) throw new Error("Missing optional allocation control");
    checkbox.props.onChange({ target: { checked: true } });
    return () => {
        const picker = render().find(element => element.type === SeatPicker);
        if (!picker) throw new Error("Missing admission seat picker");
        return (picker as ReactElement<ComponentProps<typeof SeatPicker>>).props;
    };
}

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
    fetchMock = vi.fn(async (url: string) => ({ ok: true, json: async () => url.endsWith("/capacity") ? [] : {
        shiftId: "full_day", shiftName: "Full day", isReserved: false, totalSeats: 2,
        occupiedCount: 1, availableCount: 1,
        seats: [
            { seatId: "blocked", label: "A1", occupied: true, occupiedBy: "Existing student" },
            { seatId: "free", label: "A2", occupied: false, occupiedBy: null },
        ],
    } }));
    vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("admission bundle seat availability", () => {
    it("passes the selected bundle to the actual picker request and disables occupied seats", async () => {
        const selected = admission();
        selected().onToggleShift(bundle);
        const props = selected();
        expect(props.selectedShiftIds).toEqual(["morning", "evening"]);

        // Run the actual picker effects with its own hook state; all HTTP is
        // intercepted. The form and picker therefore share the real prop contract.
        const state = { cursor: 0, values: [] as unknown[], effects: [] as Array<() => void>, collectEffects: true };
        const renderPicker = () => {
            hooks.current = state;
            state.cursor = 0;
            return elements(SeatPicker(props));
        };
        renderPicker();
        state.collectEffects = false;
        state.effects.forEach(effect => effect());
        expect(fetchMock).toHaveBeenCalledWith("/api/branches/branch_1/shifts/morning/seat-map?multiShiftId=full_day");
        expect(props.selectedMultiShiftId).toBe("full_day");

        await vi.waitFor(() => {
            const seats = renderPicker().filter(element => element.type === "button");
            expect(seats).toHaveLength(2);
            expect(seats.map(seat => seat.props.disabled)).toEqual([true, false]);
        });
    });

    it("clears the selected seat and bundle context when the bundle is toggled off", () => {
        const selected = admission();
        selected().onToggleShift(bundle);
        selected().onSelectSeat("free");
        selected().onToggleShift(bundle);
        expect(selected()).toMatchObject({ selectedShiftIds: [], selectedMultiShiftId: null, selectedSeatId: null });
    });

    it("clears bundle context and the previous seat when switching to primary shifts", () => {
        const selected = admission();
        selected().onToggleShift(bundle);
        selected().onSelectSeat("free");
        selected().onToggleShift(morning);
        expect(selected()).toMatchObject({ selectedShiftIds: ["evening"], selectedMultiShiftId: null, selectedSeatId: null });
    });
});
