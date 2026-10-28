import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { resetDatabase, disconnectDatabase, testPrisma } from "@/tests/setup/db";
import { createAllocation, createOrg, createPayment, createSeat, createStudent, createTestWorld, createUser } from "@/tests/factories";
import { SeatAllocationService } from "@/services/seatAllocation.service";
import { DashboardService } from "@/services/dashboard.service";
import { BillingHistoryService } from "@/services/billingHistory.service";

beforeEach(resetDatabase);
afterAll(disconnectDatabase);

async function moveWorld() {
    const world = await createTestWorld();
    const student = await createStudent({ branchId: world.branch.id });
    const source = await createAllocation({ seatId: world.seat.id, studentId: student.id, shiftId: world.shift.id });
    const target = await createSeat({ branchId: world.branch.id, label: "A2" });
    return { ...world, student, source, target, input: { branchId: world.branch.id, studentId: student.id, seatId: target.id, allocationIds: [source.id], shiftIds: [world.shift.id] } };
}

describe("durable allocation changes", () => {
    it("resolves concurrent no-op commands to one receipt without adding allocation history", async () => {
        const world = await moveWorld(); const key = randomUUID();
        const input = { ...world.input, seatId: world.seat.id };
        const results = await Promise.all(Array.from({ length: 4 }, () => SeatAllocationService.moveAllocation(world.user.id, key, input)));
        expect(results.every(result => result.current && result.allocations[0].id === world.source.id)).toBe(true);
        expect(await testPrisma.allocationMoveCommand.count()).toBe(1);
        expect(await testPrisma.seatAllocation.count()).toBe(1);
    });
    it("allows an authorized read-only replay, but refuses a new write after archival", async () => {
        const world = await moveWorld(); const key = randomUUID();
        const committed = await SeatAllocationService.moveAllocation(world.user.id, key, world.input);
        await testPrisma.branch.update({ where: { id: world.branch.id }, data: { billingArchivedAt: new Date() } });
        const recovered = await SeatAllocationService.moveAllocation(world.user.id, key, world.input);
        expect(recovered).toEqual({ ...committed, replayed: true });
        await expect(SeatAllocationService.moveAllocation(world.user.id, randomUUID(), world.input)).rejects.toThrow();
        expect(await testPrisma.allocationMoveCommand.count()).toBe(1);
    });
    it("does not create duplicate history when the current assignment is selected again with a new command key", async () => {
        const world = await moveWorld();
        const input = { ...world.input, seatId: world.seat.id };
        const first = await SeatAllocationService.moveAllocation(world.user.id, randomUUID(), input);
        const second = await SeatAllocationService.moveAllocation(world.user.id, randomUUID(), input);
        expect(first.allocations[0].id).toBe(world.source.id); expect(second.allocations[0].id).toBe(world.source.id);
        expect(await testPrisma.seatAllocation.count()).toBe(1);
        expect((await testPrisma.seatAllocation.findUniqueOrThrow({ where: { id: world.source.id } })).endDate).toBeNull();
    });
    it("recovers a committed move after its response is lost without repeating the change", async () => {
        const world = await moveWorld(); const key = randomUUID();
        const committed = await SeatAllocationService.moveAllocation(world.user.id, key, world.input);
        const ended = await testPrisma.seatAllocation.findUniqueOrThrow({ where: { id: world.source.id } });
        for (let attempt = 0; attempt < 3; attempt++) {
            const recovered = await SeatAllocationService.moveAllocation(world.user.id, key, world.input);
            expect(recovered).toEqual({ ...committed, replayed: true });
        }
        expect(committed.current).toBe(true);
        expect(committed.allocations).toHaveLength(1);
        expect(committed.allocations[0].seatId).toBe(world.target.id);
        expect(await testPrisma.seatAllocation.count()).toBe(2);
        expect(await testPrisma.allocationMoveCommand.count()).toBe(1);
        expect((await testPrisma.seatAllocation.findUniqueOrThrow({ where: { id: ended.id } })).endDate).toEqual(ended.endDate);
    });
    it("concurrent requests with the same key commit exactly one replacement and receipt", async () => {
        const world = await moveWorld(); const key = randomUUID();
        const results = await Promise.all(Array.from({ length: 4 }, () => SeatAllocationService.moveAllocation(world.user.id, key, world.input)));
        expect(new Set(results.map(result => result.allocations[0].id)).size).toBe(1);
        expect(await testPrisma.seatAllocation.count({ where: { endDate: null } })).toBe(1);
        expect(await testPrisma.allocationMoveCommand.count()).toBe(1);
    });
    it("rejects changed input under a committed key and returns current state after a subsequent genuine move", async () => {
        const world = await moveWorld(); const key = randomUUID();
        const first = await SeatAllocationService.moveAllocation(world.user.id, key, world.input);
        await expect(SeatAllocationService.moveAllocation(world.user.id, key, { ...world.input, seatId: world.seat.id }))
            .rejects.toMatchObject({ status: 409 });
        await SeatAllocationService.updateAllocation(world.user.id, first.allocations.map(row => row.id), world.seat.id,
            world.student.id, [world.shift.id]);
        const recovered = await SeatAllocationService.moveAllocation(world.user.id, key, world.input);
        expect(recovered.current).toBe(false);
        expect(recovered.allocations[0].seatId).toBe(world.seat.id);
        expect(await testPrisma.seatAllocation.count()).toBe(3);
    });
    it("does not disclose a foreign outcome or permit a source group to mix tenants", async () => {
        const world = await moveWorld(); const other = await moveWorld(); const key = randomUUID();
        await SeatAllocationService.moveAllocation(world.user.id, key, world.input);
        await expect(SeatAllocationService.moveAllocation(other.user.id, key, world.input)).rejects.toThrow("Allocation not found");
        await expect(SeatAllocationService.moveAllocation(other.user.id, randomUUID(), {
            ...other.input, allocationIds: [other.source.id, world.source.id],
        })).rejects.toThrow();
        expect(await testPrisma.allocationMoveCommand.count()).toBe(1);
        expect((await testPrisma.seatAllocation.findUniqueOrThrow({ where: { id: other.source.id } })).endDate).toBeNull();
    });
});

