import { describe, expect, it } from "vitest";
import { canResumePaymentRecovery, deriveWorkspaceBillingState } from "@/lib/billingState";

const now = new Date("2026-08-03T00:00:00.000Z");

describe("canResumePaymentRecovery", () => {
  const receipt = {
    agreementBranchId: "branch", organizationId: "org", organizationSubscriptionId: "local",
    authorizedProviderMode: "TEST", authorizedRazorpaySubscriptionId: "sub_original",
    type: "SUBSCRIPTION_AUTHORIZATION", idempotencyKey: "payment-recovery:original",
    status: "AWAITING_PAYMENT", operationStatus: "AWAITING_PROVIDER_CONFIRMATION", resolvedAt: null, failureCategory: null, sequence: 3,
  } as const;
  const current = { id: "local", organizationId: "org", agreementBranchId: "branch", currentAgreementBranchId: "branch",
    razorpaySubscriptionId: "sub_original", providerMode: "TEST", status: "HALTED" } as const;

  it.each(["HALTED", "PAUSED", "PENDING"] as const)("offers the same unresolved recovery for a %s mandate", status => {
    expect(canResumePaymentRecovery(receipt, { ...current, status }, "ACTIVE")).toBe(true);
    expect(canResumePaymentRecovery({ ...receipt, operationStatus: "CHECKOUT_OPEN" }, { ...current, status }, "PENDING_ACTIVATION")).toBe(true);
  });

  it("keeps initial checkout, in-progress verification, review and terminal receipts out of resume", () => {
    for (const change of [
      { idempotencyKey: "subscription-authorization:original" }, { operationStatus: "VERIFYING" },
      { failureCategory: "MANUAL_REVIEW_REQUIRED" }, { resolvedAt: now }, { status: "SUPERSEDED" },
    ] as const) expect(canResumePaymentRecovery({ ...receipt, ...change }, current, "ACTIVE")).toBe(false);
  });

  it("requires the same tenant, agreement, current mandate and provider mode", () => {
    for (const subscription of [
      { organizationId: "other" }, { agreementBranchId: "sibling" }, { currentAgreementBranchId: null },
      { id: "other" }, { razorpaySubscriptionId: "sub_other" }, { providerMode: "LIVE" }, { status: "EXPIRED" },
    ] as const) expect(canResumePaymentRecovery(receipt, { ...current, ...subscription }, "ACTIVE")).toBe(false);
    expect(canResumePaymentRecovery(receipt, current, "ARCHIVED")).toBe(false);
    expect(canResumePaymentRecovery(receipt, current, "REMOVAL_SCHEDULED")).toBe(false);
  });

  it("can recover a historical browser dismissal only until the branch has a newer intent", () => {
    const dismissed = { ...receipt, status: "UNDONE", operationStatus: "ABANDONED", failureCategory: "CHECKOUT_ABANDONED",
      resolvedAt: now } as const;
    expect(canResumePaymentRecovery(dismissed, current, "ACTIVE", 3)).toBe(true);
    expect(canResumePaymentRecovery(dismissed, current, "ACTIVE", 4)).toBe(false);
  });
});

