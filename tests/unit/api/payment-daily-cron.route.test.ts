import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  generateDuePaymentsForAllActiveStudents: vi.fn(),
}));

vi.mock("@/services/payment.service", () => ({
  PaymentService: {
    generateDuePaymentsForAllActiveStudents: mocks.generateDuePaymentsForAllActiveStudents,
  },
}));

describe("GET /api/cron/payments/daily", () => {
  const originalCronSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-secret";
  });

  afterEach(() => {
    if (originalCronSecret === undefined) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = originalCronSecret;
    }
  });

  it("rejects requests when CRON_SECRET is not configured", async () => {
    delete process.env.CRON_SECRET;
    const { GET } = await import("@/app/api/cron/payments/daily/route");

    const response = await GET(new Request("http://test.local/api/cron/payments/daily"));

    expect(response.status).toBe(401);
    expect(mocks.generateDuePaymentsForAllActiveStudents).not.toHaveBeenCalled();
  });

  it("rejects requests with the wrong bearer token", async () => {
    const { GET } = await import("@/app/api/cron/payments/daily/route");

    const response = await GET(new Request("http://test.local/api/cron/payments/daily", {
      headers: { authorization: "Bearer wrong-secret" },
    }));

    expect(response.status).toBe(401);
    expect(mocks.generateDuePaymentsForAllActiveStudents).not.toHaveBeenCalled();
  });

  it("generates payments when authorized", async () => {
    const summary = {
      generatedCount: 2,
      skippedCount: 1,
      totalStudents: 3,
      updatedBranchIds: ["branch_1", "branch_2"],
    };

    mocks.generateDuePaymentsForAllActiveStudents.mockResolvedValue(summary);
    const { GET } = await import("@/app/api/cron/payments/daily/route");

    const response = await GET(new Request("http://test.local/api/cron/payments/daily", {
      headers: { authorization: "Bearer test-secret" },
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, ...summary });
    expect(mocks.generateDuePaymentsForAllActiveStudents).toHaveBeenCalledTimes(1);
  });
});
