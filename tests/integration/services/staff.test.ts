import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { StaffService } from "@/services/staff.service";
import { StaffRole } from "@/types";
import { resetDatabase, disconnectDatabase, testPrisma } from "@/tests/setup/db";
import {
  createTestWorld,
  createUser,
  createStaff,
} from "@/tests/factories";

/**
 * INTEGRATION TESTS: StaffService
 *
 * Uses REAL test database.
 * Covers:
 * 1. authorize() — owner always passes, MANAGER/STAFF role matrix, no-record throws
 * 2. addStaff() — happy path, target user not found, duplicate guard
 * 3. removeStaff() — happy path, non-owner blocked
 * 4. updateStaffRole() — role change persists
 * 5. listStaff() — owner can list, MANAGER can list, STAFF cannot list
 *
 * Note: Unit-level PERMISSION_MATRIX tests live in tests/unit/services/staff.test.ts.
 * This file tests the full DB-backed CRUD paths.
 */

describe("StaffService Integration", () => {
  afterAll(async () => { await disconnectDatabase(); });
  beforeEach(async () => { await resetDatabase(); });

  // ─── authorize ────────────────────────────────────────────────────────────

  describe("authorize", () => {
    it("Owner is always allowed for any action", async () => {
      const { user, branch } = await createTestWorld();
      await expect(StaffService.authorize(user.id, branch.id, "staff_management")).resolves.toBe(true);
      await expect(StaffService.authorize(user.id, branch.id, "manage_org")).resolves.toBe(true);
      await expect(StaffService.authorize(user.id, branch.id, "generate_payments")).resolves.toBe(true);
    });

    it("MANAGER is allowed for manage_branch", async () => {
      const { branch } = await createTestWorld();
      const managerUser = await createUser();
      await createStaff({ userId: managerUser.id, branchId: branch.id, role: "MANAGER" });

      await expect(
        StaffService.authorize(managerUser.id, branch.id, "manage_branch")
      ).resolves.toBe(true);
    });

    it("STAFF is denied for generate_payments", async () => {
      const { branch } = await createTestWorld();
      const staffUser = await createUser();
      await createStaff({ userId: staffUser.id, branchId: branch.id, role: "STAFF" });

      await expect(
        StaffService.authorize(staffUser.id, branch.id, "generate_payments")
      ).rejects.toThrow(/Unauthorized/i);
    });

    it("throws if user has no staff record on the branch", async () => {
      const { branch } = await createTestWorld();
      const stranger = await createUser();

      await expect(
        StaffService.authorize(stranger.id, branch.id, "students")
      ).rejects.toThrow(/Not a staff member/i);
    });
  });

  // ─── addStaff ─────────────────────────────────────────────────────────────

  describe("addStaff", () => {
    it("happy path — creates staff record with correct role", async () => {
      const { user, branch } = await createTestWorld();
      const targetUser = await createUser();

      await StaffService.addStaff(user.id, branch.id, targetUser.id, StaffRole.MANAGER);

      const record = await testPrisma.staff.findUnique({
        where: { userId_branchId: { userId: targetUser.id, branchId: branch.id } },
      });
      expect(record).not.toBeNull();
      expect(record!.role).toBe("MANAGER");
    });

    it("REJECTS if target user does not exist", async () => {
      const { user, branch } = await createTestWorld();

      await expect(
        StaffService.addStaff(user.id, branch.id, "nonexistent_user_id", StaffRole.STAFF)
      ).rejects.toThrow(/not found/i);
    });

    it("REJECTS duplicate staff (same user added twice to same branch)", async () => {
      const { user, branch } = await createTestWorld();
      const targetUser = await createUser();

      await StaffService.addStaff(user.id, branch.id, targetUser.id, StaffRole.STAFF);

      await expect(
        StaffService.addStaff(user.id, branch.id, targetUser.id, StaffRole.MANAGER)
      ).rejects.toThrow(/already a staff/i);
    });

    it("REJECTS if actor is not the owner (non-owner cannot manage staff)", async () => {
      const { branch } = await createTestWorld();
      const nonOwner = await createUser();
      const targetUser = await createUser();

      await expect(
        StaffService.addStaff(nonOwner.id, branch.id, targetUser.id, StaffRole.STAFF)
      ).rejects.toThrow(/Unauthorized/i);
    });
  });

  // ─── removeStaff ──────────────────────────────────────────────────────────

  describe("removeStaff", () => {
    it("happy path — staff record is deleted from DB", async () => {
      const { user, branch } = await createTestWorld();
      const targetUser = await createUser();
      const staffRecord = await createStaff({ userId: targetUser.id, branchId: branch.id, role: "STAFF" });

      await StaffService.removeStaff(user.id, branch.id, staffRecord.id);

      const deleted = await testPrisma.staff.findUnique({ where: { id: staffRecord.id } });
      expect(deleted).toBeNull();
    });

    it("REJECTS if actor is not the owner", async () => {
      const { branch } = await createTestWorld();
      const nonOwner = await createUser();
      const targetUser = await createUser();
      const staffRecord = await createStaff({ userId: targetUser.id, branchId: branch.id, role: "STAFF" });

      await expect(
        StaffService.removeStaff(nonOwner.id, branch.id, staffRecord.id)
      ).rejects.toThrow(/Unauthorized/i);
    });
  });

  // ─── updateStaffRole ──────────────────────────────────────────────────────

  describe("updateStaffRole", () => {
    it("role change persists in the database", async () => {
      const { user, branch } = await createTestWorld();
      const targetUser = await createUser();
      const staffRecord = await createStaff({ userId: targetUser.id, branchId: branch.id, role: "STAFF" });

      await StaffService.updateStaffRole(user.id, branch.id, staffRecord.id, StaffRole.MANAGER);

      const updated = await testPrisma.staff.findUnique({ where: { id: staffRecord.id } });
      expect(updated!.role).toBe("MANAGER");
    });
  });

  // ─── listStaff ────────────────────────────────────────────────────────────

  describe("listStaff", () => {
    it("owner can list staff — returns records with user name and email", async () => {
      const { user, branch } = await createTestWorld();
      const targetUser = await createUser({ name: "Staff Member", email: "staff@test.com" });
      await createStaff({ userId: targetUser.id, branchId: branch.id, role: "STAFF" });

      const list = await StaffService.listStaff(user.id, branch.id);
      const found = list.find(s => s.userId === targetUser.id);
      expect(found).toBeDefined();
      expect(found!.user.name).toBe("Staff Member");
      expect(found!.user.email).toBe("staff@test.com");
    });

    it("MANAGER can list staff (manage_branch gate allows MANAGER)", async () => {
      const { branch } = await createTestWorld();
      const managerUser = await createUser();
      await createStaff({ userId: managerUser.id, branchId: branch.id, role: "MANAGER" });

      await expect(
        StaffService.listStaff(managerUser.id, branch.id)
      ).resolves.toBeDefined();
    });

    it("STAFF cannot list staff — denied by manage_branch gate", async () => {
      const { branch } = await createTestWorld();
      const staffUser = await createUser();
      await createStaff({ userId: staffUser.id, branchId: branch.id, role: "STAFF" });

      await expect(
        StaffService.listStaff(staffUser.id, branch.id)
      ).rejects.toThrow(/Unauthorized/i);
    });
  });
});