describe("deriveWorkspaceBillingState", () => {
  it.each(["BASIC", "STANDARD", "PRO"] as const)("grants the selected %s trial only until its original expiry", plan => {
    const endsAt = new Date("2026-09-02T00:00:00.000Z");
    const trial = { status: "ACTIVE" as const, endsAt, plan };
    expect(deriveWorkspaceBillingState({ now, trial })).toMatchObject({ effectivePlan: plan, source: "TRIAL", canWrite: true });
    expect(deriveWorkspaceBillingState({ now: endsAt, trial })).toMatchObject({ source: "NONE", canWrite: false });
    expect(trial.endsAt).toEqual(endsAt);
    for (const status of ["EXPIRED", "REVOKED", "AVAILABLE"] as const) {
      expect(deriveWorkspaceBillingState({ now, trial: { ...trial, status } }).canWrite).toBe(false);
    }
  });

  it("retains higher confirmed paid access during a lower-tier trial", () => {
    expect(deriveWorkspaceBillingState({ now, trial: { status: "ACTIVE", plan: "BASIC", endsAt: new Date("2026-09-02") },
      subscription: { plan: "STANDARD", status: "ACTIVE", paidThrough: new Date("2026-09-03") } }))
      .toMatchObject({ effectivePlan: "STANDARD", source: "PAID", canWrite: true });
  });
  it.each([
    ["BASIC", "STANDARD", true], ["BASIC", "PRO", true], ["STANDARD", "PRO", true],
    ["STANDARD", "BASIC", false], ["PRO", "STANDARD", false], ["PRO", "BASIC", false],
  ] as const)("keeps %s to %s access truthful across the paid boundary", (source, target, upgrade) => {
    const boundary = new Date("2026-09-01T00:00:00Z");
    const subscription = { status: "ACTIVE", plan: source, paidThrough: boundary };
    const grant = upgrade ? { plan: target, accessGrantedAt: now, accessRevokedAt: null, graceEndsAt: null } : null;
    expect(deriveWorkspaceBillingState({ now, subscription, authorizedReplacement: grant }))
      .toMatchObject({ effectivePlan: upgrade ? target : source, canWrite: true });
    expect(subscription).toEqual({ status: "ACTIVE", plan: source, paidThrough: boundary });
    expect(deriveWorkspaceBillingState({ now: boundary, subscription })).toMatchObject({ canWrite: false, source: "NONE" });
    expect(deriveWorkspaceBillingState({ now: boundary,
      subscription: { plan: target, status: "ACTIVE", paidThrough: new Date("2026-10-01T00:00:00Z") } }))
      .toMatchObject({ effectivePlan: target, canWrite: true, source: "PAID" });
  });

  it("grants Standard during the owner trial without a card", () => {
    expect(deriveWorkspaceBillingState({
      now,
      trial: { status: "ACTIVE", endsAt: new Date("2026-09-02T00:00:00.000Z") },
      subscription: null,
    })).toMatchObject({ accessMode: "FULL", effectivePlan: "STANDARD", source: "TRIAL" });
  });

  it("does not treat ACTIVE as paid without paidThrough", () => {
    expect(deriveWorkspaceBillingState({
      now,
      subscription: { status: "ACTIVE", plan: "PRO", paidThrough: null },
    })).toMatchObject({ accessMode: "READ_ONLY", canWrite: false });
  });

  it("uses the provider-confirmed paid boundary", () => {
    expect(deriveWorkspaceBillingState({
      now,
      subscription: {
        status: "CANCELLED",
        plan: "PRO",
        paidThrough: new Date("2026-08-20T00:00:00.000Z"),
      },
    })).toMatchObject({ accessMode: "FULL", source: "PAID" });
  });

  it("keeps pending access only through the provider-confirmed paid period", () => {
    expect(deriveWorkspaceBillingState({
      now,
      subscription: {
        status: "PENDING",
        plan: "BASIC",
        paidThrough: new Date("2026-08-20T00:00:00.000Z"),
      },
    })).toMatchObject({ accessMode: "WARNING", canWrite: true, effectivePlan: "BASIC" });
    expect(deriveWorkspaceBillingState({
      now,
      subscription: { status: "PENDING", plan: "BASIC", paidThrough: null },
    })).toMatchObject({ accessMode: "READ_ONLY", canWrite: false });
  });

  it("treats a paused UPI mandate as warning access only through paidThrough", () => {
    expect(deriveWorkspaceBillingState({
      now,
      subscription: {
        status: "PAUSED",
        plan: "PRO",
        paidThrough: new Date("2026-08-20T00:00:00.000Z"),
      },
    })).toMatchObject({ accessMode: "WARNING", canWrite: true, effectivePlan: "PRO" });
    expect(deriveWorkspaceBillingState({
      now,
      subscription: { status: "PAUSED", plan: "PRO", paidThrough: now },
    })).toMatchObject({ accessMode: "READ_ONLY", canWrite: false });
  });

  it("applies an authorized upgrade without changing the paid source plan", () => {
    expect(deriveWorkspaceBillingState({
      now,
      subscription: {
        status: "ACTIVE",
        plan: "BASIC",
        paidThrough: new Date("2026-08-20T00:00:00.000Z"),
      },
      authorizedReplacement: {
        plan: "PRO",
        accessGrantedAt: new Date("2026-08-02T00:00:00.000Z"),
        accessRevokedAt: null,
        graceEndsAt: new Date("2026-09-03T00:00:00.000Z"),
      },
    })).toMatchObject({ accessMode: "FULL", effectivePlan: "PRO" });
  });

  it("allows replacement access during bank grace and revokes it afterward", () => {
    const replacement = {
      plan: "PRO" as const,
      accessGrantedAt: new Date("2026-08-01T00:00:00.000Z"),
      accessRevokedAt: null,
      graceEndsAt: new Date("2026-08-06T00:00:00.000Z"),
    };
    expect(deriveWorkspaceBillingState({
      now: new Date("2026-08-05T00:00:00.000Z"),
      subscription: { status: "CANCELLED", plan: "BASIC", paidThrough: null },
      authorizedReplacement: replacement,
    })).toMatchObject({ accessMode: "WARNING", canWrite: true, effectivePlan: "PRO" });
    expect(deriveWorkspaceBillingState({
      now: new Date("2026-08-07T00:00:00.000Z"),
      subscription: { status: "CANCELLED", plan: "BASIC", paidThrough: null },
      authorizedReplacement: replacement,
    })).toMatchObject({ accessMode: "READ_ONLY", canWrite: false, effectivePlan: "BASIC" });
  });

  it("makes halted and unconverted organizations read-only", () => {
    expect(deriveWorkspaceBillingState({
      now,
      subscription: {
        status: "HALTED",
        plan: "PRO",
        paidThrough: new Date("2026-08-20T00:00:00.000Z"),
      },
    }).accessMode).toBe("READ_ONLY");
    expect(deriveWorkspaceBillingState({ now, subscription: null }).accessMode).toBe("READ_ONLY");
  });
});
