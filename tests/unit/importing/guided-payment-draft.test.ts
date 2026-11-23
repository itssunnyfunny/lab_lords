import { describe, expect, it } from "vitest";
import { draftFromImportRowWithFallback, normalizedFromImportDraft } from "@/importing/utils/manual-row-draft";
import { currentMonthOutcome } from "@/importing/utils/current-month-import";
import { guidedManualMetadata } from "@/importing/utils/guided-source-reconciliation";
import type { ImportMappingState, ImportNormalizedRow } from "@/importing/contracts/import-session.contract";
import { paymentStatusForManualRow, recordEditedPaymentStatus } from "@/importing/utils/manual-payment-status";

const student = { name: "Synthetic", joinedAt: "2026-01-01T00:00:00.000Z", monthlyFee: 1000 };
describe("guided editor preserves payment provenance", () => {
    const raw = { Result: " X " };
    const mapping: ImportMappingState = {
        columnMappings: [{ sourceColumn: "Result", targetField: "payment.status", confidence: 100 }],
        entityTypesDetected: ["PAYMENT"],
        importOptions: { paymentAction: "IMPORT_PAID_UNPAID", paymentMapping: {
            confirmed: true, paidValues: ["X"], unpaidValues: [], waivedValues: [], unclearValues: [],
        } },
    };

    it("retains the uploaded status word when the row editor changes only the shift", () => {
        const row = { normalizedData: { student, payment: { status: "PAID", rawStatus: "X" } } as ImportNormalizedRow };
        const draft = draftFromImportRowWithFallback(row, mapping.columnMappings, "RECORDED_ONLY");
        const saved = normalizedFromImportDraft(row, { ...draft, shift: "Evening" }, undefined, "RECORDED_ONLY");
        expect(saved.payment).toEqual({ status: "PAID", rawStatus: "X" });
        expect(recordEditedPaymentStatus({}, row.normalizedData.payment?.status, saved.payment?.status)).toEqual({});
    });

    it("holds a legacy disagreement even when the new legend would mark the fee paid", () => {
        const row: ImportNormalizedRow = { student, payment: { status: "DUE", rawStatus: "DUE", amount: 1000 } };
        expect(paymentStatusForManualRow(raw, mapping, row, {})).toEqual({
            student, payment: { status: "UNCLEAR", rawStatus: "X", amount: 1000 },
        });
        expect(paymentStatusForManualRow(raw, mapping, row, recordEditedPaymentStatus({}, "UNCLEAR", "DUE"))).toBe(row);
        expect(paymentStatusForManualRow(raw, mapping, row, recordEditedPaymentStatus({}, "UNCLEAR", "WAIVED")).payment?.status).toBe("UNCLEAR");
    });

    it("honors a recorded Due decision and an intentional clear without inferring either from the raw label", () => {
        const due: ImportNormalizedRow = { payment: { decision: "KEEP_DUE", status: "DUE" } };
        expect(paymentStatusForManualRow(raw, mapping, due, {})).toBe(due);
        const cleared: ImportNormalizedRow = {};
        const metadata = guidedManualMetadata({}, due, cleared, false);
        expect(paymentStatusForManualRow(raw, mapping, cleared, metadata)).toBe(cleared);
    });
    it("fee corrections cannot manufacture a payment from the display default", () => {
        const row = { normalizedData: { student } };
        const draft = draftFromImportRowWithFallback(row, [], "RECORDED_ONLY");
        expect(draft.paymentAmount).toBe("");
        const saved = normalizedFromImportDraft(row, { ...draft, fee: "1200" }, undefined, "RECORDED_ONLY");
        expect(saved.payment).toBeUndefined();
        expect(currentMonthOutcome(saved, new Date(2026, 10, 2)).issues).toEqual([]);
        // Saved/loaded rows retain absence rather than reviving a synthetic fact.
        expect(draftFromImportRowWithFallback({ normalizedData: saved }, [], "RECORDED_ONLY").paymentAmount).toBe("");
    });
    it.each([300, 1000])("retains a recorded amount of %i through a changed fee", amount => {
        const row = { normalizedData: { student, payment: { amount, status: "PAID", method: "CASH" } } as ImportNormalizedRow };
        const draft = draftFromImportRowWithFallback(row, [], "RECORDED_ONLY");
        const saved = normalizedFromImportDraft(row, { ...draft, fee: "1200" }, undefined, "RECORDED_ONLY");
        expect(saved.payment).toMatchObject({ amount, status: "PAID", method: "CASH" });
        expect(currentMonthOutcome(saved, new Date(2026, 10, 2)).issues.map(issue => issue.code)).toContain("PARTIAL_PAYMENT_REVIEW");
    });
    it("retains explicit equal-fee source and owner amounts rather than treating them as defaults", () => {
        const row = { normalizedData: { student }, rawData: { Receipt: "1000" } };
        const draft = draftFromImportRowWithFallback(row, [{ sourceColumn: "Receipt", targetField: "payment.amount", confidence: 100 }], "RECORDED_ONLY");
        expect(normalizedFromImportDraft(row, draft, undefined, "RECORDED_ONLY").payment?.amount).toBe(1000);
        expect(normalizedFromImportDraft({ normalizedData: { student } }, { ...draft, paymentAmount: "300" }, undefined, "RECORDED_ONLY").payment?.amount).toBe(300);
        expect(draftFromImportRowWithFallback({ normalizedData: { student } }).paymentAmount).toBe("1000");
    });
    it.each(["300", "300.50"])("does not restore explicitly cleared source %s after save, reload and another fee edit", receipt => {
        const mappings = [{ sourceColumn: "Receipt", targetField: "payment.amount" as const, confidence: 100 }];
        const row = { normalizedData: { student, ...(receipt === "300" ? { payment: { amount: 300 } } : {}) }, rawData: { Receipt: receipt } };
        const draft = draftFromImportRowWithFallback(row, mappings, "RECORDED_ONLY");
        const saved = normalizedFromImportDraft(row, { ...draft, paymentAmount: "" }, undefined, "RECORDED_ONLY");
        const mappedData = guidedManualMetadata({}, row.normalizedData, saved, false, ["payment.amount"]);
        const reloaded = { normalizedData: saved, rawData: row.rawData, mappedData };
        const reopened = draftFromImportRowWithFallback(reloaded, mappings, "RECORDED_ONLY");
        expect(reopened.paymentAmount).toBe("");
        expect(normalizedFromImportDraft(reloaded, { ...reopened, fee: "1200" }, undefined, "RECORDED_ONLY").payment).toBeUndefined();
        // Unresolved invalid raw values still hydrate when no owner cleared them.
        expect(draftFromImportRowWithFallback({ normalizedData: { student }, rawData: { Receipt: "300.50" } }, mappings, "RECORDED_ONLY").paymentAmount).toBe("300.50");
    });
});
