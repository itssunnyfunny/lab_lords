import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { Prisma } from "@/app/generated/prisma/client";
import { StaffPermissionAction } from "@/types";

const mocks = vi.hoisted(() => ({
    session: vi.fn(), branch: vi.fn(), staff: vi.fn(), students: vi.fn(), writable: vi.fn(), seat: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ getSessionUser: mocks.session }));
vi.mock("@/lib/prisma", () => ({ prisma: {
    branch: { findUnique: mocks.branch }, staff: { findUnique: mocks.staff },
    student: { findMany: mocks.students }, seat: { findUnique: mocks.seat },
} }));
vi.mock("@/services/entitlement.service", () => ({ EntitlementService: {
    assertBranchWritable: mocks.writable,
} }));

// Policy, role/override handling, selector service and route are real. Only the
// authentication and database boundaries are mocked; no disposable DB is needed.
import { GET } from "@/app/api/branches/[branchId]/seat-allocations/students/route";
import { GET as getDirectory } from "@/app/api/branches/[branchId]/students/route";
import { SeatAllocationService } from "@/services/seatAllocation.service";
import { prisma } from "@/lib/prisma";

const branch = { id: "branch", name: "Main", organizationId: "org", organization: { ownerId: "owner" } };
const records = [
    { id: "active", name: "Asha", branchId: "branch", status: "ACTIVE", phone: "private", monthlyFee: 1200 },
    { id: "inactive", name: "Bina", branchId: "branch", status: "INACTIVE", phone: "private", monthlyFee: 1300 },
    { id: "foreign", name: "Chitra", branchId: "other", status: "ACTIVE", phone: "private", monthlyFee: 1400 },
];
function staff(overrides: { action: StaffPermissionAction; allowed: boolean }[] = []) {
    mocks.staff.mockResolvedValue({ id: "staff", role: "STAFF", permissionOverrides: overrides });
}
function read(branchId = "branch", query = "") {
    return GET(new Request(`http://test.local/api/branches/${branchId}/seat-allocations/students${query}`), {
        params: Promise.resolve({ branchId }),
    });
}
beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.session.mockResolvedValue({ id: "staff-user" });
    mocks.branch.mockResolvedValue(branch);
    staff();
    mocks.students.mockImplementation(async ({ where, select }: {
        where: { branchId?: string; status?: string }; select?: Record<string, boolean>;
    }) => records.filter(row => (!where.branchId || row.branchId === where.branchId)
        && (!where.status || row.status === where.status))
        .map(row => select ? Object.fromEntries(Object.entries(row).filter(([key]) => select[key])) : row));
});
afterEach(() => { vi.restoreAllMocks(); });

describe("allocation student options authorization and projection", () => {
    it("returns only active same-branch identities for allocation-only staff, while the directory still denies them", async () => {
        staff([{ action: StaffPermissionAction.STUDENTS, allowed: false }]);
        const response = await read("branch", "?status=INACTIVE&all=true&branchId=other");
        expect(response.status).toBe(200);
        expect(response.headers.get("Cache-Control")).toBe("private, no-store");
        expect(await response.json()).toEqual({ items: [{ id: "active", name: "Asha" }], canLinkFee: false });
        expect(mocks.students).toHaveBeenCalledExactlyOnceWith({
            where: { branchId: "branch", status: "ACTIVE" }, select: { id: true, name: true },
            orderBy: [{ name: "asc" }, { id: "asc" }],
        });

        const directory = await getDirectory(new NextRequest("http://test.local/api/branches/branch/students?all=true"), {
            params: Promise.resolve({ branchId: "branch" }),
        });
        expect(directory.status).toBe(403);
        expect(mocks.students).toHaveBeenCalledTimes(1);
    });

    it.each(["owner", "staff-user"])("preserves the minimal projection and fee-link permission for %s", async actor => {
        mocks.session.mockResolvedValue({ id: actor });
        const response = await read();
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ items: [{ id: "active", name: "Asha" }], canLinkFee: true });
        if (actor === "owner") expect(mocks.staff).not.toHaveBeenCalled();
    });

    it("denies student-authorized staff whose allocation permission is disabled before reading students", async () => {
        staff([{ action: StaffPermissionAction.SEAT_ALLOCATION, allowed: false }]);
        const response = await read();
        expect(response.status).toBe(403);
        expect(await response.json()).toEqual({ error: "Forbidden" });
        expect(mocks.students).not.toHaveBeenCalled();
    });

    it("returns identical generic errors for foreign and nonexistent branches", async () => {
        mocks.staff.mockResolvedValue(null);
        const foreign = await read("foreign");
        mocks.branch.mockResolvedValue(null);
        const missing = await read("missing");
        expect([foreign.status, missing.status]).toEqual([404, 404]);
        expect(await foreign.json()).toEqual({ error: "Branch not found" });
        expect(await missing.json()).toEqual({ error: "Branch not found" });
        expect(mocks.students).not.toHaveBeenCalled();
    });

    it("requires a session before resolving any branch or student", async () => {
        mocks.session.mockResolvedValue(null);
        const response = await read();
        expect(response.status).toBe(401);
        expect(await response.json()).toEqual({ error: "Unauthorized" });
        expect(mocks.branch).not.toHaveBeenCalled(); expect(mocks.students).not.toHaveBeenCalled();
    });

    it.each(["branch", "students"] as const)("masks unexpected %s errors", async boundary => {
        mocks[boundary].mockRejectedValue(new Error("private diagnostic details"));
        const response = await read();
        expect(response.status).toBe(500);
        expect(await response.json()).toEqual({ error: "Internal Server Error" });
    });

    it("allows scoped reads in readonly mode without bypassing writability on allocation submission", async () => {
        mocks.writable.mockRejectedValue(new Error("This workspace is read-only."));
        expect((await read()).status).toBe(200);
        expect(mocks.writable).not.toHaveBeenCalled();
        mocks.seat.mockResolvedValue({ id: "seat", branchId: "branch" });
        await expect(SeatAllocationService.assignSeatToShiftsInTransaction(
            "staff-user", "seat", "active", ["shift"], undefined, prisma as unknown as Prisma.TransactionClient,
        )).rejects.toThrow("This workspace is read-only.");
        expect(mocks.writable).toHaveBeenCalledExactlyOnceWith("branch", prisma);
    });
});
