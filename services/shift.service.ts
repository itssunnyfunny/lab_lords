import { AccessPolicy } from "@/services/accessPolicy.service";

import { prisma } from "@/lib/prisma";
import { updateLinkedStudentFees } from "@/services/studentFeePeriod";
import { StaffService } from "@/services/staff.service";
import { CreateShiftDto } from "@/types";
import type { StaffAction } from "@/types";
import type { Prisma, Shift } from "@/app/generated/prisma/client";
import { parseNullableTime, timesOverlap } from "@/utils/shiftTime";
import { sortSeatsByLabel } from "@/lib/seatNumbering";
import { runAllocationTransaction } from "@/lib/allocationTransaction";
import {
    FORM_LIMITS,
    parseIntegerField,
    validateOptionalTime,
    validateRequiredText,
} from "@/lib/formValidation";
import { DEFAULT_PRIMARY_SHIFTS, ensureDefaultShiftsAndFullTime } from "@/services/defaultShifts";

export const DEFAULT_SHIFTS = DEFAULT_PRIMARY_SHIFTS;

// ─── Resolution Plan Types ─────────────────────────────────────────────────────

export type ResolutionPlan =
    | { type: "END_ALL" }
    | { type: "REALLOCATE_BULK"; targetShiftId: string }
    | { type: "REALLOCATE_MANUAL"; assignments: { allocationId: string; targetShiftId: string }[] };

export interface ShiftImpactAnalysis {
    studentsInShift: number;
    allocations: { allocationId: string; studentId: string; studentName: string; seatLabel: string; eligibleTargetShiftIds: string[] }[];
    otherShifts: { shiftId: string; name: string; totalSeats: number; activeAllocations: number; emptySeats: number }[];
    totalEmptyElsewhere: number;
    shiftsWithEnoughCapacity: string[];
    willOverflowBy: number;
    isLastActiveShift: boolean;
}

function sourceReleaseWhere(source: { id: string; studentId: string; seatId: string; multiShiftId: string | null }[]): Prisma.SeatAllocationWhereInput {
    return { endDate: null, OR: [
        { id: { in: source.map(a => a.id) } },
        ...source.filter(a => a.multiShiftId !== null).map(a => ({
            studentId: a.studentId, seatId: a.seatId, multiShiftId: a.multiShiftId!,
        })),
    ] };
}

type ShiftTimes = Pick<Shift, "startTime" | "endTime">;

function targetOccupancy(target: ShiftTimes, shifts: ReadonlyMap<string, ShiftTimes>,
    active: { seatId: string; studentId: string; shiftId: string }[]) {
    const start = parseNullableTime(target.startTime);
    const end = parseNullableTime(target.endTime);
    const seats = new Set<string>();
    const students = new Set<string>();
    for (const allocation of active) {
        const other = shifts.get(allocation.shiftId);
        if (timesOverlap(start, end, parseNullableTime(other?.startTime), parseNullableTime(other?.endTime))) {
            seats.add(allocation.seatId);
            students.add(allocation.studentId);
        }
    }
    return { seats, students };
}

function countUnplaceableAllocations(
    allocations: ShiftImpactAnalysis["allocations"], shifts: ShiftImpactAnalysis["otherShifts"],
) {
    const targets = new Map(shifts.map(s => [s.shiftId, { capacity: s.emptySeats, assigned: [] as number[] }]));

    // A full target can still take this student if one of its provisional
    // occupants has an alternate placement. These assignments are preview-only.
    function place(index: number, visited: Set<string>): boolean {
        const choices = allocations[index].eligibleTargetShiftIds;
        for (const id of choices) {
            const target = targets.get(id)!;
            if (!visited.has(id) && target.assigned.length < target.capacity) {
                target.assigned.push(index);
                return true;
            }
        }
        for (const id of choices) {
            if (visited.has(id)) continue;
            visited.add(id);
            const target = targets.get(id)!;
            const moved = target.assigned.findIndex(occupant => place(occupant, visited));
            if (moved !== -1) {
                target.assigned[moved] = index;
                return true;
            }
        }
        return false;
    }

    let unplaced = 0;
    for (let index = 0; index < allocations.length; index++) {
        if (!place(index, new Set())) unplaced++;
    }
    return unplaced;
}

