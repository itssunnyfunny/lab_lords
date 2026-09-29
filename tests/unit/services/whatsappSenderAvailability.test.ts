import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorizeRole: vi.fn(), getBranchAccess: vi.fn(),
  getOrganizationProfile: vi.fn(), assertBranchWritable: vi.fn(),
  settingsFindFirst: vi.fn(), sendersFindMany: vi.fn(),
  operationsUiEnabled: vi.fn(), serviceNoticesEnabled: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    branchWhatsAppSettings: { findFirst: mocks.settingsFindFirst },
    whatsAppSender: { findMany: mocks.sendersFindMany },
  },
}));
vi.mock("@/lib/metaWhatsApp", () => ({ readMetaWhatsAppConfiguration: vi.fn(() => ({})), getMetaWhatsAppClient: vi.fn() }));
vi.mock("@/lib/whatsappFeature", () => ({
  assertWhatsAppIntegrationEnabled: vi.fn(),
  assertWhatsAppOnboardingWritesEnabled: vi.fn(),
  areWhatsAppOnboardingWritesEnabled: vi.fn(() => false),
  isWhatsAppDeliverySchemaAccessEnabled: vi.fn(() => false),
  isWhatsAppOperationsUiEnabled: mocks.operationsUiEnabled,
  isWhatsAppServiceNoticesEnabled: mocks.serviceNoticesEnabled,
  resolveWhatsAppProviderMode: vi.fn(() => "TEST"),
}));
vi.mock("@/services/staff.service", () => ({ StaffService: {
  authorizeRole: mocks.authorizeRole, getBranchAccess: mocks.getBranchAccess,
} }));
vi.mock("@/services/entitlement.service", () => ({ EntitlementService: {
  getOrganizationProfile: mocks.getOrganizationProfile,
  assertBranchWritable: mocks.assertBranchWritable,
} }));
vi.mock("@/services/whatsappAuthorization.service", () => ({ WhatsAppAuthorizationService: {} }));
vi.mock("@/services/whatsappRecipient.service", () => ({ WhatsAppRecipientService: {} }));
vi.mock("@/services/whatsappReport.service", () => ({ WhatsAppReportService: {} }));
vi.mock("@/services/whatsappServiceNotice.service", () => ({ WhatsAppServiceNoticeService: {} }));

import { WhatsAppSenderService } from "@/services/whatsappSender.service";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getBranchAccess.mockResolvedValue({
    organizationId: "org_1", isOwner: false,
    permissions: { manage_whatsapp: true },
  });
  mocks.getOrganizationProfile.mockResolvedValue({
    entitlements: ["WHATSAPP_AUTOMATION"], canWrite: true,
  });
  mocks.settingsFindFirst.mockResolvedValue(null);
  mocks.sendersFindMany.mockResolvedValue([]);
  mocks.operationsUiEnabled.mockReturnValue(true);
  mocks.serviceNoticesEnabled.mockReturnValue(true);
});

describe("branch WhatsApp availability projection", () => {
  it("exposes independent operations and notices flags without report or onboarding access", async () => {
    const response = await WhatsAppSenderService.getBranchAssignment("staff_1", "org_1", "branch_1");
    expect(response).toMatchObject({
      enabled: true,
      operationsUiEnabled: true,
      serviceNoticesEnabled: true,
      canManage: false,
    });
    expect(mocks.authorizeRole).toHaveBeenCalledWith("staff_1", "branch_1", "view_whatsapp");
  });

  it("fails closed for an unentitled viewer even when operations flags are on", async () => {
    mocks.getOrganizationProfile.mockResolvedValue({ entitlements: [], canWrite: true });
    const response = await WhatsAppSenderService.getBranchAssignment("staff_1", "org_1", "branch_1");
    expect(response).toMatchObject({ operationsUiEnabled: false, serviceNoticesEnabled: false });
    expect(mocks.settingsFindFirst).not.toHaveBeenCalled();
  });

  it("does not expose availability across an organization boundary", async () => {
    mocks.getBranchAccess.mockResolvedValue({
      organizationId: "org_2", isOwner: false, permissions: { manage_whatsapp: true },
    });
    await expect(WhatsAppSenderService.getBranchAssignment("staff_1", "org_1", "branch_1"))
      .rejects.toThrow();
    expect(mocks.getOrganizationProfile).not.toHaveBeenCalled();
  });
});
