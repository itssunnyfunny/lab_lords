import { AccessPolicy } from "@/services/accessPolicy.service";
import { prisma } from "@/lib/prisma";
import { StaffService } from "@/services/staff.service";
import { StudentStatus, SeatAllocationFilters } from "@/types";
import type { Prisma, SeatAllocation } from "@/app/generated/prisma/client";
import { parseNullableTime, timesOverlap } from "@/utils/shiftTime";
import {
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
    pageFromRows,
    PaginationInputError,
    type DateIdCursor,
} from "@/lib/cursorPagination";

export type SeatAllocationListOptions = {
    cursor?: DateIdCursor | null;
    limit?: number;
    all?: boolean;
};

import { runAllocationTransaction } from "@/lib/allocationTransaction";
import { createHash } from "node:crypto";
import { AllocationMoveError, allocationMoveSchema, normalizeAllocationMoveKey } from "@/lib/allocationMove";

const MINIMAL_STUDENT_IDENTITY_SELECT = {
    id: true,
    name: true,
} as const satisfies Prisma.StudentSelect;

const ALLOCATION_STUDENT_DETAIL_SELECT = {
    id: true,
    branchId: true,
    name: true,
    phone: true,
    status: true,
    joinedAt: true,
    billingStartAt: true,
    monthlyFee: true,
    feeLinkedShiftId: true,
    feeLinkedMultiShiftId: true,
    createdAt: true,
    updatedAt: true,
} as const satisfies Prisma.StudentSelect;

export class SeatAllocationService {
    /** Minimal identity picker for allocation work, independently of student-directory access. */
    static async listStudentOptions(userId: string, branchId: string) {
        const access = await AccessPolicy.authorizeCapability(userId, branchId, "allocationsView");
        const items = await prisma.student.findMany({
            where: { branchId: access.branchId, status: StudentStatus.ACTIVE },
            select: MINIMAL_STUDENT_IDENTITY_SELECT,
            orderBy: [{ name: "asc" }, { id: "asc" }],
        });
        // Fee-profile PATCH requires students permission; both mutations still
        // independently recheck authorization and branch writability on submit.
        return { items, canLinkFee: access.permissions.students };
    }

    private static async getAllocationWithBranch(allocationId: string) {
        const allocation = await prisma.seatAllocation.findUnique({
            where: { id: allocationId },
            include: { seat: { select: { branchId: true } } },
        });

        if (!allocation) throw new Error("Allocation not found");
        return allocation;
    }

