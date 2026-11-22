import { beforeEach, describe, expect, it, vi } from "vitest";
import { STAFF_ACTIONS, type StaffAction } from "@/types";

const mocks = vi.hoisted(() => ({
  getBranchAccess: vi.fn(),
  getBillingExperience: vi.fn(),
  findSeats: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: { seat: { findMany: mocks.findSeats } } }));
vi.mock("@/services/staff.service", () => ({
  StaffService: { getBranchAccess: mocks.getBranchAccess },
}));
vi.mock("@/services/billingExperience.service", () => ({
  BillingExperienceService: { getForBranch: mocks.getBillingExperience },
}));

function permissions(): Record<StaffAction, boolean> {
  return STAFF_ACTIONS.reduce((result, action) => {
    result[action] = true;
    return result;
  }, {} as Record<StaffAction, boolean>);
}

describe("BranchSearchService capability filtering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getBranchAccess.mockResolvedValue({
      branchId: "branch_1",
      branchName: "Main",
      organizationId: "org_1",
      isOwner: true,
      role: "OWNER",
      effectivePlan: "PRO",
      entitlements: ["STAFF_MANAGEMENT", "ADVANCED_ANALYTICS", "AI_ACCESS"],
      permissions: permissions(),
    });
  });

  it("does not suggest mutation actions in a read-only workspace", async () => {
    mocks.getBillingExperience.mockResolvedValue({
      accessMode: "READ_ONLY",
      customerMessage: "Restore billing to make changes.",
      branch: { billingStatus: "ACTIVE" },
    });
    const { BranchSearchService } = await import("@/services/branchSearch.service");

    const groups = await BranchSearchService.search("user_1", "branch_1", "add", {
      types: ["actions"],
    });

    expect(groups.flatMap(group => group.results)).toEqual([]);
  });

  it("keeps permitted mutation actions available in an active writable workspace", async () => {
    mocks.getBillingExperience.mockResolvedValue({
      accessMode: "FULL",
      customerMessage: "",
      branch: { billingStatus: "ACTIVE" },
    });
    const { BranchSearchService } = await import("@/services/branchSearch.service");

    const groups = await BranchSearchService.search("user_1", "branch_1", "add", {
      types: ["actions"],
    });

    expect(groups.flatMap(group => group.results).map(result => result.title))
      .toContain("Add Student");
  });

  it.each([["evening reader", "Evening Reader"], ["A1", "Morning Reader"]])("finds a shared seat by %s with a single occupant projection", async (query, name) => {
    const active = [{ student: { name: "Morning Reader" } }, { student: { name: "Evening Reader" } }];
    mocks.findSeats.mockImplementation(async ({ select }) => {
      const text = { contains: query, mode: "insensitive" };
      expect(select.seatAllocations.where).toEqual({
        endDate: null, student: { branchId: "branch_1" }, OR: [{ student: { name: text } }, { seat: { label: text } }],
      });
      expect(select.seatAllocations.take).toBe(1);
      const matches = active.filter(row => "a1".includes(query.toLowerCase()) || row.student.name.toLowerCase().includes(query.toLowerCase()));
      return [{ id: "s1", label: "A1", seatAllocations: matches.slice(0, select.seatAllocations.take) }];
    });
    const { BranchSearchService } = await import("@/services/branchSearch.service");
    const groups = await BranchSearchService.search("user_1", "branch_1", query, { types: ["seats"] });
    expect(groups[0]?.results).toEqual([expect.objectContaining({ title: "Seat A1", subtitle: `Occupied by ${name}` })]);
  });
});
