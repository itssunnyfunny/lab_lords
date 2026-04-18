import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { BranchService } from "@/services/branch.service";
import { resetDatabase, disconnectDatabase, testPrisma } from "@/tests/setup/db";
import { createUser, createOrg } from "@/tests/factories";

/**
 * INTEGRATION TESTS: BranchService
 *
 * Uses REAL test database.
 * Covers:
 * 1. createBranchForOrg — branch created, default shifts, seats, MANAGER staff record
 * 2. getBranchById — found / not found
 */

describe("BranchService Integration", () => {
  afterAll(async () => { await disconnectDatabase(); });
  beforeEach(async () => { await resetDatabase(); });

  // ─── createBranchForOrg ───────────────────────────────────────────────────

  describe("createBranchForOrg", () => {
    it("creates branch linked to correct org", async () => {
      const user = await createUser();
      const org = await createOrg({ ownerId: user.id });

      const branch = await BranchService.createBranchForOrg({
        organizationId: org.id,
        userId: user.id,
        name: "Main Branch",
      });

      expect(branch.organizationId).toBe(org.id);
      expect(branch.name).toBe("Main Branch");
    });

    it("creates default shifts (Morning, Afternoon, Evening, Full Time) when none supplied", async () => {
      const user = await createUser();
      const org = await createOrg({ ownerId: user.id });

      const branch = await BranchService.createBranchForOrg({
        organizationId: org.id,
        userId: user.id,
        name: "Shift Branch",
      });

      const shifts = await testPrisma.shift.findMany({ where: { branchId: branch.id } });
      expect(shifts.length).toBeGreaterThanOrEqual(3);
    });

    it("creates the correct number of seats when seatCount supplied", async () => {
      const user = await createUser();
      const org = await createOrg({ ownerId: user.id });

      const branch = await BranchService.createBranchForOrg({
        organizationId: org.id,
        userId: user.id,
        name: "Seat Branch",
        seatCount: 5,
      });

      const count = await testPrisma.seat.count({ where: { branchId: branch.id } });
      expect(count).toBe(5);
    });

    it("adds calling user as MANAGER on the new branch", async () => {
      const user = await createUser();
      const org = await createOrg({ ownerId: user.id });

      const branch = await BranchService.createBranchForOrg({
        organizationId: org.id,
        userId: user.id,
        name: "Staff Branch",
      });

      const staffRecord = await testPrisma.staff.findFirst({
        where: { userId: user.id, branchId: branch.id },
      });
      expect(staffRecord).not.toBeNull();
      expect(staffRecord!.role).toBe("MANAGER");
    });
  });

  // ─── getBranchById ────────────────────────────────────────────────────────

  describe("getBranchById", () => {
    it("returns null for an unknown id", async () => {
      const result = await BranchService.getBranchById("nonexistent_id");
      expect(result).toBeNull();
    });

    it("returns branch for a valid id", async () => {
      const user = await createUser();
      const org = await createOrg({ ownerId: user.id });
      const branch = await BranchService.createBranchForOrg({
        organizationId: org.id,
        userId: user.id,
        name: "Lookup Branch",
      });

      const found = await BranchService.getBranchById(branch.id);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(branch.id);
    });
  });
});