    /**
     * Assign a seat to a student across ONE OR MORE shifts atomically.
     *
     * STRICT Validation Rules (enforced inside a single transaction):
     * 1. User must have seat-allocation access in the branch.
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
        multiShiftId?: string,
        expectedBranchId?: string
    ) {
        return runAllocationTransaction(tx =>
            this.assignSeatToShiftsInTransaction(
                userId,
                seatId,
                studentId,
                shiftIds,
                multiShiftId,
                tx, expectedBranchId
            )
        );
    }

    static async assignSeatToShiftsInTransaction(
        userId: string,
        seatId: string,
        studentId: string,
        shiftIds: string[],
        multiShiftId: string | undefined,
        tx: Prisma.TransactionClient,
        expectedBranchId?: string
    ) {
        if (!shiftIds || shiftIds.length === 0) {
            throw new Error("At least one shift must be selected.");
        }

        const uniqueShiftIds = [...new Set(shiftIds)];
        const seat = await tx.seat.findUnique({ where: { id: seatId } });
        if (!seat || (expectedBranchId && seat.branchId !== expectedBranchId)) throw new Error("Seat not found");
        const branchId = seat.branchId;
        await AccessPolicy.authorizeRecord(userId, branchId, "seat_allocation", "Seat", tx, true);

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
                const ms = await tx.multiShift.findUnique({
                    where: { id: multiShiftId },
                    include: { components: { select: { shiftId: true } } },
                });
                if (!ms) throw new Error("Multi-shift not found");
                if (ms.branchId !== branchId) throw new Error("Multi-shift does not belong to this branch");
                const componentIds = ms.components.map(component => component.shiftId);
                if (
                    componentIds.length !== uniqueShiftIds.length
                    || componentIds.some(componentId => !uniqueShiftIds.includes(componentId))
                ) {
                    throw new Error("All component shifts of the selected multi-shift are required.");
                }
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

            const allocationsToCreate = [];

            for (const requestedShift of requestedShifts) {
                const newStart = parseNullableTime(requestedShift.startTime);
                const newEnd = parseNullableTime(requestedShift.endTime);

                // 7a. Seat conflict — block if seat occupied in exact or time-overlapping shift
                for (const alloc of activeSeatAllocations) {
                    if (alloc.shiftId === requestedShift.id) {
                        throw new Error(`Seat is already assigned in shift "${requestedShift.name}".`);
                    }
                    const existing = shiftTimeMap.get(alloc.shiftId);
                    if (existing && timesOverlap(newStart, newEnd, parseNullableTime(existing.startTime), parseNullableTime(existing.endTime))) {
                        throw new Error(
                            `Seat is already occupied during this time (conflict with "${existing.name}")`
                        );
                    }
                }

                // 7b. Student conflict — block if student already in exact or time-overlapping shift
                for (const alloc of activeStudentAllocations) {
                    if (alloc.shiftId === requestedShift.id) {
                        throw new Error(`Student already has a seat in shift "${requestedShift.name}".`);
                    }
                    const existing = shiftTimeMap.get(alloc.shiftId);
                    if (existing && timesOverlap(newStart, newEnd, parseNullableTime(existing.startTime), parseNullableTime(existing.endTime))) {
                        throw new Error(
                            `Student is already allocated in an overlapping shift ("${existing.name}")`
                        );
                    }
                }

                // 8. Create allocation for this shift (with optional multiShiftId)
                const allocation = await tx.seatAllocation.create({
                    data: {
                        branchId,
                        seatId,
                        studentId,
                        shiftId: requestedShift.id,
                        ...(multiShiftId ? { multiShiftId } : {}),
                    },
                });

                // Push mock objects into live arrays so subsequent loop iterations
                // also see allocations created earlier in this transaction.
                const mockAllocation = { shiftId: requestedShift.id } as SeatAllocation;
                activeSeatAllocations.push(mockAllocation);
                activeStudentAllocations.push(mockAllocation);

                allocationsToCreate.push(allocation);
            }

            // 9. Update Branch lastDataChange
            await tx.branch.update({
                where: { id: branchId },
                data: { lastDataChange: new Date() },
            });

            return allocationsToCreate;
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
     * Does NOT delete the record. Releasing one component of a multi-shift
     * releases the complete student + seat + bundle allocation.
     */
    static async unassignSeat(userId: string, allocationId: string) {
        const allocation = await this.getAllocationWithBranch(allocationId);
        await AccessPolicy.authorizeRecord(userId, allocation.seat.branchId, "seat_allocation", "Allocation", undefined, true);

        return runAllocationTransaction(async (tx) => {
            const scopedAllocation = await tx.seatAllocation.findUnique({
                where: { id: allocationId },
                include: { seat: true },
            });

            if (!scopedAllocation) throw new Error("Allocation not found");
            if (scopedAllocation.endDate !== null) throw new Error("Allocation is already ended.");

            const endedAt = new Date();
            const releaseWhere: Prisma.SeatAllocationWhereInput = scopedAllocation.multiShiftId
                ? {
                    seatId: scopedAllocation.seatId,
                    studentId: scopedAllocation.studentId,
                    multiShiftId: scopedAllocation.multiShiftId,
                    endDate: null,
                }
                : { id: allocationId, endDate: null };

            await tx.seatAllocation.updateMany({
                where: releaseWhere,
                data: { endDate: endedAt },
            });

            await tx.branch.update({
                where: { id: scopedAllocation.seat.branchId },
                data: { lastDataChange: new Date() },
            });

            return {
                ...scopedAllocation,
                endDate: endedAt,
            };
        });
    }

