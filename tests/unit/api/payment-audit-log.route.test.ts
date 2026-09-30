import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { BranchAccessNotFoundError } from "@/services/accessPolicy.service";

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
    vi.resetAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

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
    expect(await response.json()).toEqual({ error: "Forbidden" });
    expect(mocks.auditLogFindMany).not.toHaveBeenCalled();
  });

  it("returns identical generic 404 responses for missing and foreign payments", async () => {
    mocks.getSessionUser.mockResolvedValue({ id: "unrelated_user" });
    mocks.paymentFindUnique.mockResolvedValueOnce(null);
    const { GET } = await import("@/app/api/payments/[paymentId]/audit-log/route");

    const missing = await GET(request, context);
    expect(mocks.authorize).not.toHaveBeenCalled();
    mocks.paymentFindUnique.mockResolvedValueOnce({ id: "payment_1", branchId: "foreign_branch" });
    mocks.authorize.mockRejectedValueOnce(new BranchAccessNotFoundError());
    const foreign = await GET(request, context);

    expect(missing.status).toBe(404);
    expect(foreign.status).toBe(missing.status);
    expect(await missing.json()).toEqual({ error: "Payment not found" });
    expect(await foreign.json()).toEqual({ error: "Payment not found" });
    expect(mocks.authorize).toHaveBeenCalledWith("unrelated_user", "foreign_branch", "view_payments");
    expect(mocks.auditLogFindMany).not.toHaveBeenCalled();
  });

  it.each(["payment", "authorization", "audit"] as const)("masks unexpected %s errors", async stage => {
    mocks.getSessionUser.mockResolvedValue({ id: "owner_1" });
    mocks.paymentFindUnique.mockResolvedValue({ id: "payment_1", branchId: "branch_1" });
    mocks.authorize.mockResolvedValue(true);
    const failingRead = stage === "payment" ? mocks.paymentFindUnique
      : stage === "authorization" ? mocks.authorize : mocks.auditLogFindMany;
    failingRead.mockRejectedValueOnce(new Error("Internal database detail must not appear in the response"));
    const { GET } = await import("@/app/api/payments/[paymentId]/audit-log/route");

    const response = await GET(request, context);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Internal Server Error" });
    expect(console.error).toHaveBeenCalledWith("[PAYMENT_AUDIT_LOG_GET] Unexpected audit-log failure");
    if (stage !== "audit") expect(mocks.auditLogFindMany).not.toHaveBeenCalled();
  });
});
