import { prisma } from "@/lib/prisma";
import { StudentStatus, SeatAllocationFilters } from "@/types";
import { parseNullableTime, timesOverlap } from "@/utils/shiftTime";

export class SeatAllocationService {
    /**
     * Assign a seat to a student across ONE OR MORE shifts atomically.
     *
     * STRICT Validation Rules (enforced inside a single transaction):
     * 1. User must OWN the branch (via the seat's organization).
     * 2. Student must be ACTIVE.
     * 3. Seat, Student, and ALL Shifts must belong to the same branch.
     * 4. Requested shifts must not overlap with each other.
     * 5. Seat cannot be occupied in any time-overlapping shift.
     * 6. Student cannot already be allocated in any time-overlapping shift.
     * 7. Shift must be ACTIVE.
     *
     * Returns an array of created SeatAllocation records (one per shift).
     */
    static async assignSeatToShifts(
        userId: string,
        seatId: string,
        studentId: string,
        shiftIds: string[],
        multiShiftId?: string
    ) {
        if (!shiftIds || shiftIds.length === 0) {
            throw new Error("At least one shift must be selected.");
        }

        // Deduplicate
        const uniqueShiftIds = [...new Set(shiftIds)];

        return prisma.$transaction(async (tx) => {
            // 1. Fetch seat (with branch + org for ownership check)
            const seat = await tx.seat.findUnique({
                where: { id: seatId },
                include: { branch: { include: { organization: true } } },
            });
            if (!seat) throw new Error("Seat not found");

            // 2. Ownership check
            if (seat.branch.organization.ownerId !== userId) {
                throw new Error("Unauthorized: You do not own this seat's branch");
            }

            const branchId = seat.branchId;

            // 3. Fetch student
            const student = await tx.student.findUnique({ where: { id: studentId } });
            if (!student) throw new Error("Student not found");
            if (student.status !== StudentStatus.ACTIVE) {
                throw new Error("Only ACTIVE students can be assigned a seat");
            }
            if (student.branchId !== branchId) {
                throw new Error("Student does not belong to this branch");
            }

            // 3b. Validate multiShiftId if provided
            if (multiShiftId) {
                const ms = await tx.multiShift.findUnique({ where: { id: multiShiftId } });
                if (!ms) throw new Error("Multi-shift not found");
                if (ms.branchId !== branchId) throw new Error("Multi-shift does not belong to this branch");
            }

            // 4. Fetch and validate all requested shifts
            const requestedShifts = await tx.shift.findMany({
                where: { id: { in: uniqueShiftIds } },
            });

            if (requestedShifts.length !== uniqueShiftIds.length) {
                throw new Error("One or more shifts were not found.");
            }

            for (const s of requestedShifts) {
                if (s.status !== "ACTIVE") throw new Error(`Shift "${s.name}" is not active.`);
                if (s.branchId !== branchId) throw new Error(`Shift "${s.name}" does not belong to this branch.`);
            }

            // 5. Requested shifts must not overlap with each other.
            //    EXCEPTION: when allocating via a multi-shift (multiShiftId is set),
            //    the component shifts are a pre-approved bundle — skip this check.
            //    The overlap guard still protects manual multi-primary-shift selections.
            if (!multiShiftId) {
                for (let i = 0; i < requestedShifts.length; i++) {
                    for (let j = i + 1; j < requestedShifts.length; j++) {
                        const a = requestedShifts[i];
                        const b = requestedShifts[j];
                        if (timesOverlap(
                            parseNullableTime(a.startTime),
                            parseNullableTime(a.endTime),
                            parseNullableTime(b.startTime),
                            parseNullableTime(b.endTime)
                        )) {
                            throw new Error(
                                `Selected shifts "${a.name}" and "${b.name}" overlap with each other. You cannot assign both.`
                            );
                        }
                    }
                }
            }

            // 6. Load ALL active shifts in branch for conflict lookups
            const allBranchShifts = await tx.shift.findMany({
                where: { branchId, status: "ACTIVE" },
                select: { id: true, name: true, startTime: true, endTime: true },
            });
            const shiftTimeMap = new Map(allBranchShifts.map(s => [s.id, s]));

            // 7. Load existing active seat allocations (for seat + student conflict checks)
            const activeSeatAllocations = await tx.seatAllocation.findMany({
                where: { seatId, endDate: null },
            });
            const activeStudentAllocations = await tx.seatAllocation.findMany({
                where: { studentId, endDate: null },
            });

            const allocationsToCreateData = [];

            for (const requestedShift of requestedShifts) {
                const newStart = parseNullableTime(requestedShift.startTime);
                const newEnd = parseNullableTime(requestedShift.endTime);

                // 7a. Seat conflict — block if seat occupied in exact or time-overlapping shift
                for (const alloc of activeSeatAllocations) {
                    if (alloc.shiftId === requestedShift.id) {
                        throw new Error(`Seat is already assigned in shift "${requestedShift.name}".`);
                    }
                    if (!multiShiftId) {
                        const existing = shiftTimeMap.get(alloc.shiftId);
                        if (existing && timesOverlap(newStart, newEnd, parseNullableTime(existing.startTime), parseNullableTime(existing.endTime))) {
                            throw new Error(
                                `Seat is already occupied during this time (conflict with "${existing.name}")`
                            );
                        }
                    }
                }

                // 7b. Student conflict — block if student already in exact or time-overlapping shift
                for (const alloc of activeStudentAllocations) {
                    if (alloc.shiftId === requestedShift.id) {
                        throw new Error(`Student already has a seat in shift "${requestedShift.name}".`);
                    }
                    if (!multiShiftId) {
                        const existing = shiftTimeMap.get(alloc.shiftId);
                        if (existing && timesOverlap(newStart, newEnd, parseNullableTime(existing.startTime), parseNullableTime(existing.endTime))) {
                            throw new Error(
                                `Student is already allocated in an overlapping shift ("${existing.name}")`
                            );
                        }
                    }
                }

                // 8. Prepare allocation data for this shift
                const allocationData = {
                    seatId,
                    studentId,
                    shiftId: requestedShift.id,
                    ...(multiShiftId ? { multiShiftId } : {}),
                };

                // Push mock objects into live arrays so subsequent loop iterations
                // also see allocations created earlier in this transaction.
                const mockAllocation = { shiftId: requestedShift.id } as import("@prisma/client").SeatAllocation;
                activeSeatAllocations.push(mockAllocation);
                activeStudentAllocations.push(mockAllocation);

                allocationsToCreateData.push(allocationData);
            }

            // ⚡ Bolt: Replaced O(n) individual insert queries inside loop with single bulk insert
            // Expected Impact: Eliminates N+1 query bottleneck when allocating a student to multiple shifts
            if (allocationsToCreateData.length > 0) {
                await tx.seatAllocation.createMany({
                    data: allocationsToCreateData,
                });
            }

            // Retrieve the newly created records as createMany only returns a count.
            // Maintain order by sorting via map index.
            let createdAllocations: import("@prisma/client").SeatAllocation[] = [];
            if (allocationsToCreateData.length > 0) {
                const unorderedAllocations = await tx.seatAllocation.findMany({
                    where: {
                        seatId,
                        studentId,
                        shiftId: { in: allocationsToCreateData.map(a => a.shiftId) },
                        endDate: null
                    }
                });

                const shiftOrderMap = new Map(allocationsToCreateData.map((data, index) => [data.shiftId, index]));
                createdAllocations = unorderedAllocations.sort(
                    (a, b) => (shiftOrderMap.get(a.shiftId) ?? 0) - (shiftOrderMap.get(b.shiftId) ?? 0)
                );
            }

            // 9. Update Branch lastDataChange
            await tx.branch.update({
                where: { id: branchId },
                data: { lastDataChange: new Date() },
            });

            return createdAllocations;
        });
    }

