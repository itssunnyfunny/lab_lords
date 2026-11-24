import { describe, it, expect, beforeEach, afterAll, beforeAll, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { PaymentService } from "@/services/payment.service";
import { StudentService } from "@/services/student.service";
import { reviewFee } from "@/lib/feeBalance";
import { ShiftService } from "@/services/shift.service";
import { MultiShiftService } from "@/services/multiShift.service";
import { resetDatabase, disconnectDatabase, testPrisma } from "@/tests/setup/db";
import {
  createTestWorld,
  createStudent,
  createPayment,
  createStaff,
  createUser,
  createOrg,
  createBranch,
  createShift,
  createSaasSubscription,
} from "@/tests/factories";
import { freezeTime, advanceMonths, restoreTime } from "@/tests/setup/time";
import { addMonths, format } from "date-fns";
import type { Prisma } from "@/app/generated/prisma/client";

/**
 * INTEGRATION TESTS: PaymentService
 *
 * Uses REAL test database.
 * Time is FROZEN to 2026-01-01 by default.
 *
 * Key behaviors under test:
 * 1. generateDuePayments — idempotency (running twice doesn't duplicate)
 * 2. generateDuePayments — catch-up (generates multiple months if behind)
 * 3. listPayments — DUE filter includes overdue
 * 4. listPayments — PAID filter is strict to the month
 * 5. markPaymentAsPaid — updates status + clears MessageDrafts
 * 6. markPaymentAsWaived — updates status
 */

describe("PaymentService Integration", () => {
  beforeAll(() => freezeTime());
  afterAll(async () => {
    restoreTime();
    await disconnectDatabase();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  // ─── generateDuePaymentsForBranch ─────────────────────────────────────────

  describe("generateDuePaymentsForBranch", () => {
    it.each(["manual", "shift", "bundle"] as const)("preserves an accrued positive fee and skips only free anniversaries on %s rate changes", async source => {
      const joinedAt = new Date(2026, 9, 10);
      const novemberDue = new Date(2026, 10, 10);
      freezeTime(new Date(2026, 10, 11));
      try {
        const { user, branch, shift } = await createTestWorld();
        if (source === "shift") await ShiftService.updateShift(user.id, shift.id, { price: 900 });
        let bundleId: string | undefined;
        if (source === "bundle") {
          const evening = await createShift({ branchId: branch.id, name: "Evening", startTime: "17:00", endTime: "21:00" });
          const bundle = await MultiShiftService.createMultiShift(user.id, branch.id, {
            name: "Nov bundle", price: 900, shiftIds: [shift.id, evening.id],
          });
          bundleId = bundle.id;
        }
        const student = await createStudent({ branchId: branch.id, joinedAt, monthlyFee: 900,
          feeLinkedShiftId: source === "shift" ? shift.id : null, feeLinkedMultiShiftId: bundleId });
        async function setRate(price: number) {
          if (bundleId) await MultiShiftService.updateMultiShift(user.id, bundleId, { price });
          else if (source === "shift") await ShiftService.updateShift(user.id, shift.id, { price });
          else await StudentService.updateStudentProfile(user.id, student.id, { monthlyFee: price });
        }
        const generate = () => PaymentService.generateDuePaymentsForBranch(user.id, branch.id);
        const rows = () => testPrisma.payment.findMany({ where: { studentId: student.id },
          orderBy: { dueDate: "asc" }, select: { amount: true, status: true, periodStart: true, dueDate: true } });

        // November's anniversary has accrued, but the scheduled generator has not run.
        await setRate(0);
        freezeTime(new Date(2026, 10, 12));
        await setRate(900);
        await generate();
        const november = { amount: 900, status: "DUE", periodStart: joinedAt, dueDate: novemberDue };
        expect(await rows()).toEqual([november]);

        await setRate(0);
        freezeTime(new Date(2026, 11, 10));
        expect((await generate()).generatedCount).toBe(0);
        freezeTime(new Date(2026, 11, 12));
        await setRate(1050);
        expect((await generate()).generatedCount).toBe(0);
        freezeTime(new Date(2027, 0, 10));
        expect((await generate()).generatedCount).toBe(1);
        expect((await generate()).generatedCount).toBe(0);
        expect(await rows()).toEqual([november, {
          amount: 1050, status: "DUE", periodStart: new Date(2026, 11, 10), dueDate: new Date(2027, 0, 10),
        }]);
      } finally { freezeTime(); }
    });

    it("checks generation permission only for missing dues and respects a legacy payment on the same due day", async () => {
      freezeTime(new Date(2026, 10, 11));
      try {
        const { branch } = await createTestWorld();
        const staff = await createUser();
        await createStaff({ userId: staff.id, branchId: branch.id, role: "STAFF" });
        const student = await createStudent({ branchId: branch.id, joinedAt: new Date(2026, 9, 10), monthlyFee: 900 });
        const makeFree = () => StudentService.updateStudentProfile(staff.id, student.id, { monthlyFee: 0 });
        await expect(makeFree()).rejects.toThrow(/generate_payments/);
        expect((await testPrisma.student.findUniqueOrThrow({ where: { id: student.id } })).monthlyFee).toBe(900);
        expect(await testPrisma.payment.count({ where: { studentId: student.id } })).toBe(0);
        const legacy = await createPayment({ branchId: branch.id, studentId: student.id, amount: 750, status: "WAIVED",
          periodStart: new Date(2026, 9, 1), periodEnd: new Date(2026, 10, 10), dueDate: new Date(2026, 10, 10, 15) });
        await expect(makeFree()).resolves.toMatchObject({ monthlyFee: 0 });
        expect(await testPrisma.payment.findMany({ where: { studentId: student.id } })).toEqual([legacy]);
      } finally { freezeTime(); }
    });

    it("allows Basic owners to set free manual and linked rates before any fee accrues", async () => {
      const owner = await createUser();
      const org = await createOrg({ ownerId: owner.id, billingModelVersion: "WORKSPACE_V2" });
      await createSaasSubscription({ organizationId: org.id, plan: "BASIC" });
      const branch = await createBranch({ organizationId: org.id });
      const morning = await createShift({ branchId: branch.id, price: 900 });
      const manual = await createStudent({ branchId: branch.id, monthlyFee: 900, joinedAt: new Date() });
      const linked = await createStudent({ branchId: branch.id, monthlyFee: 900, joinedAt: new Date(), feeLinkedShiftId: morning.id });
      await expect(StudentService.updateStudentProfile(owner.id, manual.id, { monthlyFee: 0 })).resolves.toMatchObject({ monthlyFee: 0 });
      await ShiftService.updateShift(owner.id, morning.id, { price: 0 });
      expect((await testPrisma.student.findUniqueOrThrow({ where: { id: linked.id } })).monthlyFee).toBe(0);
      expect(await testPrisma.payment.count({ where: { branchId: branch.id } })).toBe(0);
    });
    it("does not recreate debt when deactivation settles dues after generation reads its candidates", async () => {
      const joinedAt = new Date(2026, 0, 1);
      const firstDue = addMonths(joinedAt, 1);
      const { user, branch } = await createTestWorld();
      const student = await createStudent({ branchId: branch.id, joinedAt, monthlyFee: 800 });
      const existing = await createPayment({ branchId: branch.id, studentId: student.id, amount: 800,
        periodStart: joinedAt, periodEnd: firstDue, dueDate: firstDue });
      const findMany = prisma.payment.findMany.bind(prisma.payment);
      const read = vi.spyOn(prisma.payment, "findMany").mockImplementationOnce(args => findMany(args).then(async rows => {
        await StudentService.updateStudentStatus(user.id, student.id, "INACTIVE", "WAIVED", { reviewedDues: [reviewFee(existing)] });
        return rows;
      }) as ReturnType<typeof findMany>);
      try {
        const result = await PaymentService.generateDuePaymentsForBranch(user.id, branch.id, addMonths(joinedAt, 2));
        expect(read).toHaveBeenCalled();
        expect(result).toMatchObject({ totalStudents: 1, generatedCount: 0 });
        expect(await testPrisma.student.findUniqueOrThrow({ where: { id: student.id } })).toMatchObject({ status: "INACTIVE" });
        expect(await testPrisma.payment.findMany({ where: { studentId: student.id }, select: { id: true, status: true } }))
          .toEqual([{ id: existing.id, status: "WAIVED" }]);
      } finally {
        read.mockRestore();
      }
    });

    it("skips completed free anniversaries and bills only the new paid period after a fee change", async () => {
      const joinedAt = new Date(2026, 0, 1);
      const paidPeriod = addMonths(joinedAt, 2);
      freezeTime(new Date(2026, 2, 15));
      try {
        const { user, branch } = await createTestWorld();
        const student = await createStudent({ branchId: branch.id, joinedAt, monthlyFee: 0 });
        const generate = (date: Date) => PaymentService.generateDuePaymentsForBranch(user.id, branch.id, date);
        expect((await generate(new Date())).generatedCount).toBe(0);
        expect(await testPrisma.payment.count({ where: { studentId: student.id } })).toBe(0);
        const legacy = await createPayment({ branchId: branch.id, studentId: student.id, amount: 0, status: "DUE",
          periodStart: joinedAt, periodEnd: addMonths(joinedAt, 1), dueDate: addMonths(joinedAt, 1) });
        expect(await PaymentService.listPayments(user.id, branch.id)).toEqual([]);
        expect(await PaymentService.listPayments(user.id, branch.id, "DUE", new Date(), { limit: 10 }))
          .toMatchObject({ items: [], total: 0 });
        await StudentService.updateStudentProfile(user.id, student.id, { monthlyFee: 950 });
        expect((await generate(new Date())).generatedCount).toBe(0);
        const nextDue = addMonths(paidPeriod, 1);
        expect((await generate(nextDue)).generatedCount).toBe(1);
        expect((await generate(nextDue)).generatedCount).toBe(0);
        expect(await testPrisma.payment.findMany({ where: { studentId: student.id }, orderBy: { dueDate: "asc" } }))
          .toMatchObject([{ id: legacy.id, amount: 0 }, { amount: 950, status: "DUE", periodStart: paidPeriod, dueDate: nextDue }]);
        expect(await PaymentService.listPayments(user.id, branch.id, "DUE", nextDue)).toMatchObject([{ amount: 950 }]);
      } finally {
        freezeTime();
      }
    });

    it("generates 1 payment for a student joined 1 month ago (time advanced by 1 month)", async () => {
      const BASE = new Date("2026-01-01T00:00:00.000Z");
      const { user, branch } = await createTestWorld();
      // Student joined on BASE date
      await createStudent({ branchId: branch.id, joinedAt: BASE, monthlyFee: 1500 });

      // Advance time by 1 month so payment is now due
      advanceMonths(1, BASE); // now = 2026-02-01

      const result = await PaymentService.generateDuePaymentsForBranch(user.id, branch.id, addMonths(BASE, 1));
      expect(result.generatedCount).toBe(1);
      expect(result.totalStudents).toBe(1);
    });

    it("is idempotent — running twice does not create duplicate payments", async () => {
      const BASE = new Date("2026-01-01T00:00:00.000Z");
      const { user, branch } = await createTestWorld();
      await createStudent({ branchId: branch.id, joinedAt: BASE });

      const asOf = addMonths(BASE, 1);
      await PaymentService.generateDuePaymentsForBranch(user.id, branch.id, asOf);
      await PaymentService.generateDuePaymentsForBranch(user.id, branch.id, asOf);

      const payments = await testPrisma.payment.findMany({ where: { branchId: branch.id } });
      // Only 1 payment should exist even though we called it twice
      expect(payments.filter(p => p.type === "MONTHLY")).toHaveLength(1);
    });

    it("allows admission and monthly payments for the same period while preserving typed monthly idempotency", async () => {
      const BASE = new Date("2026-01-01T00:00:00.000Z");
      freezeTime(BASE);
      const { user, branch } = await createTestWorld();
      const student = await StudentService.createStudent(user.id, branch.id, {
        name: "Typed Identity Student",
        phone: "9876543210",
        admissionFee: 2500,
        monthlyFee: 1000,
      });
      const admission = await testPrisma.payment.findFirstOrThrow({
        where: { studentId: student.id, type: "ADMISSION" },
      });

      const asOf = addMonths(BASE, 1);
      const firstRun = await PaymentService.generateDuePaymentsForBranch(user.id, branch.id, asOf);
      const secondRun = await PaymentService.generateDuePaymentsForBranch(user.id, branch.id, asOf);

      const monthly = await testPrisma.payment.findUnique({
        where: {
          studentId_type_periodStart: {
            studentId: student.id,
            type: "MONTHLY",
            periodStart: admission.periodStart,
          },
        },
      });
      const persistedAdmission = await testPrisma.payment.findUnique({
        where: {
          studentId_type_periodStart: {
            studentId: student.id,
            type: "ADMISSION",
            periodStart: admission.periodStart,
          },
        },
      });
      const samePeriodPayments = await testPrisma.payment.findMany({
        where: { studentId: student.id, periodStart: admission.periodStart },
      });

      expect(firstRun.generatedCount).toBe(1);
      expect(secondRun.generatedCount).toBe(0);
      expect(samePeriodPayments).toHaveLength(2);
      expect(new Set(samePeriodPayments.map(payment => payment.type))).toEqual(
        new Set(["ADMISSION", "MONTHLY"])
      );
      expect(persistedAdmission?.id).toBe(admission.id);
      expect(monthly).not.toBeNull();

      await expect(
        createPayment({
          branchId: branch.id,
          studentId: student.id,
          type: "MONTHLY",
          dueDate: asOf,
          periodStart: admission.periodStart,
          periodEnd: asOf,
        })
      ).rejects.toThrow();
    });

    it("catch-up: generates multiple payments if not run for several months", async () => {
      const BASE = new Date("2026-01-01T00:00:00.000Z");
      const { user, branch } = await createTestWorld();
      await createStudent({ branchId: branch.id, joinedAt: BASE });

      // Fast-forward 4 months
      const asOf = addMonths(BASE, 4);
      const result = await PaymentService.generateDuePaymentsForBranch(user.id, branch.id, asOf);
      expect(result.generatedCount).toBe(4);
    });

    it("generates the next monthly due even when the previous monthly due is still unpaid", async () => {
      const BASE = new Date("2026-01-01T00:00:00.000Z");
      const { user, branch } = await createTestWorld();
      const student = await createStudent({ branchId: branch.id, joinedAt: BASE });

      await createPayment({
        branchId: branch.id,
        studentId: student.id,
        dueDate: addMonths(BASE, 1),
        periodStart: BASE,
        periodEnd: addMonths(BASE, 1),
        status: "DUE",
      });

      const result = await PaymentService.generateDuePaymentsForBranch(user.id, branch.id, addMonths(BASE, 2));
      const monthlyPayments = await testPrisma.payment.findMany({
        where: { branchId: branch.id, studentId: student.id, type: "MONTHLY" },
        orderBy: { dueDate: "asc" },
      });

      expect(result.generatedCount).toBe(1);
      expect(monthlyPayments.map(payment => payment.status)).toEqual(["DUE", "DUE"]);
      expect(monthlyPayments.map(payment => format(payment.dueDate, "yyyy-MM-dd"))).toEqual([
        format(addMonths(BASE, 1), "yyyy-MM-dd"),
        format(addMonths(BASE, 2), "yyyy-MM-dd"),
      ]);
    });

    it("does not generate payments for INACTIVE students", async () => {
      const BASE = new Date("2026-01-01T00:00:00.000Z");
      const { user, branch } = await createTestWorld();
      const student = await createStudent({ branchId: branch.id, joinedAt: BASE });

      // Deactivate student
      await testPrisma.student.update({ where: { id: student.id }, data: { status: "INACTIVE" } });

      const result = await PaymentService.generateDuePaymentsForBranch(user.id, branch.id, addMonths(BASE, 2));
      expect(result.generatedCount).toBe(0);
      expect(result.totalStudents).toBe(0);
    });

    it("hides a foreign branch from non-members", async () => {
      const { branch } = await createTestWorld();
      await expect(
        PaymentService.generateDuePaymentsForBranch("wrong_user", branch.id)
      ).rejects.toThrow("Branch not found");
    });

    it("rejects STAFF role users from generating payments", async () => {
      const { branch } = await createTestWorld();
      const staffUser = await createUser();
      await createStaff({ userId: staffUser.id, branchId: branch.id, role: "STAFF" });

      await expect(
        PaymentService.generateDuePaymentsForBranch(staffUser.id, branch.id)
      ).rejects.toThrow(/Unauthorized/i);
    });

    it("rejects payment generation for a read-only branch", async () => {
      const owner = await createUser();
      const organization = await createOrg({
        ownerId: owner.id,
        billingModelVersion: "WORKSPACE_V2",
      });
      const branch = await createBranch({ organizationId: organization.id });

      await expect(
        PaymentService.generateDuePaymentsForBranch(owner.id, branch.id)
      ).rejects.toThrow("paid subscription is required");
    });

    it("allows an authorized manager on a writable branch", async () => {
      const BASE = new Date("2026-01-01T00:00:00.000Z");
      const { branch } = await createTestWorld();
      const manager = await createUser();
      await createStaff({ userId: manager.id, branchId: branch.id, role: "MANAGER" });
      await createStudent({ branchId: branch.id, joinedAt: BASE });

      const result = await PaymentService.generateDuePaymentsForBranch(
        manager.id,
        branch.id,
        addMonths(BASE, 1)
      );

      expect(result.generatedCount).toBe(1);
    });

    it("ensures branch payments without requiring a user id", async () => {
      const BASE = new Date("2026-01-01T00:00:00.000Z");
      const { branch } = await createTestWorld();
      await createStudent({ branchId: branch.id, joinedAt: BASE });

      const result = await PaymentService.ensureDuePaymentsForBranch(branch.id, addMonths(BASE, 2));

      expect(result.generatedCount).toBe(2);
      expect(result.totalStudents).toBe(1);
      expect(result.updatedBranchIds).toEqual([branch.id]);
    });

    it("cron generation covers active students across branches and skips inactive students", async () => {
      const BASE = new Date("2026-01-01T00:00:00.000Z");
      const first = await createTestWorld();
      const second = await createTestWorld();
      const inactive = await createStudent({ branchId: first.branch.id, joinedAt: BASE });

      await createStudent({ branchId: first.branch.id, joinedAt: BASE });
      await createStudent({ branchId: second.branch.id, joinedAt: BASE });
      await testPrisma.student.update({
        where: { id: inactive.id },
        data: { status: "INACTIVE" },
      });

      const result = await PaymentService.generateDuePaymentsForAllActiveStudents(addMonths(BASE, 1));

      expect(result.generatedCount).toBe(2);
      expect(result.totalStudents).toBe(2);
      expect(new Set(result.updatedBranchIds)).toEqual(new Set([first.branch.id, second.branch.id]));
    });

    it("cron generation is idempotent when re-run", async () => {
      const BASE = new Date("2026-01-01T00:00:00.000Z");
      const { branch } = await createTestWorld();
      await createStudent({ branchId: branch.id, joinedAt: BASE });

      await PaymentService.generateDuePaymentsForAllActiveStudents(addMonths(BASE, 1));
      const secondRun = await PaymentService.generateDuePaymentsForAllActiveStudents(addMonths(BASE, 1));

      const payments = await testPrisma.payment.findMany({ where: { branchId: branch.id } });
      expect(payments.filter(p => p.type === "MONTHLY")).toHaveLength(1);
      expect(secondRun.generatedCount).toBe(0);
    });

    it("handles concurrent branch ensures without duplicating payments", async () => {
      const BASE = new Date("2026-01-01T00:00:00.000Z");
      const { branch } = await createTestWorld();
      await createStudent({ branchId: branch.id, joinedAt: BASE });

      const results = await Promise.all([
        PaymentService.ensureDuePaymentsForBranch(branch.id, addMonths(BASE, 1)),
        PaymentService.ensureDuePaymentsForBranch(branch.id, addMonths(BASE, 1)),
      ]);

      const payments = await testPrisma.payment.findMany({ where: { branchId: branch.id } });
      expect(payments.filter(p => p.type === "MONTHLY")).toHaveLength(1);
      expect(results.reduce((sum, result) => sum + result.generatedCount, 0)).toBe(1);
    });
  });

  // ─── listPayments ─────────────────────────────────────────────────────────

  describe("listPayments", () => {
    it("DUE filter includes overdue payments (older than current month)", async () => {
      const BASE = new Date("2026-01-01T00:00:00.000Z");
      const { user, branch } = await createTestWorld();
      const student = await createStudent({ branchId: branch.id, joinedAt: BASE });

      // Create an overdue payment (from 2 months ago)
      await createPayment({
        branchId: branch.id,
        studentId: student.id,
        dueDate: BASE,  // January — asking for February but this should show
        periodStart: BASE,
        periodEnd: addMonths(BASE, 1),
        status: "DUE",
      });

      const february = addMonths(BASE, 1);
      const results = await PaymentService.listPayments(user.id, branch.id, "DUE", february);
      expect(results.length).toBeGreaterThan(0);
      expect(results.every(p => p.status === "DUE")).toBe(true);
    });

    it("PAID filter is strict — only shows payments in the requested month", async () => {
      const BASE = new Date("2026-01-01T00:00:00.000Z");
      const { user, branch } = await createTestWorld();
      const student = await createStudent({ branchId: branch.id, joinedAt: BASE });

      // Create a PAID payment for January
      await createPayment({
        branchId: branch.id,
        studentId: student.id,
        dueDate: BASE,
        periodStart: BASE,
        periodEnd: addMonths(BASE, 1),
        status: "PAID",
      });

      // Ask for February PAID — should return nothing
      const february = addMonths(BASE, 1);
      const results = await PaymentService.listPayments(user.id, branch.id, "PAID", february);
      expect(results).toHaveLength(0);
    });

    it("WAIVED filter is strict like paid payments", async () => {
      const BASE = new Date("2026-01-01T00:00:00.000Z");
      const { user, branch } = await createTestWorld();
      const student = await createStudent({ branchId: branch.id, joinedAt: BASE });
      const januaryWaiver = await createPayment({
        branchId: branch.id,
        studentId: student.id,
        dueDate: BASE,
        periodStart: BASE,
        periodEnd: addMonths(BASE, 1),
        status: "WAIVED",
      });
      const februaryWaiver = await createPayment({
        branchId: branch.id,
        studentId: student.id,
        dueDate: addMonths(BASE, 1),
        periodStart: addMonths(BASE, 1),
        periodEnd: addMonths(BASE, 2),
        status: "WAIVED",
      });

      const results = await PaymentService.listPayments(user.id, branch.id, "WAIVED", addMonths(BASE, 1));

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe(februaryWaiver.id);
      expect(results[0].id).not.toBe(januaryWaiver.id);
    });

    it("monthly mixed view includes waived history records", async () => {
      const BASE = new Date("2026-01-01T00:00:00.000Z");
      const { user, branch } = await createTestWorld();
      const student = await createStudent({ branchId: branch.id, joinedAt: BASE });
      const waiver = await createPayment({
        branchId: branch.id,
        studentId: student.id,
        dueDate: BASE,
        periodStart: BASE,
        periodEnd: addMonths(BASE, 1),
        status: "WAIVED",
      });

      const results = await PaymentService.listPayments(user.id, branch.id, undefined, BASE);

      expect(results.some(payment => payment.id === waiver.id)).toBe(true);
    });

    it("allows STAFF role users to view branch payments", async () => {
      const BASE = new Date("2026-01-01T00:00:00.000Z");
      const { branch } = await createTestWorld();
      const staffUser = await createUser();
      await createStaff({ userId: staffUser.id, branchId: branch.id, role: "STAFF" });
      const student = await createStudent({ branchId: branch.id, joinedAt: BASE });
      await createPayment({
        branchId: branch.id,
        studentId: student.id,
        dueDate: BASE,
        periodStart: BASE,
        periodEnd: addMonths(BASE, 1),
        status: "DUE",
      });

      const results = await PaymentService.listPayments(staffUser.id, branch.id);

      expect(results).toHaveLength(1);
    });
  });

  // ─── markPaymentAsPaid ────────────────────────────────────────────────────

  describe("markPaymentAsPaid", () => {
    it("updates payment status to PAID", async () => {
      const BASE = new Date("2026-01-01T00:00:00.000Z");
      const { user, branch } = await createTestWorld();
      const student = await createStudent({ branchId: branch.id, joinedAt: BASE });
      const payment = await createPayment({
        branchId: branch.id,
        studentId: student.id,
        dueDate: BASE,
        periodStart: BASE,
        periodEnd: addMonths(BASE, 1),
      });

      await PaymentService.markPaymentAsPaid(user.id, payment.id);

      const updated = await testPrisma.payment.findUnique({ where: { id: payment.id } });
      expect(updated?.status).toBe("PAID");
      expect(updated?.paidAt).not.toBeNull();
    });

    it("records a complete immutable PAYMENT_ACTION snapshot alongside the existing audit", async () => {
      const BASE = new Date("2026-01-01T00:00:00.000Z");
      const dueDate = addMonths(BASE, 1);
      const { user, branch } = await createTestWorld();
      const student = await createStudent({ branchId: branch.id, joinedAt: BASE });
      const payment = await createPayment({
        branchId: branch.id,
        studentId: student.id,
        amount: 2750,
        type: "ADMISSION",
        dueDate,
        periodStart: BASE,
        periodEnd: dueDate,
      });

      await PaymentService.markPaymentAsPaid(user.id, payment.id, "UPI", "UPI-REF-123");

      const updated = await testPrisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
      const event = await testPrisma.paymentResolutionEvent.findFirstOrThrow({
        where: { paymentId: payment.id },
      });
      const audit = await testPrisma.auditLog.findFirstOrThrow({
        where: { paymentId: payment.id, action: "PAYMENT_MARKED_PAID" },
      });

      expect(event).toMatchObject({
        paymentId: payment.id,
        branchId: branch.id,
        actorUserId: user.id,
        source: "PAYMENT_ACTION",
        fromStatus: "DUE",
        toStatus: "PAID",
        amount: 2750,
        paymentType: "ADMISSION",
        paymentMethod: "UPI",
        referenceId: "UPI-REF-123",
        details: { collectionId: expect.any(String), actualReceived: 2750 },
      });
      expect(event.periodStart).toEqual(BASE);
      expect(event.dueDate).toEqual(dueDate);
      expect(event.paidAt).toEqual(updated.paidAt);
      expect(event.occurredAt).toEqual(updated.paidAt);
      expect(audit.details).toMatchObject({
        from: "DUE",
        to: "PAID",
        amount: 2750,
        method: "UPI",
        referenceId: "UPI-REF-123",
      });
    });

    it("is idempotent — marking PAID twice does not throw", async () => {
      const BASE = new Date("2026-01-01T00:00:00.000Z");
      const { user, branch } = await createTestWorld();
      const student = await createStudent({ branchId: branch.id, joinedAt: BASE });
      const payment = await createPayment({
        branchId: branch.id,
        studentId: student.id,
        dueDate: BASE,
        periodStart: BASE,
        periodEnd: addMonths(BASE, 1),
      });

      await PaymentService.markPaymentAsPaid(user.id, payment.id);
      await expect(PaymentService.markPaymentAsPaid(user.id, payment.id)).resolves.not.toThrow();

      expect(
        await testPrisma.paymentResolutionEvent.count({ where: { paymentId: payment.id } })
      ).toBe(1);
      expect(
        await testPrisma.auditLog.count({
          where: { paymentId: payment.id, action: "PAYMENT_MARKED_PAID" },
        })
      ).toBe(1);
    });

    it("serializes concurrent mark-paid requests into one transition event and audit", async () => {
      const BASE = new Date("2026-01-01T00:00:00.000Z");
      const { user, branch } = await createTestWorld();
      const student = await createStudent({ branchId: branch.id, joinedAt: BASE });
      const payment = await createPayment({
        branchId: branch.id,
        studentId: student.id,
        dueDate: BASE,
        periodStart: BASE,
        periodEnd: addMonths(BASE, 1),
      });

      await Promise.all([
        PaymentService.markPaymentAsPaid(user.id, payment.id, "CASH"),
        PaymentService.markPaymentAsPaid(user.id, payment.id, "CASH"),
      ]);

      expect(
        await testPrisma.paymentResolutionEvent.count({ where: { paymentId: payment.id } })
      ).toBe(1);
      expect(
        await testPrisma.auditLog.count({ where: { paymentId: payment.id } })
      ).toBe(1);
    });

    it("preserves a fully collected fee and receipt when a waiver has no remaining debt", async () => {
      const BASE = new Date("2026-01-01T00:00:00.000Z");
      freezeTime(BASE);
      const { user, branch } = await createTestWorld();
      const student = await createStudent({ branchId: branch.id, joinedAt: BASE });
      const payment = await createPayment({
        branchId: branch.id,
        studentId: student.id,
        amount: 3100,
        dueDate: addMonths(BASE, 1),
        periodStart: BASE,
        periodEnd: addMonths(BASE, 1),
      });

      await PaymentService.markPaymentAsPaid(user.id, payment.id, "UPI", "ORIGINAL-REF");
      const originalPaidEvent = await testPrisma.paymentResolutionEvent.findFirstOrThrow({
        where: { paymentId: payment.id },
      });

      advanceMonths(1, BASE);
      await PaymentService.markPaymentAsWaived(user.id, payment.id);
      advanceMonths(2, BASE);
      await PaymentService.markPaymentAsPaid(user.id, payment.id);

      const events = await testPrisma.paymentResolutionEvent.findMany({
        where: { paymentId: payment.id },
        orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
      });
      const finalPayment = await testPrisma.payment.findUniqueOrThrow({ where: { id: payment.id } });

      expect(events.map(event => [event.fromStatus, event.toStatus])).toEqual([
        ["DUE", "PAID"],
      ]);
      expect(new Set(events.map(event => event.id)).size).toBe(1);
      expect(events.map(event => event.source)).toEqual([
        "PAYMENT_ACTION",
      ]);
      expect(events[0]).toMatchObject({
        id: originalPaidEvent.id,
        paidAt: originalPaidEvent.paidAt,
        paymentMethod: "UPI",
        referenceId: "ORIGINAL-REF",
      });
      expect(finalPayment).toMatchObject({ status: "PAID", collectedAmount: 3100, waivedAmount: 0, paidAt: originalPaidEvent.paidAt });
      expect(await testPrisma.feeCollection.count({ where: { studentId: student.id } })).toBe(1);
      expect(finalPayment).toMatchObject({
        status: "PAID",
        paymentMethod: "UPI",
        referenceId: "ORIGINAL-REF",
      });
      expect(await testPrisma.auditLog.count({ where: { paymentId: payment.id } })).toBe(1);
    });

    it("creates no payment, audit, or event changes for an unauthorized actor", async () => {
      const BASE = new Date("2026-01-01T00:00:00.000Z");
      const { branch } = await createTestWorld();
      const unauthorized = await createUser();
      const student = await createStudent({ branchId: branch.id, joinedAt: BASE });
      const payment = await createPayment({
        branchId: branch.id,
        studentId: student.id,
        dueDate: BASE,
        periodStart: BASE,
        periodEnd: addMonths(BASE, 1),
      });

      await expect(
        PaymentService.markPaymentAsPaid(unauthorized.id, payment.id)
      ).rejects.toThrow("Payment not found");

      expect((await testPrisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe("DUE");
      expect(await testPrisma.auditLog.count({ where: { paymentId: payment.id } })).toBe(0);
      expect(
        await testPrisma.paymentResolutionEvent.count({ where: { paymentId: payment.id } })
      ).toBe(0);
    });

    it("creates no event when a writable-entitlement check rejects the payment branch", async () => {
      const BASE = new Date("2026-01-01T00:00:00.000Z");
      const owner = await createUser();
      const organization = await createOrg({
        ownerId: owner.id,
        billingModelVersion: "WORKSPACE_V2",
      });
      const branch = await createBranch({ organizationId: organization.id });
      const student = await createStudent({ branchId: branch.id, joinedAt: BASE });
      const payment = await createPayment({
        branchId: branch.id,
        studentId: student.id,
        dueDate: BASE,
        periodStart: BASE,
        periodEnd: addMonths(BASE, 1),
      });

      await expect(PaymentService.markPaymentAsPaid(owner.id, payment.id)).rejects.toThrow(
        /Unauthorized|subscription|required|read-only/i
      );

      expect((await testPrisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe("DUE");
      expect(await testPrisma.auditLog.count({ where: { paymentId: payment.id } })).toBe(0);
      expect(
        await testPrisma.paymentResolutionEvent.count({ where: { paymentId: payment.id } })
      ).toBe(0);
    });

    it("returns the same tenant-safe error for foreign and nonexistent payments without creating events", async () => {
      const BASE = new Date("2026-01-01T00:00:00.000Z");
      const first = await createTestWorld();
      const second = await createTestWorld();
      const student = await createStudent({ branchId: second.branch.id, joinedAt: BASE });
      const payment = await createPayment({
        branchId: second.branch.id,
        studentId: student.id,
        dueDate: BASE,
        periodStart: BASE,
        periodEnd: addMonths(BASE, 1),
      });

      await expect(
        PaymentService.markPaymentAsWaived(first.user.id, payment.id)
      ).rejects.toThrow("Payment not found");
      await expect(
        PaymentService.markPaymentAsWaived(first.user.id, "payment_that_does_not_exist")
      ).rejects.toThrow("Payment not found");

      expect((await testPrisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe("DUE");
      expect(await testPrisma.auditLog.count({ where: { paymentId: payment.id } })).toBe(0);
      expect(
        await testPrisma.paymentResolutionEvent.count({ where: { paymentId: payment.id } })
      ).toBe(0);
    });

    it("rolls back the payment and audit when resolution-event insertion fails", async () => {
      const BASE = new Date("2026-01-01T00:00:00.000Z");
      const { user, branch } = await createTestWorld();
      const student = await createStudent({ branchId: branch.id, joinedAt: BASE });
      const payment = await createPayment({
        branchId: branch.id,
        studentId: student.id,
        dueDate: BASE,
        periodStart: BASE,
        periodEnd: addMonths(BASE, 1),
      });

      await expect(
        testPrisma.$transaction(async tx => {
          const failingEventDelegate = new Proxy(tx.paymentResolutionEvent, {
            get(target, property) {
              if (property === "create") {
                return async () => {
                  throw new Error("forced resolution-event insert failure");
                };
              }
              const value = Reflect.get(target, property, target);
              return typeof value === "function" ? value.bind(target) : value;
            },
          });
          const failingTx = new Proxy(tx, {
            get(target, property) {
              if (property === "paymentResolutionEvent") return failingEventDelegate;
              const value = Reflect.get(target, property, target);
              return typeof value === "function" ? value.bind(target) : value;
            },
          }) as Prisma.TransactionClient;

          return PaymentService.markPaymentAsPaidInTransaction(
            user.id,
            payment.id,
            "CASH",
            undefined,
            failingTx,
            { source: "PAYMENT_ACTION" }
          );
        })
      ).rejects.toThrow("forced resolution-event insert failure");

      const persisted = await testPrisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
      expect(persisted).toMatchObject({
        status: "DUE",
        paidAt: null,
        paymentMethod: null,
        referenceId: null,
      });
      expect(await testPrisma.auditLog.count({ where: { paymentId: payment.id } })).toBe(0);
      expect(
        await testPrisma.paymentResolutionEvent.count({ where: { paymentId: payment.id } })
      ).toBe(0);
    });

    it("rolls back the payment and creates no event when audit insertion fails", async () => {
      const BASE = new Date("2026-01-01T00:00:00.000Z");
      const { user, branch } = await createTestWorld();
      const student = await createStudent({ branchId: branch.id, joinedAt: BASE });
      const payment = await createPayment({
        branchId: branch.id,
        studentId: student.id,
        dueDate: BASE,
        periodStart: BASE,
        periodEnd: addMonths(BASE, 1),
      });

      await expect(
        testPrisma.$transaction(async tx => {
          const failingAuditDelegate = new Proxy(tx.auditLog, {
            get(target, property) {
              if (property === "create") {
                return async () => {
                  throw new Error("forced audit insert failure");
                };
              }
              const value = Reflect.get(target, property, target);
              return typeof value === "function" ? value.bind(target) : value;
            },
          });
          const failingTx = new Proxy(tx, {
            get(target, property) {
              if (property === "auditLog") return failingAuditDelegate;
              const value = Reflect.get(target, property, target);
              return typeof value === "function" ? value.bind(target) : value;
            },
          }) as Prisma.TransactionClient;

          return PaymentService.markPaymentAsPaidInTransaction(
            user.id,
            payment.id,
            "CASH",
            undefined,
            failingTx,
            { source: "PAYMENT_ACTION" }
          );
        })
      ).rejects.toThrow("forced audit insert failure");

      const persisted = await testPrisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
      expect(persisted).toMatchObject({
        status: "DUE",
        paidAt: null,
        paymentMethod: null,
      });
      expect(await testPrisma.auditLog.count({ where: { paymentId: payment.id } })).toBe(0);
      expect(
        await testPrisma.paymentResolutionEvent.count({ where: { paymentId: payment.id } })
      ).toBe(0);
    });

    it("restricts deleting a payment that has immutable resolution history", async () => {
      const BASE = new Date("2026-01-01T00:00:00.000Z");
      const { user, branch } = await createTestWorld();
      const student = await createStudent({ branchId: branch.id, joinedAt: BASE });
      const payment = await createPayment({
        branchId: branch.id,
        studentId: student.id,
        dueDate: BASE,
        periodStart: BASE,
        periodEnd: addMonths(BASE, 1),
      });
      await PaymentService.markPaymentAsPaid(user.id, payment.id);

      await expect(testPrisma.payment.delete({ where: { id: payment.id } })).rejects.toThrow();

      expect(await testPrisma.payment.count({ where: { id: payment.id } })).toBe(1);
      expect(
        await testPrisma.paymentResolutionEvent.count({ where: { paymentId: payment.id } })
      ).toBe(1);
    });

    it("preserves retired message records when the associated payment is paid", async () => {
      const BASE = new Date("2026-01-01T00:00:00.000Z");
      const { user, branch } = await createTestWorld();
      const student = await createStudent({ branchId: branch.id, joinedAt: BASE });
      const payment = await createPayment({
        branchId: branch.id,
        studentId: student.id,
        dueDate: BASE,
        periodStart: BASE,
        periodEnd: addMonths(BASE, 1),
      });

      // Retirement retains historical text; current fee state no longer deletes it.
      await testPrisma.messageDraft.create({
        data: {
          branchId: branch.id,
          studentId: student.id,
          action: "FOLLOW_UP_OVERDUE_PAYMENTS",
          message: "Dear student, your payment is overdue.",
        },
      });

      await PaymentService.markPaymentAsPaid(user.id, payment.id);

      const drafts = await testPrisma.messageDraft.findMany({
        where: { studentId: student.id, action: "FOLLOW_UP_OVERDUE_PAYMENTS" },
      });
      expect(drafts).toHaveLength(1);
    });

    it("records paymentMethod CASH with null referenceId", async () => {
      const BASE = new Date("2026-01-01T00:00:00.000Z");
      const { user, branch } = await createTestWorld();
      const student = await createStudent({ branchId: branch.id, joinedAt: BASE });
      const payment = await createPayment({
        branchId: branch.id,
        studentId: student.id,
        dueDate: BASE,
        periodStart: BASE,
        periodEnd: addMonths(BASE, 1),
      });

      await PaymentService.markPaymentAsPaid(user.id, payment.id, "CASH");

      const updated = await testPrisma.payment.findUnique({ where: { id: payment.id } });
      expect(updated?.paymentMethod).toBe("CASH");
      expect(updated?.referenceId).toBeNull();
    });

    it("records paymentMethod UPI with txn referenceId", async () => {
      const BASE = new Date("2026-01-01T00:00:00.000Z");
      const { user, branch } = await createTestWorld();
      const student = await createStudent({ branchId: branch.id, joinedAt: BASE });
      const payment = await createPayment({
        branchId: branch.id,
        studentId: student.id,
        dueDate: BASE,
        periodStart: BASE,
        periodEnd: addMonths(BASE, 1),
      });

      await PaymentService.markPaymentAsPaid(user.id, payment.id, "UPI", "TXN123ABC");

      const updated = await testPrisma.payment.findUnique({ where: { id: payment.id } });
      expect(updated?.paymentMethod).toBe("UPI");
      expect(updated?.referenceId).toBe("TXN123ABC");
    });

    it("legacy full-payment callers default to a Cash collection when method is omitted", async () => {
      const BASE = new Date("2026-01-01T00:00:00.000Z");
      const { user, branch } = await createTestWorld();
      const student = await createStudent({ branchId: branch.id, joinedAt: BASE });
      const payment = await createPayment({
        branchId: branch.id,
        studentId: student.id,
        dueDate: BASE,
        periodStart: BASE,
        periodEnd: addMonths(BASE, 1),
      });

      await PaymentService.markPaymentAsPaid(user.id, payment.id);

      const updated = await testPrisma.payment.findUnique({ where: { id: payment.id } });
      expect(updated?.paymentMethod).toBe("CASH");
      expect(updated?.referenceId).toBeNull();
    });

    it("allows STAFF role users to mark payments paid", async () => {
      const BASE = new Date("2026-01-01T00:00:00.000Z");
      const { branch } = await createTestWorld();
      const staffUser = await createUser();
      await createStaff({ userId: staffUser.id, branchId: branch.id, role: "STAFF" });
      const student = await createStudent({ branchId: branch.id, joinedAt: BASE });
      const payment = await createPayment({
        branchId: branch.id,
        studentId: student.id,
        dueDate: BASE,
        periodStart: BASE,
        periodEnd: addMonths(BASE, 1),
      });

      await PaymentService.markPaymentAsPaid(staffUser.id, payment.id, "CASH");

      const updated = await testPrisma.payment.findUnique({ where: { id: payment.id } });
      expect(updated?.status).toBe("PAID");
      expect(updated?.paymentMethod).toBe("CASH");
    });
  });


  // ─── markPaymentAsWaived ──────────────────────────────────────────────────

  describe("markPaymentAsWaived", () => {
    it("happy path — status becomes WAIVED", async () => {
      const BASE = new Date("2026-01-01T00:00:00.000Z");
      const { user, branch } = await createTestWorld();
      const student = await createStudent({ branchId: branch.id, joinedAt: BASE });
      const payment = await createPayment({
        branchId: branch.id,
        studentId: student.id,
        dueDate: BASE,
        periodStart: BASE,
        periodEnd: addMonths(BASE, 1),
        status: "DUE",
      });

      await PaymentService.markPaymentAsWaived(user.id, payment.id);

      const updated = await testPrisma.payment.findUnique({ where: { id: payment.id } });
      const auditLog = await testPrisma.auditLog.findFirst({ where: { paymentId: payment.id } });
      expect(updated?.status).toBe("WAIVED");
      expect(auditLog?.action).toBe("PAYMENT_WAIVED");
      expect(auditLog?.details).toMatchObject({
        from: "DUE",
        to: "WAIVED",
        amount: 1000,
      });
    });

    it("is idempotent — marking WAIVED twice does not throw", async () => {
      const BASE = new Date("2026-01-01T00:00:00.000Z");
      const { user, branch } = await createTestWorld();
      const student = await createStudent({ branchId: branch.id, joinedAt: BASE });
      const payment = await createPayment({
        branchId: branch.id,
        studentId: student.id,
        dueDate: BASE,
        periodStart: BASE,
        periodEnd: addMonths(BASE, 1),
        status: "DUE",
      });

      await PaymentService.markPaymentAsWaived(user.id, payment.id);
      await expect(PaymentService.markPaymentAsWaived(user.id, payment.id)).resolves.not.toThrow();

      expect(
        await testPrisma.paymentResolutionEvent.count({ where: { paymentId: payment.id } })
      ).toBe(1);
      expect(
        await testPrisma.auditLog.count({
          where: { paymentId: payment.id, action: "PAYMENT_WAIVED" },
        })
      ).toBe(1);
    });

    it("rejects STAFF role users from waiving payments", async () => {
      const BASE = new Date("2026-01-01T00:00:00.000Z");
      const { branch } = await createTestWorld();
      const staffUser = await createUser();
      await createStaff({ userId: staffUser.id, branchId: branch.id, role: "STAFF" });
      const student = await createStudent({ branchId: branch.id, joinedAt: BASE });
      const payment = await createPayment({
        branchId: branch.id,
        studentId: student.id,
        dueDate: BASE,
        periodStart: BASE,
        periodEnd: addMonths(BASE, 1),
        status: "DUE",
      });

      await expect(
        PaymentService.markPaymentAsWaived(staffUser.id, payment.id)
      ).rejects.toThrow(/Unauthorized/i);
    });
  });

  // ─── listPayments — default (no-status) filter ───────────────────────────

  describe("listPayments — default filter excludes WAIVED", () => {
    it("calling without status arg returns DUE but not WAIVED payments", async () => {
      const BASE = new Date("2026-01-01T00:00:00.000Z");
      const { user, branch } = await createTestWorld();
      const student = await createStudent({ branchId: branch.id, joinedAt: BASE });

      // Create one DUE + one WAIVED payment
      await createPayment({
        branchId: branch.id,
        studentId: student.id,
        dueDate: BASE,
        periodStart: BASE,
        periodEnd: addMonths(BASE, 1),
        status: "DUE",
      });
      await createPayment({
        branchId: branch.id,
        studentId: student.id,
        dueDate: addMonths(BASE, 1),
        periodStart: addMonths(BASE, 1),
        periodEnd: addMonths(BASE, 2),
        status: "WAIVED",
      });

      // Call without status argument — default clause: { status: { not: "WAIVED" } }
      const results = await PaymentService.listPayments(user.id, branch.id);
      expect(results.every(p => p.status !== "WAIVED")).toBe(true);
      expect(results.some(p => p.status === "DUE")).toBe(true);
    });
  });
});
