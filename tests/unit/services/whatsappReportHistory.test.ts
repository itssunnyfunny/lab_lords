import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorize: vi.fn(), findOrganization: vi.fn(), findOwnerOrganization: vi.fn(),
  findBranch: vi.fn(), findMessages: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: {
  organization: { findFirst: mocks.findOwnerOrganization, findUnique: mocks.findOrganization },
  branch: { findUnique: mocks.findBranch },
  whatsAppMessage: { findMany: mocks.findMessages },
} }));
vi.mock("@/services/staff.service", () => ({ StaffService: { authorize: mocks.authorize } }));
vi.mock("@/services/whatsappIncident.service", () => ({ WhatsAppIncidentService: {} }));
vi.mock("@/analytics/whatsapp-report.analytics", () => ({ getWhatsAppDailyReportMetrics: vi.fn() }));

import { EntitlementService, SubscriptionEntitlementError } from "@/services/entitlement.service";
import { WhatsAppReportService } from "@/services/whatsappReport.service";
import { WhatsAppResourceNotFoundError } from "@/lib/whatsappHttp";

const env = { WHATSAPP_INTEGRATION_ENABLED: "true", WHATSAPP_REPORTS_ENABLED: "true", META_WHATSAPP_MODE: "TEST", NODE_ENV: "test" };
const profile = {
  organizationId: "org_1", plan: "PRO" as const, effectivePlan: "PRO" as const,
  subscriptionStatus: "ACTIVE", fallbackAccess: false, entitlements: ["WHATSAPP_AUTOMATION" as const],
  limits: { maxBranches: null }, usage: { branches: 1 }, accessMode: "READ_ONLY" as const,
  canWrite: false, accessReason: "Read-only test fixture", trial: null,
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.findOwnerOrganization.mockImplementation(async ({ where }) => (
    where.id === "org_1" && where.ownerId === "owner_1" ? { id: "org_1" } : null
  ));
  mocks.findOrganization.mockResolvedValue({ id: "org_1", ownerId: "owner_1", timezone: "Asia/Kolkata" });
  mocks.findBranch.mockResolvedValue({
    id: "branch_1", organizationId: "org_1", organization: { ownerId: "owner_1", timezone: "Asia/Kolkata" },
  });
  mocks.findMessages.mockResolvedValue([]);
  vi.spyOn(EntitlementService, "assertOrganizationEntitlement").mockResolvedValue(profile);
  vi.spyOn(EntitlementService, "assertBranchEntitlement").mockResolvedValue(profile);
  vi.spyOn(EntitlementService, "assertOrganizationWritable").mockResolvedValue(profile);
  vi.spyOn(EntitlementService, "assertBranchWritable").mockResolvedValue(profile);
});
afterEach(() => vi.restoreAllMocks());

