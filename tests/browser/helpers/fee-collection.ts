import { expect, type Page } from "@playwright/test";
import type { FeeCollectionView } from "@/lib/feeCollections";

/** Browser interaction fixture only; real accounting is tested in PostgreSQL. */
export async function mockFeeCollections(page: Page, branchId: string, options: { amount?: number; onCollected?: () => void } = {}) {
    const original = options.amount ?? 1200;
    const state = { received: 0, attempts: [] as Record<string, unknown>[], reject: false, loseResponse: false,
        receiptFailure: false, records: new Map<string, FeeCollectionView>() };
    await page.route(`**/api/branches/${branchId}/collections**`, async route => {
        const request = route.request(); const url = new URL(request.url());
        if (request.method() === "POST") {
            const body = request.postDataJSON(); state.attempts.push(body);
            if (state.reject) return route.fulfill({ status: 403, json: { error: "Collection unavailable" } });
            let record = state.records.get(body.idempotencyKey);
            if (!record) {
                state.received += body.amount;
                record = { id: `collection-${state.records.size + 1}`, receiptNumber: `LL-TEST-${state.records.size + 1}`,
                    amount: body.amount, method: body.method, reference: body.reference, collectedAt: "2026-09-10T06:30:00.000Z",
                    voidedAt: null, voidReason: null, snapshot: { version: 1, studentId: "student", studentName: "Sample Student",
                        branchName: "Sample Library", organizationName: "Sample Organization", address: "Delhi", contactPhone: null,
                        recordedBy: "Sample Owner", recordedById: "owner", collectedAt: "2026-09-10T06:30:00.000Z", amount: body.amount,
                        method: body.method, reference: body.reference, note: body.note, remainingBalance: original - state.received,
                        allocations: [{ paymentId: "payment", type: "MONTHLY", periodStart: "2026-07-10T00:00:00.000Z",
                            periodEnd: "2026-08-10T00:00:00.000Z", amount: body.amount, remaining: original - state.received }] } };
                state.records.set(body.idempotencyKey, record); options.onCollected?.();
            } else expect(body).toEqual(state.attempts.find(a => a.idempotencyKey === body.idempotencyKey));
            if (state.loseResponse) { state.loseResponse = false; return route.abort("failed"); }
            return route.fulfill({ json: record });
        }
        if (url.searchParams.get("dues") === "true") return route.fulfill({ json: {
            student: { id: "student", name: "Sample Student" }, payments: state.received >= original ? [] : [{ id: "payment", studentId: "student", branchId,
                amount: original, collectedAmount: state.received, waivedAmount: 0, ledgerBacked: state.received > 0, status: "DUE", type: "MONTHLY",
                dueDate: "2026-08-10T00:00:00.000Z", periodStart: "2026-07-10T00:00:00.000Z", periodEnd: "2026-08-10T00:00:00.000Z" }],
        } });
        if (url.pathname.endsWith("/collections")) return route.fulfill({ json: { items: [...state.records.values()], nextCursor: null, total: state.records.size } });
        if (state.receiptFailure) return route.fulfill({ status: 500, json: { error: "Receipt unavailable" } });
        const record = [...state.records.values()].find(c => url.pathname.endsWith(c.id));
        return route.fulfill({ status: record ? 200 : 404, json: record ?? { error: "Not found" } });
    });
    return state;
}
