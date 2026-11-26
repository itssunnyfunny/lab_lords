import { testPrisma } from "../setup/db";
import { registerHistoricalBillingFixture } from "@/tests/factories/historicalBilling";

/**
 * FACTORY FUNCTIONS — Why These Exist
 *
 * Without factories, every test file manually writes 30+ lines of setup:
 *   const user = await prisma.user.create({ data: { email: "...", id: "..." } })
 *   const org  = await prisma.organization.create(...)
 *   const branch = ...
 *
 * This causes:
 *   - Copy-paste drift (tests use slightly different data shapes)
 *   - Hard-to-read tests (setup noise drowns out the actual assertion)
 *   - Fragile tests when schema changes (update 1 factory, not 20 files)
 *
 * Usage:
 *   const user   = await createUser();
 *   const branch = await createBranch({ ownerId: user.id });
 *   Overrides let you customize only what matters for the test.
 */

let counter = 0;
const uid = () => `test_${++counter}_${Date.now()}`;

// ─── User ─────────────────────────────────────────────────────────────────────

export async function createUser(overrides: { id?: string; clerkId?: string | null; email?: string; name?: string } = {}) {
  return testPrisma.user.create({
    data: {
      id: overrides.id ?? uid(),
      clerkId: overrides.clerkId,
      email: overrides.email ?? `user_${uid()}@test.com`,
      name: overrides.name ?? "Test User",
    },
  });
}

// ─── Organization ─────────────────────────────────────────────────────────────

export async function createOrg(overrides: {
  ownerId: string;
  name?: string;
  id?: string;
  businessType?: string | null;
  paymentGraceDays?: number;
  billingModelVersion?: "LEGACY" | "WORKSPACE_V2" | "BRANCH_V3";
  selectedPostTrialPlan?: "BASIC" | "STANDARD" | "PRO" | null;
  trialPlan?: "BASIC" | "STANDARD" | "PRO" | null;
} & Record<string, unknown>) {
  const now = new Date();
  const organization = await testPrisma.organization.create({
    data: {
      id: overrides.id ?? uid(),
      name: overrides.name ?? "Test Org",
      ownerId: overrides.ownerId,
      businessType: overrides.businessType,
      paymentGraceDays: overrides.paymentGraceDays,
      billingModelVersion: overrides.billingModelVersion ?? "BRANCH_V3",
      ownerTrialGrant: overrides.trialPlan ? { create: { ownerId: overrides.ownerId, trialPlan: overrides.trialPlan,
        status: "ACTIVE", source: "ONBOARDING", trialStartedAt: now, claimedAt: now, consumedAt: now,
        trialEndsAt: new Date(now.getTime() + 30 * 86400000),
      } } : undefined,
      selectedPostTrialPlan: overrides.selectedPostTrialPlan,
    },
  });
  if (organization.billingModelVersion !== "BRANCH_V3") registerHistoricalBillingFixture(organization.id);
  return organization;
}

// ─── Branch ───────────────────────────────────────────────────────────────────

export async function createBranch(overrides: {
  organizationId: string;
  billingStatus?: "ACTIVE" | "PENDING_ACTIVATION" | "REMOVAL_SCHEDULED" | "ARCHIVED";
  selectedPlan?: "BASIC" | "STANDARD" | "PRO";
  name?: string;
  defaultFee?: number;
  defaultAdmissionFee?: number;
  id?: string;
}) {
  const org = await testPrisma.organization.findUniqueOrThrow({
    where: { id: overrides.organizationId }, select: { billingModelVersion: true },
  });
  return testPrisma.branch.create({
    data: {
      id: overrides.id ?? uid(),
      organizationId: overrides.organizationId,
      name: overrides.name ?? "Test Branch",
      billingStatus: overrides.billingStatus,
      billingAgreement: org.billingModelVersion === "BRANCH_V3" ? {
        create: { selectedPlan: overrides.selectedPlan ?? "BASIC" },
      } : undefined,
      defaultFee: overrides.defaultFee ?? 1000,
      defaultAdmissionFee: overrides.defaultAdmissionFee ?? 0,
    },
  });
}

// ─── Shift ────────────────────────────────────────────────────────────────────

