import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from "vitest";
import { OnboardingService } from "@/services/onboarding.service";
import { resetDatabase, disconnectDatabase, testPrisma } from "@/tests/setup/db";
import { createUser } from "@/tests/factories";
import { randomUUID } from "node:crypto";
import { OwnerTrialService } from "@/services/ownerTrial.service";
import { BranchService } from "@/services/branch.service";

/**
 * INTEGRATION TESTS: OnboardingService
 *
 * Uses REAL test database.
 * Covers:
 * 1. createNetwork — atomically creates org + branch
 * 2. Default shifts are created
 * 3. Seats are created when seatCount supplied
 * 4. User is added as MANAGER on the branch
 * 5. Durable replay, owner scope, intentional additional workspaces and rollback
 */

describe("OnboardingService Integration", () => {
  afterAll(async () => { await disconnectDatabase(); });
  beforeEach(async () => {
    vi.stubEnv("WORKSPACE_BRANCH_BILLING_V2_ENABLED", "true");
    await resetDatabase();
  });
  afterEach(() => vi.unstubAllEnvs());

  const baseParams = (userId: string) => ({
    userId,
    idempotencyKey: randomUUID(),
    selectedPostTrialPlan: "BASIC" as const,
    ownerPhone: "9876543210",
    orgData: { name: "Bright Academy" },
    branchData: { name: "Main Hall", city: "Delhi", defaultFee: 1200 },
  });

  // ─── createNetwork ────────────────────────────────────────────────────────

  describe("createNetwork", () => {
    it("rejects creation while V2 onboarding is held without writing a legacy workspace", async () => {
      const user = await createUser();
      vi.stubEnv("WORKSPACE_BRANCH_BILLING_V2_ENABLED", "false");
      await expect(OnboardingService.createNetwork(baseParams(user.id))).rejects.toThrow(/temporarily unavailable/i);
      expect(await testPrisma.organization.count()).toBe(0);
      expect(await testPrisma.branch.count()).toBe(0);
    });

    it("creates org and branch atomically — correct ownership chain", async () => {
      const user = await createUser();
      const result = await OnboardingService.createNetwork(baseParams(user.id));
      const org = await testPrisma.organization.findUniqueOrThrow({ where: { id: result.org.id } });
      const branch = await testPrisma.branch.findUniqueOrThrow({ where: { id: result.branch.id } });

      expect(org.ownerId).toBe(user.id);
      expect(branch.organizationId).toBe(org.id);
      expect(org.name).toBe("Bright Academy");
      expect(org.selectedPostTrialPlan).toBe("BASIC");
      expect(org.billingModelVersion).toBe("WORKSPACE_V2");
      const trial = await testPrisma.ownerTrialGrant.findUnique({ where: { ownerId: user.id } });
      expect(trial?.organizationId).toBe(org.id);
      expect(trial?.status).toBe("ACTIVE");
      expect(branch.name).toBe("Main Hall");
      expect(org.contactPhone).toBe("+91 98765 43210");
      expect(branch.contactPhone).toBe("+91 98765 43210");
      await expect(testPrisma.user.findUnique({ where: { id: user.id }, select: { phone: true } })).resolves.toEqual({
        phone: "+91 98765 43210",
      });
    });

    it("requires an owner phone", async () => {
      const user = await createUser();
      await expect(
        OnboardingService.createNetwork({
          ...baseParams(user.id),
          ownerPhone: "",
        })
      ).rejects.toThrow(/owner phone is required/i);
    });

    it("rejects a manipulated or legacy post-trial plan", async () => {
      const user = await createUser();
      await expect(OnboardingService.createNetwork({
        ...baseParams(user.id),
        selectedPostTrialPlan: "AGENT_CONTROL" as "BASIC",
      })).rejects.toThrow("Choose Basic or Standard");

      expect(await testPrisma.organization.count({ where: { ownerId: user.id } })).toBe(0);
    });

    it("creates default shifts on the new branch", async () => {
      const user = await createUser();
      const { branch } = await OnboardingService.createNetwork(baseParams(user.id));

      const shifts = await testPrisma.shift.findMany({
        where: { branchId: branch.id },
        orderBy: { startTime: "asc" },
      });
      expect(shifts.map(shift => ({
        name: shift.name,
        startTime: shift.startTime,
        endTime: shift.endTime,
      }))).toEqual([
        { name: "Morning", startTime: "06:00", endTime: "09:59" },
        { name: "Afternoon", startTime: "10:00", endTime: "15:59" },
        { name: "Evening", startTime: "16:00", endTime: "21:59" },
      ]);

      const fullTime = await testPrisma.multiShift.findUnique({
        where: { branchId_name: { branchId: branch.id, name: "Full Time" } },
        include: { components: { include: { shift: true }, orderBy: { order: "asc" } } },
      });
      expect(fullTime?.components.map(component => component.shift.name)).toEqual(["Morning", "Afternoon", "Evening"]);
    });

    it("skips the default Full Time multi-shift when disabled", async () => {
      const user = await createUser();
      const { branch } = await OnboardingService.createNetwork({
        ...baseParams(user.id),
        includeFullTimeMultiShift: false,
      });

      const fullTimeCount = await testPrisma.multiShift.count({
        where: { branchId: branch.id, name: "Full Time" },
      });
      expect(fullTimeCount).toBe(0);
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

    it("creates custom numbered seats when seatNumbering is supplied", async () => {
      const user = await createUser();
      const { branch } = await OnboardingService.createNetwork({
        ...baseParams(user.id),
        seatCount: 4,
        seatNumbering: {
          mode: "RANGE",
          ranges: [
            { prefix: "A", start: 1, end: 2, separator: "" },
            { prefix: "B", start: 1, end: 2, separator: "" },
          ],
        },
      });

      const seats = await testPrisma.seat.findMany({ where: { branchId: branch.id } });
      expect(seats.map(seat => seat.label).sort()).toEqual(["A1", "A2", "B1", "B2"]);
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

    it("two intentional keys create independent networks and retain one owner trial", async () => {
      const user = await createUser();
      const result1 = await OnboardingService.createNetwork(baseParams(user.id));
      const result2 = await OnboardingService.createNetwork(baseParams(user.id));

      // Two separate org + branch pairs must exist
      expect(result1.org.id).not.toBe(result2.org.id);
      expect(result1.branch.id).not.toBe(result2.branch.id);

      const orgCount = await testPrisma.organization.count({ where: { ownerId: user.id } });
      expect(orgCount).toBe(2);
      expect(await testPrisma.onboardingRequest.count({ where: { ownerId: user.id } })).toBe(2);
      expect(await testPrisma.ownerTrialGrant.count({ where: { ownerId: user.id } })).toBe(1);
    });

    it("concurrent retries commit one network, receipt and trial", async () => {
      const owner = await createUser();
      const command = { ...baseParams(owner.id), seatCount: 3 };
      const results = await Promise.all(Array.from({ length: 4 }, () => OnboardingService.createNetwork(command)));
      expect(results.every(result => result.org.id === results[0].org.id && result.branch.id === results[0].branch.id)).toBe(true);
      expect(await testPrisma.organization.count()).toBe(1);
      expect(await testPrisma.branch.count()).toBe(1);
      expect(await testPrisma.staff.count()).toBe(1);
      expect(await testPrisma.seat.count()).toBe(3);
      expect(await testPrisma.onboardingRequest.count()).toBe(1);
      expect(await testPrisma.ownerTrialGrant.count()).toBe(1);
    });

    it("replays the lost-response command without restoring changed settings or trial state", async () => {
      const owner = await createUser();
      const command = baseParams(owner.id);
      const result = await OnboardingService.createNetwork(command);
      await testPrisma.user.update({ where: { id: owner.id }, data: { phone: "+91 98765 43211" } });
      await testPrisma.organization.update({ where: { id: result.org.id }, data: { name: "Later name", selectedPostTrialPlan: "PRO" } });
      await testPrisma.branch.update({ where: { id: result.branch.id }, data: { billingStatus: "ARCHIVED", name: "Later branch" } });
      await testPrisma.ownerTrialGrant.update({ where: { ownerId: owner.id }, data: { status: "EXPIRED" } });
      const before = await Promise.all([
        testPrisma.user.findUnique({ where: { id: owner.id } }),
        testPrisma.organization.findUnique({ where: { id: result.org.id } }),
        testPrisma.branch.findUnique({ where: { id: result.branch.id } }),
        testPrisma.ownerTrialGrant.findUnique({ where: { ownerId: owner.id } }),
        testPrisma.onboardingRequest.findMany(),
      ]);
      vi.stubEnv("WORKSPACE_BRANCH_BILLING_V2_ENABLED", "false");
      expect(await OnboardingService.createNetwork(command)).toEqual(result);
      const after = await Promise.all([
        testPrisma.user.findUnique({ where: { id: owner.id } }),
        testPrisma.organization.findUnique({ where: { id: result.org.id } }),
        testPrisma.branch.findUnique({ where: { id: result.branch.id } }),
        testPrisma.ownerTrialGrant.findUnique({ where: { ownerId: owner.id } }),
        testPrisma.onboardingRequest.findMany(),
      ]);
      expect(after).toEqual(before);
      expect(await testPrisma.organization.count()).toBe(1);
    });

    it("replays the same receipt after supported branch archival without creating another workspace", async () => {
      const owner = await createUser();
      const command = baseParams(owner.id);
      const result = await OnboardingService.createNetwork(command);
      const trial = await testPrisma.ownerTrialGrant.findUniqueOrThrow({ where: { ownerId: owner.id } });
      const receiptWhere = { ownerId_idempotencyKey: { ownerId: owner.id, idempotencyKey: command.idempotencyKey } };
      const receipt = await testPrisma.onboardingRequest.findUniqueOrThrow({ where: receiptWhere });
      const sibling = await BranchService.createBranchForOrg({
        organizationId: result.org.id,
        userId: owner.id,
        name: "Continuing Hall",
        contactPhone: command.ownerPhone,
        idempotencyKey: randomUUID(),
      });

      const scheduled = await BranchService.scheduleBillingRemoval(owner.id, result.branch.id, randomUUID());
      expect(scheduled).toMatchObject({ action: "NONE", change: { status: "SCHEDULED", effectiveAt: trial.trialEndsAt } });
      const archived = await BranchService.archiveDueBillingRemovals(new Date(trial.trialEndsAt!.getTime() + 1));
      expect(archived).toEqual({ archived: 1 });
      await expect(testPrisma.branch.findUniqueOrThrow({ where: { id: result.branch.id } }))
        .resolves.toMatchObject({ billingStatus: "ARCHIVED" });

      const beforeReplay = await Promise.all([
        testPrisma.organization.count({ where: { ownerId: owner.id } }),
        testPrisma.branch.count({ where: { organizationId: result.org.id } }),
        testPrisma.ownerTrialGrant.count({ where: { ownerId: owner.id } }),
        testPrisma.onboardingRequest.count({ where: { ownerId: owner.id } }),
      ]);
      expect(beforeReplay).toEqual([1, 2, 1, 1]);
      vi.stubEnv("WORKSPACE_BRANCH_BILLING_V2_ENABLED", "false");
      expect(await OnboardingService.createNetwork(command)).toEqual(result);
      expect(await testPrisma.onboardingRequest.findUniqueOrThrow({ where: receiptWhere })).toEqual(receipt);
      expect(await testPrisma.branch.findUniqueOrThrow({ where: { id: result.branch.id } }))
        .toMatchObject({ billingStatus: "ARCHIVED" });
      expect(await testPrisma.branch.findUniqueOrThrow({ where: { id: sibling.id } }))
        .toMatchObject({ billingStatus: "ACTIVE" });
      expect(await Promise.all([
        testPrisma.organization.count({ where: { ownerId: owner.id } }),
        testPrisma.branch.count({ where: { organizationId: result.org.id } }),
        testPrisma.ownerTrialGrant.count({ where: { ownerId: owner.id } }),
        testPrisma.onboardingRequest.count({ where: { ownerId: owner.id } }),
      ])).toEqual(beforeReplay);
    });

    it("rejects changed payload and isolates the same UUID across owners", async () => {
      const owner = await createUser();
      const other = await createUser();
      const command = baseParams(owner.id);
      const first = await OnboardingService.createNetwork(command);
      await expect(OnboardingService.createNetwork({ ...command, branchData: { name: "Changed" } }))
        .rejects.toMatchObject({ code: "ONBOARDING_KEY_CONFLICT", status: 409 });
      const second = await OnboardingService.createNetwork({ ...command, userId: other.id });
      expect(second.org.id).not.toBe(first.org.id);
      expect(await testPrisma.onboardingRequest.count()).toBe(2);
      expect(await testPrisma.organization.count()).toBe(2);
    });

    it("rejects a foreign result even when its receipt has valid independent foreign keys", async () => {
      const owner = await createUser();
      const other = await createUser();
      const command = baseParams(owner.id);
      await OnboardingService.createNetwork(command);
      const foreign = await OnboardingService.createNetwork(baseParams(other.id));
      await testPrisma.onboardingRequest.update({
        where: { ownerId_idempotencyKey: { ownerId: owner.id, idempotencyKey: command.idempotencyKey } },
        data: { organizationId: foreign.org.id, branchId: foreign.branch.id },
      });
      await expect(OnboardingService.createNetwork(command))
        .rejects.toMatchObject({ code: "ONBOARDING_RESULT_NOT_FOUND", message: "Workspace setup result not found." });
      expect(await testPrisma.organization.count()).toBe(2);
    });

    it("rolls back setup and phone changes if the transaction fails before receipt creation", async () => {
      const owner = await createUser();
      const failure = vi.spyOn(OwnerTrialService, "startOnboardingTrial").mockRejectedValueOnce(new Error("Synthetic trial failure"));
      const command = baseParams(owner.id);
      try {
        await expect(OnboardingService.createNetwork(command)).rejects.toThrow("Synthetic trial failure");
      } finally { failure.mockRestore(); }
      expect(await testPrisma.organization.count()).toBe(0);
      expect(await testPrisma.branch.count()).toBe(0);
      expect(await testPrisma.staff.count()).toBe(0);
      expect(await testPrisma.shift.count()).toBe(0);
      expect(await testPrisma.onboardingRequest.count()).toBe(0);
      expect(await testPrisma.ownerTrialGrant.count()).toBe(0);
      expect((await testPrisma.user.findUniqueOrThrow({ where: { id: owner.id } })).phone).toBeNull();
      await OnboardingService.createNetwork(command);
      expect(await testPrisma.onboardingRequest.count()).toBe(1);
    });

    it("rolls back the entire network and trial when receipt insertion itself fails", async () => {
      const owner = await createUser();
      const command = { ...baseParams(owner.id), idempotencyKey: "11111111-1111-4111-8111-111111111111", seatCount: 2 };
      // Test-only fault at the final write, after the real trial was inserted.
      // This suite must only run against the exact verified disposable database.
      await testPrisma.$executeRaw`ALTER TABLE "OnboardingRequest" ADD CONSTRAINT "test_onboarding_receipt_failure"
        CHECK ("idempotencyKey" <> '11111111-1111-4111-8111-111111111111')`;
      try {
        await expect(OnboardingService.createNetwork(command)).rejects.toThrow(/test_onboarding_receipt_failure/);
      } finally {
        await testPrisma.$executeRaw`ALTER TABLE "OnboardingRequest" DROP CONSTRAINT "test_onboarding_receipt_failure"`;
      }
      expect(await testPrisma.organization.count()).toBe(0);
      expect(await testPrisma.branch.count()).toBe(0);
      expect(await testPrisma.shift.count()).toBe(0);
      expect(await testPrisma.multiShift.count()).toBe(0);
      expect(await testPrisma.multiShiftComponent.count()).toBe(0);
      expect(await testPrisma.seat.count()).toBe(0);
      expect(await testPrisma.staff.count()).toBe(0);
      expect(await testPrisma.ownerTrialGrant.count()).toBe(0);
      expect(await testPrisma.onboardingRequest.count()).toBe(0);
      expect((await testPrisma.user.findUniqueOrThrow({ where: { id: owner.id } })).phone).toBeNull();
      await OnboardingService.createNetwork(command);
      expect(await testPrisma.onboardingRequest.count()).toBe(1);
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

    it("creates editable multi-shift bundles from selected onboarding primary shifts", async () => {
      const user = await createUser();
      const { branch } = await OnboardingService.createNetwork({
        ...baseParams(user.id),
        shifts: [
          { name: "Morning", startTime: "06:00", endTime: "09:59", price: 800 },
          { name: "Midday", startTime: "10:00", endTime: "13:59", price: 900 },
          { name: "Afternoon", startTime: "14:00", endTime: "17:59", price: 1000 },
          { name: "Evening", startTime: "18:00", endTime: "21:59", price: 1100 },
        ],
        multiShifts: [
          { name: "Day Pass", price: 1700, componentShiftNames: ["Morning", "Midday"] },
          { name: "Full Day", price: 3600, componentShiftNames: ["Morning", "Midday", "Afternoon", "Evening"] },
        ],
      });

      const multiShifts = await testPrisma.multiShift.findMany({
        where: { branchId: branch.id },
        include: { components: { include: { shift: true }, orderBy: { order: "asc" } } },
        orderBy: { name: "asc" },
      });

      expect(multiShifts).toHaveLength(2);
      expect(multiShifts.map(multiShift => ({
        name: multiShift.name,
        price: multiShift.price,
        components: multiShift.components.map(component => component.shift.name),
      }))).toEqual([
        { name: "Day Pass", price: 1700, components: ["Morning", "Midday"] },
        { name: "Full Day", price: 3600, components: ["Morning", "Midday", "Afternoon", "Evening"] },
      ]);
    });
  });
});
