import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ getSessionUser: vi.fn(), listRecentHistory: vi.fn(), rateLimit: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getSessionUser: mocks.getSessionUser }));
vi.mock("@/lib/whatsappRoute", () => ({ whatsAppRateLimitResponse: mocks.rateLimit }));
vi.mock("@/services/whatsappReport.service", () => ({ WhatsAppReportService: { listRecentHistory: mocks.listRecentHistory } }));

import { WhatsAppResourceNotFoundError } from "@/lib/whatsappHttp";
import { GET as branchHistory } from "@/app/api/branches/[branchId]/whatsapp/reports/history/route";
import { GET as organizationHistory } from "@/app/api/organizations/[orgId]/whatsapp/reports/history/route";

const routes = [
  { scope: { scope: "BRANCH", branchId: "branch_1" }, invoke: () => branchHistory(new Request("https://app.example.test/api/branches/branch_1/whatsapp/reports/history"), { params: Promise.resolve({ branchId: "branch_1" }) }) },
  { scope: { scope: "ORGANIZATION", organizationId: "org_1" }, invoke: () => organizationHistory(new Request("https://app.example.test/api/organizations/org_1/whatsapp/reports/history"), { params: Promise.resolve({ orgId: "org_1" }) }) },
];

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getSessionUser.mockResolvedValue({ id: "actor_1" });
  mocks.rateLimit.mockReturnValue(null);
  mocks.listRecentHistory.mockResolvedValue({ reports: [] });
});

describe.each(routes)("daily report history $scope.scope route", ({ scope, invoke }) => {
  it("passes only authenticated actor and route scope to the history service", async () => {
    const response = await invoke();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ reports: [] });
    expect(mocks.listRecentHistory).toHaveBeenCalledExactlyOnceWith({ ...scope, actorUserId: "actor_1" });
  });
  it("rejects signed-out reads before the service", async () => {
    mocks.getSessionUser.mockResolvedValue(null);
    expect((await invoke()).status).toBe(401);
    expect(mocks.listRecentHistory).not.toHaveBeenCalled();
  });
  it("uses the generic foreign/missing resource response", async () => {
    mocks.listRecentHistory.mockRejectedValue(new WhatsAppResourceNotFoundError());
    const response = await invoke();
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "WhatsApp resource not found", code: "WHATSAPP_RESOURCE_NOT_FOUND" });
  });
  it("honors the report read rate limit", async () => {
    mocks.rateLimit.mockReturnValue(new Response(null, { status: 429 }));
    expect((await invoke()).status).toBe(429);
    expect(mocks.listRecentHistory).not.toHaveBeenCalled();
  });
});
