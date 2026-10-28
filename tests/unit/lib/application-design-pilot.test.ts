import { describe, expect, it } from "vitest";
import { isApplicationDesignPilotPath, isSelectedApplicationSurfacePath } from "@/lib/applicationDesignPilot";

describe("selected branch presentation route scope", () => {
  it("includes only the dedicated organization billing routes", () => {
    expect(isSelectedApplicationSurfacePath("/org/org_1/billing")).toBe(true);
    expect(isSelectedApplicationSurfacePath("/org/org_1/billing/processing/change_1")).toBe(true);
    expect(isSelectedApplicationSurfacePath("/org/org_1/billing/unrecognized")).toBe(false);
    expect(isSelectedApplicationSurfacePath("/billing")).toBe(false);
  });
  it.each([
    "/branch/branch_1",
    "/branch/branch_1/students",
    "/branch/branch_1/seats",
    "/branch/branch_1/follow-ups",
    "/branch/branch_1/tasks",
    "/branch/branch_1/reports",
    "/branch/branch_1/dashboard-settings",
    "/branch/branch_1/staff",
    "/branch/branch_1/settings",
    "/branch/branch_1/renewals",
    "/branch/branch_1/overdue",
    "/branch/branch_1/allocations",
    "/branch/branch_1/shifts",
    "/branch/branch_1/payments",
    "/branch/branch_1/attendance",
    "/branch/branch_1/analytics",
    "/branch/branch_1/ai/reports",
    "/branch/branch_1/onboarding/import",
    "/branch/branch_1/onboarding/import/session_1",
  ])("includes %s", (pathname) => {
    expect(isApplicationDesignPilotPath(pathname)).toBe(true);
  });

  it.each([
    null,
    "/app",
    "/org/org_1",
    "/branch/branch_1/students/history",
    "/branch",
    "/branch/branch_1/ai/messages",
  ])("excludes %s", (pathname) => {
    expect(isApplicationDesignPilotPath(pathname)).toBe(false);
  });
});
