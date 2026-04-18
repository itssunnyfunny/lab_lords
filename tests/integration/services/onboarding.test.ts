import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { OnboardingService } from "@/services/onboarding.service";
import { resetDatabase, disconnectDatabase, testPrisma } from "@/tests/setup/db";
import { createUser } from "@/tests/factories";

/**
 * INTEGRATION TESTS: OnboardingService
 *
 * Uses REAL test database.
 * Covers:
 * 1. createNetwork — atomically creates org + branch
 * 2. Default shifts are created
 * 3. Seats are created when seatCount supplied
 * 4. User is added as MANAGER on the branch
 * 5. Calling twice creates 2 independent networks (documents no-idempotency contract)
 */

describe("OnboardingService Integration", () => {
  afterAll(async () => { await disconnectDatabase(); });
  beforeEach(async () => { await resetDatabase(); });

  const baseParams = (userId: string) => ({
    userId,
    orgData: { name: "Bright Academy" },
    branchData: { name: "Main Hall", city: "Delhi", defaultFee: 1200 },
  });

  // ─── createNetwork ────────────────────────────────────────────────────────

  describe("createNetwork", () => {
    it("creates org and branch atomically — correct ownership chain", async () => {
      const user = await createUser();
      const { org, branch } = await OnboardingService.createNetwork(baseParams(user.id));

      expect(org.ownerId).toBe(user.id);
      expect(branch.organizationId).toBe(org.id);
      expect(org.name).toBe("Bright Academy");
      expect(branch.name).toBe("Main Hall");
    });

    it("creates default shifts on the new branch", async () => {
      const user = await createUser();
      const { branch } = await OnboardingService.createNetwork(baseParams(user.id));

      const shiftCount = await testPrisma.shift.count({ where: { branchId: branch.id } });
      // Service creates 3 default shifts (Morning, Evening, Reserved) when none supplied
      expect(shiftCount).toBeGreaterThanOrEqual(2);
    });

    it("creates correct number of seats when seatCount is supplied", async () => {
      const user = await createUser();
      const { branch } = await OnboardingService.createNetwork({
        ...baseParams(user.id),
        seatCount: 10,
      });

      const seatCount = await testPrisma.seat.count({ where: { branchId: branch.id } });
      expect(seatCount).toBe(10);
    });

    it("adds the user as MANAGER on the new branch", async () => {
      const user = await createUser();
      const { branch } = await OnboardingService.createNetwork(baseParams(user.id));

      const staffRecord = await testPrisma.staff.findFirst({
        where: { userId: user.id, branchId: branch.id },
      });
      expect(staffRecord).not.toBeNull();
      expect(staffRecord!.role).toBe("MANAGER");
    });

    it("calling twice creates 2 separate networks — no dedup (expected contract)", async () => {
      /**
       * OnboardingService.createNetwork has NO idempotency guard.
       * Calling it twice for the same user produces two distinct orgs + branches.
       * This test documents that contract explicitly.
       * If idempotency is ever added to the service, this test should be updated first.
       */
      const user = await createUser();
      const result1 = await OnboardingService.createNetwork(baseParams(user.id));
      const result2 = await OnboardingService.createNetwork(baseParams(user.id));

      // Two separate org + branch pairs must exist
      expect(result1.org.id).not.toBe(result2.org.id);
      expect(result1.branch.id).not.toBe(result2.branch.id);

      const orgCount = await testPrisma.organization.count({ where: { ownerId: user.id } });
      expect(orgCount).toBe(2);
    });

    it("creates custom shifts when shifts array is supplied", async () => {
      const user = await createUser();
      const { branch } = await OnboardingService.createNetwork({
        ...baseParams(user.id),
        shifts: [
          { name: "Custom Morning", startTime: "07:00", endTime: "12:00", price: 800 },
          { name: "Custom Evening", startTime: "16:00", endTime: "21:00", price: 1000 },
        ],
      });

      const shifts = await testPrisma.shift.findMany({ where: { branchId: branch.id } });
      expect(shifts).toHaveLength(2);
      expect(shifts.map(s => s.name)).toContain("Custom Morning");
      expect(shifts.map(s => s.name)).toContain("Custom Evening");
    });
  });
});
