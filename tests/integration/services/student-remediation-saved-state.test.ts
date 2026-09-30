import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { SeatAllocationService } from "@/services/seatAllocation.service";
import { StudentService } from "@/services/student.service";
import { StaffPermissionAction } from "@/types";
import {
    createAllocation,
    createPayment,
    createSeat,
    createStaff,
    createStudent,
    createTestWorld,
    createUser,
} from "@/tests/factories";
import { disconnectDatabase, resetDatabase, testPrisma as db } from "@/tests/setup/db";

async function allowWrites(world: { user: { id: string }; org: { id: string } }) {
    await db.organization.update({ where: { id: world.org.id }, data: { billingModelVersion: "WORKSPACE_V2" } });
    await db.ownerTrialGrant.create({ data: {
        ownerId: world.user.id,
        organizationId: world.org.id,
        source: "ONBOARDING",
        status: "ACTIVE",
        trialStartedAt: new Date(),
        trialEndsAt: new Date(Date.now() + 7 * 86_400_000),
    } });
}

function duePayment(branchId: string, studentId: string) {
    return createPayment({
        branchId,
        studentId,
        amount: 900,
        dueDate: new Date("2026-09-01T00:00:00.000Z"),
        periodStart: new Date("2026-08-01T00:00:00.000Z"),
        periodEnd: new Date("2026-08-31T23:59:59.999Z"),
    });
}

describe("Student remediation saved state — real disposable PostgreSQL", () => {
    beforeEach(resetDatabase);
    afterAll(disconnectDatabase);

    it("lets ordinary staff deactivate with KEEP while preserving the due ledger and denying waiver", async () => {
        const world = await createTestWorld();
        await allowWrites(world);
        const staffUser = await createUser();
        await createStaff({ userId: staffUser.id, branchId: world.branch.id, role: "STAFF" });
        const student = await createStudent({ branchId: world.branch.id });
        const allocation = await createAllocation({ seatId: world.seat.id, studentId: student.id, shiftId: world.shift.id });
        const payment = await duePayment(world.branch.id, student.id);

        await expect(StudentService.updateStudentStatus(staffUser.id, student.id, "INACTIVE", "WAIVED"))
            .rejects.toThrow("waive_payments");
        expect((await db.student.findUniqueOrThrow({ where: { id: student.id } })).status).toBe("ACTIVE");
        expect((await db.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe("DUE");

        await StudentService.updateStudentStatus(staffUser.id, student.id, "INACTIVE");
        expect((await db.student.findUniqueOrThrow({ where: { id: student.id } })).status).toBe("INACTIVE");
        expect((await db.seatAllocation.findUniqueOrThrow({ where: { id: allocation.id } })).endDate).not.toBeNull();
        expect(await db.payment.findUniqueOrThrow({ where: { id: payment.id } })).toMatchObject({
            status: "DUE", collectedAmount: 0, waivedAmount: 0,
        });
        expect(await db.paymentResolutionEvent.count({ where: { paymentId: payment.id } })).toBe(0);
        expect(await db.auditLog.count({ where: { paymentId: payment.id } })).toBe(0);
        expect(await db.feeCollection.count({ where: { studentId: student.id } })).toBe(0);
    });

    it("persists unrelated edits to an imported phone-less student without inventing a phone", async () => {
        const world = await createTestWorld();
        await allowWrites(world);
        const imported = await StudentService.createImportedStudent(world.user.id, world.branch.id, {
            name: "Imported Reader", phone: null, monthlyFee: 875, admissionFee: 0,
        });
        expect(imported).toMatchObject({ enrollmentSource: "IMPORT", phone: null });

        await StudentService.updateStudentProfile(world.user.id, imported.id, {
            name: "Imported Reader Updated", monthlyFee: 925,
        });
        const saved = await db.student.findUniqueOrThrow({ where: { id: imported.id } });
        expect(saved).toMatchObject({
            enrollmentSource: "IMPORT", name: "Imported Reader Updated", phone: null, monthlyFee: 925,
        });
        expect((await StudentService.getStudentsByBranch(world.user.id, world.branch.id))
            .find(student => student.id === imported.id)?.phone).toBeNull();
    });

    it("keeps a committed allocation move when a later optional fee write loses permission", async () => {
        const world = await createTestWorld();
        await allowWrites(world);
        const staffUser = await createUser();
        const staff = await createStaff({ userId: staffUser.id, branchId: world.branch.id, role: "STAFF" });
        const student = await createStudent({ branchId: world.branch.id, monthlyFee: 500 });
        const old = await createAllocation({ seatId: world.seat.id, studentId: student.id, shiftId: world.shift.id });
        const newSeat = await createSeat({ branchId: world.branch.id, label: "Replacement" });

        await SeatAllocationService.updateAllocation(staffUser.id, [old.id], newSeat.id, student.id, [world.shift.id]);
        const denied = await db.staffPermissionOverride.create({ data: {
            staffId: staff.id, action: StaffPermissionAction.STUDENTS, allowed: false,
        } });
        await expect(StudentService.updateStudentProfile(staffUser.id, student.id, { monthlyFee: 650 }))
            .rejects.toThrow(/Unauthorized/);

        const savedAfterFailure = await db.seatAllocation.findMany({ where: { studentId: student.id }, orderBy: { startDate: "asc" } });
        expect(savedAfterFailure).toHaveLength(2);
        expect(savedAfterFailure.find(allocation => allocation.id === old.id)?.endDate).not.toBeNull();
        expect(savedAfterFailure.filter(allocation => allocation.endDate === null))
            .toEqual([expect.objectContaining({ seatId: newSeat.id, shiftId: world.shift.id })]);
        expect((await db.student.findUniqueOrThrow({ where: { id: student.id } })).monthlyFee).toBe(500);

        await db.staffPermissionOverride.update({ where: { id: denied.id }, data: { allowed: true } });
        await StudentService.updateStudentProfile(staffUser.id, student.id, { monthlyFee: 650 });
        expect((await db.student.findUniqueOrThrow({ where: { id: student.id } })).monthlyFee).toBe(650);
        expect(await db.seatAllocation.count({ where: { studentId: student.id, endDate: null } })).toBe(1);
    });
});