    /**
     * Single-shift convenience wrapper — delegates to assignSeatToShifts.
     * Kept for backward compatibility with any internal callers.
     */
    static async assignSeat(
        userId: string,
        seatId: string,
        studentId: string,
        shiftId: string
    ) {
        const results = await this.assignSeatToShifts(userId, seatId, studentId, [shiftId]);
        return results[0];
    }

    /**
     * Unassign (Release) a seat.
     * Sets the endDate to now, marking it as inactive (history).
     * Does NOT delete the record.
     */
    static async unassignSeat(allocationId: string) {
        return prisma.$transaction(async (tx) => {
            const allocation = await tx.seatAllocation.findUnique({
                where: { id: allocationId },
                include: { seat: true },
            });

            if (!allocation) throw new Error("Allocation not found");
            if (allocation.endDate !== null) throw new Error("Allocation is already ended.");

            const updatedAllocation = await tx.seatAllocation.update({
                where: { id: allocationId },
                data: { endDate: new Date() },
            });

            await tx.branch.update({
                where: { id: allocation.seat.branchId },
                data: { lastDataChange: new Date() },
            });

            return updatedAllocation;
        });
    }

    /**
     * Update an active allocation — end old record(s) and create new one(s)
     * atomically. Used for "Change Seat / Shift" from the UI.
     *
     * @param userId        - Owner performing the action
     * @param allocationIds - IDs of the current active allocation(s) to end
     * @param newSeatId     - Target seat
     * @param newShiftIds   - Target shift(s) (component IDs for multi-shift)
     * @param newMultiShiftId - Optional multi-shift bundle ID
     */
    static async updateAllocation(
        userId: string,
        allocationIds: string[],
        newSeatId: string,
        studentId: string,
        newShiftIds: string[],
        newMultiShiftId?: string
    ) {
        // Fetch one allocation to get the studentId (validation)
        const existing = await prisma.seatAllocation.findUnique({
            where: { id: allocationIds[0] },
        });
        if (!existing) throw new Error("Allocation not found.");
        if (existing.endDate !== null) throw new Error("Allocation is already ended.");
        if (existing.studentId !== studentId) throw new Error("Student mismatch.");

        // End all old allocations + create new ones in one transaction
        return prisma.$transaction(async (tx) => {
            // End old records
            await tx.seatAllocation.updateMany({
                where: { id: { in: allocationIds }, endDate: null },
                data: { endDate: new Date() },
            });

            // Re-use assignSeatToShifts — but it opens its own transaction,
            // so we call the inner logic directly here.
            const newAllocations = await tx.seatAllocation.findMany({
                where: { seatId: newSeatId, endDate: null },
            });

            // Get branch from seat
            const seat = await tx.seat.findUnique({
                where: { id: newSeatId },
                include: { branch: { include: { organization: true } } },
            });
            if (!seat) throw new Error("Seat not found.");
            if (seat.branch.organization.ownerId !== userId)
                throw new Error("Unauthorized: You do not own this branch.");

            const branchId = seat.branchId;

            // Validate new shifts
            const shifts = await tx.shift.findMany({
                where: { id: { in: newShiftIds } },
            });
            if (shifts.length !== newShiftIds.length)
                throw new Error("One or more new shifts were not found.");
            for (const s of shifts) {
                if (s.status !== "ACTIVE") throw new Error(`Shift "${s.name}" is not active.`);
                if (s.branchId !== branchId) throw new Error(`Shift "${s.name}" does not belong to this branch.`);
            }

            // ⚡ Bolt: Replaced O(n) individual concurrent inserts with single bulk insert
            // Expected Impact: Eliminates N+1 query bottleneck during seat/shift reallocation
            if (newShiftIds.length > 0) {
                await tx.seatAllocation.createMany({
                    data: newShiftIds.map((shiftId) => ({
                        seatId: newSeatId,
                        studentId,
                        shiftId,
                        ...(newMultiShiftId ? { multiShiftId: newMultiShiftId } : {}),
                    }))
                });
            }

            let created: import("@prisma/client").SeatAllocation[] = [];
            if (newShiftIds.length > 0) {
                const unorderedCreated = await tx.seatAllocation.findMany({
                    where: {
                        seatId: newSeatId,
                        studentId,
                        shiftId: { in: newShiftIds },
                        endDate: null
                    }
                });

                const shiftOrderMap = new Map(newShiftIds.map((shiftId, index) => [shiftId, index]));
                created = unorderedCreated.sort(
                    (a, b) => (shiftOrderMap.get(a.shiftId) ?? 0) - (shiftOrderMap.get(b.shiftId) ?? 0)
                );
            }

            await tx.branch.update({
                where: { id: branchId },
                data: { lastDataChange: new Date() },
            });

            return created;
        });
    }

    /**
     * List allocations for a branch with optional filters.
     */
    static async listAllocations(
        branchId: string,
        filters?: SeatAllocationFilters
    ) {
        return prisma.seatAllocation.findMany({
            where: {
                seat: { branchId }, // Strictly scoped to branch via seat
                studentId: filters?.studentId,
                shiftId: filters?.shiftId,
                endDate: filters?.activeOnly ? null : undefined,
            },
            include: {
                seat: true,
                student: true,
                shift: true,
                multiShift: { select: { id: true, name: true } },
            },
            orderBy: {
                startDate: "desc",
            },
        });
    }
}
