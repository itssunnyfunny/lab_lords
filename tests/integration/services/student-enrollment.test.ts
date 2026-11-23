import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSaasSubscription, createStudent, createTestWorld } from "@/tests/factories";
import { disconnectDatabase, resetDatabase, testPrisma } from "@/tests/setup/db";
import { PaymentService } from "@/services/payment.service";
import { StudentService } from "@/services/student.service";
import { RenewalsService } from "@/services/renewals.service";
import { prisma } from "@/lib/prisma";

const date = (day: string) => new Date(`${day}T00:00:00.000Z`);
const day = (value: Date) => value.toISOString().slice(0, 10);

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
        const student = await createStudent({ branchId: branch.id, joinedAt: date("2026-01-10"), monthlyFee: 900 });
        const fees = () => testPrisma.payment.findMany({ where: { branchId: branch.id, studentId: student.id }, orderBy: { dueDate: "asc" } });
        const generate = () => PaymentService.generateDuePaymentsForAllActiveStudents();
        const become = (status: "ACTIVE" | "INACTIVE", rejoinedOn?: string) =>
            StudentService.updateStudentStatus(user.id, student.id, status, "KEEP", rejoinedOn);

        vi.setSystemTime(date("2026-02-20"));
        // Departure still retains the charge already earned when cron has not run.
        await become("INACTIVE");
        const [february] = await fees();
        expect(february).toMatchObject({ dueDate: date("2026-02-10"), amount: 900, status: "DUE" });

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
        expect((await fees()).map(fee => [day(fee.dueDate), fee.status])).toEqual([
            ["2026-02-10", "DUE"], ["2026-06-15", "DUE"], ["2026-07-15", "DUE"],
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
        expect((await fees()).map(fee => day(fee.dueDate))).toEqual([
            "2026-02-10", "2026-06-15", "2026-07-15", "2026-09-30", "2026-10-31",
        ]);
        const history = await StudentService.getEnrollmentHistory(user.id, branch.id, student.id, 20, null);
        expect(history.current?.startedAt).toEqual(date("2026-08-31"));
        expect(history.items.map(period => [day(period.startedAt), day(period.endedAt!)])).toEqual([
            ["2026-05-15", "2026-07-22"], ["2026-01-10", "2026-02-20"],
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

        await expect(StudentService.updateStudentStatus(outsider.user.id, student.id, "ACTIVE", "KEEP", "2026-05-15")).rejects.toThrow();
        await expect(StudentService.getEnrollmentHistory(outsider.user.id, outsider.branch.id, student.id, 20, null)).rejects.toThrow("Student not found");
        await expect(StudentService.updateStudentStatus(owner.user.id, student.id, "ACTIVE", "KEEP", "2026-05-16")).rejects.toThrow(/on or before today/);
        expect(await testPrisma.studentEnrollmentHistory.count()).toBe(0);

        const updated = await StudentService.updateStudentStatus(owner.user.id, student.id, "ACTIVE", "KEEP", "2026-05-15");
        expect(updated).toMatchObject({ joinedAt, rejoinedOn: date("2026-05-15"), billingStartAt: null });
        expect(await testPrisma.studentEnrollmentHistory.findMany({ where: { studentId: student.id } })).toMatchObject([
            { branchId: owner.branch.id, studentId: student.id, startedAt: joinedAt, endedAt: null, billingStartAt },
        ]);
    });

    it("rejects a staged old anniversary after a student leaves and returns before the generator writes", async () => {
        vi.setSystemTime(date("2026-05-14"));
        const { user, branch } = await createTestWorld();
        const student = await createStudent({ branchId: branch.id, joinedAt: date("2026-04-10"), monthlyFee: 900 });
        const originalRead = prisma.payment.findMany.bind(prisma.payment);
        vi.spyOn(prisma.payment, "findMany").mockImplementationOnce(args => originalRead(args).then(async rows => {
            await StudentService.updateStudentStatus(user.id, student.id, "INACTIVE");
            vi.setSystemTime(date("2026-05-15"));
            await StudentService.updateStudentStatus(user.id, student.id, "ACTIVE", "KEEP", "2026-05-15");
            return rows;
        }) as ReturnType<typeof originalRead>);

        expect((await PaymentService.generateDuePaymentsForAllActiveStudents(date("2026-06-10"))).generatedCount).toBe(0);
        expect((await PaymentService.generateDuePaymentsForAllActiveStudents(date("2026-06-15"))).generatedCount).toBe(1);
        expect((await testPrisma.payment.findMany({ where: { studentId: student.id }, orderBy: { dueDate: "asc" } }))
            .map(fee => day(fee.dueDate))).toEqual(["2026-05-10", "2026-06-15"]);
    });

    it("settles only the recorded balance and leaves newly discovered accrual unpaid", async () => {
        vi.setSystemTime(date("2026-03-15"));
        const { user, branch } = await createTestWorld();
        const student = await createStudent({ branchId: branch.id, joinedAt: date("2026-01-10"), monthlyFee: 900 });
        await PaymentService.generateDuePaymentsForAllActiveStudents(date("2026-02-10"));
        await StudentService.updateStudentStatus(user.id, student.id, "INACTIVE", "PAID");
        const fees = await testPrisma.payment.findMany({ where: { studentId: student.id }, orderBy: { dueDate: "asc" } });
        expect(fees.map(fee => [day(fee.dueDate), fee.status])).toEqual([["2026-02-10", "PAID"], ["2026-03-10", "DUE"]]);
        expect(await testPrisma.feeCollection.findMany({ where: { studentId: student.id }, select: { amount: true } }))
            .toEqual([{ amount: 900 }]);
    });
});
