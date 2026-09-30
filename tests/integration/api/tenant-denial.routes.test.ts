import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET as getPaymentAuditLog } from "@/app/api/payments/[paymentId]/audit-log/route";
import { GET as getOrganizationSnapshot } from "@/app/api/analytics/org/[orgId]/snapshot/route";
import { GET as getOrganizationTrends } from "@/app/api/analytics/org/[orgId]/trends/route";
import { createPayment, createSaasSubscription, createStudent, createTestWorld } from "@/tests/factories";
import { disconnectDatabase, resetDatabase, testPrisma } from "@/tests/setup/db";

const authMock = vi.hoisted(() => ({
  sessionUser: null as { id: string; email?: string } | null,
}));

// Only the Clerk session boundary is replaced. Route, policy, entitlement,
// analytics, and Prisma queries run against the verified disposable database.
vi.mock("@/lib/auth", () => ({
  getSessionUser: vi.fn(() => Promise.resolve(authMock.sessionUser)),
}));

function paymentAuditLog(paymentId: string) {
  return getPaymentAuditLog(
    new NextRequest(`http://test.local/api/payments/${paymentId}/audit-log`),
    { params: Promise.resolve({ paymentId }) }
  );
}

function organizationAnalytics(
  route: typeof getOrganizationSnapshot | typeof getOrganizationTrends,
  orgId: string
) {
  return route(
    new Request(`http://test.local/api/analytics/org/${orgId}`),
    { params: Promise.resolve({ orgId }) }
  );
}

describe("connected tenant-safe route denials", () => {
  beforeEach(async () => {
    await resetDatabase();
    authMock.sessionUser = null;
  });
  afterAll(disconnectDatabase);

  it("MONEY-06 returns the same generic denial for persisted foreign and missing payments", async () => {
    const owner = await createTestWorld();
    const foreign = await createTestWorld();
    const periodStart = new Date("2026-09-01T00:00:00.000Z");
    const periodEnd = new Date("2026-10-01T00:00:00.000Z");
    const ownerStudent = await createStudent({ branchId: owner.branch.id });
    const foreignStudent = await createStudent({ branchId: foreign.branch.id });
    const ownedPayment = await createPayment({
      branchId: owner.branch.id,
      studentId: ownerStudent.id,
      dueDate: periodStart,
      periodStart,
      periodEnd,
    });
    const foreignPayment = await createPayment({
      branchId: foreign.branch.id,
      studentId: foreignStudent.id,
      dueDate: periodStart,
      periodStart,
      periodEnd,
    });
    const ownedLog = await testPrisma.auditLog.create({ data: {
      branchId: owner.branch.id,
      userId: owner.user.id,
      paymentId: ownedPayment.id,
      action: "PAYMENT_MARKED_PAID",
      details: { source: "owned-fixture" },
    } });
    await testPrisma.auditLog.create({ data: {
      branchId: foreign.branch.id,
      userId: foreign.user.id,
      paymentId: foreignPayment.id,
      action: "PAYMENT_MARKED_PAID",
      details: { source: "foreign-fixture" },
    } });
    const missingPaymentId = "missing_payment_for_tenant_denial";
    expect(await testPrisma.payment.findUnique({ where: { id: foreignPayment.id } })).not.toBeNull();
    expect(await testPrisma.payment.findUnique({ where: { id: missingPaymentId } })).toBeNull();
    authMock.sessionUser = { id: owner.user.id, email: owner.user.email };

    const foreignResponse = await paymentAuditLog(foreignPayment.id);
    const missingResponse = await paymentAuditLog(missingPaymentId);
    expect(foreignResponse.status).toBe(404);
    expect(missingResponse.status).toBe(foreignResponse.status);
    expect(await foreignResponse.json()).toEqual({ error: "Payment not found" });
    expect(await missingResponse.json()).toEqual({ error: "Payment not found" });

    const ownedResponse = await paymentAuditLog(ownedPayment.id);
    expect(ownedResponse.status).toBe(200);
    expect(await ownedResponse.json()).toEqual([
      expect.objectContaining({
        id: ownedLog.id,
        branchId: owner.branch.id,
        paymentId: ownedPayment.id,
        user: expect.objectContaining({ id: owner.user.id }),
      }),
    ]);
  });

  it("LEAD-02 returns identical owner denials for both organization analytics routes", async () => {
    const owner = await createTestWorld();
    const foreign = await createTestWorld();
    await createSaasSubscription({ organizationId: owner.org.id, plan: "PRO" });
    const missingOrgId = "missing_org_for_tenant_denial";
    expect(await testPrisma.organization.findUnique({ where: { id: foreign.org.id } })).not.toBeNull();
    expect(await testPrisma.organization.findUnique({ where: { id: missingOrgId } })).toBeNull();
    authMock.sessionUser = { id: owner.user.id, email: owner.user.email };

    for (const route of [getOrganizationSnapshot, getOrganizationTrends]) {
      const foreignResponse = await organizationAnalytics(route, foreign.org.id);
      const missingResponse = await organizationAnalytics(route, missingOrgId);
      expect(foreignResponse.status).toBe(404);
      expect(missingResponse.status).toBe(foreignResponse.status);
      expect(await foreignResponse.json()).toEqual({ error: "Organization not found" });
      expect(await missingResponse.json()).toEqual({ error: "Organization not found" });
    }

    const ownedSnapshot = await organizationAnalytics(getOrganizationSnapshot, owner.org.id);
    expect(ownedSnapshot.status).toBe(200);
    expect(await ownedSnapshot.json()).toMatchObject({
      organization: { totalBranches: 1 },
      branches: [{ branchId: owner.branch.id }],
    });
    const ownedTrends = await organizationAnalytics(getOrganizationTrends, owner.org.id);
    expect(ownedTrends.status).toBe(501);
    expect(await ownedTrends.json()).toEqual({ message: "Organization trends not yet implemented" });
  });
});
