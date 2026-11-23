import { describe, expect, it } from "vitest";
import { parseImportMappingMutation } from "@/importing/http/import-mapping-request";
import { classifyPaymentStatus } from "@/importing/utils/row-normalizer";

describe("import mapping request validation", () => {
    it.each(["unpaidValues", "waivedValues", "unclearValues"])("rejects a paid label also listed in %s and holds retained ambiguous rows", otherList => {
        const legend = { paidValues: ["X  Y", "received"], unpaidValues: [], waivedValues: [], unclearValues: [],
            confirmed: true, [otherList]: [" x y "] };
        expect(() => parseImportMappingMutation({ importOptions: { paymentMapping: legend } })).toThrow("only one meaning");
        expect(classifyPaymentStatus("x y", legend)).toBe("UNCLEAR");
        expect(classifyPaymentStatus("RECEIVED", legend)).toBe("PAID");
    });

    it("accepts reviewed mappings and normalizes them as manual decisions", () => {
        expect(parseImportMappingMutation({
            columnMappings: [
                { sourceColumn: " Name ", targetField: "student.name", confidence: 97, source: "AI" },
                { sourceColumn: "Notes", targetField: "ignore", confidence: 40, needsReview: true },
            ],
            importOptions: {
                configurationBatchApproved: true,
                paymentCycle: "USE_JOINED_AT_ANNIVERSARY",
                paymentAction: "GENERATE_DUE",
            },
        })).toEqual({
            columnMappings: [
                {
                    sourceColumn: "Name",
                    targetField: "student.name",
                    confidence: 97,
                    source: "MANUAL",
                    autoApplied: false,
                    needsReview: false,
                },
                {
                    sourceColumn: "Notes",
                    targetField: "ignore",
                    confidence: 40,
                    source: "MANUAL",
                    autoApplied: false,
                    needsReview: false,
                },
            ],
            importOptions: {
                configurationBatchApproved: true,
                paymentCycle: "USE_JOINED_AT_ANNIVERSARY",
                paymentAction: "GENERATE_DUE",
            },
        });
    });

    it("does not treat truthy strings as configuration approval", () => {
        expect(() => parseImportMappingMutation({
            importOptions: { configurationBatchApproved: "false" },
        })).toThrow("configurationBatchApproved must be true or false");
    });

    it("rejects unsupported and duplicate target mappings", () => {
        expect(() => parseImportMappingMutation({
            columnMappings: [{ sourceColumn: "Status", targetField: "student.status", confidence: 100 }],
        })).toThrow("unsupported target field");

        expect(() => parseImportMappingMutation({
            columnMappings: [
                { sourceColumn: "Name", targetField: "student.name", confidence: 100 },
                { sourceColumn: "Student", targetField: "student.name", confidence: 100 },
            ],
        })).toThrow("Only one source column can map to student.name");
    });

    it("rejects unknown options and malformed payment mapping values", () => {
        expect(() => parseImportMappingMutation({
            importOptions: { paymentPeriod: "CURRENT" },
        })).toThrow("paymentPeriod is not supported");

        expect(() => parseImportMappingMutation({
            importOptions: {
                paymentMapping: {
                    paidValues: "paid",
                    confirmed: true,
                },
            },
        })).toThrow("Paid values must contain at most 100 text values");
    });
});