describe("persisted daily report history", () => {
  it.each([
    { scope: "BRANCH" as const, branchId: "branch_1" },
    { scope: "ORGANIZATION" as const, organizationId: "org_1" },
  ])("bounds the $scope query to tenant, purpose, actor subscriptions, matching snapshots and provider mode", async scope => {
    expect(await WhatsAppReportService.listRecentHistory({ ...scope, actorUserId: "owner_1", env })).toEqual({ reports: [] });
    const relationScope = {
      organizationId: "org_1", branchId: scope.scope === "BRANCH" ? "branch_1" : null,
      scope: scope.scope, scopeKey: scope.scope === "BRANCH" ? "branch_1" : "org_1",
    };
    expect(mocks.findMessages).toHaveBeenCalledExactlyOnceWith({
      where: {
        organizationId: "org_1", branchId: relationScope.branchId,
        purpose: scope.scope === "BRANCH" ? "DAILY_BRANCH_REPORT" : "DAILY_ORGANIZATION_REPORT",
        sender: { organizationId: "org_1", provider: "META_CLOUD", providerMode: "TEST" },
        reportSubscription: { ...relationScope, userId: "owner_1" }, dailyReportSnapshot: relationScope,
      },
      select: {
        id: true, status: true, recipientPhoneE164: true, scheduledFor: true,
        estimatedCostMicros: true, dailyReportSnapshot: { select: { localReportDate: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 20,
    });
    expect(EntitlementService.assertOrganizationWritable).not.toHaveBeenCalled();
    expect(EntitlementService.assertBranchWritable).not.toHaveBeenCalled();
  });

  it("rechecks all report permissions and entitlement before reading branch history", async () => {
    await WhatsAppReportService.listRecentHistory({ scope: "BRANCH", branchId: "branch_1", actorUserId: "staff_1", env });
    expect(mocks.authorize.mock.calls.map(call => call.slice(0, 3))).toEqual([
      ["staff_1", "branch_1", "view_whatsapp"], ["staff_1", "branch_1", "receive_whatsapp_reports"],
      ["staff_1", "branch_1", "view_payments"], ["staff_1", "branch_1", "analytics"],
    ]);
    expect(EntitlementService.assertBranchEntitlement).toHaveBeenCalledWith("branch_1", "WHATSAPP_AUTOMATION", expect.anything());
    expect(mocks.authorize.mock.invocationCallOrder.at(-1)).toBeLessThan(mocks.findMessages.mock.invocationCallOrder[0]);
  });

  it("restricts a LIVE environment to LIVE sender history", async () => {
    await WhatsAppReportService.listRecentHistory({ scope: "ORGANIZATION", organizationId: "org_1", actorUserId: "owner_1", env: { ...env, META_WHATSAPP_MODE: "LIVE" } });
    expect(mocks.findMessages.mock.calls[0][0].where.sender).toEqual({
      organizationId: "org_1", provider: "META_CLOUD", providerMode: "LIVE",
    });
  });

  it("preserves each persisted status and projects only masked delivery history", async () => {
    const statuses = ["SCHEDULED", "CLAIMED", "SUBMITTING", "ACCEPTED", "SENT", "DELIVERED", "READ", "FAILED", "CANCELLED", "SUPPRESSED", "UNKNOWN"];
    mocks.findMessages.mockResolvedValue(statuses.map((status, index) => ({
      id: `message_${index}`, status, recipientPhoneE164: "+919876543210",
      scheduledFor: new Date("2026-09-28T15:30:00Z"), estimatedCostMicros: index === 0 ? null : 250000n,
      dailyReportSnapshot: { localReportDate: "2026-09-28", metrics: { private: "must-not-leak" } },
      renderedPreview: "must-not-leak", providerMessageId: "must-not-leak", userId: "must-not-leak",
    })));
    const result = await WhatsAppReportService.listRecentHistory({ scope: "ORGANIZATION", organizationId: "org_1", actorUserId: "owner_1", env });
    expect(result.reports.map(report => report.status)).toEqual(statuses);
    expect(result.reports[0]).toEqual({
      id: "message_0", status: "SCHEDULED", maskedPhone: "••••••3210", localReportDate: "2026-09-28",
      scheduledFor: "2026-09-28T15:30:00.000Z", estimatedCostMicros: null,
    });
    expect(result.reports[1].estimatedCostMicros).toBe("250000");
    expect(JSON.stringify(result)).not.toMatch(/9876543210|must-not-leak|providerMessageId|metrics/);
  });

  it.each(["org_foreign", "org_missing"])("denies %s generically before loading history", async organizationId => {
    await expect(WhatsAppReportService.listRecentHistory({ scope: "ORGANIZATION", organizationId, actorUserId: "owner_1", env }))
      .rejects.toBeInstanceOf(WhatsAppResourceNotFoundError);
    expect(mocks.findOrganization).not.toHaveBeenCalled();
    expect(mocks.findMessages).not.toHaveBeenCalled();
  });

  it.each(["Branch not found", "Unauthorized: Permission disabled"])("denies branch access before loading history: %s", async message => {
    mocks.authorize.mockRejectedValue(new Error(message));
    await expect(WhatsAppReportService.listRecentHistory({ scope: "BRANCH", branchId: "branch_1", actorUserId: "staff_1", env }))
      .rejects.toBeInstanceOf(WhatsAppResourceNotFoundError);
    expect(mocks.findMessages).not.toHaveBeenCalled();
  });

  it("does not read history without the report entitlement or rollout gate", async () => {
    vi.mocked(EntitlementService.assertOrganizationEntitlement).mockRejectedValue(new SubscriptionEntitlementError("Upgrade required"));
    await expect(WhatsAppReportService.listRecentHistory({ scope: "ORGANIZATION", organizationId: "org_1", actorUserId: "owner_1", env }))
      .rejects.toBeInstanceOf(SubscriptionEntitlementError);
    await expect(WhatsAppReportService.listRecentHistory({ scope: "ORGANIZATION", organizationId: "org_1", actorUserId: "owner_1", env: { ...env, WHATSAPP_REPORTS_ENABLED: "false" } }))
      .rejects.toThrow();
    expect(mocks.findMessages).not.toHaveBeenCalled();
  });
});
