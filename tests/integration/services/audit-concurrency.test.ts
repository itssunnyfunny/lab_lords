import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase, disconnectDatabase, testPrisma } from "@/tests/setup/db";
import { createAllocation, createSaasSubscription, createSeat, createShift, createStaff, createStudent, createTestWorld, createUser } from "@/tests/factories";
import { ShiftService } from "@/services/shift.service";
import { StudentService } from "@/services/student.service";
import { SeatAllocationService } from "@/services/seatAllocation.service";
import { StudentStatus } from "@/types";
import type { Prisma } from "@/app/generated/prisma/client";

beforeEach(resetDatabase); afterEach(() => vi.restoreAllMocks()); afterAll(disconnectDatabase);
function signal() { let resolve!: () => void; const promise = new Promise<void>(done => { resolve = done; }); return { promise, resolve }; }
async function waitFor(promise: Promise<void>) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try { await Promise.race([promise, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Controlled transaction barrier was not reached")), 5000); })]); }
    finally { clearTimeout(timer); }
}

describe("primary shift overlap races", () => {
    it.each(["create", "edit"] as const)("rejects a concurrent overlapping %s after both validations initially see a free interval", async method => {
        const world = await createTestWorld();
        const second = await createShift({ branchId: world.branch.id, name: "Afternoon", startTime: "12:00", endTime: "17:00" });
        const guard = ShiftService as unknown as { checkTimeOverlap: (...args: unknown[]) => Promise<void> };
        const original = guard.checkTimeOverlap.bind(ShiftService); const both = signal(); let reads = 0;
        vi.spyOn(guard, "checkTimeOverlap").mockImplementation(async (...args) => {
            await original(...args);
            if (++reads <= 2) { if (reads === 2) both.resolve(); await waitFor(both.promise); }
        });
        const change = { startTime: "18:00", endTime: "22:00", price: 500 };
        const results = await Promise.allSettled(method === "create"
            ? [ShiftService.createShift(world.user.id, world.branch.id, { ...change, name: "Night one" }), ShiftService.createShift(world.user.id, world.branch.id, { ...change, name: "Night two" })]
            : [ShiftService.updateShift(world.user.id, world.shift.id, change), ShiftService.updateShift(world.user.id, second.id, change)]);
        expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
        expect(await testPrisma.shift.count({ where: { branchId: world.branch.id, startTime: "18:00", endTime: "22:00", status: "ACTIVE" } })).toBe(1);
    });
});

describe("policy changes committed before the writer transaction starts", () => {
    const methods = ["admission", "profile", "status", "shift", "allocation"] as const;
    for (const method of methods) it.each(["permission", "archival"] as const)(`${method} rechecks %s at the writer boundary`, async boundary => {
        const world = await createTestWorld(); await createSaasSubscription({ organizationId: world.org.id });
        const actor = await createUser(); const membership = await createStaff({ userId: actor.id, branchId: world.branch.id, role: "MANAGER" });
        const student = await createStudent({ branchId: world.branch.id });
        const allocation = await createAllocation({ studentId: student.id, seatId: world.seat.id, shiftId: world.shift.id });
        const target = await createSeat({ branchId: world.branch.id, label: "B2" });
        const beforeStudent = await testPrisma.student.findUniqueOrThrow({ where: { id: student.id } });
        const paused = signal(); const resume = signal(); let intercepted = false;
        const original = prisma.$transaction.bind(prisma);
        vi.spyOn(prisma, "$transaction").mockImplementation((async (...args: unknown[]) => {
            if (typeof args[0] === "function" && !intercepted) { intercepted = true; paused.resolve(); await resume.promise; }
            return Reflect.apply(original, prisma, args);
        }) as typeof prisma.$transaction);
        const operation = () => method === "admission" ? StudentService.createStudent(actor.id, world.branch.id, { name: "Must not create", phone: "9876501234" })
            : method === "profile" ? StudentService.updateStudentProfile(actor.id, student.id, { name: "Must not change" })
                : method === "status" ? StudentService.updateStudentStatus(actor.id, student.id, StudentStatus.INACTIVE, "KEEP")
                    : method === "shift" ? ShiftService.updateShift(actor.id, world.shift.id, { name: "Must not change" })
                        : SeatAllocationService.updateAllocation(actor.id, [allocation.id], target.id, student.id, [world.shift.id]);
        const result = operation().then(() => ({ success: true, error: null }), (error: unknown) => ({ success: false, error }));
        try {
            await waitFor(paused.promise);
            if (boundary === "permission") await testPrisma.staffPermissionOverride.create({ data: { staffId: membership.id,
                action: method === "shift" ? "MANAGE_BRANCH" : method === "allocation" ? "SEAT_ALLOCATION" : "STUDENTS", allowed: false } });
            else await testPrisma.branch.update({ where: { id: world.branch.id }, data: { billingStatus: "ARCHIVED" } });
        } finally { resume.resolve(); }
        const outcome = await result;
        expect(outcome.success).toBe(false);
        expect(await testPrisma.student.findUniqueOrThrow({ where: { id: student.id } })).toEqual(beforeStudent);
        expect(await testPrisma.student.count()).toBe(1);
        expect((await testPrisma.shift.findUniqueOrThrow({ where: { id: world.shift.id } })).name).toBe(world.shift.name);
        expect((await testPrisma.seatAllocation.findUniqueOrThrow({ where: { id: allocation.id } })).endDate).toBeNull();
    });
});

describe("deactivation versus allocation", () => {
    it("cannot commit an active allocation from an ACTIVE read after deactivation has committed", async () => {
        const world = await createTestWorld(); const student = await createStudent({ branchId: world.branch.id });
        const read = signal(); const resume = signal(); let intercepted = false;
        const original = prisma.$transaction.bind(prisma);
        vi.spyOn(prisma, "$transaction").mockImplementation((async (...args: unknown[]) => {
            const operation = args[0];
            if (typeof operation !== "function") return Reflect.apply(original, prisma, args);
            return Reflect.apply(original, prisma, [async (tx: Prisma.TransactionClient) => {
                const reader = new Proxy(tx.student, { get(model, property) {
                    if (property !== "findUnique") return Reflect.get(model, property);
                    return async (query: Prisma.StudentFindUniqueArgs) => {
                        const value = await model.findUnique(query);
                        if (!intercepted && query.where.id === student.id && value?.status === "ACTIVE") { intercepted = true; read.resolve(); await resume.promise; }
                        return value;
                    };
                } });
                return operation(new Proxy(tx, { get(target, property) { return property === "student" ? reader : Reflect.get(target, property); } }));
            }, ...args.slice(1)]);
        }) as typeof prisma.$transaction);
        const assigning = SeatAllocationService.assignSeatToShifts(world.user.id, world.seat.id, student.id, [world.shift.id])
            .then(() => true, () => false);
        try { await waitFor(read.promise); await StudentService.updateStudentStatus(world.user.id, student.id, StudentStatus.INACTIVE, "KEEP"); }
        finally { resume.resolve(); }
        expect(await assigning).toBe(false);
        expect((await testPrisma.student.findUniqueOrThrow({ where: { id: student.id } })).status).toBe("INACTIVE");
        expect(await testPrisma.seatAllocation.count({ where: { studentId: student.id, endDate: null } })).toBe(0);
    });
});
