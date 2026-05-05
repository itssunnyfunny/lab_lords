import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { OrganizationService } from "@/services/organization.service";
import { resetDatabase, disconnectDatabase } from "@/tests/setup/db";
import { createUser, createOrg, createBranch } from "@/tests/factories";

/**
 * INTEGRATION TESTS: OrganizationService
 *
 * Uses REAL test database.
 * Covers:
 * 1. createOrganization — creates org linked to owner
 * 2. getOrganizationsByUserId — scoped per user
 * 3. getOrganizationById — includes branches
 * 4. updateOrganization — name change, non-owner throws
 * 5. isOwner — true for owner, false for stranger
 */

describe("OrganizationService Integration", () => {
  afterAll(async () => { await disconnectDatabase(); });
  beforeEach(async () => { await resetDatabase(); });

  // ─── createOrganization ───────────────────────────────────────────────────

  describe("createOrganization", () => {
    it("creates org linked to the correct owner", async () => {
      const user = await createUser();
      const org = await OrganizationService.createOrganization({
        name: "Test Academy",
        ownerId: user.id,
      });

      expect(org.ownerId).toBe(user.id);
      expect(org.name).toBe("Test Academy");
    });
  });

  // ─── getOrganizationsByUserId ──────────────────────────────────────────────

  describe("getOrganizationsByUserId", () => {
    it("returns only orgs belonging to the requesting user", async () => {
      const user1 = await createUser();
      const user2 = await createUser();
      await createOrg({ ownerId: user1.id, name: "Org A" });
      await createOrg({ ownerId: user2.id, name: "Org B" });

      const orgs = await OrganizationService.getOrganizationsByUserId(user1.id);
      expect(orgs).toHaveLength(1);
      expect(orgs[0].name).toBe("Org A");
    });

    it("returns empty array when user has no orgs", async () => {
      const user = await createUser();
      const orgs = await OrganizationService.getOrganizationsByUserId(user.id);
      expect(orgs).toHaveLength(0);
    });
  });

  // ─── getOrganizationById ──────────────────────────────────────────────────

  describe("getOrganizationById", () => {
    it("returns org with branches included", async () => {
      const user = await createUser();
      const org = await createOrg({ ownerId: user.id });
      await createBranch({ organizationId: org.id, name: "Branch One" });

      const found = await OrganizationService.getOrganizationById(org.id);
      expect(found).not.toBeNull();
      expect(found!.branches).toHaveLength(1);
      expect(found!.branches[0].name).toBe("Branch One");
    });

    it("returns null for unknown org id", async () => {
      const found = await OrganizationService.getOrganizationById("nonexistent");
      expect(found).toBeNull();
    });
  });

  // ─── updateOrganization ───────────────────────────────────────────────────

  describe("updateOrganization", () => {
    it("updates org name successfully", async () => {
      const user = await createUser();
      const org = await createOrg({ ownerId: user.id });

      const updated = await OrganizationService.updateOrganization(org.id, user.id, {
        name: "Renamed Academy",
      });

      expect(updated.name).toBe("Renamed Academy");
    });

    it("REJECTS update by non-owner", async () => {
      const owner = await createUser();
      const stranger = await createUser();
      const org = await createOrg({ ownerId: owner.id });

      await expect(
        OrganizationService.updateOrganization(org.id, stranger.id, { name: "Hijacked" })
      ).rejects.toThrow(/Unauthorized/i);
    });

    it("updates persisted organization settings", async () => {
      const user = await createUser();
      const org = await createOrg({ ownerId: user.id });

      const updated = await OrganizationService.updateSettings(org.id, user.id, {
        name: "Settings Academy",
        businessType: "Library",
        legalName: "Settings Academy Pvt Ltd",
        contactEmail: "owner@example.com",
        contactPhone: "+91 99999 99999",
        address: "MG Road, Delhi",
        timezone: "Asia/Kolkata",
        currency: "inr",
        weekStartsOn: 1,
        paymentGraceDays: 5,
      });

      expect(updated.name).toBe("Settings Academy");
      expect(updated.legalName).toBe("Settings Academy Pvt Ltd");
      expect(updated.contactEmail).toBe("owner@example.com");
      expect(updated.currency).toBe("INR");
      expect(updated.paymentGraceDays).toBe(5);
    });

    it("rejects invalid organization settings", async () => {
      const user = await createUser();
      const org = await createOrg({ ownerId: user.id });

      await expect(
        OrganizationService.updateSettings(org.id, user.id, {
          name: "Valid",
          unknownField: true,
        })
      ).rejects.toThrow(/Unknown settings field/i);

      await expect(
        OrganizationService.updateSettings(org.id, user.id, {
          name: "",
        })
      ).rejects.toThrow(/required/i);

      await expect(
        OrganizationService.updateSettings(org.id, user.id, {
          name: "Valid",
          paymentGraceDays: false as unknown as number,
        })
      ).rejects.toThrow(/whole number/i);
    });
  });

  // ─── isOwner ─────────────────────────────────────────────────────────────

  describe("isOwner", () => {
    it("returns true for the actual owner", async () => {
      const user = await createUser();
      const org = await createOrg({ ownerId: user.id });

      const result = await OrganizationService.isOwner(org.id, user.id);
      expect(result).toBe(true);
    });

    it("returns false for a stranger", async () => {
      const owner = await createUser();
      const stranger = await createUser();
      const org = await createOrg({ ownerId: owner.id });

      const result = await OrganizationService.isOwner(org.id, stranger.id);
      expect(result).toBe(false);
    });
  });
});
