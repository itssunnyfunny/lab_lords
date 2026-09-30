import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement, ReactNode } from "react";
import type { Student } from "@/app/generated/prisma/browser";
import { EditStudentDialog } from "@/app/branch/[branchId]/students/EditStudentDialog";

// Exercise the actual dialog's input/save callbacks without a DOM, database,
// authentication provider, or network. Shared presentation hooks are outside
// this test's profile-update boundary.
const hooks = vi.hoisted(() => ({
    cursor: 0,
    values: [] as unknown[],
    collectEffects: false,
    effects: [] as Array<() => void>,
}));
vi.mock("react", async original => ({
    ...await original<typeof import("react")>(),
    useState: (initial: unknown) => {
        const index = hooks.cursor++;
        if (!(index in hooks.values)) hooks.values[index] = initial;
        return [hooks.values[index], (value: unknown) => {
            hooks.values[index] = typeof value === "function" ? value(hooks.values[index]) : value;
        }];
    },
    useEffect: (effect: () => void) => {
        if (hooks.collectEffects) hooks.effects.push(effect);
    },
}));
vi.mock("@/components/settings/LocalizedText", () => ({
    useTranslation: () => Object.assign((value: string) => value, {
        owned: (value: string) => value,
        error: (value: string) => value,
    }),
    LocalizedError: () => null,
}));
vi.mock("@/components/ui/InlineFieldError", async original => ({
    ...await original<typeof import("@/components/ui/InlineFieldError")>(),
    useInlineFieldErrors: () => ({
        markTouched: vi.fn(), markSubmitted: vi.fn(), resetFieldErrors: vi.fn(),
        visibleError: (field: string, errors: Record<string, string>) => errors[field],
    }),
}));

type Control = ReactElement<{
    id?: string;
    children?: ReactNode;
    disabled?: boolean;
    onChange?: (event: { target: { value: string } }) => void;
    onClick?: () => Promise<void>;
    "aria-invalid"?: boolean;
}>;
function controls(node: ReactNode): Control[] {
    if (!node || typeof node !== "object") return [];
    if (Array.isArray(node)) return node.flatMap(controls);
    const element = node as Control;
    return [element, ...controls(element.props?.children)];
}

function mount(phone: string | null = null) {
    const student = {
        id: "student_1", branchId: "branch_1", name: "Imported student", phone,
        monthlyFee: 1000, feeLinkedShiftId: null, feeLinkedMultiShiftId: null,
    } as Student;
    const onSuccess = vi.fn();
    const onClose = vi.fn();
    const render = () => {
        hooks.cursor = 0;
        const view = EditStudentDialog({ isOpen: true, student, branchId: student.branchId, onClose, onSuccess });
        if (!view) throw new Error("Expected the student edit dialog");
        return view;
    };
    hooks.collectEffects = true;
    render();
    hooks.collectEffects = false;
    hooks.effects.forEach(effect => effect());
    const input = (id: string) => {
        const control = controls(render().props.children).find(item => item.props.id === id);
        if (!control?.props.onChange) throw new Error(`Missing input ${id}`);
        return control;
    };
    const saveButton = () => {
        const control = controls(render().props.footer).find(item => item.props.children === "Save Changes");
        if (!control?.props.onClick) throw new Error("Missing save control");
        return control;
    };
    return {
        student, onSuccess, onClose, input, saveButton,
        change: (id: string, value: string) => input(id).props.onChange!({ target: { value } }),
        save: () => saveButton().props.onClick!(),
    };
}

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
    hooks.cursor = 0;
    hooks.values = [];
    hooks.effects = [];
    hooks.collectEffects = false;
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("student profile edits preserve an unchanged phone", () => {
    it("saves an imported student's name without supplying a phone", async () => {
        const dialog = mount();
        const updated = { ...dialog.student, name: "Corrected student" };
        fetchMock.mockResolvedValue(new Response(JSON.stringify(updated)));
        dialog.change("edit-student-name", updated.name);

        await dialog.save();

        expect(fetchMock).toHaveBeenCalledExactlyOnceWith("/api/branches/branch_1/students", {
            method: "PATCH", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: "student_1", name: updated.name }),
        });
        expect(dialog.onSuccess).toHaveBeenCalledWith(expect.objectContaining({ name: updated.name, phone: null }));
        expect(dialog.onClose).toHaveBeenCalledOnce();
    });

    it("allows a fee-only edit while retaining an imported null phone", async () => {
        const dialog = mount();
        fetchMock.mockResolvedValue(new Response(JSON.stringify({ ...dialog.student, monthlyFee: 1500 })));
        dialog.change("edit-student-monthly-fee", "1500");
        await dialog.save();
        expect(fetchMock).toHaveBeenCalledOnce();
        expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
            id: "student_1", name: dialog.student.name, monthlyFee: 1500,
        });
    });

    it("omits an unchanged existing phone from a name correction", async () => {
        const dialog = mount("+91 98765 43210");
        fetchMock.mockResolvedValue(new Response(JSON.stringify({ ...dialog.student, name: "Corrected student" })));
        dialog.change("edit-student-name", "Corrected student");
        await dialog.save();
        expect(fetchMock).toHaveBeenCalledOnce();
        expect(JSON.parse(fetchMock.mock.calls[0][1].body)).not.toHaveProperty("phone");
    });

    it("normalizes and sends a deliberately added phone", async () => {
        const dialog = mount();
        const updated = { ...dialog.student, phone: "+91 98765 43210" };
        fetchMock.mockResolvedValue(new Response(JSON.stringify(updated)));
        dialog.change("edit-student-phone", "9876543210");
        await dialog.save();
        expect(fetchMock).toHaveBeenCalledOnce();
        expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
            id: "student_1", name: dialog.student.name, phone: updated.phone,
        });
        expect(dialog.onSuccess).toHaveBeenCalledWith(updated);
    });

    it.each(["", "phone!"])("rejects a changed existing phone of %j without submitting", async phone => {
        const dialog = mount("+91 98765 43210");
        dialog.change("edit-student-phone", phone);
        await dialog.save();
        expect(dialog.input("edit-student-phone").props["aria-invalid"]).toBe(true);
        expect(fetchMock).not.toHaveBeenCalled();
        expect(dialog.onSuccess).not.toHaveBeenCalled();
        expect(dialog.onClose).not.toHaveBeenCalled();
    });

    it("does not enable save for an unchanged null-phone profile", () => {
        expect(mount().saveButton().props.disabled).toBe(true);
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
