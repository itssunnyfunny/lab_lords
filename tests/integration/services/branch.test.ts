import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { BranchService } from "@/services/branch.service";
import { resetDatabase, disconnectDatabase, testPrisma } from "@/tests/setup/db";
import { createUser, createOrg, createStaff } from "@/tests/factories";

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

    it("rejects branch creation for an organization the user does not own", async () => {
      const owner = await createUser();
      const otherUser = await createUser();
      const org = await createOrg({ ownerId: owner.id });

      await expect(
        BranchService.createBranchForOrg({
          organizationId: org.id,
          userId: otherUser.id,
          name: "Unauthorized Branch",
        })
      ).rejects.toThrow(/Unauthorized/i);

      await expect(
        testPrisma.branch.count({ where: { organizationId: org.id } })
      ).resolves.toBe(0);
    });

    it("rejects invalid branch creation fields", async () => {
      const user = await createUser();
      const org = await createOrg({ ownerId: user.id });

      await expect(
        BranchService.createBranchForOrg({
          organizationId: org.id,
          userId: user.id,
          name: "",
        })
      ).rejects.toThrow(/required/i);

      await expect(
        BranchService.createBranchForOrg({
          organizationId: org.id,
          userId: user.id,
          name: "Invalid Seats",
          seatCount: -1,
        })
      ).rejects.toThrow(/whole number|at least/i);

      await expect(
        BranchService.createBranchForOrg({
          organizationId: org.id,
          userId: user.id,
          name: "Invalid Shifts",
          shifts: [
            { name: "Morning", startTime: "06:00", endTime: "12:00", price: 0 },
            { name: "Morning", startTime: "13:00", endTime: "18:00", price: 0 },
          ],
        })
      ).rejects.toThrow(/duplicate shift name/i);
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

  describe("getBranchDetails", () => {
    it("allows staff with payment access to read branch metadata without staff records", async () => {
      const owner = await createUser();
      const staff = await createUser();
      const org = await createOrg({ ownerId: owner.id });
      const branch = await BranchService.createBranchForOrg({
        organizationId: org.id,
        userId: owner.id,
        name: "Payment Branch",
      });
      const staffRecord = await createStaff({ userId: staff.id, branchId: branch.id, role: "STAFF" });
      await testPrisma.staffPermissionOverride.create({
        data: {
          staffId: staffRecord.id,
          action: "STUDENTS",
          allowed: false,
        },
      });

      const details = await BranchService.getBranchDetails(staff.id, branch.id);

      expect(details?.id).toBe(branch.id);
      expect(details?._count?.payments).toBe(0);
      expect((details as { staff?: unknown }).staff).toBeUndefined();
    });
  });

  describe("updateSettings", () => {
    it("updates branch settings for the organization owner", async () => {
      const user = await createUser();
      const org = await createOrg({ ownerId: user.id });
      const branch = await BranchService.createBranchForOrg({
        organizationId: org.id,
        userId: user.id,
        name: "Settings Branch",
      });

      const updated = await BranchService.updateSettings(user.id, branch.id, {
        name: "Downtown Branch",
        city: "Delhi",
        address: "Ring Road",
        contactPhone: "+91 99999 99999",
        openingTime: "06:00",
        closingTime: "22:00",
        defaultFee: 1500,
        defaultAdmissionFee: 300,
        defaultMessageLanguage: "hi",
        reminderTone: "firm",
        aiEnabled: false,
      });

      expect(updated.name).toBe("Downtown Branch");
      expect(updated.defaultFee).toBe(1500);
      expect(updated.defaultAdmissionFee).toBe(300);
      expect(updated.defaultMessageLanguage).toBe("hi");
      expect(updated.aiEnabled).toBe(false);
    });

    it("allows branch managers to update branch settings", async () => {
      const owner = await createUser();
      const manager = await createUser();
      const org = await createOrg({ ownerId: owner.id });
      const branch = await BranchService.createBranchForOrg({
        organizationId: org.id,
        userId: owner.id,
        name: "Managed Branch",
      });
      await createStaff({ userId: manager.id, branchId: branch.id, role: "MANAGER" });

      const updated = await BranchService.updateSettings(manager.id, branch.id, {
        name: "Manager Updated",
      });

      expect(updated.name).toBe("Manager Updated");
    });

    it("rejects staff without manage_branch permission", async () => {
      const owner = await createUser();
      const staff = await createUser();
      const org = await createOrg({ ownerId: owner.id });
      const branch = await BranchService.createBranchForOrg({
        organizationId: org.id,
        userId: owner.id,
        name: "Staff Branch",
      });
      await createStaff({ userId: staff.id, branchId: branch.id, role: "STAFF" });

      await expect(
        BranchService.updateSettings(staff.id, branch.id, {
          name: "Not Allowed",
        })
      ).rejects.toThrow(/Unauthorized/i);
    });

    it("rejects invalid branch settings", async () => {
      const user = await createUser();
      const org = await createOrg({ ownerId: user.id });
      const branch = await BranchService.createBranchForOrg({
        organizationId: org.id,
        userId: user.id,
        name: "Invalid Branch",
      });

      await expect(
        BranchService.updateSettings(user.id, branch.id, {
          name: "Valid",
          defaultFee: -1,
        })
      ).rejects.toThrow(/at least 0/i);

      await expect(
        BranchService.updateSettings(user.id, branch.id, {
          name: "Valid",
          defaultFee: false as unknown as number,
        })
      ).rejects.toThrow(/whole number/i);

      await expect(
        BranchService.updateSettings(user.id, branch.id, {
          name: "Valid",
          openingTime: "25:00",
        })
      ).rejects.toThrow(/HH:mm/i);
    });
  });
});