export class ShiftService {
    private static async assertBranchAccess(userId: string, branchId: string, action: StaffAction) {
        await StaffService.authorize(userId, branchId, action);

        const branch = await prisma.branch.findUnique({ where: { id: branchId } });
        if (!branch) throw new Error("Branch not found");
        return branch;
    }

    /**
     * Validates that the given time window does not overlap with any existing
     * ACTIVE shift in the branch. Throws a descriptive error if a conflict is found.
     * @param excludeShiftId - skip this shift ID when checking (used for updates)
     */
    private static async checkTimeOverlap(
        branchId: string,
        startTime: string | null,
        endTime: string | null,
        excludeShiftId?: string,
        client: Prisma.TransactionClient | typeof prisma = prisma
    ) {
        const newStart = parseNullableTime(startTime);
        const newEnd = parseNullableTime(endTime);

        const activeShifts = await client.shift.findMany({
            where: {
                branchId,
                status: "ACTIVE",
                ...(excludeShiftId ? { id: { not: excludeShiftId } } : {}),
            },
            select: { id: true, name: true, startTime: true, endTime: true },
        });

        for (const shift of activeShifts) {
            const existStart = parseNullableTime(shift.startTime);
            const existEnd = parseNullableTime(shift.endTime);
            if (timesOverlap(newStart, newEnd, existStart, existEnd)) {
                throw new Error(
                    `Shift time overlaps with an existing active shift ("${shift.name}": ${shift.startTime ?? "?"} – ${shift.endTime ?? "?"})`
                );
            }
        }
    }

    static async createShift(userId: string, branchId: string, data: CreateShiftDto) {
        return runAllocationTransaction(tx =>
            this.createShiftInTransaction(userId, branchId, data, tx)
        );
    }

    static async createShiftInTransaction(
        userId: string,
        branchId: string,
        data: CreateShiftDto,
        tx: Prisma.TransactionClient
    ) {
        await AccessPolicy.authorizeAction(userId, branchId, "manage_branch", tx, true);
        const nameResult = validateRequiredText(data.name, "Shift name", 50);
        if (!nameResult.ok) throw new Error(nameResult.error);
        const startResult = validateOptionalTime(data.startTime, "Start time");
        if (!startResult.ok) throw new Error(startResult.error);
        const endResult = validateOptionalTime(data.endTime, "End time");
        if (!endResult.ok) throw new Error(endResult.error);
        if ((startResult.value && !endResult.value) || (!startResult.value && endResult.value)) {
            throw new Error("Shift must have both start and end time, or neither.");
        }
        const priceResult = parseIntegerField(data.price, "Monthly price", {
            min: 0,
            max: FORM_LIMITS.moneyMax,
        });
        if (!priceResult.ok) throw new Error(priceResult.error);

        const existingShift = await tx.shift.findFirst({
            where: { branchId, name: nameResult.value, status: "ACTIVE" },
        });
        if (existingShift) throw new Error(`Shift with name "${nameResult.value}" already exists in this branch.`);

        // Always check overlap, even for null times (null = full day, overlaps everything)
        await this.checkTimeOverlap(branchId, startResult.value, endResult.value, undefined, tx);

        const shift = await tx.shift.create({
            data: {
                branchId,
                name: nameResult.value,
                startTime: startResult.value,
                endTime: endResult.value,
                price: priceResult.value ?? 0,
                isReserved: data.isReserved ?? false,
            },
        });
        await tx.branch.update({ where: { id: branchId }, data: { lastDataChange: new Date() } });
        return shift;
    }

