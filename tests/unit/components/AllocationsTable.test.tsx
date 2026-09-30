import type { ComponentProps, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AllocationsTable } from "@/components/allocations/AllocationsTable";

const actions = vi.hoisted(() => [] as Array<{ children?: ReactNode; onClick?: () => void }>);
vi.mock("@/components/settings/LocalizedText", () => ({
    useTranslation: () => Object.assign((value: string) => value, { owned: (value: string) => value }),
}));
vi.mock("@/components/settings/UserPreferencesApplier", () => ({
    // Preserve full timestamps in assertions so same-day periods are distinct.
    useUserPreferences: () => ({ formatDate: (value: string) => value }),
}));
vi.mock("@/components/ui", () => ({
    AppButton: (props: { children?: ReactNode; onClick?: () => void }) => {
        actions.push(props);
        return <button>{props.children}</button>;
    },
    AppPanel: ({ children }: { children?: ReactNode }) => <section>{children}</section>,
}));
vi.mock("@/components/ui/Badge", () => ({
    Badge: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
}));
vi.mock("@/components/ui/ConfirmDialog", () => ({ ConfirmDialog: () => null }));

type Allocation = ComponentProps<typeof AllocationsTable>["allocations"][number];
type Mode = "grid" | "table";
const septemberStart = "2026-09-01T09:00:00.000Z";
const septemberEnd = "2026-09-10T09:00:00.000Z";
const augustStart = "2026-08-01T09:00:00.000Z";
const augustEnd = "2026-08-10T09:00:00.000Z";

function period(id: string, overrides: Partial<Allocation> = {}): Allocation[] {
    return ["Morning", "Evening"].map((name, index) => ({
        id: `${id}-${index}`, studentId: "student_1",
        student: { name: "Same name", status: "ACTIVE", monthlyFee: 700 },
        seat: { id: "seat_1", label: "A1" },
        shiftId: `shift_${index}`, shift: { name, isReserved: false },
        startDate: septemberStart, endDate: septemberEnd,
        multiShiftId: "bundle_1", multiShift: { id: "bundle_1", name: "Full day" },
        ...overrides,
    }));
}

function render(allocations: Allocation[], mode: Mode, highlightedAllocationId?: string) {
    const html = renderToStaticMarkup(<AllocationsTable
        allocations={allocations} viewMode={mode} isEndedTab
        highlightedAllocationId={highlightedAllocationId} onEndAllocation={async () => undefined}
    />);
    // Table mode also renders mobile cards; check the desktop table independently.
    const content = mode === "table" ? html.match(/<tbody\b[^>]*>([\s\S]*?)<\/tbody>/)![1] : html;
    const count = (content.match(mode === "table" ? /<tr\b/g : /Multi-shift assignment/g) ?? []).length;
    return { content, count };
}

beforeEach(() => { actions.length = 0; });

describe.each<Mode>(["grid", "table"])("allocation history in %s view", mode => {
    it("keeps two ended periods for the same student, seat, and bundle", () => {
        const { content, count } = render([
            ...period("older", { startDate: augustStart, endDate: augustEnd }),
            ...period("newer"),
        ], mode);
        expect(count).toBe(2);
        for (const date of [augustStart, augustEnd, septemberStart, septemberEnd]) expect(content).toContain(date);
        expect(content.indexOf(septemberStart)).toBeLessThan(content.indexOf(augustStart));
        expect(content.match(/Morning/g)).toHaveLength(2);
        expect(content.match(/Evening/g)).toHaveLength(2);
    });

    it("keeps separate same-name student identities even when the other grouping fields match", () => {
        const { count } = render([
            ...period("first"),
            ...period("second", { studentId: "student_2" }),
        ], mode);
        expect(count).toBe(2);
    });

    it("uses the seat identity rather than a reusable display label", () => {
        const { count } = render([
            ...period("first"),
            ...period("second", { seat: { id: "seat_2", label: "A1" } }),
        ], mode);
        expect(count).toBe(2);
    });

    it("keeps separate starts within one day instead of truncating the episode to a date", () => {
        const later = "2026-09-01T12:00:00.000Z";
        const { count, content } = render([
            ...period("first"),
            ...period("second", { startDate: later }),
        ], mode);
        expect(count).toBe(2);
        expect(content).toContain(septemberStart);
        expect(content).toContain(later);
    });

    it("retains separate closure times instead of concealing a partially ended historical component", () => {
        const rows = period("historical");
        const differentEnd = "2026-09-10T12:00:00.000Z";
        rows[1].endDate = differentEnd;
        const { count, content } = render(rows, mode);
        expect(count).toBe(2);
        expect(content).toContain(septemberEnd);
        expect(content).toContain(differentEnd);
    });

    it("highlights a requested component within its own historical period", () => {
        const { content } = render([
            ...period("newer"),
            ...period("older", { startDate: augustStart, endDate: augustEnd }),
        ], mode, "older-1");
        const targetId = `allocation-record-older-1-${mode === "grid" ? "card" : "row"}`;
        const highlighted = content.slice(content.indexOf(`id="${targetId}"`));
        expect(content).toContain(`id="${targetId}"`);
        expect(highlighted).toContain('aria-current="true"');
        expect(highlighted).toContain(augustStart);
        expect(highlighted).toContain(augustEnd);
        expect(highlighted).not.toContain(septemberStart);
    });

    it("still groups siblings of one bundle period once", () => {
        const { count, content } = render(period("same"), mode);
        expect(count).toBe(1);
        expect(content.match(/Morning/g)).toHaveLength(1);
        expect(content.match(/Evening/g)).toHaveLength(1);
    });

    it("keeps active and ended periods distinct", () => {
        const { count } = render([
            ...period("ended"), ...period("active", { endDate: null }),
        ], mode);
        expect(count).toBe(2);
    });
});

it("retains active bundle component IDs and stable identities in the change action", () => {
    const onUpdateAllocation = vi.fn();
    renderToStaticMarkup(<AllocationsTable
        allocations={period("active", { endDate: null })} viewMode="grid"
        onEndAllocation={async () => undefined} onUpdateAllocation={onUpdateAllocation}
    />);
    const changes = actions.filter(action => action.children === "Change");
    expect(changes).toHaveLength(1);
    changes[0].onClick!();
    expect(onUpdateAllocation).toHaveBeenCalledWith(
        ["active-0", "active-1"], "student_1", "Same name", "seat_1", 700, ["shift_0", "shift_1"], "bundle_1"
    );
});

it("keeps primary shift allocations as separate records", () => {
    const rows = period("primary", { multiShiftId: null, multiShift: null });
    expect(render(rows, "table").count).toBe(2);
    const html = render(rows, "grid").content;
    expect(html.match(/Primary assignment/g)).toHaveLength(2);
});
