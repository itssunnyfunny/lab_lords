import { describe, expect, it } from "vitest";
import { isApplicationDesignPilotPath } from "@/lib/applicationDesignPilot";

describe("application design pilot route scope", () => {
  it.each([
    "/branch/branch_1",
    "/branch/branch_1/students",
    "/branch/branch_1/seats",
  ])("includes %s", (pathname) => {
    expect(isApplicationDesignPilotPath(pathname)).toBe(true);
  });

  it.each([
    null,
    "/app",
    "/org/org_1",
    "/branch/branch_1/payments",
    "/branch/branch_1/allocations",
    "/branch/branch_1/students/history",
    "/branch",
  ])("excludes %s", (pathname) => {
    expect(isApplicationDesignPilotPath(pathname)).toBe(false);
  });
});