    static async updateShift(
        userId: string,
        shiftId: string,
        data: Partial<{ name: string; startTime: string | null; endTime: string | null; price: number; isReserved: boolean }>,
        transaction?: Prisma.TransactionClient,
        expectedBranchId?: string
    ): Promise<Shift> {
        if (!transaction) return runAllocationTransaction(tx => this.updateShift(userId, shiftId, data, tx, expectedBranchId));
        const tx = transaction;
        const shift = await tx.shift.findUnique({ where: { id: shiftId } });
        if (!shift || (expectedBranchId && shift.branchId !== expectedBranchId)) throw new Error("Shift not found");
        await AccessPolicy.authorizeRecord(userId, shift.branchId, "manage_branch", "Shift", tx, true);

        const nameResult = data.name !== undefined ? validateRequiredText(data.name, "Shift name", 50) : null;
        if (nameResult && !nameResult.ok) throw new Error(nameResult.error);
        const startResult = data.startTime !== undefined ? validateOptionalTime(data.startTime, "Start time") : null;
        if (startResult && !startResult.ok) throw new Error(startResult.error);
        const endResult = data.endTime !== undefined ? validateOptionalTime(data.endTime, "End time") : null;
        if (endResult && !endResult.ok) throw new Error(endResult.error);
        const priceResult = data.price !== undefined
            ? parseIntegerField(data.price, "Monthly price", { min: 0, max: FORM_LIMITS.moneyMax })
            : null;
        if (priceResult && !priceResult.ok) throw new Error(priceResult.error);

        const normalizedName = nameResult?.ok ? nameResult.value : undefined;
        if (normalizedName && normalizedName !== shift.name) {
            const duplicate = await tx.shift.findFirst({
                where: { branchId: shift.branchId, name: normalizedName, status: "ACTIVE", id: { not: shiftId } },
            });
            if (duplicate) throw new Error(`Shift with name "${normalizedName}" already exists in this branch.`);
        }

        const newStart = startResult?.ok ? startResult.value : shift.startTime;
        const newEnd = endResult?.ok ? endResult.value : shift.endTime;
        if ((newStart && !newEnd) || (!newStart && newEnd)) {
            throw new Error("Shift must have both start and end time, or neither.");
        }
        if (data.startTime !== undefined || data.endTime !== undefined) {
            await this.checkTimeOverlap(shift.branchId, newStart ?? null, newEnd ?? null, shiftId, tx);
        }

        const normalizedPrice = priceResult?.ok ? priceResult.value : undefined;
        const priceChanged = normalizedPrice !== undefined && normalizedPrice !== shift.price;

            const updated = await tx.shift.update({
                where: { id: shiftId },
                data: {
                    ...(normalizedName !== undefined ? { name: normalizedName } : {}),
                    ...(data.startTime !== undefined ? { startTime: newStart } : {}),
                    ...(data.endTime !== undefined ? { endTime: newEnd } : {}),
                    ...(normalizedPrice !== undefined ? { price: normalizedPrice } : {}),
                    ...(data.isReserved !== undefined ? { isReserved: data.isReserved } : {}),
                },
            });

            if (priceChanged) {
                await updateLinkedStudentFees(tx, userId, { branchId: shift.branchId, feeLinkedShiftId: shiftId }, normalizedPrice);
            }

            await tx.branch.update({
                where: { id: shift.branchId },
                data: { lastDataChange: new Date() },
            });

            return updated;
    }

    // ─── Analyze shift deletion impact (read-only) ────────────────────────────

