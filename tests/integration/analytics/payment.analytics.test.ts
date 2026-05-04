import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { addMonths } from "date-fns";
import { getPaymentPeriodStats } from "@/analytics/payment.analytics";
import { getSeatUtilizationTrend } from "@/analytics/trends/seat.trends";
import { GET as getBranchSnapshot } from "@/app/api/analytics/branch/[branchId]/snapshot/route";
import { resetDatabase, disconnectDatabase, testPrisma } from "@/tests/setup/db";
import {
  createAllocation,
  createBranch,
  createOrg,
  createPayment,
  createSeat,
  createShift,
  createStudent,
  createTestWorld,
  createUser,
} from "@/tests/factories";

describe("Analytics corrections", () => {
  afterAll(async () => {
    await disconnectDatabase();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  describe("getPaymentPeriodStats", () => {
    it("separates monthly revenue, monthly collected, and all due correctly", async () => {
      const asOf = new Date("2026-03-15T12:00:00.000Z");
      const { branch } = await createTestWorld();
      const students = await Promise.all([
        createStudent({ branchId: branch.id, name: "A" }),
        createStudent({ branchId: branch.id, name: "B" }),
        createStudent({ branchId: branch.id, name: "C" }),
        createStudent({ branchId: branch.id, name: "D" }),
        createStudent({ branchId: branch.id, name: "E" }),
        createStudent({ branchId: branch.id, name: "F" }),
      ]);

      await createPayment({
        branchId: branch.id,
        studentId: students[0].id,
        dueDate: new Date("2026-01-10T00:00:00.000Z"),
        periodStart: new Date("2026-01-01T00:00:00.000Z"),
        periodEnd: new Date("2026-01-31T00:00:00.000Z"),
        amount: 100,
        status: "DUE",
      });

      await createPayment({
        branchId: branch.id,
        studentId: students[1].id,
        dueDate: new Date("2026-03-10T00:00:00.000Z"),
        periodStart: new Date("2026-03-01T00:00:00.000Z"),
        periodEnd: new Date("2026-03-31T00:00:00.000Z"),
        amount: 200,
        status: "DUE",
      });

      const paidInMarch = await createPayment({
        branchId: branch.id,
        studentId: students[2].id,
        dueDate: new Date("2026-02-10T00:00:00.000Z"),
        periodStart: new Date("2026-02-01T00:00:00.000Z"),
        periodEnd: new Date("2026-02-28T00:00:00.000Z"),
        amount: 400,
        status: "PAID",
      });
      await testPrisma.payment.update({
        where: { id: paidInMarch.id },
        data: { paidAt: new Date("2026-03-05T00:00:00.000Z") },
      });

      await createPayment({
        branchId: branch.id,
        studentId: students[3].id,
        dueDate: new Date("2026-03-12T00:00:00.000Z"),
        periodStart: new Date("2026-03-01T00:00:00.000Z"),
        periodEnd: new Date("2026-03-31T00:00:00.000Z"),
        amount: 500,
        status: "PAID",
      });

      await createPayment({
        branchId: branch.id,
        studentId: students[4].id,
        dueDate: new Date("2026-04-10T00:00:00.000Z"),
        periodStart: new Date("2026-04-01T00:00:00.000Z"),
        periodEnd: new Date("2026-04-30T00:00:00.000Z"),
        amount: 900,
        status: "DUE",
      });

      await createPayment({
        branchId: branch.id,
        studentId: students[5].id,
        dueDate: new Date("2026-03-14T00:00:00.000Z"),
        periodStart: new Date("2026-03-01T00:00:00.000Z"),
        periodEnd: new Date("2026-03-31T00:00:00.000Z"),
        amount: 1000,
        status: "WAIVED",
      });

      const monthly = await getPaymentPeriodStats(branch.id, asOf, "month");
      const allTime = await getPaymentPeriodStats(branch.id, asOf, "all");

      expect(monthly.revenueAmount).toBe(700);
      expect(monthly.paidAmount).toBe(900);
      expect(monthly.dueAmount).toBe(300);

      expect(allTime.revenueAmount).toBe(1200);
      expect(allTime.paidAmount).toBe(900);
      expect(allTime.dueAmount).toBe(monthly.dueAmount);
    });
  });

  describe("getSeatUtilizationTrend", () => {
    it("uses shift-slot occupancy instead of distinct-seat occupancy", async () => {
      const asOf = new Date("2026-06-01T00:00:00.000Z");
      const { branch, shift, seat } = await createTestWorld();
      const secondShift = await createShift({
        branchId: branch.id,
        name: "Evening",
        startTime: "17:00",
        endTime: "22:00",
      });
      await createSeat({ branchId: branch.id, label: "S2" });

      const firstStudent = await createStudent({ branchId: branch.id, name: "A", joinedAt: addMonths(asOf, -1) });
      const secondStudent = await createStudent({ branchId: branch.id, name: "B", joinedAt: addMonths(asOf, -1) });

      await createAllocation({ seatId: seat.id, studentId: firstStudent.id, shiftId: shift.id });
      await createAllocation({ seatId: seat.id, studentId: secondStudent.id, shiftId: secondShift.id });

      const trend = await getSeatUtilizationTrend(branch.id, asOf, asOf);

      expect(trend).toHaveLength(1);
      expect(trend[0].utilizationRatio).toBe(0.5);
    });
  });

  describe("branch analytics route authorization", () => {
    it("rejects users without analytics access", async () => {
      const { branch } = await createTestWorld();

      const response = await getBranchSnapshot(
        new Request(`http://localhost/api/analytics/branch/${branch.id}/snapshot?period=month`),
        { params: Promise.resolve({ branchId: branch.id }) }
      );

      expect(response.status).toBe(403);
    });

    it("accepts period=month for authorized owners", async () => {
      const user = await createUser({ id: "user_alice" });
      const org = await createOrg({ ownerId: user.id });
      const branch = await createBranch({ organizationId: org.id });
      await createShift({ branchId: branch.id });
      await createSeat({ branchId: branch.id });
      const student = await createStudent({ branchId: branch.id });
      await createPayment({
        branchId: branch.id,
        studentId: student.id,
        dueDate: new Date(),
        periodStart: new Date("2026-01-01T00:00:00.000Z"),
        periodEnd: new Date("2026-01-31T00:00:00.000Z"),
        amount: 250,
      });

      const response = await getBranchSnapshot(
        new Request(`http://localhost/api/analytics/branch/${branch.id}/snapshot?period=month`),
        { params: Promise.resolve({ branchId: branch.id }) }
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.period).toBe("month");
    });
  });
});
