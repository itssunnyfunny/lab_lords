import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  paymentFindUnique: vi.fn(),
  auditLogFindMany: vi.fn(),
  authorize: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getSessionUser: mocks.getSessionUser,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    payment: {
      findUnique: mocks.paymentFindUnique,
    },
    auditLog: {
      findMany: mocks.auditLogFindMany,
    },
  },
}));

vi.mock("@/services/staff.service", () => ({
  StaffService: {
    authorize: mocks.authorize,
  },
}));

describe("GET /api/payments/[paymentId]/audit-log", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const request = new NextRequest("http://test.local/api/payments/payment_1/audit-log");
  const context = { params: Promise.resolve({ paymentId: "payment_1" }) };

  it("returns 401 when no user is signed in", async () => {
    mocks.getSessionUser.mockResolvedValue(null);
    const { GET } = await import("@/app/api/payments/[paymentId]/audit-log/route");

    const response = await GET(request, context);

    expect(response.status).toBe(401);
    expect(mocks.paymentFindUnique).not.toHaveBeenCalled();
    expect(mocks.authorize).not.toHaveBeenCalled();
  });

  it("requires view_payments access for the payment branch", async () => {
    mocks.getSessionUser.mockResolvedValue({ id: "staff_1", email: "staff@test.com" });
    mocks.paymentFindUnique.mockResolvedValue({ id: "payment_1", branchId: "branch_1" });
    mocks.authorize.mockResolvedValue(true);
    mocks.auditLogFindMany.mockResolvedValue([{ id: "log_1" }]);
    const { GET } = await import("@/app/api/payments/[paymentId]/audit-log/route");

    const response = await GET(request, context);

    expect(response.status).toBe(200);
    expect(mocks.authorize).toHaveBeenCalledWith("staff_1", "branch_1", "view_payments");
    expect(await response.json()).toEqual([{ id: "log_1" }]);
  });

  it("returns 403 when the signed-in user cannot view branch payments", async () => {
    mocks.getSessionUser.mockResolvedValue({ id: "staff_1", email: "staff@test.com" });
    mocks.paymentFindUnique.mockResolvedValue({ id: "payment_1", branchId: "branch_1" });
    mocks.authorize.mockRejectedValue(new Error("Unauthorized: Role cannot perform view_payments"));
    const { GET } = await import("@/app/api/payments/[paymentId]/audit-log/route");

    const response = await GET(request, context);

    expect(response.status).toBe(403);
    expect(mocks.auditLogFindMany).not.toHaveBeenCalled();
  });
});
