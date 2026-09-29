import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  snapshot: vi.fn(),
  healthTrend: vi.fn(),
  seatTrend: vi.fn(),
  paymentTrend: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ getSessionUser: async () => ({ id: "staff" }) }));
vi.mock("@/services/staff.service", () => ({ StaffService: { authorize: mocks.authorize } }));
vi.mock("@/services/analyticsAccess.service", () => ({ AnalyticsAccessService: {
  branchSnapshot: mocks.snapshot,
  healthTrend: mocks.healthTrend,
  seatTrend: mocks.seatTrend,
  paymentTrend: mocks.paymentTrend,
} }));

import { GET as snapshotGET } from "@/app/api/analytics/branch/[branchId]/snapshot/route";
import { GET as trendsGET } from "@/app/api/analytics/branch/[branchId]/trends/route";

const params = { params: Promise.resolve({ branchId: "branch" }) };
const operational = {
  students: { status: { active: 4, inactive: 1 } },
  seats: { occupancySnapshot: {
    totalShiftCapacity: 10,
    totalUsedSlots: 3,
    totalOccupancyPercent: 30,
    shifts: [],
  } },
};

describe("branch financial analytics routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorize.mockResolvedValue(true);
    mocks.healthTrend.mockResolvedValue([{ asOf: new Date("2026-09-01"), snapshot: operational }]);
    mocks.seatTrend.mockResolvedValue([]);
    mocks.paymentTrend.mockResolvedValue([]);
  });

  it("omits every financial field for an analytics viewer with payment denial", async () => {
    mocks.snapshot.mockResolvedValue({ health: operational, finance: null });
    const response = await snapshotGET(new NextRequest("http://test.local/api/analytics/branch/branch/snapshot?period=month"), params);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ totalStudents: 5, activeStudents: 4, assignedSeats: 3, occupancyRate: 30, financialAccess: false });
    for (const key of ["monthlyRevenue", "dueAmount", "paidAmount", "collectionRate", "payments", "overdueCount", "healthScore"]) {
      expect(body).not.toHaveProperty(key);
    }
  });

  it("preserves the authorized financial snapshot", async () => {
    mocks.snapshot.mockResolvedValue({ health: operational, finance: {
      revenueAmount: 1000, paidAmount: 700, dueAmount: 300, collectionRate: 70,
    } });
    const response = await snapshotGET(new NextRequest("http://test.local/api/analytics/branch/branch/snapshot"), params);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      financialAccess: true, monthlyRevenue: 1000, paidAmount: 700, dueAmount: 300, collectionRate: 70,
    });
  });

  it("returns 403 rather than a financial trend when payment permission is denied", async () => {
    mocks.paymentTrend.mockRejectedValue(new Error("Unauthorized: Permission 'view_payments' is disabled"));
    const response = await trendsGET(new NextRequest("http://test.local/api/analytics/branch/branch/trends?from=2026-09-01&to=2026-09-02&type=payment"), params);
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Forbidden" });
    expect(mocks.paymentTrend).toHaveBeenCalledOnce();
  });

  it("retains nonfinancial health and student trends", async () => {
    for (const type of ["health", "students"]) {
      const response = await trendsGET(new NextRequest(`http://test.local/api/analytics/branch/branch/trends?from=2026-09-01&to=2026-09-02&type=${type}`), params);
      expect(response.status).toBe(200);
      expect(await response.json()).not.toEqual([]);
    }
    expect(mocks.paymentTrend).not.toHaveBeenCalled();
  });
});
