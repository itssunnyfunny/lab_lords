import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { createAllocation, createPayment, createSaasSubscription, createStaff, createStudent, createTestWorld, createUser } from "@/tests/factories";
import { disconnectDatabase, resetDatabase, testPrisma } from "@/tests/setup/db";
import { PaymentService } from "@/services/payment.service";
import { StudentService } from "@/services/student.service";
import { RenewalsService } from "@/services/renewals.service";
import { prisma } from "@/lib/prisma";
import { DEPARTURE_BALANCE_CHANGED, reviewFee, type ReviewedFee } from "@/lib/feeBalance";
import { FeeCollectionService } from "@/services/feeCollection.service";

const date = (day: string) => new Date(`${day}T00:00:00.000Z`);
// Existing enrollments retain the historical generator's runtime-local midnight.
const legacyDate = (day: string) => new Date(`${day}T00:00:00`);

describe("student enrollments and fees", () => {
    beforeEach(async () => {
        await resetDatabase();
        vi.useFakeTimers({ toFake: ["Date"] });
    });
    afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
    afterAll(disconnectDatabase);

    it("keeps old arrears, skips the inactive gap and opens a repeatable new anniversary", async () => {
        vi.setSystemTime(date("2026-01-10"));
        const { user, branch, org } = await createTestWorld();
        await createSaasSubscription({ organizationId: org.id, plan: "STANDARD", paidThrough: date("2026-12-01") });
        const student = await createStudent({ branchId: branch.id, joinedAt: legacyDate("2026-01-10"), monthlyFee: 900 });
        const fees = () => testPrisma.payment.findMany({ where: { branchId: branch.id, studentId: student.id }, orderBy: { dueDate: "asc" } });
        const generate = () => PaymentService.generateDuePaymentsForAllActiveStudents();
        const become = (status: "ACTIVE" | "INACTIVE", rejoinedOn?: string) =>
            StudentService.updateStudentStatus(user.id, student.id, status, "KEEP", { rejoinedOn });

        vi.setSystemTime(date("2026-02-20"));
        // Departure still retains the charge already earned when cron has not run.
        await become("INACTIVE");
        const [february] = await fees();
        expect(february).toMatchObject({ dueDate: legacyDate("2026-02-10"), amount: 900, status: "DUE" });

        vi.setSystemTime(date("2026-05-15"));
        expect((await generate()).generatedCount).toBe(0);
        await expect(become("ACTIVE", "2026-02-19")).rejects.toThrow(/on or after departure/);
        const reactivations = await Promise.all([become("ACTIVE", "2026-05-15"), become("ACTIVE", "2026-05-15")]);
        expect(reactivations.every(result => result.rejoinedOn?.getTime() === +date("2026-05-15"))).toBe(true);
        expect(reactivations[0].joinedAt).toEqual(student.joinedAt);
        await expect(become("ACTIVE", "2026-05-14")).rejects.toThrow(/already active/);
        expect(await testPrisma.studentEnrollmentHistory.count({ where: { studentId: student.id } })).toBe(1);

        vi.setSystemTime(date("2026-06-14"));
        expect((await generate()).generatedCount).toBe(0);
        const queue = await RenewalsService.list(user.id, branch.id, { filter: "ALL", days: 7, limit: 20, search: "" });
        expect(queue.items).toContainEqual(expect.objectContaining({ expected: true, dueDate: date("2026-06-15").toISOString() }));
        vi.setSystemTime(date("2026-06-15"));
        const concurrent = await Promise.all([generate(), generate()]);
        expect(concurrent.reduce((count, result) => count + result.generatedCount, 0)).toBe(1);
        vi.setSystemTime(date("2026-07-15"));
        expect((await generate()).generatedCount).toBe(1);
        expect((await fees()).map(fee => [fee.dueDate, fee.status])).toEqual([
            [legacyDate("2026-02-10"), "DUE"], [date("2026-06-15"), "DUE"], [date("2026-07-15"), "DUE"],
        ]);
        expect((await fees())[0]).toEqual(february);

        vi.setSystemTime(date("2026-07-22"));
        await become("INACTIVE");
        await expect(become("ACTIVE", "2026-05-15")).rejects.toThrow(/on or after departure/);
        vi.setSystemTime(date("2026-08-31"));
        await become("ACTIVE", "2026-08-31");
        vi.setSystemTime(date("2026-09-29"));
        expect((await generate()).generatedCount).toBe(0);
        vi.setSystemTime(date("2026-10-31"));
        expect((await generate()).generatedCount).toBe(2);
        expect((await fees()).map(fee => fee.dueDate)).toEqual([
            legacyDate("2026-02-10"), date("2026-06-15"), date("2026-07-15"), date("2026-09-30"), date("2026-10-31"),
        ]);
        const history = await StudentService.getEnrollmentHistory(user.id, branch.id, student.id, 20, null);
        expect(history.current?.startedAt).toEqual(date("2026-08-31"));
        expect(history.items.map(period => [period.startedAt, period.endedAt])).toEqual([
            [date("2026-05-15"), date("2026-07-22")], [student.joinedAt, date("2026-02-20")],
        ]);
    });

    it("protects branch and tenant scope, preserving a legacy cutoff without guessing the departure", async () => {
        vi.setSystemTime(date("2026-05-15"));
        const owner = await createTestWorld();
        const outsider = await createTestWorld();
        const joinedAt = date("2026-01-10");
        const billingStartAt = date("2026-02-10");
        const student = await createStudent({ branchId: owner.branch.id, joinedAt, billingStartAt });
        await testPrisma.student.update({ where: { id: student.id }, data: { status: "INACTIVE" } });

        await expect(StudentService.updateStudentStatus(outsider.user.id, student.id, "ACTIVE", "KEEP", { rejoinedOn: "2026-05-15" })).rejects.toThrow();
        await expect(StudentService.getEnrollmentHistory(outsider.user.id, outsider.branch.id, student.id, 20, null)).rejects.toThrow("Student not found");
        await expect(StudentService.updateStudentStatus(owner.user.id, student.id, "ACTIVE", "KEEP", { rejoinedOn: "2026-05-16" })).rejects.toThrow(/on or before today/);
        expect(await testPrisma.studentEnrollmentHistory.count()).toBe(0);

        const updated = await StudentService.updateStudentStatus(owner.user.id, student.id, "ACTIVE", "KEEP", { rejoinedOn: "2026-05-15" });
        expect(updated).toMatchObject({ joinedAt, rejoinedOn: date("2026-05-15"), billingStartAt: null });
        expect(await testPrisma.studentEnrollmentHistory.findMany({ where: { studentId: student.id } })).toMatchObject([
            { branchId: owner.branch.id, studentId: student.id, startedAt: joinedAt, endedAt: null, billingStartAt },
        ]);
    });

    it("rejects a staged old anniversary after a student leaves and returns before the generator writes", async () => {
        vi.setSystemTime(date("2026-05-14"));
        const { user, branch } = await createTestWorld();
        const student = await createStudent({ branchId: branch.id, joinedAt: legacyDate("2026-04-10"), monthlyFee: 900 });
        const originalRead = prisma.payment.findMany.bind(prisma.payment);
        vi.spyOn(prisma.payment, "findMany").mockImplementationOnce(args => originalRead(args).then(async rows => {
            await StudentService.updateStudentStatus(user.id, student.id, "INACTIVE");
            vi.setSystemTime(date("2026-05-15"));
            await StudentService.updateStudentStatus(user.id, student.id, "ACTIVE", "KEEP", { rejoinedOn: "2026-05-15" });
            return rows;
        }) as ReturnType<typeof originalRead>);

        expect((await PaymentService.generateDuePaymentsForAllActiveStudents(date("2026-06-10"))).generatedCount).toBe(0);
        expect((await PaymentService.generateDuePaymentsForAllActiveStudents(date("2026-06-15"))).generatedCount).toBe(1);
        expect((await testPrisma.payment.findMany({ where: { studentId: student.id }, orderBy: { dueDate: "asc" } }))
            .map(fee => fee.dueDate)).toEqual([legacyDate("2026-05-10"), date("2026-06-15")]);
    });

    it("settles only the recorded balance and leaves newly discovered accrual unpaid", async () => {
        vi.setSystemTime(date("2026-03-15"));
        const { user, branch } = await createTestWorld();
        const student = await createStudent({ branchId: branch.id, joinedAt: legacyDate("2026-01-10"), monthlyFee: 900 });
        await PaymentService.generateDuePaymentsForAllActiveStudents(legacyDate("2026-02-10"));
        const reviewedDues = (await testPrisma.payment.findMany({ where: { studentId: student.id } })).map(reviewFee);
        await StudentService.updateStudentStatus(user.id, student.id, "INACTIVE", "PAID", { reviewedDues });
        const fees = await testPrisma.payment.findMany({ where: { studentId: student.id }, orderBy: { dueDate: "asc" } });
        expect(fees.map(fee => [fee.dueDate, fee.status])).toEqual([[legacyDate("2026-02-10"), "PAID"], [legacyDate("2026-03-10"), "DUE"]]);
        expect(await testPrisma.feeCollection.findMany({ where: { studentId: student.id }, select: { amount: true } }))
            .toEqual([{ amount: 900 }]);
    });

    it.each(["PAID", "WAIVED"] as const)("requires a fresh %s confirmation after another fee or partial collection", async resolution => {
        vi.setSystemTime(date("2026-03-15"));
        const { user, branch, seat, shift } = await createTestWorld();
        const student = await createStudent({ branchId: branch.id, joinedAt: legacyDate("2026-01-10"), monthlyFee: 900 });
        const allocation = await createAllocation({ seatId: seat.id, shiftId: shift.id, studentId: student.id });
        const fees = () => testPrisma.payment.findMany({ where: { branchId: branch.id, studentId: student.id }, orderBy: { dueDate: "asc" } });
        const leave = (reviewedDues?: ReviewedFee[]) => StudentService.updateStudentStatus(user.id, student.id, "INACTIVE", resolution, { reviewedDues });
        await PaymentService.generateDuePaymentsForAllActiveStudents(legacyDate("2026-02-10"));
        const original = (await fees()).map(reviewFee);
        expect(original).toEqual([{ id: expect.any(String), remaining: 900 }]);
        await PaymentService.generateDuePaymentsForAllActiveStudents(legacyDate("2026-03-10"));
        await expect(leave(original)).rejects.toThrow(DEPARTURE_BALANCE_CHANGED);
        await expect(leave()).rejects.toThrow(DEPARTURE_BALANCE_CHANGED);
        const twoFees = (await fees()).map(reviewFee);
        expect(twoFees.map(fee => fee.remaining)).toEqual([900, 900]);
        await expect(leave([twoFees[0], twoFees[0]])).rejects.toThrow(DEPARTURE_BALANCE_CHANGED);
        const other = await createTestWorld();
        const otherStudent = await createStudent({ branchId: other.branch.id });
        const foreign = await createPayment({
            branchId: other.branch.id, studentId: otherStudent.id, amount: 900,
            periodStart: date("2026-02-10"), periodEnd: date("2026-03-10"), dueDate: date("2026-03-10"),
        });
        await expect(leave([twoFees[0], reviewFee(foreign)])).rejects.toThrow(DEPARTURE_BALANCE_CHANGED);
        expect(await testPrisma.payment.findUniqueOrThrow({ where: { id: foreign.id } })).toEqual(foreign);
        expect(await testPrisma.feeCollection.count({ where: { studentId: student.id } })).toBe(0);

        await FeeCollectionService.collect(user.id, branch.id, {
            studentId: student.id, paymentIds: [twoFees[0].id], amount: 200, method: "CASH", reference: "", note: "", idempotencyKey: randomUUID(),
        });
        await expect(leave(twoFees)).rejects.toThrow(DEPARTURE_BALANCE_CHANGED);
        expect(await testPrisma.studentEnrollmentHistory.count({ where: { studentId: student.id } })).toBe(0);
        expect(await testPrisma.student.findUniqueOrThrow({ where: { id: student.id } })).toMatchObject({ status: "ACTIVE" });
        expect(await testPrisma.seatAllocation.findUniqueOrThrow({ where: { id: allocation.id } })).toMatchObject({ endDate: null });
        const refreshed = (await fees()).map(reviewFee);
        expect(refreshed.map(fee => fee.remaining)).toEqual([700, 900]);
        await leave(refreshed);
        await leave(refreshed);
        expect((await fees()).map(fee => fee.status)).toEqual([resolution, resolution]);
        const receipts = await testPrisma.feeCollection.findMany({ where: { studentId: student.id }, orderBy: { amount: "asc" } });
        expect(receipts.map(receipt => receipt.amount)).toEqual(resolution === "PAID" ? [200, 700, 900] : [200]);
    });

    it("requires fee-generation permission only when departure would create an earned fee", async () => {
        vi.setSystemTime(date("2026-03-15"));
        const { branch, seat, shift } = await createTestWorld();
        const desk = await createUser();
        await createStaff({ userId: desk.id, branchId: branch.id, role: "STAFF" });
        const student = await createStudent({ branchId: branch.id, joinedAt: date("2026-02-10"), monthlyFee: 900 });
        const allocation = await createAllocation({ seatId: seat.id, shiftId: shift.id, studentId: student.id });
        const leave = () => StudentService.updateStudentStatus(desk.id, student.id, "INACTIVE");
        await expect(leave()).rejects.toThrow("generate_payments");
        expect(await testPrisma.payment.count({ where: { studentId: student.id } })).toBe(0);
        expect(await testPrisma.studentEnrollmentHistory.count({ where: { studentId: student.id } })).toBe(0);
        expect(await testPrisma.student.findUniqueOrThrow({ where: { id: student.id } })).toMatchObject({ status: "ACTIVE" });
        expect(await testPrisma.seatAllocation.findUniqueOrThrow({ where: { id: allocation.id } })).toMatchObject({ endDate: null });
        expect((await PaymentService.generateDuePaymentsForAllActiveStudents()).generatedCount).toBe(1);
        await expect(leave()).resolves.toMatchObject({ status: "INACTIVE" });
        expect(await testPrisma.payment.findMany({ where: { studentId: student.id } })).toMatchObject([{ amount: 900, status: "DUE" }]);
    });
});