    /**
     * Update an active allocation — end old record(s) and create new one(s)
     * atomically. Used for "Change Seat / Shift" from the UI.
     *
     * @param userId        - User performing the action
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
        newMultiShiftId?: string,
        transaction?: Prisma.TransactionClient
    ): Promise<SeatAllocation[]> {
        if (!transaction) return runAllocationTransaction(tx => this.updateAllocation(
            userId, allocationIds, newSeatId, studentId, newShiftIds, newMultiShiftId, tx));
        const tx = transaction;
        if (allocationIds.length === 0) {
            throw new AllocationMoveError("At least one allocation is required.", 400);
        }
        if (newShiftIds.length === 0) {
            throw new AllocationMoveError("At least one new shift is required.", 400);
        }

        // Fetch one allocation to get the studentId (validation)
        const existing = await tx.seatAllocation.findUnique({
            where: { id: allocationIds[0] },
        });
        if (!existing) throw new AllocationMoveError("Allocation not found.", 404);
        const branchId = existing.branchId;
        await AccessPolicy.authorizeRecord(userId, branchId, "seat_allocation", "Allocation", tx, true);
        if (existing.endDate !== null) throw new AllocationMoveError("Allocation is already ended.", 400);
        if (existing.studentId !== studentId) throw new AllocationMoveError("Student mismatch.", 400);

        const uniqueAllocationIds = [...new Set(allocationIds)];
        const scopedAllocations = await tx.seatAllocation.findMany({
            where: { id: { in: uniqueAllocationIds }, branchId, studentId },
            include: { seat: { select: { branchId: true } } },
        });

        if (scopedAllocations.length !== uniqueAllocationIds.length) {
            throw new AllocationMoveError("One or more allocations were not found.", 404);
        }

        for (const allocation of scopedAllocations) {
            if (allocation.endDate !== null) throw new AllocationMoveError("Allocation is already ended.", 400);
            if (allocation.studentId !== studentId) throw new AllocationMoveError("Student mismatch.", 400);
            if (allocation.seat.branchId !== branchId) {
                throw new AllocationMoveError("Allocations must belong to the same branch.", 400);
            }
        }

        const targetSeat = await tx.seat.findUnique({
            where: { id: newSeatId, branchId },
            select: { branchId: true },
        });
        if (!targetSeat) throw new AllocationMoveError("Seat not found.", 404);
        if (targetSeat.branchId !== branchId) {
            throw new AllocationMoveError("Seat does not belong to this branch.", 400);
        }

        const uniqueNewShiftIds = [...new Set(newShiftIds)];

        // Validate the complete replacement before ending any existing row.
            let replacementAllocationIds = uniqueAllocationIds;
            let activeOldAllocations = await tx.seatAllocation.findMany({
                where: { id: { in: uniqueAllocationIds }, branchId, studentId, endDate: null },
                include: { seat: { select: { branchId: true } } },
            });
            if (activeOldAllocations.length !== uniqueAllocationIds.length) {
                throw new AllocationMoveError("One or more allocations are no longer active.", 400);
            }
            for (const allocation of activeOldAllocations) {
                if (allocation.studentId !== studentId) throw new AllocationMoveError("Student mismatch.", 400);
                if (allocation.seat.branchId !== branchId) {
                    throw new AllocationMoveError("Allocations must belong to the same branch.", 400);
                }
            }

            // Resolve bundle siblings inside the serializable transaction so
            // concurrent component writes cannot leave a partial old bundle.
            const bundleScopes = activeOldAllocations
                .filter((allocation) => allocation.multiShiftId !== null)
                .map((allocation) => ({
                    studentId: allocation.studentId,
                    seatId: allocation.seatId,
                    multiShiftId: allocation.multiShiftId!,
                    endDate: null,
                }));
            if (bundleScopes.length > 0) {
                const bundleSiblings = await tx.seatAllocation.findMany({
                    where: { branchId, OR: bundleScopes },
                    select: { id: true },
                });
                replacementAllocationIds = [...new Set([
                    ...replacementAllocationIds,
                    ...bundleSiblings.map((allocation) => allocation.id),
                ])];
                activeOldAllocations = await tx.seatAllocation.findMany({
                    where: { id: { in: replacementAllocationIds }, branchId, studentId, endDate: null },
                    include: { seat: { select: { branchId: true } } },
                });
                if (activeOldAllocations.length !== replacementAllocationIds.length) {
                    throw new AllocationMoveError("One or more allocations are no longer active.", 400);
                }
                for (const allocation of activeOldAllocations) {
                    if (allocation.studentId !== studentId) throw new AllocationMoveError("Student mismatch.", 400);
                    if (allocation.seat.branchId !== branchId) {
                        throw new AllocationMoveError("Allocations must belong to the same branch.", 400);
                    }
                }
            }

            const seat = await tx.seat.findUnique({
                where: { id: newSeatId, branchId },
                select: { branchId: true },
            });
            if (!seat) throw new AllocationMoveError("Seat not found.", 404);
            if (seat.branchId !== branchId)
                throw new AllocationMoveError("Seat does not belong to this branch.", 400);

            const student = await tx.student.findUnique({
                where: { id: studentId, branchId },
                select: { branchId: true, status: true },
            });
            if (!student) throw new AllocationMoveError("Student not found.", 404);
            if (student.branchId !== branchId) throw new AllocationMoveError("Student does not belong to this branch.", 400);
            if (student.status !== StudentStatus.ACTIVE) {
                throw new AllocationMoveError("Only ACTIVE students can be assigned a seat", 400);
            }

            if (newMultiShiftId) {
                const multiShift = await tx.multiShift.findUnique({
                    where: { id: newMultiShiftId, branchId },
                    select: {
                        branchId: true,
                        components: { select: { shiftId: true } },
                    },
                });
                if (!multiShift) throw new AllocationMoveError("Multi-shift not found.", 404);
                if (multiShift.branchId !== branchId)
                    throw new AllocationMoveError("Multi-shift does not belong to this branch.", 400);
                const componentIds = multiShift.components.map((component) => component.shiftId);
                if (
                    componentIds.length !== uniqueNewShiftIds.length
                    || componentIds.some((componentId) => !uniqueNewShiftIds.includes(componentId))
                ) {
                    throw new AllocationMoveError("All component shifts of the selected multi-shift are required.", 400);
                }
            }

            // Validate new shifts
            const shifts = await tx.shift.findMany({
                where: { id: { in: uniqueNewShiftIds }, branchId },
            });
            if (shifts.length !== uniqueNewShiftIds.length)
                throw new AllocationMoveError("One or more new shifts were not found.", 404);
            for (const s of shifts) {
                if (s.status !== "ACTIVE") throw new AllocationMoveError(`Shift "${s.name}" is not active.`, 400);
                if (s.branchId !== branchId) throw new AllocationMoveError(`Shift "${s.name}" does not belong to this branch.`, 400);
            }

            if (!newMultiShiftId) {
                for (let i = 0; i < shifts.length; i++) {
                    for (let j = i + 1; j < shifts.length; j++) {
                        const a = shifts[i];
                        const b = shifts[j];
                        if (timesOverlap(
                            parseNullableTime(a.startTime),
                            parseNullableTime(a.endTime),
                            parseNullableTime(b.startTime),
                            parseNullableTime(b.endTime)
                        )) {
                            throw new AllocationMoveError(`Selected shifts "${a.name}" and "${b.name}" overlap with each other. You cannot assign both.`, 400);
                        }
                    }
                }
            }

            const allBranchShifts = await tx.shift.findMany({
                where: { branchId },
                select: { id: true, name: true, startTime: true, endTime: true },
            });
            const shiftTimeMap = new Map(allBranchShifts.map((shift) => [shift.id, shift]));
            const activeSeatAllocations = await tx.seatAllocation.findMany({
                where: {
                    seatId: newSeatId,
                    endDate: null,
                    id: { notIn: replacementAllocationIds },
                },
            });
            const activeStudentAllocations = await tx.seatAllocation.findMany({
                where: {
                    studentId,
                    endDate: null,
                    id: { notIn: replacementAllocationIds },
                },
            });

            for (const requestedShift of shifts) {
                const requestedStart = parseNullableTime(requestedShift.startTime);
                const requestedEnd = parseNullableTime(requestedShift.endTime);

                for (const allocation of activeSeatAllocations) {
                    const existingShift = shiftTimeMap.get(allocation.shiftId);
                    if (
                        allocation.shiftId === requestedShift.id
                        || (existingShift && timesOverlap(
                            requestedStart,
                            requestedEnd,
                            parseNullableTime(existingShift.startTime),
                            parseNullableTime(existingShift.endTime)
                        ))
                    ) {
                        throw new AllocationMoveError(`Seat is already occupied during this time${existingShift ? ` (conflict with "${existingShift.name}")` : ""}`, 400);
                    }
                }

                for (const allocation of activeStudentAllocations) {
                    const existingShift = shiftTimeMap.get(allocation.shiftId);
                    if (
                        allocation.shiftId === requestedShift.id
                        || (existingShift && timesOverlap(
                            requestedStart,
                            requestedEnd,
                            parseNullableTime(existingShift.startTime),
                            parseNullableTime(existingShift.endTime)
                        ))
                    ) {
                        throw new AllocationMoveError(`Student is already allocated in an overlapping shift${existingShift ? ` ("${existingShift.name}")` : ""}`, 400);
                    }
                }
            }

            // Re-selecting the existing complete assignment is a no-op, even
            // after a browser refresh has replaced the client's command key.
            if (activeOldAllocations.length === uniqueNewShiftIds.length && activeOldAllocations.every(row =>
                row.seatId === newSeatId && uniqueNewShiftIds.includes(row.shiftId)
                && (row.multiShiftId ?? null) === (newMultiShiftId ?? null))) return activeOldAllocations;

            await tx.seatAllocation.updateMany({
                where: { id: { in: replacementAllocationIds }, branchId, studentId, endDate: null },
                data: { endDate: new Date() },
            });

            const payload = uniqueNewShiftIds.map((shiftId) => ({
                branchId,
                seatId: newSeatId,
                studentId,
                shiftId,
                ...(newMultiShiftId ? { multiShiftId: newMultiShiftId } : {}),
            }));

            const created = await tx.seatAllocation.createManyAndReturn({
                data: payload,
            });

            await tx.branch.update({
                where: { id: branchId },
                data: { lastDataChange: new Date() },
            });

            return created;
    }

    /** The receipt and replacement share the serializable allocation transaction.
     * A retry re-authorizes the actor, then returns the recorded outcome even
     * though its original source allocations have already ended. */
    static async moveAllocation(userId: string, key: unknown, input: unknown) {
        const commandKey = normalizeAllocationMoveKey(key);
        const parsed = allocationMoveSchema.safeParse(input);
        if (!parsed.success) throw new AllocationMoveError("Invalid allocation change.", 400);
        const data = parsed.data;
        const requestHash = "v1:" + createHash("sha256").update(JSON.stringify({
            branchId: data.branchId, studentId: data.studentId, seatId: data.seatId,
            allocationIds: [...data.allocationIds].sort(), shiftIds: [...data.shiftIds].sort(),
            multiShiftId: data.multiShiftId ?? null,
        })).digest("hex");
        const operation = () => runAllocationTransaction(async tx => {
            const access = await AccessPolicy.authorizeRecord(userId, data.branchId, "seat_allocation", "Allocation", tx);
            const where = { actorId_branchId_commandKey: { actorId: userId, branchId: access.branchId, commandKey } };
            let receipt = await tx.allocationMoveCommand.findUnique({ where });
            const replayed = Boolean(receipt);
            if (receipt && receipt.requestHash !== requestHash) {
                throw new AllocationMoveError("This change request was already used with different details.", 409);
            }
            if (!receipt) {
                await AccessPolicy.authorizeRecord(userId, access.branchId, "seat_allocation", "Allocation", tx, true);
                await tx.$queryRaw`SELECT "id" FROM "Student" WHERE "id" = ${data.studentId} AND "branchId" = ${access.branchId} FOR UPDATE`;
                const source = await tx.seatAllocation.findFirst({ where: { id: data.allocationIds[0], branchId: access.branchId, studentId: data.studentId }, select: { id: true } });
                if (!source) throw new AllocationMoveError("Allocation not found", 404);
                const result = await this.updateAllocation(userId, data.allocationIds, data.seatId,
                    data.studentId, data.shiftIds, data.multiShiftId, tx);
                receipt = await tx.allocationMoveCommand.create({ data: {
                    actorId: userId, branchId: access.branchId, studentId: data.studentId, commandKey,
                    requestHash, sourceIds: data.allocationIds, resultIds: result.map(row => row.id),
                } });
            }
            const allocations = await tx.seatAllocation.findMany({
                where: { branchId: access.branchId, studentId: data.studentId, endDate: null },
                orderBy: { id: "asc" },
            });
            return { replayed, current: receipt.resultIds.every(id => allocations.some(row => row.id === id)), allocations };
        });
        // A no-op command may race another receipt without writing the shared
        // Branch row. Retry a unique-key collision in a fresh transaction so
        // the winner is read and its hash is checked instead of returning 500.
        for (let attempt = 0; attempt < 3; attempt++) {
            try { return await operation(); }
            catch (error) {
                if (attempt === 2 || typeof error !== "object" || error === null || !("code" in error) || error.code !== "P2002") throw error;
            }
        }
        throw new Error("Allocation change could not be confirmed.");
    }

