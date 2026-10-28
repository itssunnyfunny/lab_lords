import { z } from "zod";

const id = z.string().min(1).max(128);
const ids = z.array(id).min(1).max(100).refine(value => new Set(value).size === value.length);
export const allocationMoveSchema = z.object({
    branchId: id, seatId: id, studentId: id, allocationIds: ids, shiftIds: ids, multiShiftId: id.optional(),
}).strict();

export class AllocationMoveError extends Error {
    constructor(message: string, readonly status: 400 | 404 | 409) { super(message); }
}
export function normalizeAllocationMoveKey(key: unknown): string {
    if (typeof key !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key)) {
        throw new AllocationMoveError("A valid allocation change request key is required.", 400);
    }
    return key.toLowerCase();
}
