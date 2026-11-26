import { readFileSync } from "node:fs";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ run: vi.fn() }));

vi.mock("@/services/whatsappPlanner.service", () => ({
  WhatsAppPlannerService: { run: mocks.run },
}));

describe("GET /api/cron/whatsapp/plan", () => {
  const originalSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "planner-secret";
  });

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = originalSecret;
  });

  it("fails closed when CRON_SECRET is absent or not an exact match", async () => {
    const { GET } = await import("@/app/api/cron/whatsapp/plan/route");
    delete process.env.CRON_SECRET;
    const missing = await GET(new Request("http://test.local/api/cron/whatsapp/plan"));
    process.env.CRON_SECRET = "planner-secret";
    const wrong = await GET(new Request("http://test.local/api/cron/whatsapp/plan", {
      headers: { authorization: "Bearer wrong-secret" },
    }));

    expect(missing.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(mocks.run).not.toHaveBeenCalled();
  });

  it("returns only bounded aggregate planner results", async () => {
    mocks.run.mockResolvedValue({
      held: false,
      claimedBranches: 2,
      completedBranches: 2,
      failedBranches: 0,
      plannedMessages: 7,
      skippedCandidates: 3,
      cancelledMessages: 1,
      limitReached: false,
    });
    const { GET } = await import("@/app/api/cron/whatsapp/plan/route");
    const response = await GET(new Request("http://test.local/api/cron/whatsapp/plan", {
      headers: { authorization: "Bearer planner-secret" },
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      held: false,
      claimedBranches: 2,
      completedBranches: 2,
      failedBranches: 0,
      plannedMessages: 7,
      skippedCandidates: 3,
      cancelledMessages: 1,
      limitReached: false,
    });
    expect(mocks.run).toHaveBeenCalledTimes(1);
  });

  it("registers each authenticated GET job once at its operating cadence", () => {
    const configuration = JSON.parse(readFileSync("vercel.json", "utf8"));
    expect(configuration.crons).toBeUndefined();
    const routes = [
      ["/api/cron/payments/daily", "0 0 * * *"],
      ["/api/cron/billing/hourly", "0 * * * *"],
      ["/api/cron/imports/daily", "30 0 * * *"],
      ["/api/cron/whatsapp/plan", "*/15 * * * *"],
      ["/api/cron/whatsapp/send", "*/5 * * * *"],
      ["/api/cron/whatsapp/reports", "*/15 * * * *"],
      ["/api/cron/whatsapp/health", "*/30 * * * *"],
      ["/api/cron/whatsapp/maintenance", "0 2 * * *"],
    ];
    expect(Object.values(configuration.schedules)).toEqual(routes.map(([path, schedule]) => ({
      path, schedule, requestMethod: "GET",
    })));
  });
});
