import { describe, expect, it, vi } from "vitest";
import { parseCsv } from "@/importing/parsers/csv.parser";
import { parsePastedTable } from "@/importing/parsers/pasted-table.parser";
import { parsePdf } from "@/importing/parsers/pdf.parser";
import { parseXlsx } from "@/importing/parsers/xlsx.parser";
import { buildFallbackMappings, normalizeColumnName } from "@/importing/utils/column-normalizer";
import { detectDuplicateImportRows } from "@/importing/utils/duplicate-detector";
import { validateRequiredImportFields } from "@/importing/validators/import-required-fields.validator";
import { validateImportPayment } from "@/importing/validators/import-payment.validator";
import { validateImportShift } from "@/importing/validators/import-shift.validator";
import { validateImportStudent } from "@/importing/validators/import-student.validator";

const mocks = vi.hoisted(() => ({
    callGemini: vi.fn(),
}));

vi.mock("@/ai/llm/gemini.client", () => ({
    callGemini: mocks.callGemini,
}));

describe("import parsers", () => {
    it("parses CSV headers and rows", () => {
        const parsed = parseCsv("Name,Mobile,Seat\nAsha,9876543210,A1\nRavi,9876543211,A2");

        expect(parsed.columns).toEqual(["Name", "Mobile", "Seat"]);
        expect(parsed.rows).toEqual([
            { Name: "Asha", Mobile: "9876543210", Seat: "A1" },
            { Name: "Ravi", Mobile: "9876543211", Seat: "A2" },
        ]);
    });

    it("parses pasted tabular data", () => {
        const parsed = parsePastedTable("Student Name\tPhone\nAsha\t9876543210");

        expect(parsed.columns).toEqual(["Student Name", "Phone"]);
        expect(parsed.rows[0]["Student Name"]).toBe("Asha");
    });

    it("parses the first XLSX sheet", async () => {
        const XLSX = await import("xlsx");
        const workbook = XLSX.utils.book_new();
        const sheet = XLSX.utils.json_to_sheet([{ Name: "Asha", Paid: "yes" }]);
        XLSX.utils.book_append_sheet(workbook, sheet, "Students");
        const buffer = Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));

        const parsed = await parseXlsx(buffer);

        expect(parsed.columns).toEqual(["Name", "Paid"]);
        expect(parsed.rows[0]).toEqual({ Name: "Asha", Paid: "yes" });
    });

    it("returns a graceful PDF parser error", async () => {
        await expect(parsePdf(Buffer.from("not a pdf"))).rejects.toThrow("Could not read this PDF");
    });
});

describe("import mapping and validation", () => {
    it("normalizes common column variants", () => {
        const mappings = buildFallbackMappings(["student name", "mobile", "seat no", "batch", "fee", "paid"]);

        expect(normalizeColumnName("Seat No.")).toBe("seat no");
        expect(mappings.map(mapping => mapping.targetField)).toEqual([
            "student.name",
            "student.phone",
            "seat.label",
            "shift.name",
            "student.monthlyFee",
            "payment.status",
        ]);
    });

    it("falls back when AI mapping fails", async () => {
        mocks.callGemini.mockResolvedValueOnce(null);
        const { mapImportColumns } = await import("@/importing/ai/import-column-mapper.ai");

        const mapped = await mapImportColumns({
            branchContext: {},
            columns: ["Name", "Mobile"],
            sampleRows: [{ Name: "Asha", Mobile: "9876543210" }],
        });

        expect(mapped.usedFallback).toBe(true);
        expect(mapped.columnMappings[0].targetField).toBe("student.name");
    });

    it("blocks rows missing student name", () => {
        const result = validateRequiredImportFields({ student: { phone: "9876543210" } });

        expect(result.issues[0].code).toBe("MISSING_STUDENT_NAME");
    });

    it("warns for missing phone", () => {
        const result = validateImportStudent(
            { student: { name: "Asha" } },
            { branchDefaultFee: 1200, shiftsByName: new Map(), multiShiftsByName: new Map() }
        );

        expect(result.warnings.some(warning => warning.code === "MISSING_PHONE")).toBe(true);
    });

    it("asks a question for unknown shift", () => {
        const result = validateImportShift(
            { student: { name: "Asha" }, allocation: { seatLabel: "A1", shiftName: "Night" } },
            { shiftsByName: new Map(), multiShiftsByName: new Map() }
        );

        expect(result.questions[0].field).toBe("allocation.shiftName");
    });

    it("asks for payment cycle when payment columns exist", () => {
        const result = validateImportPayment(
            { student: { name: "Asha" }, payment: { amount: 1200, rawStatus: "paid", status: "PAID" } },
            { entityTypesDetected: ["PAYMENT"], columnMappings: [], importOptions: {} }
        );

        expect(result.questions.some(question => question.field === "payment.period")).toBe(true);
    });

    it("marks ambiguous paid/unpaid values as review warnings", () => {
        const result = validateImportPayment(
            { payment: { rawStatus: "maybe", status: "UNCLEAR" } },
            {
                entityTypesDetected: ["PAYMENT"],
                columnMappings: [],
                importOptions: {
                    paymentCycle: "CURRENT_MONTH",
                    paymentAction: "IMPORT_PAID_UNPAID",
                    paymentMapping: { paidValues: ["yes"], unpaidValues: ["no"], waivedValues: [], unclearValues: [], confirmed: true },
                },
            }
        );

        expect(result.warnings.some(warning => warning.code === "AMBIGUOUS_PAYMENT_STATUS")).toBe(true);
    });

    it("detects duplicate phone in the same file", () => {
        const result = detectDuplicateImportRows([
            { id: "row_1", rowNumber: 2, normalizedData: { student: { name: "A", phone: "9876543210" } } },
            { id: "row_2", rowNumber: 3, normalizedData: { student: { name: "B", phone: "9876543210" } } },
        ]);

        expect(result.get("row_2")?.[0].code).toBe("DUPLICATE_PHONE_IN_FILE");
    });
});
