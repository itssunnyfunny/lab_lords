import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement, ReactNode } from "react";

// Exercise the actual dialog's hooks and callbacks without a DOM or network.
const hooks = vi.hoisted(() => ({
    cursor: 0, values: [] as unknown[], dirty: false,
    effects: [] as Array<() => void>, cleanups: new Map<number, () => void>(),
}));
const mocks = vi.hoisted(() => ({
    fetch: vi.fn(), close: vi.fn(), success: vi.fn(),
    fields: { markTouched: vi.fn(), markSubmitted: vi.fn(), resetFieldErrors: vi.fn(), visibleError: vi.fn() },
}));
vi.mock("react", async original => ({
    ...await original<typeof import("react")>(),
    useState: (initial: unknown) => {
        const index = hooks.cursor++;
        if (!(index in hooks.values)) hooks.values[index] = typeof initial === "function" ? initial() : initial;
        return [hooks.values[index], (value: unknown) => {
            const next = typeof value === "function" ? value(hooks.values[index]) : value;
            if (!Object.is(next, hooks.values[index])) { hooks.values[index] = next; hooks.dirty = true; }
        }];
    },
    useEffect: (effect: () => void | (() => void), deps: unknown[]) => {
        const index = hooks.cursor++;
        const previous = hooks.values[index] as unknown[] | undefined;
        hooks.values[index] = deps;
        if (previous?.length === deps.length && previous.every((value, i) => Object.is(value, deps[i]))) return;
        hooks.effects.push(() => {
            hooks.cleanups.get(index)?.();
            const cleanup = effect();
            if (cleanup) hooks.cleanups.set(index, cleanup); else hooks.cleanups.delete(index);
        });
    },
}));
vi.mock("@/components/settings/LocalizedText", () => ({
    useTranslation: () => (text: string) => text, LocalizedError: "localized-error",
}));
vi.mock("@/components/ui/InlineFieldError", () => ({
    useInlineFieldErrors: () => mocks.fields, FieldError: "field-error",
}));
vi.mock("@/components/allocations/SeatPicker", () => ({ SeatPicker: "seat-picker" }));

import { AllocateSeatDialog } from "@/components/allocations/AllocateSeatDialog";

type Node = ReactElement<{
    children?: ReactNode; footer?: ReactNode; type?: string; id?: string;
    "aria-pressed"?: boolean; onClick?: () => void | Promise<void>;
    onChange?: (event: { target: { checked: boolean } }) => void;
}>;
function nodes(value: ReactNode): Node[] {
    if (!value || typeof value !== "object") return [];
    if (Array.isArray(value)) return value.flatMap(nodes);
    const element = value as Node;
    return element.props ? [element, ...nodes(element.props.children), ...nodes(element.props.footer)] : [];
}
function mount(preselectedStudentId?: string) {
    const props = {
        isOpen: true, branchId: "branch", preselectedStudentId,
        preselectedSeatId: "seat", preselectedShiftIds: ["shift"], preselectedShiftNames: ["Morning"],
        onClose: mocks.close, onSuccess: mocks.success,
    };
    const render = () => {
        for (let tries = 0; tries < 10; tries++) {
            hooks.cursor = 0; hooks.dirty = false;
            const view = AllocateSeatDialog(props);
            hooks.effects.splice(0).forEach(effect => effect());
            if (!hooks.dirty) return nodes(view);
        }
        throw new Error("Unstable dialog render");
    };
    render();
    return {
        render,
        choose: () => { render().find(node => node.props["aria-pressed"] !== undefined)!.props.onClick!(); },
        checkbox: () => render().find(node => node.props.type === "checkbox"),
        confirm: async () => { await render().find(node => node.props.children === "Confirm")!.props.onClick!(); },
    };
}
async function flush() { for (let i = 0; i < 10; i++) await Promise.resolve(); }
function options(canLinkFee: boolean) {
    mocks.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ items: [{ id: "student", name: "Asha" }], canLinkFee }) });
}
beforeEach(() => {
    vi.resetAllMocks();
    hooks.cursor = 0; hooks.values = []; hooks.dirty = false; hooks.effects = []; hooks.cleanups.clear();
    vi.stubGlobal("fetch", mocks.fetch);
});
afterEach(() => {
    hooks.cleanups.forEach(cleanup => cleanup()); hooks.cleanups.clear(); vi.unstubAllGlobals();
});

describe("allocation student selector", () => {
    it("loads minimal allocation options and lets allocation-only staff submit without a student PATCH", async () => {
        options(false);
        const dialog = mount(); await flush();
        expect(mocks.fetch).toHaveBeenCalledWith("/api/branches/branch/seat-allocations/students");
        dialog.choose();
        expect(dialog.checkbox()).toBeUndefined();
        mocks.fetch.mockResolvedValueOnce({ ok: true });
        await dialog.confirm();
        expect(mocks.fetch).toHaveBeenCalledTimes(2);
        expect(mocks.fetch.mock.calls[1]).toEqual(["/api/branches/branch/seat-allocations", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ studentId: "student", seatId: "seat", shiftIds: ["shift"] }),
        }]);
        expect(mocks.success).toHaveBeenCalledOnce(); expect(mocks.close).toHaveBeenCalledOnce();
    });

    it("keeps the optional fee link for staff with student permission", async () => {
        options(true);
        const dialog = mount("student"); await flush();
        dialog.checkbox()!.props.onChange!({ target: { checked: true } });
        mocks.fetch.mockResolvedValue({ ok: true });
        await dialog.confirm();
        expect(mocks.fetch.mock.calls[2]).toEqual(["/api/branches/branch/students", {
            method: "PATCH", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: "student", feeLinkedShiftId: "shift", feeLinkedMultiShiftId: null }),
        }]);
    });

    it("does not expose fee linking before the selector has resolved", () => {
        mocks.fetch.mockReturnValue(new Promise(() => {}));
        const dialog = mount("student");
        expect(dialog.checkbox()).toBeUndefined();
    });
});
