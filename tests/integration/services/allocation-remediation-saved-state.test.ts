import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { MultiShiftService } from "@/services/multiShift.service";
import { SeatService } from "@/services/seat.service";
import { SeatAllocationService } from "@/services/seatAllocation.service";
import { ShiftService } from "@/services/shift.service";
import { StudentService } from "@/services/student.service";
import { StaffPermissionAction } from "@/types";
import { createAllocation, createSeat, createShift, createStaff, createStudent, createTestWorld, createUser } from "@/tests/factories";
import { disconnectDatabase, resetDatabase, testPrisma as db } from "@/tests/setup/db";

async function allowWrites(world: { user: { id: string }; org: { id: string } }) {
    await db.organization.update({ where: { id: world.org.id }, data: { billingModelVersion: "WORKSPACE_V2" } });
    await db.ownerTrialGrant.create({ data: { ownerId: world.user.id, organizationId: world.org.id,
        source: "ONBOARDING", status: "ACTIVE", trialStartedAt: new Date(),
        trialEndsAt: new Date(Date.now() + 7 * 86_400_000) } });
}

describe("Allocation remediation saved state — real disposable PostgreSQL", () => {
    beforeEach(resetDatabase);
    afterAll(disconnectDatabase);

    it("checks every selected bundle shift before admission and persists only the chosen free seat", async () => {
        const world = await createTestWorld({ shiftStart: "06:00", shiftEnd: "10:00" });
        await allowWrites(world);
        const { user, branch, seat: blockedSeat, shift: morning } = world;
        const freeSeat = await createSeat({ branchId: branch.id, label: "Free bundle seat" });
        const evening = await createShift({ branchId: branch.id, name: "Evening", startTime: "17:00", endTime: "21:00" });
        const bundle = await db.multiShift.create({ data: { branchId: branch.id, name: "Morning and evening", price: 1300,
            components: { create: [{ shiftId: morning.id, order: 0 }, { shiftId: evening.id, order: 1 }] } } });
        const blocker = await createStudent({ branchId: branch.id, name: "Evening occupant" });
        await createAllocation({ seatId: blockedSeat.id, studentId: blocker.id, shiftId: evening.id });

        const availability = await SeatService.getSeatMap(user.id, branch.id, morning.id, bundle.id);
        expect(availability.seats.find(seat => seat.seatId === blockedSeat.id)?.occupied).toBe(true);
        expect(availability.seats.find(seat => seat.seatId === freeSeat.id)?.occupied).toBe(false);
        expect(availability).toMatchObject({ occupiedCount: 1, availableCount: 1 });
        expect((await SeatService.getShiftsCapacityWithMulti(user.id, branch.id))
            .find(choice => choice.multiShiftId === bundle.id)).toMatchObject({ used: 1, available: 1 });

        // Admission saves the student first, then sends an independent allocation command.
        const admitted = await StudentService.createStudent(user.id, branch.id, {
            name: "New admission", phone: "9876543210", feeLinkedMultiShiftId: bundle.id,
        });
        expect(admitted.monthlyFee).toBe(1300);
        await expect(SeatAllocationService.assignSeatToShifts(user.id, blockedSeat.id, admitted.id,
            [morning.id, evening.id], bundle.id)).rejects.toThrow('Seat is already assigned in shift "Evening".');
        expect(await db.seatAllocation.count({ where: { studentId: admitted.id } })).toBe(0);

        await SeatAllocationService.assignSeatToShifts(user.id, freeSeat.id, admitted.id,
            [morning.id, evening.id], bundle.id);
        const saved = await db.seatAllocation.findMany({ where: { studentId: admitted.id, endDate: null } });
        expect(saved).toHaveLength(2);
        expect(new Set(saved.map(allocation => allocation.shiftId))).toEqual(new Set([morning.id, evening.id]));
        expect(saved.every(allocation => allocation.seatId === freeSeat.id && allocation.multiShiftId === bundle.id)).toBe(true);
        expect((await db.student.findUniqueOrThrow({ where: { id: admitted.id } })).feeLinkedMultiShiftId).toBe(bundle.id);
    });

    it("keeps a retained bundle for management but removes it from allocation choices after component deactivation", async () => {
        const world = await createTestWorld({ shiftStart: "06:00", shiftEnd: "10:00" });
        await allowWrites(world);
        const { user, branch, seat, shift: morning } = world;
        const evening = await createShift({ branchId: branch.id, name: "Evening", startTime: "17:00", endTime: "21:00" });
        const bundle = await db.multiShift.create({ data: { branchId: branch.id, name: "Retained bundle",
            components: { create: [{ shiftId: morning.id, order: 0 }, { shiftId: evening.id, order: 1 }] } } });
        const student = await createStudent({ branchId: branch.id });
        expect((await SeatService.getShiftsCapacityWithMulti(user.id, branch.id))
            .some(choice => choice.multiShiftId === bundle.id)).toBe(true);

        await ShiftService.deleteShift(user.id, evening.id, { type: "END_ALL" });
        expect((await db.shift.findUniqueOrThrow({ where: { id: evening.id } })).status).toBe("INACTIVE");
        expect((await MultiShiftService.listMultiShifts(user.id, branch.id)).some(item => item.id === bundle.id)).toBe(true);
        expect((await SeatService.getShiftsCapacityWithMulti(user.id, branch.id))
            .some(choice => choice.multiShiftId === bundle.id)).toBe(false);
        await expect(SeatService.getSeatMap(user.id, branch.id, morning.id, bundle.id)).rejects.toThrow("Multi-shift not found");
        await expect(SeatAllocationService.assignSeatToShifts(user.id, seat.id, student.id,
            [morning.id, evening.id], bundle.id)).rejects.toThrow(/not active/i);
        expect(await db.seatAllocation.count({ where: { studentId: student.id } })).toBe(0);
    });

    it("lets allocation-only staff select same-branch active identities without seeing the student directory", async () => {
        const world = await createTestWorld();
        await allowWrites(world);
        const other = await createTestWorld();
        const staffUser = await createUser();
        const staff = await createStaff({ userId: staffUser.id, branchId: world.branch.id, role: "STAFF" });
        await db.staffPermissionOverride.create({ data: { staffId: staff.id, action: StaffPermissionAction.STUDENTS, allowed: false } });
        const active = await createStudent({ branchId: world.branch.id, name: "Active local" });
        const inactive = await createStudent({ branchId: world.branch.id, name: "Inactive local" });
        await db.student.update({ where: { id: inactive.id }, data: { status: "INACTIVE" } });
        await createStudent({ branchId: other.branch.id, name: "Foreign active" });

        expect(await SeatAllocationService.listStudentOptions(staffUser.id, world.branch.id)).toEqual({
            items: [{ id: active.id, name: active.name }], canLinkFee: false,
        });
        await expect(StudentService.getStudentsByBranch(staffUser.id, world.branch.id)).rejects.toThrow();
        await SeatAllocationService.assignSeatToShifts(staffUser.id, world.seat.id, active.id, [world.shift.id]);
        expect(await db.seatAllocation.count({ where: { branchId: world.branch.id, studentId: active.id, endDate: null } })).toBe(1);
    });
});
