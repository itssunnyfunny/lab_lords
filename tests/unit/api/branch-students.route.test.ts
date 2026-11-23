import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  getStudentsByBranch: vi.fn(),
  assertStudentInBranch: vi.fn(),
  updateStudentProfile: vi.fn(),
  updateStudentStatus: vi.fn(),
  getEnrollmentHistory: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getSessionUser: mocks.getSessionUser,
}));

vi.mock("@/services/student.service", () => ({
  StudentService: {
    getStudentsByBranch: mocks.getStudentsByBranch,
    assertStudentInBranch: mocks.assertStudentInBranch,
    updateStudentProfile: mocks.updateStudentProfile,
    updateStudentStatus: mocks.updateStudentStatus,
    getEnrollmentHistory: mocks.getEnrollmentHistory,
  },
}));

describe("GET /api/branches/[branchId]/students", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSessionUser.mockResolvedValue({ id: "staff_1", email: "staff@test.com" });
  });

  const context = { params: Promise.resolve({ branchId: "branch_1" }) };

  it("uses the default page size and returns a paged result", async () => {
    const result = { items: [{ id: "student_1" }], nextCursor: null, total: 1 };
    mocks.getStudentsByBranch.mockResolvedValue(result);
    const request = new NextRequest(
      "http://test.local/api/branches/branch_1/students?status=ACTIVE&shiftId=shift_1&q=asha"
    );
    const { GET } = await import("@/app/api/branches/[branchId]/students/route");

    const response = await GET(request, context);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(result);
    expect(mocks.getStudentsByBranch).toHaveBeenCalledWith("staff_1", "branch_1", {
      status: "ACTIVE",
      shiftId: "shift_1",
      multiShiftId: undefined,
      query: "asha",
      limit: 50,
      cursor: null,
    });
  });

  it("keeps explicit complete reads inside the PagedResult contract", async () => {
    const items = [{ id: "student_1" }, { id: "student_2" }];
    mocks.getStudentsByBranch.mockResolvedValue(items);
    const request = new NextRequest(
      "http://test.local/api/branches/branch_1/students?status=ACTIVE&all=true"
    );
    const { GET } = await import("@/app/api/branches/[branchId]/students/route");

    const response = await GET(request, context);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ items, nextCursor: null, total: 2 });
    expect(mocks.getStudentsByBranch).toHaveBeenCalledWith("staff_1", "branch_1", {
      status: "ACTIVE",
      shiftId: undefined,
      multiShiftId: undefined,
      query: undefined,
    });
  });

  it("forwards an exact multi-shift filter", async () => {
    mocks.getStudentsByBranch.mockResolvedValue({ items: [], nextCursor: null, total: 0 });
    const request = new NextRequest(
      "http://test.local/api/branches/branch_1/students?multiShiftId=multi_full"
    );
    const { GET } = await import("@/app/api/branches/[branchId]/students/route");

    const response = await GET(request, context);

    expect(response.status).toBe(200);
    expect(mocks.getStudentsByBranch).toHaveBeenCalledWith("staff_1", "branch_1", {
      status: undefined,
      shiftId: undefined,
      multiShiftId: "multi_full",
      query: undefined,
      limit: 50,
      cursor: null,
    });
  });

  it("rejects primary and multi-shift filters together", async () => {
    const request = new NextRequest(
      "http://test.local/api/branches/branch_1/students?shiftId=morning&multiShiftId=multi_full"
    );
    const { GET } = await import("@/app/api/branches/[branchId]/students/route");

    const response = await GET(request, context);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "shiftId and multiShiftId cannot be combined" });
    expect(mocks.getStudentsByBranch).not.toHaveBeenCalled();
  });

  it("returns 404 when the requested multi-shift is missing or belongs to another branch", async () => {
    mocks.getStudentsByBranch.mockRejectedValue(new Error("Multi-shift not found"));
    const request = new NextRequest(
      "http://test.local/api/branches/branch_1/students?multiShiftId=missing"
    );
    const { GET } = await import("@/app/api/branches/[branchId]/students/route");

    const response = await GET(request, context);

    expect(response.status).toBe(404);
  });

  it.each([
    ["limit=0", "limit must be between 1 and 100"],
    ["limit=101", "limit must be between 1 and 100"],
    ["cursor=not-a-cursor", "cursor is invalid"],
    ["all=maybe", "all must be true or false"],
    ["all=true&limit=50", "all cannot be combined with cursor or limit"],
  ])("returns 400 for invalid pagination input %s", async (query, message) => {
    const request = new NextRequest(`http://test.local/api/branches/branch_1/students?${query}`);
    const { GET } = await import("@/app/api/branches/[branchId]/students/route");

    const response = await GET(request, context);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: message });
    expect(mocks.getStudentsByBranch).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/branches/[branchId]/students", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSessionUser.mockResolvedValue({ id: "staff_1", email: "staff@test.com" });
  });

  it("returns 400 for an invalid dueResolution without invoking the service", async () => {
    const request = new NextRequest("http://test.local/api/branches/branch_1/students", {
      method: "PATCH",
      body: JSON.stringify({
        id: "student_1",
        status: "INACTIVE",
        dueResolution: "FORGED",
      }),
      headers: { "content-type": "application/json" },
    });
    const { PATCH } = await import("@/app/api/branches/[branchId]/students/route");

    const response = await PATCH(request, { params: Promise.resolve({ branchId: "branch_1" }) });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid due resolution" });
    expect(mocks.updateStudentStatus).not.toHaveBeenCalled();
    expect(mocks.updateStudentProfile).not.toHaveBeenCalled();
  });

  it("rejects a non-string dueResolution instead of treating it as KEEP", async () => {
    const request = new NextRequest("http://test.local/api/branches/branch_1/students", {
      method: "PATCH",
      body: JSON.stringify({
        id: "student_1",
        status: "INACTIVE",
        dueResolution: null,
      }),
      headers: { "content-type": "application/json" },
    });
    const { PATCH } = await import("@/app/api/branches/[branchId]/students/route");

    const response = await PATCH(request, { params: Promise.resolve({ branchId: "branch_1" }) });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid due resolution" });
    expect(mocks.updateStudentStatus).not.toHaveBeenCalled();
  });

  it("keeps the existing KEEP default when dueResolution is omitted", async () => {
    const student = { id: "student_1", status: "INACTIVE" };
    mocks.updateStudentStatus.mockResolvedValue(student);
    const request = new NextRequest("http://test.local/api/branches/branch_1/students", {
      method: "PATCH",
      body: JSON.stringify({
        id: "student_1",
        status: "INACTIVE",
      }),
      headers: { "content-type": "application/json" },
    });
    const { PATCH } = await import("@/app/api/branches/[branchId]/students/route");

    const response = await PATCH(request, { params: Promise.resolve({ branchId: "branch_1" }) });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(student);
    expect(mocks.updateStudentStatus).toHaveBeenCalledWith(
      "staff_1",
      "student_1",
      "INACTIVE",
      "KEEP"
    );
  });
});

