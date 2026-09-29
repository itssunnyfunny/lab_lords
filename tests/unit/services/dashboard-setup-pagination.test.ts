import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
    const table = () => ({ findMany: vi.fn(), findFirst: vi.fn(), count: vi.fn() });
    return { branch: vi.fn(), clock: vi.fn(), staff: vi.fn(), student: table(), expectation: table(), term: table() };
});
vi.mock("@/lib/prisma", () => ({ prisma: {
    branch: { findUnique: mocks.branch, findUniqueOrThrow: mocks.clock }, staff: { findUnique: mocks.staff },
    student: mocks.student, attendanceExpectation: mocks.expectation, membershipTerm: mocks.term,
} }));

import { DashboardService } from "@/services/dashboard.service";

type Row = Record<string, unknown> & { id: string };
type Query = { where: Record<string, unknown>; orderBy?: Record<string, string> | Record<string, string>[]; take?: number; select?: Record<string, unknown> };
function matches(row: Row, where: Record<string, unknown>): boolean {
    return Object.entries(where).every(([key, value]) => {
        if (key === "OR") return (value as Record<string, unknown>[]).some(part => matches(row, part));
        if (key === "AND") return (value as Record<string, unknown>[]).every(part => matches(row, part));
        if (value && typeof value === "object") return Object.entries(value).every(([op, compare]) => {
            if (op === "gt") return String(row[key]) > String(compare);
            if (op === "lt") return String(row[key]) < String(compare);
            if (op === "equals") return row[key] === compare;
            throw new Error(`Unsupported controlled query: ${op}`);
        });
        return row[key] === value;
    });
}
function bind(table: typeof mocks.student, rows: Row[]) {
    const project = (row: Row, select?: Record<string, unknown>) => select
        ? Object.fromEntries(Object.entries(row).filter(([key]) => select[key])) : row;
    const ordered = ({ where, orderBy }: Query) => {
        const order = orderBy ? (Array.isArray(orderBy) ? orderBy : [orderBy]) : [];
        return rows.filter(row => matches(row, where)).sort((left, right) => {
            for (const key of order) for (const [field, direction] of Object.entries(key)) {
                const comparison = String(left[field]) < String(right[field]) ? -1 : String(left[field]) > String(right[field]) ? 1 : 0;
                if (comparison) return direction === "desc" ? -comparison : comparison;
            }
            return 0;
        });
    };
    table.count.mockImplementation(async ({ where }: Query) => rows.filter(row => matches(row, where)).length);
    table.findFirst.mockImplementation(async (query: Query) => {
        const row = ordered(query)[0]; return row ? project(row, query.select) : null;
    });
    table.findMany.mockImplementation(async (query: Query) => {
        return ordered(query).slice(0, query.take).map(row => project(row, query.select));
    });
}
const students = Array.from({ length: 501 }, (_, index) => ({
    id: `student-${String(index).padStart(3, "0")}`, name: `Student ${String(Math.floor(index / 2)).padStart(3, "0")}`,
    branchId: "branch", status: "ACTIVE", phone: "private", monthlyFee: 1500,
}));
const expectations = students.map((student, index) => ({
    id: `expectation-${String(index).padStart(3, "0")}`, branchId: "branch", studentId: student.id,
    weekdays: [1, 3, 5], expectedBy: "08:00", enabled: true, student: { name: student.name },
}));
const terms = students.map((student, index) => ({
    id: `term-${String(index).padStart(3, "0")}`, branchId: "branch", studentId: student.id,
    label: "Membership", startDate: index < 500 ? "2026-01-01" : "2025-01-01", endDate: index < 500 ? "2026-09-30" : "2025-12-31", student: { name: student.name },
}));
const now = new Date("2026-09-29T10:00:00Z");
function read(kind: "expectations" | "terms", query: Record<string, unknown> = {}) {
    return kind === "expectations"
        ? DashboardService.expectations("owner", "branch", query)
        : DashboardService.terms("owner", "branch", now, query);
}
beforeEach(() => {
    vi.resetAllMocks();
    mocks.branch.mockResolvedValue({ id: "branch", name: "Main", organizationId: "org", organization: { ownerId: "owner" } });
    mocks.clock.mockResolvedValue({ organization: { timezone: "Asia/Kolkata" } });
    bind(mocks.student, [...students, { ...students[0], id: "foreign-student", branchId: "other" }, { ...students[0], id: "inactive", status: "INACTIVE" }]);
    bind(mocks.expectation, [...expectations, { ...expectations[0], id: "foreign-expectation", branchId: "other" }]);
    bind(mocks.term, [...terms, { ...terms[0], id: "foreign-term", branchId: "other" }]);
});

