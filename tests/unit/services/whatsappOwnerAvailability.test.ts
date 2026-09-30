import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertOwner: vi.fn(),
  getOrganizationProfile: vi.fn(),
  sendersFindMany: vi.fn(),
  operationsUiEnabled: vi.fn(),
  onboardingWritesEnabled: vi.fn(),
  readConfiguration: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { whatsAppSender: { findMany: mocks.sendersFindMany } },
}));
vi.mock("@/lib/metaWhatsApp", () => ({
  readMetaWhatsAppConfiguration: mocks.readConfiguration,
  getMetaWhatsAppClient: vi.fn(),
}));
vi.mock("@/lib/whatsappFeature", () => ({
  assertWhatsAppIntegrationEnabled: vi.fn(),
  assertWhatsAppOnboardingWritesEnabled: vi.fn(),
  areWhatsAppOnboardingWritesEnabled: mocks.onboardingWritesEnabled,
  isWhatsAppDeliverySchemaAccessEnabled: vi.fn(() => false),
  isWhatsAppOperationsUiEnabled: mocks.operationsUiEnabled,
  isWhatsAppServiceNoticesEnabled: vi.fn(() => false),
  resolveWhatsAppProviderMode: vi.fn(() => "TEST"),
}));
vi.mock("@/services/staff.service", () => ({ StaffService: {} }));
vi.mock("@/services/entitlement.service", () => ({ EntitlementService: {
  getOrganizationProfile: mocks.getOrganizationProfile,
} }));
vi.mock("@/services/whatsappAuthorization.service", () => ({ WhatsAppAuthorizationService: {
  assertOwner: mocks.assertOwner,
} }));
vi.mock("@/services/whatsappRecipient.service", () => ({ WhatsAppRecipientService: {} }));
vi.mock("@/services/whatsappReport.service", () => ({ WhatsAppReportService: {} }));
vi.mock("@/services/whatsappServiceNotice.service", () => ({ WhatsAppServiceNoticeService: {} }));

import { WhatsAppSenderService } from "@/services/whatsappSender.service";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.assertOwner.mockResolvedValue({ id: "org_1" });
  mocks.getOrganizationProfile.mockResolvedValue({
    entitlements: ["WHATSAPP_AUTOMATION"], canWrite: true,
  });
  mocks.sendersFindMany.mockResolvedValue([]);
  mocks.operationsUiEnabled.mockReturnValue(true);
  mocks.onboardingWritesEnabled.mockReturnValue(false);
  mocks.readConfiguration.mockReturnValue({});
});

describe("owner WhatsApp availability projection", () => {
  it("keeps operational management available when only onboarding is held", async () => {
    const response = await WhatsAppSenderService.listForOwner("owner_1", "org_1");
    expect(response).toMatchObject({
      enabled: true, operationsUiEnabled: true, canManage: false, canManageOperations: true,
    });
    expect(mocks.assertOwner).toHaveBeenCalledWith("owner_1", "org_1");
    expect(mocks.sendersFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { organizationId: "org_1", provider: "META_CLOUD", providerMode: "TEST" },
    }));
  });

  it("does not require onboarding provider configuration to pause an existing sender", async () => {
    mocks.onboardingWritesEnabled.mockReturnValue(true);
    mocks.readConfiguration.mockImplementation(() => { throw new Error("Not configured"); });
    expect(await WhatsAppSenderService.listForOwner("owner_1", "org_1")).toMatchObject({
      operationsUiEnabled: true, canManage: false, canManageOperations: true,
    });
  });

  it("allows an entitled read-only owner to view operations while withholding mutation controls", async () => {
    mocks.onboardingWritesEnabled.mockReturnValue(true);
    mocks.getOrganizationProfile.mockResolvedValue({
      entitlements: ["WHATSAPP_AUTOMATION"], canWrite: false,
    });
    expect(await WhatsAppSenderService.listForOwner("owner_1", "org_1")).toMatchObject({
      operationsUiEnabled: true, canManage: false, canManageOperations: false,
    });
  });

  it("keeps the independent operations flag closed without changing onboarding availability", async () => {
    mocks.onboardingWritesEnabled.mockReturnValue(true);
    mocks.operationsUiEnabled.mockReturnValue(false);
    expect(await WhatsAppSenderService.listForOwner("owner_1", "org_1")).toMatchObject({
      operationsUiEnabled: false, canManage: true, canManageOperations: true,
    });
  });

  it("withholds operational availability and management from an unentitled owner", async () => {
    mocks.getOrganizationProfile.mockResolvedValue({ entitlements: [], canWrite: true });
    expect(await WhatsAppSenderService.listForOwner("owner_1", "org_1")).toMatchObject({
      operationsUiEnabled: false, canManage: false, canManageOperations: false, senders: [],
    });
    expect(mocks.sendersFindMany).not.toHaveBeenCalled();
  });

  it("checks ownership before exposing entitlement or sender availability", async () => {
    mocks.assertOwner.mockRejectedValue(new Error("Not found"));
    await expect(WhatsAppSenderService.listForOwner("foreign_user", "org_1")).rejects.toThrow("Not found");
    expect(mocks.getOrganizationProfile).not.toHaveBeenCalled();
    expect(mocks.sendersFindMany).not.toHaveBeenCalled();
  });
});
