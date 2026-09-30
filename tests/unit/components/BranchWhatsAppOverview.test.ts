import { describe, expect, it, vi } from "vitest";
import { fetchBranchWhatsAppOverview } from "@/components/whatsapp/BranchWhatsAppPanel";

function fixture(overrides: Partial<{
  operationsUiEnabled: boolean;
  serviceNoticesEnabled: boolean;
}> = {}) {
  const assignment = {
    enabled: true,
    canManage: false,
    operationsUiEnabled: true,
    serviceNoticesEnabled: true,
    safeReason: null,
    assignment: null,
    availableSenders: [],
    ...overrides,
  };
  const incidents = { incidents: [{ id: "incident_1" }], unknownOutcomes: [] };
  const serviceNotices = { notices: [{ id: "notice_1" }] };
  const api = {
    getBranchAssignment: vi.fn().mockResolvedValue(assignment),
    getBranchSettings: vi.fn().mockResolvedValue({ enabled: true }),
    getBranchReportSubscription: vi.fn().mockResolvedValue(null),
    listBranchIncidents: vi.fn().mockResolvedValue(incidents),
    listBranchServiceNotices: vi.fn().mockResolvedValue(serviceNotices),
  };
  const load = (canReceiveReports: boolean, canViewNotices: boolean) =>
    fetchBranchWhatsAppOverview({
      organizationId: "org_1", branchId: "branch_1", canReceiveReports, canViewNotices,
    }, api as unknown as Parameters<typeof fetchBranchWhatsAppOverview>[1]);
  return { api, assignment, incidents, serviceNotices, load };
}

describe("branch WhatsApp operations loading", () => {
  it("keeps notices and incidents when a report-only request fails", async () => {
    const { api, incidents, serviceNotices, load } = fixture();
    api.getBranchReportSubscription.mockRejectedValue(new Error("Reports held"));
    const overview = await load(true, true);
    expect(overview.reportSubscription).toBeNull();
    expect(overview.incidents).toEqual(incidents);
    expect(overview.serviceNotices).toEqual(serviceNotices);
    expect(api.listBranchIncidents).toHaveBeenCalledWith("branch_1");
    expect(api.listBranchServiceNotices).toHaveBeenCalledWith("branch_1");
  });

  it("loads independent notices for an operator without report permission", async () => {
    const { api, incidents, serviceNotices, load } = fixture();
    const overview = await load(false, true);
    expect(api.getBranchReportSubscription).not.toHaveBeenCalled();
    expect(overview.incidents).toEqual(incidents);
    expect(overview.serviceNotices).toEqual(serviceNotices);
  });

  it("keeps incidents hidden when their separate rollout flag is absent while notices remain available", async () => {
    const { api, serviceNotices, load } = fixture({ operationsUiEnabled: false });
    const overview = await load(true, true);
    expect(api.listBranchIncidents).not.toHaveBeenCalled();
    expect(api.listBranchServiceNotices).toHaveBeenCalledOnce();
    expect(overview.incidents).toBeNull();
    expect(overview.serviceNotices).toEqual(serviceNotices);
  });

  it("does not fetch notices without their independent flag or viewing rights", async () => {
    const disabled = fixture({ serviceNoticesEnabled: false });
    await disabled.load(false, true);
    expect(disabled.api.listBranchIncidents).toHaveBeenCalledOnce();
    expect(disabled.api.listBranchServiceNotices).not.toHaveBeenCalled();

    const unpermitted = fixture();
    await unpermitted.load(false, false);
    expect(unpermitted.api.listBranchIncidents).toHaveBeenCalledOnce();
    expect(unpermitted.api.listBranchServiceNotices).not.toHaveBeenCalled();
  });

  it("does not load independent data after assignment access fails", async () => {
    const { api, load } = fixture();
    api.getBranchAssignment.mockRejectedValue(new Error("Not found"));
    await expect(load(false, true)).rejects.toThrow("Not found");
    expect(api.listBranchIncidents).not.toHaveBeenCalled();
    expect(api.listBranchServiceNotices).not.toHaveBeenCalled();
  });
});
