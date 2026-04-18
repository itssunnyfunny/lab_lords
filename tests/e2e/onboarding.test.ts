import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import { resetDatabase, disconnectDatabase, testPrisma } from "@/tests/setup/db";
import { resetAllMocks } from "@/tests/mocks";
import { createTestWorld, createStudent } from "@/tests/factories";
import { StudentService } from "@/services/student.service";
import { PaymentService } from "@/services/payment.service";
import { addMonths } from "date-fns";

/**
 * E2E FLOW TESTS (Service Layer — NOT browser)
 *
 * Why NOT browser/Playwright at this stage:
 *   - Playwright requires a running server, flaky CI setup
 *   - These flows can be fully validated at the service layer
 *   - Browser tests are deferred until the app stabilizes
 *
 * Two critical flows only:
 *   1. Student Admission Journey (create → seat assigned → payment created)
 *   2. Month-End Billing (generate → mark paid → drafts cleared)
 */

describe("E2E Flow: Student Admission Journey", () => {
  afterAll(async () => { await disconnectDatabase(); });
  beforeEach(async () => { await resetDatabase(); });
  afterEach(() => { resetAllMocks(); });

  it("FLOW: Create student → Seat gets occupied → Admission payment created", async () => {
    const { user, branch, seat, shift } = await createTestWorld();

    // Step 1: Create student with seat + shift
    const student = await StudentService.createStudent(user.id, branch.id, {
      name: "Priya Mehta",
      phone: "9876543210",
      monthlyFee: 1500,
      admissionFee: 500,
      seatId: seat.id,
      shiftIds: [shift.id],
    });

    // Step 2: Verify student is ACTIVE
    expect(student.status).toBe("ACTIVE");

    // Step 3: Verify seat is now occupied
    const allocation = await testPrisma.seatAllocation.findFirst({
      where: { studentId: student.id, shiftId: shift.id, endDate: null },
    });
    expect(allocation).not.toBeNull();

    // Step 4: Verify admission payment was created
    const payment = await testPrisma.payment.findFirst({
      where: { studentId: student.id, type: "ADMISSION" },
    });
    expect(payment).not.toBeNull();
    expect(payment?.status).toBe("DUE");
    expect(payment?.amount).toBe(500);
  });
});

describe("E2E Flow: Month-End Billing", () => {
  afterAll(async () => { await disconnectDatabase(); });
  beforeEach(async () => { await resetDatabase(); });
  afterEach(() => { resetAllMocks(); });

  it("FLOW: Generate payments → Student appears overdue → Mark paid → Draft cleared", async () => {
    const BASE = new Date("2026-01-01T00:00:00.000Z");
    const { user, branch } = await createTestWorld();

    // Step 1: Create student who joined on BASE
    const student = await createStudent({ branchId: branch.id, joinedAt: BASE, monthlyFee: 1200 });

    // Step 2: Generate payments for 1 month later
    const result = await PaymentService.generateDuePaymentsForBranch(
      user.id, branch.id, addMonths(BASE, 1)
    );
    expect(result.generatedCount).toBe(1);

    // Step 3: Create a message draft (simulating AI-generated reminder)
    await testPrisma.messageDraft.create({
      data: {
        branchId: branch.id,
        studentId: student.id,
        action: "FOLLOW_UP_OVERDUE_PAYMENTS",
        message: "Reminder: your fee is due.",
      },
    });

    // Step 4: Fetch the payment
    const payments = await PaymentService.listPayments(user.id, branch.id, "DUE");
    expect(payments.length).toBe(1);
    expect(payments[0].status).toBe("DUE");

    // Step 5: Mark as paid
    await PaymentService.markPaymentAsPaid(user.id, payments[0].id);

    // Step 6: Verify draft was cleared
    const drafts = await testPrisma.messageDraft.findMany({
      where: { studentId: student.id, action: "FOLLOW_UP_OVERDUE_PAYMENTS" },
    });
    expect(drafts).toHaveLength(0);
  });
});
