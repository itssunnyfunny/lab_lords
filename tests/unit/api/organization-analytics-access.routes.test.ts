import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  findOrganization: vi.fn(),
  organizationSnapshot: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getSessionUser: mocks.getSessionUser }));
vi.mock("@/lib/prisma", () => ({
  prisma: { organization: { findFirst: mocks.findOrganization } },
}));
vi.mock("@/analytics/org.analytics", () => ({ getOrganizationHealthSnapshot: mocks.organizationSnapshot }));
vi.mock("@/analytics/branch.analytics", () => ({ getBranchHealthSnapshot: vi.fn() }));
vi.mock("@/analytics/payment.analytics", () => ({ getOverduePaymentsPage: vi.fn(), getPaymentPeriodStats: vi.fn() }));
vi.mock("@/analytics/trends/branch.trends", () => ({ getBranchOperationalTrend: vi.fn() }));
vi.mock("@/analytics/trends/payment.trends", () => ({ getPaymentTrend: vi.fn() }));
vi.mock("@/analytics/trends/seat.trends", () => ({ getSeatUtilizationTrend: vi.fn() }));

import { EntitlementService, SubscriptionEntitlementError } from "@/services/entitlement.service";
import { GET as snapshot } from "@/app/api/analytics/org/[orgId]/snapshot/route";
import { GET as trends } from "@/app/api/analytics/org/[orgId]/trends/route";

const routes = [
  { name: "snapshot", get: snapshot },
  { name: "trends", get: trends },
];

function invoke(get: typeof snapshot | typeof trends, organizationId = "org_owned") {
  return get(new Request(`https://app.example.test/api/analytics/org/${organizationId}`), {
    params: Promise.resolve({ orgId: organizationId }),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getSessionUser.mockResolvedValue({ id: "owner_requesting" });
  const organizations = [
    { id: "org_owned", ownerId: "owner_requesting" },
    { id: "org_foreign", ownerId: "owner_other" },
  ];
  mocks.findOrganization.mockImplementation(async ({ where }) => (
    organizations.find(organization => organization.id === where.id && organization.ownerId === where.ownerId)
      ?? null
  ));
  mocks.organizationSnapshot.mockResolvedValue({ organization: { totalBranches: 2 } });
  vi.spyOn(EntitlementService, "assertOrganizationEntitlement").mockResolvedValue({
    organizationId: "org_owned",
    plan: "PRO",
    effectivePlan: "PRO",
    subscriptionStatus: "ACTIVE",
    fallbackAccess: false,
    entitlements: ["ADVANCED_ANALYTICS"],
    limits: { maxBranches: null },
    usage: { branches: 2 },
    accessMode: "FULL",
    canWrite: true,
    accessReason: "Authorized test fixture",
    trial: null,
  });
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => vi.restoreAllMocks());

describe("organization analytics owner-access responses", () => {
  it.each(routes)("returns identical generic 404s for foreign and missing organizations: $name", async ({ get }) => {
    const foreign = await invoke(get, "org_foreign");
    const missing = await invoke(get, "org_missing");

    expect(foreign.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(await foreign.json()).toEqual({ error: "Organization not found" });
    expect(await missing.json()).toEqual({ error: "Organization not found" });
    for (const id of ["org_foreign", "org_missing"]) {
      expect(mocks.findOrganization).toHaveBeenCalledWith({
        where: { id, ownerId: "owner_requesting" }, select: { id: true },
      });
    }
    expect(EntitlementService.assertOrganizationEntitlement).not.toHaveBeenCalled();
    expect(mocks.organizationSnapshot).not.toHaveBeenCalled();
  });

  it.each(routes)("preserves 401 without reading organization state: $name", async ({ get }) => {
    mocks.getSessionUser.mockResolvedValue(null);
    const response = await invoke(get);
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
    expect(mocks.findOrganization).not.toHaveBeenCalled();
    expect(EntitlementService.assertOrganizationEntitlement).not.toHaveBeenCalled();
    expect(mocks.organizationSnapshot).not.toHaveBeenCalled();
  });

  it("preserves the snapshot entitlement 403 and does not read aggregates", async () => {
    const error = new SubscriptionEntitlementError("Advanced analytics requires the Standard plan.");
    vi.mocked(EntitlementService.assertOrganizationEntitlement).mockRejectedValue(error);
    const response = await invoke(snapshot);
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: error.message, code: error.code });
    expect(EntitlementService.assertOrganizationEntitlement).toHaveBeenCalledWith(
      "org_owned", "ADVANCED_ANALYTICS", expect.anything()
    );
    expect(mocks.organizationSnapshot).not.toHaveBeenCalled();
  });

  it("returns the unchanged authorized snapshot after owner and entitlement checks", async () => {
    const response = await invoke(snapshot);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ organization: { totalBranches: 2 } });
    expect(mocks.findOrganization).toHaveBeenCalledWith({
      where: { id: "org_owned", ownerId: "owner_requesting" }, select: { id: true },
    });
    expect(EntitlementService.assertOrganizationEntitlement).toHaveBeenCalledWith(
      "org_owned", "ADVANCED_ANALYTICS", expect.anything()
    );
    expect(mocks.organizationSnapshot).toHaveBeenCalledExactlyOnceWith("org_owned");
    expect(vi.mocked(EntitlementService.assertOrganizationEntitlement).mock.invocationCallOrder[0])
      .toBeLessThan(mocks.organizationSnapshot.mock.invocationCallOrder[0]);
  });

  it("preserves the authorized trends placeholder without introducing an entitlement check", async () => {
    const response = await invoke(trends);
    expect(response.status).toBe(501);
    expect(await response.json()).toEqual({ message: "Organization trends not yet implemented" });
    expect(EntitlementService.assertOrganizationEntitlement).not.toHaveBeenCalled();
    expect(mocks.organizationSnapshot).not.toHaveBeenCalled();
  });

  it.each(routes)("does not classify an untyped error by its message: $name", async ({ get }) => {
    mocks.findOrganization.mockRejectedValue(new Error("Organization not found"));
    const response = await invoke(get);
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Internal Server Error" });
    expect(EntitlementService.assertOrganizationEntitlement).not.toHaveBeenCalled();
    expect(mocks.organizationSnapshot).not.toHaveBeenCalled();
  });
});