export async function createShift(overrides: {
  branchId: string;
  name?: string;
  startTime?: string | null;
  endTime?: string | null;
  price?: number;
  id?: string;
}) {
  return testPrisma.shift.create({
    data: {
      id: overrides.id ?? uid(),
      branchId: overrides.branchId,
      name: overrides.name ?? "Morning",
      startTime: overrides.startTime ?? "06:00",
      endTime: overrides.endTime ?? "11:59",
      price: overrides.price ?? 0,
    },
  });
}

// ─── Seat ─────────────────────────────────────────────────────────────────────

export async function createSeat(overrides: { branchId: string; label?: string; id?: string }) {
  return testPrisma.seat.create({
    data: {
      id: overrides.id ?? uid(),
      branchId: overrides.branchId,
      label: overrides.label ?? `Seat-${uid()}`,
    },
  });
}

// ─── Student ──────────────────────────────────────────────────────────────────

export async function createStudent(overrides: {
  branchId: string;
  name?: string;
  phone?: string;
  monthlyFee?: number;
  feeLinkedShiftId?: string | null;
  feeLinkedMultiShiftId?: string | null;
  joinedAt?: Date;
  billingStartAt?: Date | null;
  id?: string;
}) {
  return testPrisma.student.create({
    data: {
      id: overrides.id ?? uid(),
      branchId: overrides.branchId,
      name: overrides.name ?? "Test Student",
      phone: overrides.phone ?? "9999999999",
      monthlyFee: overrides.monthlyFee ?? 1000,
      feeLinkedShiftId: overrides.feeLinkedShiftId ?? null,
      feeLinkedMultiShiftId: overrides.feeLinkedMultiShiftId ?? null,
      joinedAt: overrides.joinedAt ?? new Date("2026-01-01T00:00:00.000Z"),
      billingStartAt: overrides.billingStartAt ?? null,
      status: "ACTIVE",
    },
  });
}

// ─── SeatAllocation ───────────────────────────────────────────────────────────

export async function createAllocation(overrides: {
  seatId: string;
  studentId: string;
  shiftId: string;
  startDate?: Date;
  endDate?: Date | null;
  id?: string;
}) {
  const seat = await testPrisma.seat.findUniqueOrThrow({ where: { id: overrides.seatId } });
  return testPrisma.seatAllocation.create({
    data: {
      branchId: seat.branchId,
      id: overrides.id ?? uid(),
      seatId: overrides.seatId,
      studentId: overrides.studentId,
      shiftId: overrides.shiftId,
      startDate: overrides.startDate ?? new Date("2026-01-01T00:00:00.000Z"),
      endDate: overrides.endDate ?? null,
    },
  });
}

// ─── Payment ──────────────────────────────────────────────────────────────────

export async function createPayment(overrides: {
  branchId: string;
  studentId: string;
  dueDate: Date;
  periodStart: Date;
  periodEnd: Date;
  amount?: number;
  status?: "DUE" | "PAID" | "WAIVED";
  type?: "MONTHLY" | "ADMISSION";
  paidAt?: Date | null;
  paymentMethod?: "CASH" | "UPI" | "BANK_TRANSFER" | null;
  referenceId?: string | null;
  id?: string;
}) {
  return testPrisma.payment.create({
    data: {
      id: overrides.id ?? uid(),
      branchId: overrides.branchId,
      studentId: overrides.studentId,
      amount: overrides.amount ?? 1000,
      status: overrides.status ?? "DUE",
      type: overrides.type ?? "MONTHLY",
      paidAt: overrides.paidAt ?? null,
      paymentMethod: overrides.paymentMethod ?? null,
      referenceId: overrides.referenceId ?? null,
      dueDate: overrides.dueDate,
      periodStart: overrides.periodStart,
      periodEnd: overrides.periodEnd,
    },
  });
}

// ─── Staff ────────────────────────────────────────────────────────────────────

export async function createStaff(overrides: {
  userId: string;
  branchId: string;
  role?: "MANAGER" | "STAFF";
  id?: string;
}) {
  return testPrisma.staff.create({
    data: {
      id: overrides.id ?? uid(),
      userId: overrides.userId,
      branchId: overrides.branchId,
      role: overrides.role ?? "STAFF",
    },
  });
}