describe.each(["branch-scoped", "student-only"])("%s student reactivation route", scope => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getSessionUser.mockResolvedValue({ id: "staff_1" });
  });

  const reactivate = async (rejoinedOn?: unknown) => {
    const req = new NextRequest("http://test.local/students", {
      method: "PATCH",
      body: JSON.stringify({ id: "student_1", status: "ACTIVE", rejoinedOn }),
    });
    if (scope === "branch-scoped") {
      const { PATCH } = await import("@/app/api/branches/[branchId]/students/route");
      return PATCH(req, { params: Promise.resolve({ branchId: "branch_1" }) });
    }
    const { PATCH } = await import("@/app/api/students/[studentId]/status/route");
    return PATCH(req, { params: Promise.resolve({ studentId: "student_1" }) });
  };

  it.each([undefined, null, "2026-02-30", "2026-2-01", "2099-01-01", "2026-02-01T00:00:00Z"])("rejects %s before a status mutation", async date => {
    expect((await reactivate(date)).status).toBe(400);
    expect(mocks.updateStudentStatus).not.toHaveBeenCalled();
  });

  it("passes a valid date to the authorized service and reports an active-date conflict", async () => {
    mocks.updateStudentStatus.mockResolvedValueOnce({ id: "student_1", status: "ACTIVE" })
      .mockRejectedValueOnce(new Error("This student is already active. Refresh the record before changing enrollment."));
    expect((await reactivate("2025-01-31")).status).toBe(200);
    expect(mocks.updateStudentStatus).toHaveBeenCalledWith("staff_1", "student_1", "ACTIVE", "KEEP", "2025-01-31");
    if (scope === "branch-scoped") expect(mocks.assertStudentInBranch).toHaveBeenCalledWith("staff_1", "student_1", "branch_1");
    expect((await reactivate("2025-02-01")).status).toBe(409);
  });
});

describe("student enrollment history route", () => {
  it("passes student and branch identity to its scoped read service", async () => {
    vi.resetAllMocks();
    mocks.getSessionUser.mockResolvedValue({ id: "staff_1" });
    mocks.getEnrollmentHistory.mockResolvedValue({ originalJoinedAt: "2025-01-10T00:00:00.000Z", items: [], total: 0, nextCursor: null });
    const { GET } = await import("@/app/api/branches/[branchId]/students/[studentId]/enrollments/route");
    const response = await GET(new NextRequest("http://test.local/enrollments?limit=1"), {
      params: Promise.resolve({ branchId: "branch_1", studentId: "student_1" }),
    });
    expect(response.status).toBe(200);
    expect(mocks.getEnrollmentHistory).toHaveBeenCalledWith("staff_1", "branch_1", "student_1", 1, null);
  });
});