describe("membership correction and preserved history", () => {
    async function termWorld() {
        const world = await createTestWorld(); const student = await createStudent({ branchId: world.branch.id });
        const term = await DashboardService.saveTerm(world.user.id, world.branch.id, {
            studentId: student.id, label: "Annual reading", startDate: "2026-01-01", endDate: "2026-12-31",
        });
        return { ...world, student, term };
    }
    it("corrects mistaken dates, excludes itself from overlap, and retains previous details without financial effects", async () => {
        const world = await termWorld();
        const paymentBefore = await createPayment({ branchId: world.branch.id, studentId: world.student.id,
            amount: 1200, dueDate: new Date("2026-02-01T00:00:00Z"), periodStart: new Date("2026-01-01T00:00:00Z"), periodEnd: new Date("2026-02-01T00:00:00Z") });
        const allocationBefore = await createAllocation({ seatId: world.seat.id, studentId: world.student.id, shiftId: world.shift.id });
        const studentBefore = await testPrisma.student.findUniqueOrThrow({ where: { id: world.student.id } });
        const corrected = await DashboardService.changeTerm(world.user.id, world.branch.id, { termId: world.term.id,
            expectedRevision: 1, action: "CORRECT", reason: "Corrected the recorded start", label: "Annual reading", startDate: "2026-02-01", endDate: "2026-12-31" });
        expect(corrected).toMatchObject({ revision: 2, startDate: "2026-02-01", status: "ACTIVE" });
        const history = await DashboardService.termHistory(world.user.id, world.branch.id, world.term.id);
        expect(history.items.map(row => row.action)).toEqual(["CORRECTED", "CREATED"]);
        expect(history.items[0].before).toMatchObject({ startDate: "2026-01-01" });
        expect(history.items[0].after).toMatchObject({ startDate: "2026-02-01" });
        expect(await testPrisma.student.findUniqueOrThrow({ where: { id: world.student.id } })).toEqual(studentBefore);
        expect(await testPrisma.payment.findMany()).toEqual([paymentBefore]);
        expect(await testPrisma.seatAllocation.findMany()).toEqual([allocationBefore]);
        await expect(testPrisma.membershipTermRevision.update({ where: { id: history.items[0].id }, data: { reason: "overwrite" } })).rejects.toThrow(/immutable/);
    });
    it("voids an erroneous term without erasing it and permits replacement with exactly the same dates", async () => {
        const world = await termWorld();
        await DashboardService.changeTerm(world.user.id, world.branch.id, { termId: world.term.id, expectedRevision: 1,
            action: "VOID", reason: "Wrong membership recorded" });
        const replacement = await DashboardService.saveTerm(world.user.id, world.branch.id, { studentId: world.student.id,
            label: "Correct membership", startDate: world.term.startDate, endDate: world.term.endDate });
        expect(replacement.id).not.toBe(world.term.id);
        expect(await testPrisma.membershipTerm.count()).toBe(2);
        expect((await testPrisma.membershipTerm.findUniqueOrThrow({ where: { id: world.term.id } })).status).toBe("VOIDED");
        expect((await DashboardService.termHistory(world.user.id, world.branch.id, world.term.id)).items[0].action).toBe("VOIDED");
    });
    it("records an actual early end separately and rejects overlap with another effective term", async () => {
        const world = await termWorld();
        const ended = await DashboardService.changeTerm(world.user.id, world.branch.id, { termId: world.term.id, expectedRevision: 1,
            action: "END_EARLY", reason: "Member ended in June", endDate: "2026-06-30" });
        expect(ended.endDate).toBe("2026-06-30");
        expect((await DashboardService.termHistory(world.user.id, world.branch.id, world.term.id)).items[0]).toMatchObject({
            action: "ENDED_EARLY", before: { endDate: "2026-12-31" }, after: { endDate: "2026-06-30" },
        });
        await DashboardService.saveTerm(world.user.id, world.branch.id, { studentId: world.student.id,
            label: "July onward", startDate: "2026-07-01", endDate: "2026-12-31" });
        await expect(DashboardService.changeTerm(world.user.id, world.branch.id, { termId: world.term.id, expectedRevision: 2,
            action: "CORRECT", reason: "Attempted overlapping correction", label: "Overlapping", startDate: "2026-01-01", endDate: "2026-07-01" }))
            .rejects.toThrow("already covers");
        expect(await testPrisma.membershipTermRevision.count()).toBe(3);
    });
    it("concurrent corrections cannot overwrite one another or create duplicate revisions", async () => {
        const world = await termWorld();
        const input = { termId: world.term.id, expectedRevision: 1, action: "CORRECT" as const,
            reason: "Fixed original label", label: "Corrected annual", startDate: world.term.startDate, endDate: world.term.endDate };
        const results = await Promise.allSettled([DashboardService.changeTerm(world.user.id, world.branch.id, input), DashboardService.changeTerm(world.user.id, world.branch.id, input)]);
        expect(results.filter(row => row.status === "fulfilled")).toHaveLength(1);
        expect(await testPrisma.membershipTermRevision.count()).toBe(2);
        expect((await testPrisma.membershipTerm.findUniqueOrThrow({ where: { id: world.term.id } })).revision).toBe(2);
        const foreign = await createUser();
        await expect(DashboardService.termHistory(foreign.id, world.branch.id, world.term.id)).rejects.toThrow();
    });
    it("distinguishes cancelling a genuine upcoming membership from voiding an error or ending an active term", async () => {
        const world = await termWorld();
        const input = { studentId: world.student.id, label: "Upcoming genuine membership", startDate: "2030-01-01", endDate: "2030-12-31" };
        const upcoming = await DashboardService.saveTerm(world.user.id, world.branch.id, input);
        const cancelled = await DashboardService.changeTerm(world.user.id, world.branch.id, {
            termId: upcoming.id, expectedRevision: 1, action: "CANCEL", reason: "Member cancelled before starting",
        }, new Date("2026-10-01T00:00:00Z"));
        expect(cancelled).toMatchObject({ status: "CANCELLED", startDate: input.startDate, endDate: input.endDate });
        expect((await DashboardService.termHistory(world.user.id, world.branch.id, upcoming.id)).items[0].action).toBe("CANCELLED");
        await expect(DashboardService.changeTerm(world.user.id, world.branch.id, {
            termId: world.term.id, expectedRevision: 1, action: "CANCEL", reason: "Cannot cancel an already started term",
        }, new Date("2026-10-01T00:00:00Z"))).rejects.toThrow("already started");
        const replacement = await DashboardService.saveTerm(world.user.id, world.branch.id, input);
        expect(replacement.id).not.toBe(upcoming.id);
    });
});

