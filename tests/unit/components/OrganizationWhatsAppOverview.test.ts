import { describe, expect, it, vi } from "vitest";
import {
  fetchOrganizationWhatsAppOperations,
  fetchOrganizationWhatsAppReports,
} from "@/components/whatsapp/OrganizationWhatsAppPanel";
import type { WhatsAppSendersResponse } from "@/lib/api/whatsapp";

function fixture(overrides: Partial<WhatsAppSendersResponse> = {}) {
  const senders = {
    enabled: true,
    canManage: false,
    canManageOperations: true,
    operationsUiEnabled: true,
    safeReason: "Connection changes are held by the rollout gate.",
    senders: [{ id: "sender_1" }, { id: "sender_2" }],
    ...overrides,
  } as WhatsAppSendersResponse;
  const incidents = { incidents: [{ id: "incident_1" }], unknownOutcomes: [] };
  const safety = { senderId: "sender_1", paused: false };
  const subscription = { operationsUiEnabled: true, subscription: null };
  const settings = { operationsUiEnabled: true, settings: { enabled: false } };
  const api = {
    getOrganizationReportSubscription: vi.fn().mockResolvedValue(subscription),
    getOrganizationReportSettings: vi.fn().mockResolvedValue(settings),
    listOrganizationIncidents: vi.fn().mockResolvedValue(incidents),
    getSenderSafety: vi.fn().mockResolvedValue(safety),
  };
  return {
    api, incidents, safety, subscription, settings,
    reports: () => fetchOrganizationWhatsAppReports("org_1", senders, api),
    operations: () => fetchOrganizationWhatsAppOperations("org_1", senders, api),
  };
}

describe("organization WhatsApp operations loading", () => {
  it("keeps incidents and sender safety available when report endpoints are held", async () => {
    const { api, incidents, safety, reports, operations } = fixture();
    api.getOrganizationReportSubscription.mockRejectedValue(new Error("Reports held"));
    api.getOrganizationReportSettings.mockRejectedValue(new Error("Reports held"));

    expect(await reports()).toEqual({ subscription: null, settings: null });
    expect(await operations()).toEqual({
      incidents, senderSafety: { sender_1: safety, sender_2: safety },
    });
    expect(api.listOrganizationIncidents).toHaveBeenCalledWith("org_1");
    expect(api.getSenderSafety).toHaveBeenCalledWith("org_1", "sender_1");
  });

  it("can resolve operational data while report requests are still pending", async () => {
    const { api, incidents, subscription, reports, operations } = fixture();
    let completeReport!: (value: typeof subscription) => void;
    api.getOrganizationReportSubscription.mockImplementation(() => new Promise(resolve => {
      completeReport = resolve;
    }));
    let reportCompleted = false;
    const pendingReport = reports().then(result => {
      reportCompleted = true;
      return result;
    });
    expect((await operations()).incidents).toEqual(incidents);
    expect(reportCompleted).toBe(false);
    completeReport(subscription);
    expect((await pendingReport).subscription).toEqual(subscription);
  });

  it("isolates failed sender safety requests and does not tie report success to incidents", async () => {
    const { api, safety, subscription, settings, reports, operations } = fixture();
    api.listOrganizationIncidents.mockRejectedValue(new Error("Unavailable"));
    api.getSenderSafety.mockRejectedValueOnce(new Error("Unavailable"));
    expect(await operations()).toEqual({ incidents: null, senderSafety: { sender_2: safety } });
    expect(await reports()).toEqual({ subscription, settings });
  });

  it.each([
    { operationsUiEnabled: false },
    { operationsUiEnabled: undefined },
    { enabled: false },
  ])("fails closed before fetching operations or reports for %j", async overrides => {
    const { api, reports, operations } = fixture(overrides);
    expect(await reports()).toEqual({ subscription: null, settings: null });
    expect(await operations()).toEqual({ incidents: null, senderSafety: {} });
    for (const request of Object.values(api)) expect(request).not.toHaveBeenCalled();
  });

  it("keeps each report panel dependent on its own successful response", async () => {
    const { api, settings, reports } = fixture();
    api.getOrganizationReportSubscription.mockRejectedValue(new Error("Unavailable"));
    expect(await reports()).toEqual({ subscription: null, settings });
    api.getOrganizationReportSettings.mockResolvedValue({ operationsUiEnabled: false });
    expect(await reports()).toEqual({ subscription: null, settings: null });
  });
});
