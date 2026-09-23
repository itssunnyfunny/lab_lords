import { Readable } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";
import { beforeEach, describe, expect, it } from "vitest";
import { createSyntheticApiMiddleware } from "../../application-design-pilot/synthetic-api";

// In-process adapter only: no server, environment loading, provider or database.
const adapter = createSyntheticApiMiddleware();
async function request(url: string, body?: object) {
    let payload = "";
    const input = Object.assign(Readable.from(body ? [JSON.stringify(body)] : []), {
        url, method: body ? "POST" : "GET", headers: { referer: "http://127.0.0.1:4187/branch/pilot?state=busy" },
    }) as unknown as IncomingMessage;
    const output = { statusCode: 200, setHeader() {}, end(value: string) { payload = value; } } as unknown as ServerResponse;
    await adapter(input, output, () => { throw new Error("Unexpected non-API request"); });
    expect(output.statusCode).toBe(200);
    return JSON.parse(payload);
}
describe("busy dashboard fixture reconciliation", () => {
    beforeEach(async () => { await request("/api/pilot/reset", {}); });
    it("derives money, students and occupied slots from consistent records", async () => {
        const [snapshot, students, fees, collections, allocations, seats] = await Promise.all([
            request("/api/analytics/branch/pilot/snapshot"), request("/api/branches/pilot/students"),
            request("/api/branches/pilot/payments"), request("/api/branches/pilot/collections"),
            request("/api/branches/pilot/seat-allocations"), request("/api/branches/pilot/seats"),
        ]);
        expect(snapshot.activeStudents).toBe(students.items.filter((row: { status: string }) => row.status === "ACTIVE").length);
        expect(snapshot.paidAmount).toBe(collections.items.reduce((sum: number, row: { amount: number }) => sum + row.amount, 0));
        expect(snapshot.monthlyRevenue).toBe(fees.items.filter((row: { dueDate: string }) => row.dueDate.startsWith("2026-09")).reduce((sum: number, row: { amount: number }) => sum + row.amount, 0));
        expect(snapshot.dueAmount).toBe(fees.items.reduce((sum: number, row: { amount: number; collectedAmount: number }) => sum + row.amount - row.collectedAmount, 0));
        expect(snapshot.assignedSeats).toBe(allocations.items.length);
        expect(new Set(allocations.items.map((row: { seatId: string; shiftId: string }) => row.seatId + row.shiftId)).size).toBe(allocations.items.length);
        expect(seats.items.flatMap((row: { seatAllocations: unknown[] }) => row.seatAllocations)).toHaveLength(allocations.items.length);
    });
    it("keeps due records consistent after collection and same-request recovery", async () => {
        const input = { studentId: "student-aarav", paymentIds: ["payment-july"], amount: 700,
            method: "CASH", reference: "", note: "Synthetic check", idempotencyKey: "fixture-consistency" };
        const first = await request("/api/branches/pilot/collections", input);
        const retry = await request("/api/branches/pilot/collections", input);
        expect(retry.id).toBe(first.id);
        const dues = await request("/api/branches/pilot/collections?dues=true&studentId=student-aarav");
        const fee = dues.payments.find((row: { id: string }) => row.id === "payment-july");
        expect(fee.amount - fee.collectedAmount).toBe(300);
        const snapshot = await request("/api/analytics/branch/pilot/snapshot");
        expect(snapshot.paidAmount).toBe(7600);
        expect(snapshot.dueAmount).toBe(4700);
    });
});
