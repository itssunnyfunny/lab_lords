import { describe, expect, it, vi } from "vitest";
import { guidedSavedOutcomes } from "@/importing/services/import-saved-outcomes";

describe("guided saved financial outcomes", () => {
    it("counts only successful payment operations, deduplicates recovery, and keeps future tracking separate", async () => {
        const row = (rowId: string, state: string, status = "DUE", amount = 1000) => ({ rowId, state, status, amount });
        const item = (kind: string, importRowId: string, entityIds: string[], importPlanId = "plan") => ({ kind, importRowId, result: { entityIds }, run: { importPlanId } });
        const db = {
            importRunItem: { findMany: vi.fn().mockResolvedValue([
                item("STUDENT", "paid", ["student-paid"]), item("STUDENT", "failed-payment", ["student-only"]),
                item("PAYMENT_CYCLE", "paid", ["payment-paid"]), item("PAYMENT_CYCLE", "paid", ["payment-paid"]),
                item("PAYMENT_CYCLE", "waived", ["payment-waived"]), item("PAYMENT_CYCLE", "due", ["payment-due"]),
                item("STUDENT", "future", ["student-future"]), item("STUDENT", "future", ["student-future"]),
                item("STUDENT", "none", ["student-none"]), item("STUDENT", "unknown", ["student-legacy"], "legacy"),
            ]) },
            importPlan: { findMany: vi.fn().mockResolvedValue([{ id: "plan", snapshot: { currentMonthReview: { rows: [
                row("paid", "CREATE_NOW", "PAID", 1200), row("failed-payment", "CREATE_NOW", "PAID", 500),
                row("waived", "CREATE_NOW", "WAIVED", 800), row("due", "CREATE_NOW"),
                row("future", "GENERATE_LATER", "DUE", 1500), row("none", "NO_DUE"),
            ] } } }]) },
        };
        const summary = await guidedSavedOutcomes(db as unknown as Parameters<typeof guidedSavedOutcomes>[0], "branch", "session");
        expect(summary.paid).toEqual({ count: 1, amount: 1200 });
        expect(summary.waived).toEqual({ count: 1, amount: 800 });
        expect(summary.due).toEqual({ count: 1, amount: 1000 });
        expect(summary.future).toEqual({ count: 1, amount: 1500 });
        expect(summary.none).toEqual({ count: 1, amount: 0 });
        expect(db.importRunItem.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {
            kind: { in: ["STUDENT", "PAYMENT_CYCLE"] }, status: "SUCCEEDED", run: { branchId: "branch", importSessionId: "session", kind: "COMMIT" },
        } }));
        expect(db.importPlan.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: { in: ["plan", "legacy"] }, importSessionId: "session", session: { branchId: "branch" } } }));
    });
    it("does not read plans or report prepared fees before any successful operation", async () => {
        const db = { importRunItem: { findMany: vi.fn().mockResolvedValue([]) }, importPlan: { findMany: vi.fn() } };
        const summary = await guidedSavedOutcomes(db as unknown as Parameters<typeof guidedSavedOutcomes>[0], "branch", "session");
        expect(Object.values(summary).every(value => value.count === 0 && value.amount === 0)).toBe(true);
        expect(db.importPlan.findMany).not.toHaveBeenCalled();
    });
});
