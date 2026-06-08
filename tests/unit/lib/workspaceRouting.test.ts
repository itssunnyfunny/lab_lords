import { describe, expect, it } from "vitest";
import { resolveWorkspacePath } from "@/lib/workspaceRouting";

describe("resolveWorkspacePath", () => {
  it("routes users with no workspace access to onboarding", () => {
    expect(resolveWorkspacePath({
      ownedOrganizations: [],
      staffBranches: [],
    })).toBe("/onboarding");
  });

  it("uses the last branch hint only when the user can access that branch", () => {
    expect(resolveWorkspacePath({
      lastBranchId: "branch_allowed",
      ownedOrganizations: [
        {
          id: "org_1",
          branches: [
            { id: "branch_allowed", createdAt: "2026-01-01T00:00:00.000Z" },
            { id: "branch_other", createdAt: "2026-02-01T00:00:00.000Z" },
          ],
        },
      ],
      staffBranches: [],
    })).toBe("/branch/branch_allowed");
  });

  it("ignores untrusted last branch hints outside the accessible branch set", () => {
    expect(resolveWorkspacePath({
      lastBranchId: "branch_attacker",
      ownedOrganizations: [
        {
          id: "org_1",
          branches: [
            { id: "branch_allowed_1", createdAt: "2026-01-01T00:00:00.000Z" },
            { id: "branch_allowed_2", createdAt: "2026-02-01T00:00:00.000Z" },
          ],
        },
      ],
      staffBranches: [],
    })).toBe("/org/org_1");
  });

  it("opens the branch dashboard directly when there is only one accessible branch", () => {
    expect(resolveWorkspacePath({
      ownedOrganizations: [
        {
          id: "org_1",
          branches: [{ id: "branch_1", createdAt: "2026-01-01T00:00:00.000Z" }],
        },
      ],
      staffBranches: [{ id: "branch_1", createdAt: "2026-02-01T00:00:00.000Z" }],
    })).toBe("/branch/branch_1");
  });

  it("uses the existing organization branch selector for one owned org with multiple branches", () => {
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

  it("uses the existing organization selector for multiple owned orgs", () => {
    expect(resolveWorkspacePath({
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

  it("uses a safe accessible branch fallback for staff-only users with multiple branches", () => {
    expect(resolveWorkspacePath({
      ownedOrganizations: [],
      staffBranches: [
        { id: "branch_old", createdAt: "2026-01-01T00:00:00.000Z" },
        { id: "branch_new", createdAt: "2026-02-01T00:00:00.000Z" },
      ],
    })).toBe("/branch/branch_new");
  });
});