    /**
     * List allocations for a branch with optional filters.
     */
    static async listAllocations(
        userId: string,
        branchId: string,
        filters: SeatAllocationFilters = {},
        options: SeatAllocationListOptions = {}
    ) {
        await StaffService.authorize(userId, branchId, "seat_allocation");
        const access = await StaffService.getBranchAccess(userId, branchId);
        const studentSelect = access.permissions.students
            ? ALLOCATION_STUDENT_DETAIL_SELECT
            : MINIMAL_STUDENT_IDENTITY_SELECT;

        if (filters.shiftId && filters.multiShiftId) {
            throw new Error("shiftId and multiShiftId cannot be combined");
        }
        if (filters.multiShiftId) {
            const multiShift = await prisma.multiShift.findUnique({
                where: { id: filters.multiShiftId },
                select: { branchId: true },
            });
            if (!multiShift || multiShift.branchId !== branchId) {
                throw new Error("Multi-shift not found");
            }
        }

        const limit = options.limit ?? DEFAULT_PAGE_SIZE;
        if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
            throw new PaginationInputError(`limit must be between 1 and ${MAX_PAGE_SIZE}`);
        }

        const endDate = filters.status === "ACTIVE" || filters.activeOnly
            ? null
            : filters.status === "ENDED"
                ? { not: null }
                : undefined;
        const baseWhere: Prisma.SeatAllocationWhereInput = {
            seat: { branchId },
            studentId: filters.studentId,
            shiftId: filters.shiftId,
            multiShiftId: filters.multiShiftId,
            endDate,
        };
        const pageWhere: Prisma.SeatAllocationWhereInput = options.cursor
            ? {
                ...baseWhere,
                OR: [
                    { startDate: { lt: options.cursor.sort } },
                    {
                        startDate: options.cursor.sort,
                        id: { lt: options.cursor.id },
                    },
                ],
            }
            : baseWhere;

        const query = {
            where: options.all ? baseWhere : pageWhere,
            include: {
                seat: true,
                student: { select: studentSelect },
                shift: true,
                multiShift: { select: { id: true, name: true } },
            },
            orderBy: [
                { startDate: "desc" as const },
                { id: "desc" as const },
            ],
            ...(options.all ? {} : { take: limit + 1 }),
        } satisfies Prisma.SeatAllocationFindManyArgs;

        const [allocations, total] = await Promise.all([
            prisma.seatAllocation.findMany(query),
            prisma.seatAllocation.count({ where: baseWhere }),
        ]);

        if (options.all) {
            return { items: allocations, nextCursor: null, total };
        }

        return pageFromRows(allocations, limit, total, allocation => ({
            sort: allocation.startDate,
            id: allocation.id,
        }));
    }
}