describe.each(["expectations", "terms"] as const)("dashboard %s setup pagination", kind => {
    it("reaches record and active-student 501 using stable bounded pages with full counts", async () => {
        const itemIds: string[] = []; const studentIds: string[] = [];
        let cursor: string | undefined; let studentCursor: string | undefined;
        for (let count = 0; count < 6; count++) {
            const page = await read(kind, { limit: 100, cursor, studentCursor });
            expect(page.total).toBe(501); expect(page.studentTotal).toBe(501);
            expect(page.items.length).toBeLessThanOrEqual(100); expect(page.students.length).toBeLessThanOrEqual(100);
            itemIds.push(...page.items.map(item => item.id)); studentIds.push(...page.students.map(item => item.id));
            cursor = page.nextCursor ?? undefined; studentCursor = page.studentNextCursor ?? undefined;
        }
        expect(cursor).toBeUndefined(); expect(studentCursor).toBeUndefined();
        expect(new Set(itemIds).size).toBe(501); expect(new Set(studentIds).size).toBe(501);
        expect(itemIds.at(-1)).toBe(kind === "terms" ? "term-500" : "expectation-500");
        expect(studentIds.at(-1)).toBe("student-500");
        for (const table of [mocks.student, kind === "terms" ? mocks.term : mocks.expectation]) {
            expect(table.findMany.mock.calls.every(([query]) => query.take <= 101)).toBe(true);
        }
    });

    it("resolves a focused student and their record outside the initial page", async () => {
        const page = await read(kind, { studentId: "student-500" });
        expect(page.selectedStudent).toEqual({ id: "student-500", name: "Student 250" });
        expect(page.items).toHaveLength(1); expect(page.items[0].studentId).toBe("student-500");
        expect(page.total).toBe(1); expect(page.studentTotal).toBe(501);
        expect(page.students).toHaveLength(50);
        expect(page.students[0]).toEqual({ id: "student-000", name: "Student 000" });
    });

    it.each(["A renamed student", "Z renamed student"])("keeps the next student page boundary after its anchor is renamed to %s", async name => {
        const directory = students.map(student => ({ ...student }));
        bind(mocks.student, directory);
        const first = await read(kind);
        expect(first.studentNextCursor).toBe("student-049");
        directory[49].name = name;
        const next = await read(kind, { studentCursor: first.studentNextCursor });
        expect(next.students.map(student => student.id)).toEqual(directory.slice(50, 100).map(student => student.id));
        expect(next.studentTotal).toBe(501);
        expect(next.studentNextCursor).toBe("student-099");
    });

    it("orders choices by immutable ID when names have a different order", async () => {
        bind(mocks.student, students.map((student, index) => ({ ...student, name: `Student ${String(501 - index).padStart(3, "0")}` })));
        const first = await read(kind, { limit: 2 });
        expect(first.students.map(student => student.id)).toEqual(["student-000", "student-001"]);
        const next = await read(kind, { limit: 2, studentCursor: first.studentNextCursor });
        expect(next.students.map(student => student.id)).toEqual(["student-002", "student-003"]);
    });

    it.each([0, 101, "invalid"])("rejects invalid page size %s before any directory reads", async limit => {
        await expect(read(kind, { limit })).rejects.toThrow();
        expect(mocks.student.findMany).not.toHaveBeenCalled();
    });

    it.each(["foreign-student", "missing-student"])("does not resolve inaccessible focused student %s", async studentId => {
        await expect(read(kind, { studentId })).rejects.toThrow("Not found");
    });

    it.each(["studentCursor", "cursor"])("rejects a foreign or missing %s without escaping branch scope", async cursorKey => {
        const foreign = cursorKey === "studentCursor" ? "foreign-student" : kind === "terms" ? "foreign-term" : "foreign-expectation";
        for (const cursor of [foreign, "missing"]) await expect(read(kind, { [cursorKey]: cursor })).rejects.toThrow("page is no longer available");
    });

    it("keeps the original role permissions before any setup records are queried", async () => {
        mocks.branch.mockResolvedValue({ id: "branch", name: "Main", organizationId: "org", organization: { ownerId: "someone-else" } });
        mocks.staff.mockResolvedValue({ id: "staff", role: "STAFF", permissionOverrides: [{ action: "STUDENTS", allowed: false }] });
        await expect(read(kind)).rejects.toThrow("Unauthorized:");
        expect(mocks.student.findMany).not.toHaveBeenCalled(); expect(mocks.term.findMany).not.toHaveBeenCalled(); expect(mocks.expectation.findMany).not.toHaveBeenCalled();
    });
});

it("keeps the latest selected term separate from the currently browsed history page", async () => {
    bind(mocks.term, [terms[500], { ...terms[500], id: "latest", startDate: "2026-01-01", endDate: "2026-09-30" }]);
    const latest = await read("terms", { studentId: "student-500", limit: 1 });
    expect(latest.items[0].id).toBe("latest");
    const history = await read("terms", { studentId: "student-500", limit: 1, cursor: latest.nextCursor });
    expect(history.items[0].id).toBe("term-500");
    expect(history.selectedItem?.id).toBe("latest");
});