describe("complete, stable billing history", () => {
    it.each(["invoices", "history"] as const)("traverses all %s through tied timestamps and a concurrent new record", async kind => {
        const owner = await createUser(); const organization = await createOrg({ ownerId: owner.id });
        const foreign = await createOrg({ ownerId: (await createUser()).id });
        const createdAt = new Date("2026-01-01T00:00:00Z");
        const base = Array.from({ length: 65 }, (_, index) => ({ id: `record_${String(index).padStart(3, "0")}`,
            organizationId: organization.id, createdAt, amountSubunits: 49900, currency: "INR" }));
        if (kind === "invoices") await testPrisma.organizationSubscriptionInvoice.createMany({ data: base.map(row => ({ ...row, razorpayInvoiceId: `invoice_${row.id}`, status: "paid", providerMode: "TEST" })) });
        else await testPrisma.organizationSubscriptionHistory.createMany({ data: base.map(row => ({ ...row, razorpaySubscriptionId: "sub_historical", plan: "PRO", toStatus: "ACTIVE", source: "SYSTEM" })) });
        let page = await BillingHistoryService.page(owner.id, organization.id, kind);
        const seen = page.items.map(row => row.id);
        const newBase = { organizationId: organization.id, createdAt: new Date("2099-01-01T00:00:00Z"), amountSubunits: 100, currency: "INR" };
        if (kind === "invoices") {
            await testPrisma.organizationSubscriptionInvoice.create({ data: { ...newBase, razorpayInvoiceId: "invoice_new", status: "paid" } });
            await testPrisma.organizationSubscriptionInvoice.create({ data: { ...newBase, organizationId: foreign.id, razorpayInvoiceId: "invoice_foreign", status: "paid" } });
        } else await testPrisma.organizationSubscriptionHistory.create({ data: { ...newBase, razorpaySubscriptionId: "sub_new", plan: "PRO", toStatus: "ACTIVE", source: "SYSTEM" } });
        while (page.nextCursor) { page = await BillingHistoryService.page(owner.id, organization.id, kind, page.nextCursor); seen.push(...page.items.map(row => row.id)); }
        expect(seen).toHaveLength(65);
        expect(new Set(seen).size).toBe(65);
        expect([...seen].sort()).toEqual(base.map(row => row.id));
        await expect(BillingHistoryService.page(owner.id, foreign.id, kind)).rejects.toThrow("Organization not found");
    });
});
