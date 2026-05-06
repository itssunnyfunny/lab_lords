import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { StaffInviteService } from "@/services/staffInvite.service";
import { StaffRole } from "@/types";
import { resetDatabase, disconnectDatabase, testPrisma } from "@/tests/setup/db";
import { createStaff, createTestWorld, createUser } from "@/tests/factories";

describe("StaffInviteService Integration", () => {
  afterAll(async () => { await disconnectDatabase(); });
  beforeEach(async () => { await resetDatabase(); });

  describe("createInvite", () => {
    it("creates a one-use invite token for the branch owner", async () => {
      const { user, branch } = await createTestWorld();

      const invite = await StaffInviteService.createInvite(user.id, branch.id, StaffRole.STAFF);

      expect(invite.branchId).toBe(branch.id);
      expect(invite.role).toBe("STAFF");
      expect(invite.token.length).toBeGreaterThan(20);
      expect(invite.expiresAt.getTime()).toBeGreaterThan(Date.now());
      expect(invite.acceptedAt).toBeNull();
    });

    it("rejects branch managers because staff invites are owner-only", async () => {
      const { branch } = await createTestWorld();
      const manager = await createUser();
      await createStaff({ userId: manager.id, branchId: branch.id, role: "MANAGER" });

      await expect(
        StaffInviteService.createInvite(manager.id, branch.id, StaffRole.STAFF)
      ).rejects.toThrow(/Unauthorized/i);
    });
  });

  describe("acceptInvite", () => {
    it("creates the staff membership and marks the invite accepted", async () => {
      const { user, branch } = await createTestWorld();
      const invitedUser = await createUser();
      const invite = await StaffInviteService.createInvite(user.id, branch.id, StaffRole.MANAGER);

      const accepted = await StaffInviteService.acceptInvite(invitedUser.id, invite.token);

      expect(accepted.branchId).toBe(branch.id);
      const staff = await testPrisma.staff.findUnique({
        where: { userId_branchId: { userId: invitedUser.id, branchId: branch.id } },
      });
      expect(staff?.role).toBe("MANAGER");

      const savedInvite = await testPrisma.staffInvite.findUnique({ where: { id: invite.id } });
      expect(savedInvite?.acceptedAt).not.toBeNull();
    });

    it("rejects expired invites", async () => {
      const { branch } = await createTestWorld();
      const invitedUser = await createUser();
      const invite = await testPrisma.staffInvite.create({
        data: {
          branchId: branch.id,
          role: "STAFF",
          token: "expired-token",
          expiresAt: new Date(Date.now() - 60_000),
        },
      });

      await expect(
        StaffInviteService.acceptInvite(invitedUser.id, invite.token)
      ).rejects.toThrow(/expired/i);
    });

    it("does not overwrite an existing staff role when accepting another invite", async () => {
      const { user, branch } = await createTestWorld();
      const invitedUser = await createUser();
      await createStaff({ userId: invitedUser.id, branchId: branch.id, role: "STAFF" });
      const invite = await StaffInviteService.createInvite(user.id, branch.id, StaffRole.MANAGER);

      await StaffInviteService.acceptInvite(invitedUser.id, invite.token);

      const staff = await testPrisma.staff.findUnique({
        where: { userId_branchId: { userId: invitedUser.id, branchId: branch.id } },
      });
      expect(staff?.role).toBe("STAFF");
    });
  });
});
