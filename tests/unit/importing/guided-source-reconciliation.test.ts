import { describe, expect, it } from "vitest";
import { guidedManualMetadata, reconcileGuidedSource, duplicateGuidedSourceColumns } from "@/importing/utils/guided-source-reconciliation";
import type { ImportMappingState } from "@/importing/contracts/import-session.contract";
const before: ImportMappingState = { entityTypesDetected: ["STUDENT"], columnMappings: [{ sourceColumn: "Unknown", targetField: "ignore", needsReview: true, confidence: 30 }] };
describe("guided source interpretation preserves explicit manual decisions", () => {
    it("identifies duplicate financial targets and semantic seating aliases", () => {
        expect([...duplicateGuidedSourceColumns({ ...before, columnMappings: [
            { sourceColumn: "Receipt", targetField: "payment.amount", confidence: 100 }, { sourceColumn: "Paid Amount", targetField: "payment.amount", confidence: 100 },
            { sourceColumn: "Seat", targetField: "seat.label", confidence: 100 }, { sourceColumn: "Allocated Seat", targetField: "allocation.seatLabel", confidence: 100 },
        ] })]).toEqual(["Receipt", "Paid Amount", "Seat", "Allocated Seat"]);
    });
    it("keeps allocation deferral when a previously unknown seat or shift is understood later", () => {
        const data = { student: { name: "Student", monthlyFee: 1000 }, allocation: {} };
        const metadata = guidedManualMetadata({ __manualNormalizedData: true }, {}, data, false);
        const result = reconcileGuidedSource({ Unknown: "A1" }, data, metadata, before,
            { ...before, columnMappings: [{ sourceColumn: "Unknown", targetField: "allocation.seatLabel", confidence: 99, needsReview: false }] });
        expect(result?.normalizedData.allocation).toEqual({}); expect(result?.normalizedData.seat).toBeUndefined();
    });
    it("holds a newly interpreted financial value that was explicitly cleared", () => {
        const data = { student: { name: "Student", monthlyFee: 1000 } };
        const metadata = guidedManualMetadata({ __manualNormalizedData: true }, { ...data, payment: { amount: 1000 } }, data, false);
        const result = reconcileGuidedSource({ Unknown: "300" }, data, metadata, before,
            { ...before, columnMappings: [{ sourceColumn: "Unknown", targetField: "payment.amount", confidence: 99, needsReview: false }] });
        expect(result?.normalizedData.payment?.amount).toBeUndefined();
        expect(result?.mappedData.__guidedSourceHolds).toEqual(expect.arrayContaining([expect.objectContaining({ code: "SOURCE_INTERPRETATION_CONFLICT" })]));
    });
});
