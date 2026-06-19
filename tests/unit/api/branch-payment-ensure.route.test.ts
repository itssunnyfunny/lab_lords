import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  getBranchAccess: vi.fn(),
  ensureDuePaymentsForBranch: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getSessionUser: mocks.getSessionUser,
}));

vi.mock("@/services/staff.service", () => ({
  StaffService: {
    getBranchAccess: mocks.getBranchAccess,
  },
}));

vi.mock("@/services/payment.service", () => ({
  PaymentService: {
    ensureDuePaymentsForBranch: mocks.ensureDuePaymentsForBranch,
  },
}));

describe("POST /api/branches/[branchId]/payments/ensure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const request = new Request("http://test.local/api/branches/branch_1/payments/ensure", {
    method: "POST",
  });
  const context = { params: Promise.resolve({ branchId: "branch_1" }) };

  it("returns 401 when no user is signed in", async () => {
    mocks.getSessionUser.mockResolvedValue(null);
    const { POST } = await import("@/app/api/branches/[branchId]/payments/ensure/route");

    const response = await POST(request, context);

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
    expect(mocks.getBranchAccess).not.toHaveBeenCalled();
    expect(mocks.ensureDuePaymentsForBranch).not.toHaveBeenCalled();
  });

  it("allows regular branch staff to ensure payments", async () => {
    const summary = {
      generatedCount: 1,
      skippedCount: 0,
      totalStudents: 1,
      updatedBranchIds: ["branch_1"],
    };

    mocks.getSessionUser.mockResolvedValue({ id: "staff_1", email: "staff@test.com" });
    mocks.getBranchAccess.mockResolvedValue({
      branchId: "branch_1",
      branchName: "Main",
      organizationId: "org_1",
      isOwner: false,
      role: "STAFF",
      permissions: {},
    });
    mocks.ensureDuePaymentsForBranch.mockResolvedValue(summary);
    const { POST } = await import("@/app/api/branches/[branchId]/payments/ensure/route");

    const response = await POST(request, context);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(summary);
    expect(mocks.getBranchAccess).toHaveBeenCalledWith("staff_1", "branch_1");
    expect(mocks.ensureDuePaymentsForBranch).toHaveBeenCalledWith("branch_1");
  });
});