export async function createSaasSubscription(overrides: {
  agreementBranchId?: string;
  organizationId: string;
  quantity?: number;
  plan?: "BASIC" | "STANDARD" | "PRO";
  status?: "AUTHENTICATED" | "ACTIVE" | "PENDING" | "PAUSED" | "HALTED" | "EXPIRED";
  confirmedPaidPeriod?: boolean;
  paidThrough?: Date | null;
}) {
  // Convenience fixtures with exactly one branch have an unambiguous target.
  // Multi-branch cases must choose the agreement; historical fixtures retain their aggregate source.
  let agreementBranchId = overrides.agreementBranchId;
  if (!agreementBranchId) {
    const organization = await testPrisma.organization.findUniqueOrThrow({
      where: { id: overrides.organizationId }, select: { billingModelVersion: true },
    });
    if (organization.billingModelVersion === "BRANCH_V3") {
      const branches = await testPrisma.branchBillingAgreement.findMany({
        where: { organizationId: overrides.organizationId }, select: { branchId: true }, take: 2,
      });
      if (branches.length !== 1) throw new Error("Choose the branch agreement for this subscription fixture.");
      agreementBranchId = branches[0].branchId;
    }
  }
  const plan = overrides.plan ?? "PRO";
  const status = overrides.status ?? "ACTIVE";
  const amount = plan === "BASIC" ? 99 : plan === "STANDARD" ? 299 : 499;
  const quantity = overrides.quantity ?? 1;
  const invoiceAmount = amount * 100 * quantity;
  const now = new Date();
  const periodStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const defaultPeriodEnd = status === "EXPIRED"
    ? new Date(now.getTime() - 60 * 60 * 1000)
    : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const paidThrough = overrides.paidThrough === undefined
    ? defaultPeriodEnd
    : overrides.paidThrough;
  const confirmedPaidPeriod = overrides.confirmedPaidPeriod ?? status === "ACTIVE";
  const razorpayPlanId = `plan_${plan.toLowerCase()}_${uid()}`;
  const razorpaySubscriptionId = `sub_${plan.toLowerCase()}_${uid()}`;
  const subscription = await testPrisma.organizationSubscription.create({
    data: {
      id: uid(),
      organizationId: overrides.organizationId,
      agreementBranchId: agreementBranchId,
      currentAgreementBranchId: agreementBranchId,
      currentOrganizationId: agreementBranchId ? null : overrides.organizationId,
      providerMode: "TEST",
      plan,
      amount,
      quantity,
      amountSubunits: amount * 100,
      currency: "INR",
      period: "monthly",
      interval: 1,
      totalCount: 120,
      razorpayPlanId,
      razorpaySubscriptionId,
      status,
      currentStart: periodStart,
      currentEnd: defaultPeriodEnd,
      paidThrough: confirmedPaidPeriod ? paidThrough : overrides.paidThrough ?? null,
      providerPaymentMethod: confirmedPaidPeriod ? "CARD" : "UNKNOWN",
    },
  });

  if (!confirmedPaidPeriod || !paidThrough) return subscription;

  const coordinator = agreementBranchId ? await testPrisma.branchBillingAgreement.update({
    where: { branchId: agreementBranchId, organizationId: overrides.organizationId },
    data: { billingMutationSequence: { increment: 1 } },
  }) : await testPrisma.organization.update({
    where: { id: overrides.organizationId },
    data: { billingMutationSequence: { increment: 1 } },
  });
  const sequence = coordinator.billingMutationSequence;
  const paymentId = `pay_${uid()}`;
  const invoiceId = `inv_${uid()}`;
  const capturedAt = new Date(periodStart.getTime() - 60 * 60 * 1000);
  const confirmedAt = new Date();
  const change = await testPrisma.organizationBillingChange.create({
    data: {
      organizationId: overrides.organizationId,
      organizationSubscriptionId: subscription.id,
      sequence,
      agreementBranchId: agreementBranchId,
      branchId: agreementBranchId,
      idempotencyKey: `test-confirmed-settlement:${subscription.id}`,
      type: "LEGACY_TRANSITION",
      status: "APPLIED",
      operationStatus: "APPLIED",
      fromPlan: plan,
      toPlan: plan,
      fromQuantity: quantity,
      toQuantity: quantity,
      commercialIntentVersion: 1,
      commercialIntentCapturedAt: capturedAt,
      authorizedProviderMode: "TEST",
      authorizedSourceRazorpaySubscriptionId: razorpaySubscriptionId,
      authorizedRazorpaySubscriptionId: razorpaySubscriptionId,
      authorizedSourceRazorpayPlanId: razorpayPlanId,
      authorizedRazorpayPlanId: razorpayPlanId,
      authorizedPlan: plan,
      authorizedQuantity: quantity,
      authorizedRazorpayOfferId: null,
      authorizedUnitAmountSubunits: amount * 100,
      authorizedGrossAmountSubunits: invoiceAmount,
      authorizedExpectedAmountSubunits: invoiceAmount,
      authorizedOfferValidThroughPaidCount: null,
      authorizedCurrency: "INR",
      authorizedPeriod: "monthly",
      authorizedInterval: 1,
      providerInvoiceId: invoiceId,
      providerPaymentId: paymentId,
      providerConfirmedAt: confirmedAt,
      appliedAt: confirmedAt,
      resolvedAt: confirmedAt,
    },
  });
  await testPrisma.organizationSubscriptionInvoice.create({
    data: {
      agreementBranchId: agreementBranchId,
      organizationId: overrides.organizationId,
      organizationSubscriptionId: subscription.id,
      razorpayInvoiceId: invoiceId,
      razorpayPaymentId: paymentId,
      status: "paid",
      amountSubunits: invoiceAmount,
      amountPaidSubunits: invoiceAmount,
      amountDueSubunits: 0,
      currency: "INR",
      paymentMethod: "CARD",
      commercialEvidenceVersion: 1,
      commercialIntentChangeId: change.id,
      providerMode: "TEST",
      razorpaySubscriptionId,
      razorpayPlanId,
      providerQuantity: quantity,
      razorpayOfferId: null,
      paymentAmountSubunits: invoiceAmount,
      paymentCurrency: "INR",
      paymentStatus: "captured",
      paymentCaptured: true,
      evidenceConfirmedAt: confirmedAt,
      evidenceFailureCode: null,
      periodStart,
      periodEnd: paidThrough,
      issuedAt: periodStart,
      paidAt: confirmedAt,
    },
  });
  return testPrisma.organizationSubscription.update({
    where: { id: subscription.id },
    data: {
      currentEnd: paidThrough,
      paidThrough,
      lastConfirmedInvoiceId: invoiceId,
      lastConfirmedPaymentId: paymentId,
      lastPaymentConfirmedAt: confirmedAt,
      confirmedCommercialIntentChangeId: change.id,
      lastReconciledAt: confirmedAt,
    },
  });
}

// ─── Convenience: full world ───────────────────────────────────────────────────

/**
 * Creates a complete test world: User → Org → Branch → Shift → Seat.
 * Use this as your starting point in integration tests.
 *
 * Returns: { user, org, branch, shift, seat }
 */
export async function createTestWorld(overrides: {
  trialPlan?: "BASIC" | "STANDARD" | "PRO" | null;
  shiftName?: string;
  shiftStart?: string;
  shiftEnd?: string;
  defaultFee?: number;
  defaultAdmissionFee?: number;
} = {}) {
  const user = await createUser();
  const org = await createOrg({ ownerId: user.id, trialPlan: overrides.trialPlan === undefined ? "BASIC" : overrides.trialPlan });
  const branch = await createBranch({
    organizationId: org.id,
    defaultFee: overrides.defaultFee,
    defaultAdmissionFee: overrides.defaultAdmissionFee,
  });
  const shift = await createShift({
    branchId: branch.id,
    name: overrides.shiftName ?? "Morning",
    startTime: overrides.shiftStart ?? "06:00",
    endTime: overrides.shiftEnd ?? "11:59",
  });
  const seat = await createSeat({ branchId: branch.id });
  return { user, org, branch, shift, seat };
}
