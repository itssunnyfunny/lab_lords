import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { ShiftService } from "@/services/shift.service";
import { resetDatabase, disconnectDatabase, testPrisma } from "@/tests/setup/db";
import { createTestWorld, createStudent, createSeat, createShift, createAllocation } from "@/tests/factories";

describe("ShiftService Integration", () => {
  afterAll(async () => { await disconnectDatabase(); });
  beforeEach(async () => { await resetDatabase(); });

  // ─── createShift ──────────────────────────────────────────────────────────

  describe("createShift", () => {
    it("creates a shift successfully", async () => {
      const { user, branch } = await createTestWorld();
      const shift = await ShiftService.createShift(user.id, branch.id, {
        name: "Night",
        startTime: "20:00",
        endTime: "23:59",
      });
      expect(shift.name).toBe("Night");
      expect(shift.status).toBe("ACTIVE");
    });

    it("REJECTS if new shift time overlaps an existing active shift", async () => {
      const { user, branch } = await createTestWorld({ shiftStart: "06:00", shiftEnd: "11:59" });
      // Try to create a shift that overlaps with Morning (06:00-11:59)
      await expect(
        ShiftService.createShift(user.id, branch.id, { name: "Overlap", startTime: "09:00", endTime: "14:00" })
      ).rejects.toThrow(/overlap/i);
    });

    it("REJECTS duplicate shift name in same branch", async () => {
      const { user, branch } = await createTestWorld({ shiftName: "Morning" });
      await expect(
        ShiftService.createShift(user.id, branch.id, { name: "Morning", startTime: "18:00", endTime: "22:00" })
      ).rejects.toThrow(/already exists/i);
    });
  });

  // ─── analyzeShiftDeletion ─────────────────────────────────────────────────

  describe("analyzeShiftDeletion", () => {
    it("correctly counts students in shift", async () => {
      const { user, branch, shift, seat } = await createTestWorld();
      await createShift({ branchId: branch.id, name: "Evening", startTime: "17:00", endTime: "22:00" });
      const student = await createStudent({ branchId: branch.id });
      await createAllocation({ seatId: seat.id, studentId: student.id, shiftId: shift.id });

      const analysis = await ShiftService.analyzeShiftDeletion(user.id, shift.id);
      expect(analysis.studentsInShift).toBe(1);
      expect(analysis.allocations[0].studentName).toBe(student.name);
    });

    it("sets isLastActiveShift=true if only 1 active shift", async () => {
      const { user, branch, shift } = await createTestWorld();
      const analysis = await ShiftService.analyzeShiftDeletion(user.id, shift.id);
      expect(analysis.isLastActiveShift).toBe(true);
    });
  });

  // ─── deleteShift ──────────────────────────────────────────────────────────

  describe("deleteShift", () => {
    it("REJECTS deleting the last active shift in a branch", async () => {
      const { user, branch, shift } = await createTestWorld();
      await expect(
        ShiftService.deleteShift(user.id, shift.id, { type: "END_ALL" })
      ).rejects.toThrow(/last active shift/i);
    });

    it("END_ALL: marks shift INACTIVE and ends all allocations", async () => {
      const { user, branch, shift, seat } = await createTestWorld();
      // Add a second shift so deletion is allowed
      await createShift({ branchId: branch.id, name: "Evening", startTime: "17:00", endTime: "22:00" });
      const student = await createStudent({ branchId: branch.id });
      const alloc = await createAllocation({ seatId: seat.id, studentId: student.id, shiftId: shift.id });

      await ShiftService.deleteShift(user.id, shift.id, { type: "END_ALL" });

      const updatedShift = await testPrisma.shift.findUnique({ where: { id: shift.id } });
      const updatedAlloc = await testPrisma.seatAllocation.findUnique({ where: { id: alloc.id } });
      expect(updatedShift?.status).toBe("INACTIVE");
      expect(updatedAlloc?.endDate).not.toBeNull();
    });

    it("REALLOCATE_BULK: moves students to target shift and marks source INACTIVE", async () => {
      const { user, branch, shift, seat } = await createTestWorld({ shiftStart: "06:00", shiftEnd: "11:59" });
      const evening = await createShift({ branchId: branch.id, name: "Evening", startTime: "17:00", endTime: "22:00" });
      const student = await createStudent({ branchId: branch.id });
      await createAllocation({ seatId: seat.id, studentId: student.id, shiftId: shift.id });

      await ShiftService.deleteShift(user.id, shift.id, {
        type: "REALLOCATE_BULK",
        targetShiftId: evening.id,
      });

      const updatedShift = await testPrisma.shift.findUnique({ where: { id: shift.id } });
      const newAlloc = await testPrisma.seatAllocation.findFirst({
        where: { studentId: student.id, shiftId: evening.id, endDate: null },
      });
      expect(updatedShift?.status).toBe("INACTIVE");
      expect(newAlloc).not.toBeNull();
    });

    it("REALLOCATE_BULK: REJECTS if target has no capacity", async () => {
      /**
       * Service check: targetActive + sourceStudents > totalSeats → throws.
       * Setup: 2 seats, evening has both seats occupied (targetActive=2).
       * Morning student uses S1 in the morning slot (non-overlapping — OK).
       * Attempting to also put that student in evening: 2 + 1 = 3 > 2 → throws.
       */
      const { user, branch, shift } = await createTestWorld({ shiftStart: "06:00", shiftEnd: "11:59" });
      const evening = await createShift({ branchId: branch.id, name: "Evening", startTime: "17:00", endTime: "22:00" });

      // 2 seats total
      const seat1 = await testPrisma.seat.findFirst({ where: { branchId: branch.id } });
      const seat2 = await createSeat({ branchId: branch.id, label: "S2" });

      // Fill both seats in evening (2 blocker students)
      const blocker1 = await createStudent({ branchId: branch.id, name: "Blocker1" });
      const blocker2 = await createStudent({ branchId: branch.id, name: "Blocker2" });
      await createAllocation({ seatId: seat1!.id, studentId: blocker1.id, shiftId: evening.id });
      await createAllocation({ seatId: seat2.id, studentId: blocker2.id, shiftId: evening.id });

      // Morning student on S1 (non-overlapping with evening — seat reuse is fine)
      const morningStudent = await createStudent({ branchId: branch.id, name: "Displaced" });
      await createAllocation({ seatId: seat1!.id, studentId: morningStudent.id, shiftId: shift.id });

      // Moving morningStudent to evening: targetActive(2) + 1 = 3 > totalSeats(2) → capacity error
      await expect(
        ShiftService.deleteShift(user.id, shift.id, { type: "REALLOCATE_BULK", targetShiftId: evening.id })
      ).rejects.toThrow(/capacity|enough/i);
    });
  });

  // ─── updateShift ──────────────────────────────────────────────────────────

  describe("updateShift", () => {
    it("name change succeeds when no duplicate exists", async () => {
      const { user, branch, shift } = await createTestWorld();
      const updated = await ShiftService.updateShift(user.id, shift.id, { name: "Dawn" });
      expect(updated.name).toBe("Dawn");
    });

    it("REJECTS time change that overlaps an existing active shift", async () => {
      const { user, branch, shift } = await createTestWorld({ shiftStart: "06:00", shiftEnd: "11:59" });
      // Add afternoon shift (12:00 – 16:59)
      await createShift({ branchId: branch.id, name: "Afternoon", startTime: "12:00", endTime: "16:59" });

      // Try to change morning to 09:00–14:00 — overlaps afternoon
      await expect(
        ShiftService.updateShift(user.id, shift.id, { startTime: "09:00", endTime: "14:00" })
      ).rejects.toThrow(/overlap/i);
    });
  });

  // ─── deleteShift → REALLOCATE_MANUAL ──────────────────────────────────────

  describe("deleteShift → REALLOCATE_MANUAL", () => {
    it("moves each student per assignment map and marks source INACTIVE", async () => {
      const { user, branch, shift, seat } = await createTestWorld({ shiftStart: "06:00", shiftEnd: "11:59" });
      const evening = await createShift({ branchId: branch.id, name: "Evening", startTime: "17:00", endTime: "22:00" });
      const student = await createStudent({ branchId: branch.id });
      const alloc = await createAllocation({ seatId: seat.id, studentId: student.id, shiftId: shift.id });

      await ShiftService.deleteShift(user.id, shift.id, {
        type: "REALLOCATE_MANUAL",
        assignments: [{ allocationId: alloc.id, targetShiftId: evening.id }],
      });

      const updatedShift = await testPrisma.shift.findUnique({ where: { id: shift.id } });
      expect(updatedShift?.status).toBe("INACTIVE");

      const newAlloc = await testPrisma.seatAllocation.findFirst({
        where: { studentId: student.id, shiftId: evening.id, endDate: null },
      });
      expect(newAlloc).not.toBeNull();
    });

    it("REJECTS if target shift has no capacity for the student", async () => {
      /**
       * Service check: currentActive + incoming > totalSeats → throws.
       * Setup: 2 seats, both occupied in evening. Morning student uses S1 (non-overlapping).
       * Moving morning student to evening: 2 + 1 = 3 > 2 → capacity error.
       */
      const { user, branch, shift } = await createTestWorld({ shiftStart: "06:00", shiftEnd: "11:59" });
      const evening = await createShift({ branchId: branch.id, name: "Evening", startTime: "17:00", endTime: "22:00" });

      // 2 seats total
      const seat1 = await testPrisma.seat.findFirst({ where: { branchId: branch.id } });
      const seat2 = await createSeat({ branchId: branch.id, label: "S2" });

      // Fill both seats in evening
      const blocker1 = await createStudent({ branchId: branch.id, name: "EveningBlocker1" });
      const blocker2 = await createStudent({ branchId: branch.id, name: "EveningBlocker2" });
      await createAllocation({ seatId: seat1!.id, studentId: blocker1.id, shiftId: evening.id });
      await createAllocation({ seatId: seat2.id, studentId: blocker2.id, shiftId: evening.id });

      // Morning student on S1 (non-overlapping with evening — seat reuse is valid)
      const morningStudent = await createStudent({ branchId: branch.id, name: "Displaced" });
      const morningAlloc = await createAllocation({ seatId: seat1!.id, studentId: morningStudent.id, shiftId: shift.id });

      // Add a third shift so deletion is allowed (cannot delete last active)
      await createShift({ branchId: branch.id, name: "Afternoon", startTime: "12:00", endTime: "16:59" });

      // Evening currentActive(2) + 1 incoming > totalSeats(2) → must throw
      await expect(
        ShiftService.deleteShift(user.id, shift.id, {
          type: "REALLOCATE_MANUAL",
          assignments: [{ allocationId: morningAlloc.id, targetShiftId: evening.id }],
        })
      ).rejects.toThrow(/capacity|seat/i);
    });
  });

  // ─── ensureDefaultShifts ──────────────────────────────────────────────────

  describe("ensureDefaultShifts", () => {
    it("creates Morning, Afternoon, Evening when none exist", async () => {
      const { branch } = await createTestWorld();
      // Clear all shifts first
      await testPrisma.shift.deleteMany({ where: { branchId: branch.id } });

      await ShiftService.ensureDefaultShifts(branch.id);

      const shifts = await testPrisma.shift.findMany({ where: { branchId: branch.id } });
      const names = shifts.map(s => s.name);
      expect(names).toContain("Morning");
      expect(names).toContain("Afternoon");
      expect(names).toContain("Evening");
    });

    it("is idempotent — calling twice does not duplicate shifts", async () => {
      const { branch } = await createTestWorld();
      await testPrisma.shift.deleteMany({ where: { branchId: branch.id } });

      await ShiftService.ensureDefaultShifts(branch.id);
      await ShiftService.ensureDefaultShifts(branch.id);

      const shifts = await testPrisma.shift.findMany({ where: { branchId: branch.id } });
      // Exactly 3 default shifts — no duplicates
      expect(shifts).toHaveLength(3);
    });
  });
});