    static async analyzeShiftDeletion(userId: string, shiftId: string): Promise<ShiftImpactAnalysis> {
        const shift = await prisma.shift.findUnique({ where: { id: shiftId } });
        if (!shift) throw new Error("Shift not found");
        await AccessPolicy.authorizeRecord(userId, shift.branchId, "manage_branch", "Shift", undefined, true);
        if (shift.status !== "ACTIVE") throw new Error("Shift not found");

        const branchId = shift.branchId;

        const branchShifts = await prisma.shift.findMany({
            where: { branchId },
            select: { id: true, name: true, status: true, startTime: true, endTime: true },
        });
        const shifts = new Map(branchShifts.map(s => [s.id, s]));
        const otherActiveShifts = branchShifts.filter(s => s.status === "ACTIVE" && s.id !== shiftId);
        const isLastActiveShift = otherActiveShifts.length === 0;

        const rawAllocations = await prisma.seatAllocation.findMany({
            where: { shiftId, endDate: null },
            include: {
                student: { select: { id: true, name: true, status: true, branchId: true } },
                seat: { select: { label: true, branchId: true } },
            },
        });

        if (rawAllocations.some(a => a.student.branchId !== branchId || a.seat.branchId !== branchId)) {
            throw new Error("Source allocations require repair before this shift can be removed.");
        }
        const remainingAllocations = await prisma.seatAllocation.findMany({
            where: { seat: { branchId }, endDate: null, NOT: sourceReleaseWhere(rawAllocations) },
            select: { seatId: true, studentId: true, shiftId: true },
        });

        const totalBranchSeats = await prisma.seat.count({ where: { branchId } });
        const allocations = rawAllocations.map(a => ({
            allocationId: a.id, studentId: a.student.id, studentName: a.student.name, seatLabel: a.seat.label,
            eligibleTargetShiftIds: [] as string[],
        }));
        const studentsInShift = allocations.length;
        const activeStudents = new Set(rawAllocations.filter(a => a.student.status === "ACTIVE").map(a => a.studentId));
        const otherShifts = otherActiveShifts.map(s => {
            const occupied = targetOccupancy(s, shifts, remainingAllocations);
            const activeAllocations = occupied.seats.size;
            const emptySeats = Math.max(0, totalBranchSeats - activeAllocations);
            for (const allocation of allocations) {
                if (emptySeats > 0 && activeStudents.has(allocation.studentId) && !occupied.students.has(allocation.studentId)) {
                    allocation.eligibleTargetShiftIds.push(s.id);
                }
            }
            return {
                shiftId: s.id,
                name: s.name,
                totalSeats: totalBranchSeats,
                activeAllocations,
                emptySeats,
            };
        });

        const totalEmptyElsewhere = otherShifts.reduce((sum, s) => sum + s.emptySeats, 0);
        const shiftsWithEnoughCapacity = otherShifts
            .filter(s => s.emptySeats >= studentsInShift && activeStudents.size === studentsInShift &&
                allocations.every(a => a.eligibleTargetShiftIds.includes(s.shiftId)))
            .map(s => s.shiftId);
        const willOverflowBy = shiftsWithEnoughCapacity.length ? 0 : countUnplaceableAllocations(allocations, otherShifts);

        return {
            studentsInShift,
            allocations,
            otherShifts,
            totalEmptyElsewhere,
            shiftsWithEnoughCapacity,
            willOverflowBy,
            isLastActiveShift,
        };
    }

    // ─── Delete shift with resolution (transactional) ─────────────────────────

