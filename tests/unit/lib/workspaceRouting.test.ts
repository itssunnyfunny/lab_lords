import { describe, expect, it } from "vitest";
import { resolveWorkspacePath } from "@/lib/workspaceRouting";

describe("resolveWorkspacePath", () => {
  it("routes users with no owned organizations or staff branches to onboarding", () => {
    expect(resolveWorkspacePath({
      ownedOrganizations: [],
      staffBranches: [],
    })).toBe("/onboarding");
  });

  it("opens an owned organization dashboard when it has no branches", () => {
    expect(resolveWorkspacePath({
      ownedOrganizations: [{ id: "org_1", branches: [] }],
      staffBranches: [],
    })).toBe("/org/org_1");
  });

  it("opens the only owned branch directly", () => {
    expect(resolveWorkspacePath({
      ownedOrganizations: [
        {
          id: "org_1",
          branches: [{ id: "branch_1", createdAt: "2026-01-01T00:00:00.000Z" }],
        },
      ],
      staffBranches: [],
    })).toBe("/branch/branch_1");
  });

  it("opens the organization dashboard when the owned organization has multiple branches", () => {
    expect(resolveWorkspacePath({
      ownedOrganizations: [
        {
          id: "org_1",
          branches: [
            { id: "branch_1", createdAt: "2026-01-01T00:00:00.000Z" },
            { id: "branch_2", createdAt: "2026-02-01T00:00:00.000Z" },
          ],
        },
      ],
      staffBranches: [],
    })).toBe("/org/org_1");
  });

  it("does not let a recent branch bypass a multi-branch organization dashboard", () => {
    expect(resolveWorkspacePath({
      lastBranchId: "branch_2",
      ownedOrganizations: [
        {
          id: "org_1",
          branches: [
            { id: "branch_1", createdAt: "2026-01-01T00:00:00.000Z" },
            { id: "branch_2", createdAt: "2026-02-01T00:00:00.000Z" },
          ],
        },
      ],
      staffBranches: [],
    })).toBe("/org/org_1");
  });

  it("opens the organization selector when the user owns multiple organizations", () => {
    expect(resolveWorkspacePath({
      lastBranchId: "branch_2",
      ownedOrganizations: [
        {
          id: "org_1",
          branches: [{ id: "branch_1", createdAt: "2026-01-01T00:00:00.000Z" }],
        },
        {
          id: "org_2",
          branches: [{ id: "branch_2", createdAt: "2026-02-01T00:00:00.000Z" }],
        },
      ],
      staffBranches: [],
    })).toBe("/org");
  });

  it("prioritizes an owned organization over unrelated staff branch access", () => {
    expect(resolveWorkspacePath({
      lastBranchId: "staff_branch",
      ownedOrganizations: [{ id: "org_1", branches: [] }],
      staffBranches: [{ id: "staff_branch", createdAt: "2026-03-01T00:00:00.000Z" }],
    })).toBe("/org/org_1");
  });

  it("uses a valid recent branch for staff-only users", () => {
    expect(resolveWorkspacePath({
      lastBranchId: "branch_old",
      ownedOrganizations: [],
      staffBranches: [
        { id: "branch_old", createdAt: "2026-01-01T00:00:00.000Z" },
        { id: "branch_new", createdAt: "2026-02-01T00:00:00.000Z" },
      ],
    })).toBe("/branch/branch_old");
  });

  it("ignores an inaccessible recent branch for staff-only users", () => {
    expect(resolveWorkspacePath({
      lastBranchId: "branch_attacker",
      ownedOrganizations: [],
      staffBranches: [
        { id: "branch_old", createdAt: "2026-01-01T00:00:00.000Z" },
        { id: "branch_new", createdAt: "2026-02-01T00:00:00.000Z" },
      ],
    })).toBe("/branch/branch_new");
  });

  it("falls back to the newest staff branch when no recent branch is available", () => {
    expect(resolveWorkspacePath({
      ownedOrganizations: [],
      staffBranches: [
        { id: "branch_old", createdAt: "2026-01-01T00:00:00.000Z" },
        { id: "branch_new", createdAt: "2026-02-01T00:00:00.000Z" },
      ],
    })).toBe("/branch/branch_new");
  });
});
