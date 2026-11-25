import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  branchFindUnique: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    branch: { findUnique: mocks.branchFindUnique },
  },
}));

describe("EntitlementService.assertBranchWritable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks direct mutations while branch removal is scheduled", async () => {
    mocks.branchFindUnique.mockResolvedValue({
      id: "branch_1", organizationId: "org_1",
      organization: { id: "org_1", billingModelVersion: "WORKSPACE_V2", _count: {branches: 1} },
      billingAgreement: null,
      billingStatus: "REMOVAL_SCHEDULED",
    });
    const { EntitlementService } = await import("@/services/entitlement.service");
    const organizationWritable = vi
      .spyOn(EntitlementService, "assertOrganizationWritable")
      .mockResolvedValue({} as never);

    await expect(EntitlementService.assertBranchWritable("branch_1"))
      .rejects.toThrow("read-only while removal is scheduled");
    expect(organizationWritable).not.toHaveBeenCalled();
  });
});