    static async deleteShift(userId: string, shiftId: string, resolution: ResolutionPlan) {
        return runAllocationTransaction(async tx => {
            const shift = await tx.shift.findFirst({ where: {
                id: shiftId,
                branch: { OR: [{ organization: { ownerId: userId } }, { staff: { some: { userId } } }] },
            } });
            if (!shift) throw new Error("Shift not found");
            const branchId = shift.branchId;
            await AccessPolicy.authorizeAction(userId, branchId, "manage_branch", tx, true);
            if (shift.status !== "ACTIVE") throw new Error("Shift not found");
            if (await tx.shift.count({ where: { branchId, status: "ACTIVE" } }) <= 1) {
                throw new Error("Cannot delete the last active shift in this branch.");
            }

            // The source set is authoritative and is read under the same
            // serializable protocol used by every competing allocation writer.
            const source = await tx.seatAllocation.findMany({
                where: { shiftId, endDate: null },
                include: { student: { select: { branchId: true, status: true } }, seat: { select: { branchId: true } } },
            });
            if (source.some(a => a.student.branchId !== branchId || a.seat.branchId !== branchId)) {
                throw new Error("Source allocations require repair before this shift can be removed.");
            }
            const sourceIds = new Set(source.map(a => a.id));
            let assignments: { allocationId: string; targetShiftId: string }[];
            switch (resolution.type) {
                case "END_ALL":
                    assignments = [];
                    break;
                case "REALLOCATE_BULK":
                    assignments = source.map(a => ({ allocationId: a.id, targetShiftId: resolution.targetShiftId }));
                    break;
                case "REALLOCATE_MANUAL": {
                    assignments = resolution.assignments;
                    const ids = assignments.map(a => a.allocationId);
                    if (ids.length !== source.length || new Set(ids).size !== ids.length
                        || ids.some(id => !sourceIds.has(id))) {
                        throw new Error("Assignments must include every active source allocation exactly once.");
                    }
                    break;
                }
                default:
                    throw new Error("Invalid resolution type.");
            }

            // Validate a bulk target even when the source has no allocations.
            const targetIds = resolution.type === "REALLOCATE_BULK"
                ? [resolution.targetShiftId] : [...new Set(assignments.map(a => a.targetShiftId))];
            const targets = await tx.shift.findMany({
                where: { id: { in: targetIds }, branchId, status: "ACTIVE" },
                select: { id: true },
            });
            if (targets.length !== targetIds.length) throw new Error("Target shift not found or inactive.");
            if (targetIds.includes(shiftId)) throw new Error("Target shift cannot be the same shift.");

            // Releasing any bundle component releases that student's complete
            // bundle on that seat, exactly as ordinary release/replacement does.
            const now = new Date();
            await tx.seatAllocation.updateMany({
                where: sourceReleaseWhere(source),
                data: { endDate: now },
            });
            const seats = sortSeatsByLabel(await tx.seat.findMany({ where: { branchId } }));
            const allShifts = await tx.shift.findMany({ where: { branchId } });
            const shiftMap = new Map(allShifts.map(s => [s.id, s]));
            const active = await tx.seatAllocation.findMany({
                where: { seat: { branchId }, endDate: null },
            });
            const sourceById = new Map(source.map(a => [a.id, a]));
            const creates: Prisma.SeatAllocationCreateManyInput[] = [];
            // Bulk and manual resolution share one tenant/overlap/capacity path.
            for (const assignment of assignments) {
                const old = sourceById.get(assignment.allocationId)!;
                if (old.student.status !== "ACTIVE") throw new Error("Only ACTIVE students can be assigned a seat");
                const target = shiftMap.get(assignment.targetShiftId)!;
                const occupied = targetOccupancy(target, shiftMap, active);
                if (occupied.students.has(old.studentId)) {
                    throw new Error("Student is already allocated in the target or an overlapping shift.");
                }
                const seat = seats.find(s => !occupied.seats.has(s.id));
                if (!seat) throw new Error("Target shift does not have enough capacity: no available seat.");
                const allocation = {
                    branchId, studentId: old.studentId, seatId: seat.id, shiftId: target.id, startDate: now,
                };
                creates.push(allocation);
                active.push({ ...allocation, id: crypto.randomUUID(), multiShiftId: null, endDate: null });
            }
            if (creates.length) await tx.seatAllocation.createMany({ data: creates });
            await tx.student.updateMany({
                where: { branchId, feeLinkedShiftId: shiftId },
                data: { feeLinkedShiftId: null },
            });
            await tx.shift.update({ where: { id: shiftId }, data: { status: "INACTIVE", deletedAt: now } });
            await tx.branch.update({ where: { id: branchId }, data: { lastDataChange: now } });
            return { success: true };
        });
    }

    static async ensureDefaultShifts(branchId: string) {
        // ⚡ Bolt: Batch database queries to prevent N+1 bottleneck.
        // Replaced loop-based findFirst + create with a single findMany and createMany.
        await ensureDefaultShiftsAndFullTime(branchId);
    }

    static async listShifts(userId: string, branchId: string) {
        await this.assertBranchAccess(userId, branchId, "seat_allocation");
        return prisma.shift.findMany({
            where: { branchId, status: "ACTIVE" },
            orderBy: { name: "asc" },
        });
    }
}
