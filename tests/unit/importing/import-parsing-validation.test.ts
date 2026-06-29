import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseCsv } from "@/importing/parsers/csv.parser";
import { parsePastedTable } from "@/importing/parsers/pasted-table.parser";
import { parsePdf } from "@/importing/parsers/pdf.parser";
import { parseXlsx } from "@/importing/parsers/xlsx.parser";
import { buildFallbackMappings, normalizeColumnName } from "@/importing/utils/column-normalizer";
import { detectDuplicateImportRows } from "@/importing/utils/duplicate-detector";
import {
    buildImportAttention,
    buildImportSourceProfile,
    hasManualNormalizedData,
    markManualNormalizedData,
} from "@/importing/pipeline/import-extraction.pipeline";
import { applyImportDefaults, parseImportMoney } from "@/importing/utils/row-normalizer";
import { promoteKnownMultiShiftAllocation } from "@/importing/utils/shift-alias-resolver";
import { normalizedFromImportDraft } from "@/importing/utils/manual-row-draft";
import { buildImportPlanChecks, getBlockingImportPlanChecks } from "@/importing/utils/import-plan-checks";
import { statusForValidation } from "@/importing/services/import-session.service";
import { validateRequiredImportFields } from "@/importing/validators/import-required-fields.validator";
import { validateImportPayment } from "@/importing/validators/import-payment.validator";
import { validateImportAllocation } from "@/importing/validators/import-allocation.validator";
import { validateImportSeat } from "@/importing/validators/import-seat.validator";
import { validateImportShift } from "@/importing/validators/import-shift.validator";
import { validateImportStudent } from "@/importing/validators/import-student.validator";

const mocks = vi.hoisted(() => ({
    callGemini: vi.fn(),
    callGeminiJson: vi.fn(),
}));

vi.mock("@/ai/llm/gemini.client", () => ({
    callGemini: mocks.callGemini,
    callGeminiJson: mocks.callGeminiJson,
    resolveGeminiProModel: () => "gemini-3.5-flash",
}));

beforeEach(() => {
    vi.clearAllMocks();
});

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

    it("profiles extracted source columns for downstream AI analysis", () => {
        const profile = buildImportSourceProfile({
            columns: ["Name", "Mobile", "Fee"],
            rows: [
                { Name: "Asha", Mobile: "9876543210", Fee: "Rs 1,200" },
                { Name: "Ravi", Mobile: "", Fee: "1500" },
            ],
        });

        expect(profile.rowCount).toBe(2);
        expect(profile.columns.find(column => column.column === "Mobile")?.detectedKind).toBe("phone");
        expect(profile.columns.find(column => column.column === "Fee")?.fillRate).toBe(100);
    });

    it("returns a graceful PDF parser error", async () => {
        await expect(parsePdf(Buffer.from("not a pdf"))).rejects.toThrow("Could not read this PDF");
    }, 10000);
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
        mocks.callGeminiJson.mockResolvedValueOnce({ ok: false, rawText: null, error: "Missing API key" });
        const { mapImportColumns } = await import("@/importing/ai/import-column-mapper.ai");

        const mapped = await mapImportColumns({
            branchContext: {},
            columns: ["Name", "Mobile"],
            sampleRows: [{ Name: "Asha", Mobile: "9876543210" }],
        });

        expect(mapped.usedFallback).toBe(true);
        expect(mapped.columnMappings[0].targetField).toBe("student.name");
        expect(mapped.aiTrace?.status).toBe("unavailable");
        expect(mapped.warnings[0]).toBe("Missing API key");
    });

    it("keeps AI payment value guesses unconfirmed", async () => {
        mocks.callGeminiJson.mockResolvedValueOnce({
            ok: true,
            rawText: "{}",
            data: {
            entityTypesDetected: ["STUDENT", "PAYMENT"],
            columnMappings: [
                { sourceColumn: "Name", targetField: "student.name", confidence: 92 },
                { sourceColumn: "Paid", targetField: "payment.status", confidence: 88 },
            ],
            questions: [],
            warnings: [],
            suggestedImportOptions: {
                paymentMapping: {
                    paidValues: ["yes"],
                    unpaidValues: ["no"],
                    waivedValues: [],
                    unclearValues: ["maybe"],
                    confirmed: true,
                },
            },
        }});
        const { mapImportColumns } = await import("@/importing/ai/import-column-mapper.ai");

        const mapped = await mapImportColumns({
            branchContext: {},
            columns: ["Name", "Paid"],
            sampleRows: [{ Name: "Asha", Paid: "yes" }],
        });

        expect(mapped.suggestedImportOptions?.paymentMapping?.paidValues).toEqual(["yes"]);
        expect(mapped.suggestedImportOptions?.paymentMapping?.confirmed).toBe(false);
    });

    it("flags duplicate AI target mappings and keeps all source columns covered", async () => {
        mocks.callGeminiJson.mockResolvedValueOnce({
            ok: true,
            rawText: "{}",
            data: {
                entityTypesDetected: ["STUDENT"],
                columnMappings: [
                    { sourceColumn: "Name", targetField: "student.name", confidence: 92 },
                    { sourceColumn: "Full Name", targetField: "student.name", confidence: 91 },
                    { sourceColumn: "Notes", targetField: "student.notes", confidence: 80 },
                ],
                questions: [],
                warnings: [],
            },
        });
        const { mapImportColumns } = await import("@/importing/ai/import-column-mapper.ai");

        const mapped = await mapImportColumns({
            branchContext: {},
            columns: ["Name", "Full Name", "Notes"],
            sampleRows: [{ Name: "Asha", "Full Name": "Asha Sharma", Notes: "prefers morning" }],
        });

        expect(mapped.aiTrace?.status).toBe("success");
        expect(mapped.columnMappings).toHaveLength(3);
        expect(mapped.columnMappings.find(mapping => mapping.sourceColumn === "Full Name")?.targetField).toBe("ignore");
        expect(mapped.columnMappings.find(mapping => mapping.sourceColumn === "Notes")?.targetField).toBe("ignore");
        expect(mapped.warnings.some(warning => warning.includes("more than one column"))).toBe(true);
    });

    it("keeps low-confidence AI mappings for review instead of auto-applying them", async () => {
        mocks.callGeminiJson.mockResolvedValueOnce({
            ok: true,
            rawText: "{}",
            data: {
                entityTypesDetected: ["STUDENT", "ALLOCATION"],
                columnMappings: [
                    { sourceColumn: "Name", targetField: "student.name", confidence: 94 },
                    { sourceColumn: "Maybe Seat", targetField: "allocation.seatLabel", confidence: 62 },
                ],
                questions: [],
                warnings: [],
            },
        });
        const { mapImportColumns } = await import("@/importing/ai/import-column-mapper.ai");

        const mapped = await mapImportColumns({
            branchContext: {},
            columns: ["Name", "Maybe Seat"],
            sampleRows: [{ Name: "Asha", "Maybe Seat": "Morning maybe" }],
        });

        expect(mapped.columnMappings.find(mapping => mapping.sourceColumn === "Name")).toMatchObject({
            targetField: "student.name",
            source: "AI",
            autoApplied: true,
            needsReview: false,
        });
        expect(mapped.columnMappings.find(mapping => mapping.sourceColumn === "Maybe Seat")).toMatchObject({
            targetField: "ignore",
            source: "AI",
            autoApplied: false,
            needsReview: true,
        });
        expect(mapped.warnings.some(warning => warning.includes("unsure"))).toBe(true);
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

    it("requires valid dates for custom payment periods", () => {
        const result = validateImportPayment(
            { student: { name: "Asha" }, payment: { amount: 1200, rawStatus: "paid", status: "PAID" } },
            {
                entityTypesDetected: ["PAYMENT"],
                columnMappings: [],
                importOptions: {
                    paymentCycle: "CUSTOM_PERIOD",
                    paymentAction: "GENERATE_DUE",
                },
            }
        );

        expect(result.warnings.some(warning => warning.code === "PAYMENT_CUSTOM_PERIOD_REQUIRED")).toBe(true);
    });

    it("accepts complete custom payment periods", () => {
        const result = validateImportPayment(
            { student: { name: "Asha" }, payment: { amount: 1200, rawStatus: "paid", status: "PAID" } },
            {
                entityTypesDetected: ["PAYMENT"],
                columnMappings: [],
                importOptions: {
                    paymentCycle: "CUSTOM_PERIOD",
                    customPeriodStart: "2026-01-01",
                    customPeriodEnd: "2026-01-31",
                    paymentAction: "GENERATE_DUE",
                },
            }
        );

        expect(result.warnings.some(warning => warning.code === "PAYMENT_CUSTOM_PERIOD_REQUIRED")).toBe(false);
    });

    it("allows unknown seats to be skipped while importing the student", () => {
        const result = validateImportSeat(
            { student: { name: "Asha" }, allocation: { seatLabel: "A404", shiftName: "Morning" } },
            { seatsByLabel: new Map(), skipUnknownSeatAllocations: true }
        );

        expect(result.questions).toEqual([]);
        expect(result.warnings[0]).toMatchObject({ code: "ALLOCATION_SKIPPED_UNKNOWN_SEAT", severity: "info" });
    });

    it("allows unknown shifts to be skipped while importing the student", () => {
        const result = validateImportShift(
            { student: { name: "Asha" }, allocation: { seatLabel: "A1", shiftName: "Night" } },
            { shiftsByName: new Map(), multiShiftsByName: new Map(), skipUnknownShiftAllocations: true }
        );

        expect(result.questions).toEqual([]);
        expect(result.warnings[0]).toMatchObject({ code: "ALLOCATION_SKIPPED_UNKNOWN_SHIFT", severity: "info" });
    });

    it("does not keep rows in review for info-only skipped allocation warnings", () => {
        const status = statusForValidation({
            skipped: false,
            issues: [],
            warnings: [{
                code: "ALLOCATION_SKIPPED_UNKNOWN_SEAT",
                field: "allocation.seatLabel",
                message: "Student will import without allocation because the seat is unknown.",
                severity: "info",
            }],
        });

        expect(status).toBe("WARNING");
    });

    it("blocks import allocation conflicts for overlapping shift times", () => {
        const result = validateImportAllocation(
            { student: { name: "Asha" }, allocation: { seatLabel: "A1", shiftName: "Late Morning" } },
            {
                seatsByLabel: new Map([["a1", { id: "seat_1", label: "A1" }]]),
                shiftsByName: new Map([["late morning", { id: "shift_late", name: "Late Morning", startTime: "10:00", endTime: "13:00" }]]),
                multiShiftsByName: new Map(),
                activeAllocations: [{
                    seatId: "seat_1",
                    shiftId: "shift_morning",
                    seat: { label: "A1" },
                    shift: { name: "Morning", startTime: "09:00", endTime: "12:00" },
                }],
            }
        );

        expect(result.issues[0]).toMatchObject({ code: "ALLOCATION_CONFLICT", severity: "error" });
    });

    it("allows allocation conflicts to become manual follow-up warnings", () => {
        const result = validateImportAllocation(
            { student: { name: "Asha" }, allocation: { seatLabel: "A1", shiftName: "Late Morning" } },
            {
                seatsByLabel: new Map([["a1", { id: "seat_1", label: "A1" }]]),
                shiftsByName: new Map([["late morning", { id: "shift_late", name: "Late Morning", startTime: "10:00", endTime: "13:00" }]]),
                multiShiftsByName: new Map(),
                activeAllocations: [{
                    seatId: "seat_1",
                    shiftId: "shift_morning",
                    seat: { label: "A1" },
                    shift: { name: "Morning", startTime: "09:00", endTime: "12:00" },
                }],
                skipConflictingAllocations: true,
            }
        );
        const status = statusForValidation({
            skipped: false,
            issues: result.issues,
            warnings: result.warnings,
        });

        expect(result.issues).toEqual([]);
        expect(result.warnings[0]).toMatchObject({ code: "ALLOCATION_SKIPPED_CONFLICT", severity: "info" });
        expect(status).toBe("WARNING");
    });

    it("applies operator defaults before validation", () => {
        const normalized = applyImportDefaults(
            { student: { name: "Asha" }, allocation: { seatLabel: "A1" } },
            { defaultShiftName: "Morning", defaultJoinedAt: "2026-01-01" }
        );

        expect(normalized.allocation?.shiftName).toBe("Morning");
        expect(normalized.student?.joinedAt).toContain("2026-01-01");
    });

    it("clears stale shift and payment values when a manual row edit blanks them", () => {
        const normalized = normalizedFromImportDraft(
            {
                normalizedData: {
                    student: { name: "Asha", monthlyFee: 1200 },
                    seat: { label: "A1" },
                    shift: { name: "Morning" },
                    allocation: { seatLabel: "A1", shiftName: "Morning" },
                    payment: { amount: 1200, status: "PAID", rawStatus: "PAID", method: "UPI", referenceId: "TXN1" },
                },
            },
            {
                studentName: "Asha",
                phone: "",
                joinedAt: "",
                fee: "",
                seat: "A2",
                shift: "",
                multiShift: "",
                paymentAmount: "",
                paymentStatus: "",
                paymentMethod: "",
                referenceId: "",
            }
        );

        expect(normalized.allocation?.seatLabel).toBe("A2");
        expect(normalized.allocation?.shiftName).toBeUndefined();
        expect(normalized.shift).toBeUndefined();
        expect(normalized.payment).toBeUndefined();
        expect(normalized.student?.monthlyFee).toBeUndefined();
    });

    it("keeps manual seat and bundle edits scoped to the edited row", () => {
        const normalized = normalizedFromImportDraft(
            { normalizedData: { student: { name: "Asha" }, allocation: { seatLabel: "A1", shiftName: "Morning" } } },
            {
                studentName: "Asha",
                phone: "",
                joinedAt: "",
                fee: "2500",
                seat: "B7",
                shift: "",
                multiShift: "Full Time",
                paymentAmount: "",
                paymentStatus: "",
                paymentMethod: "",
                referenceId: "",
            },
            {
                defaultFee: 1200,
                defaultAdmissionFee: 0,
                seats: [{ id: "seat_b7", label: "B7" }],
                shifts: [{ id: "shift_morning", name: "Morning", startTime: null, endTime: null, price: 1200 }],
                multiShifts: [{ id: "multi_full", name: "Full Time", price: 2500, componentShiftNames: ["Morning", "Evening"] }],
            }
        );

        expect(normalized.allocation).toMatchObject({ seatLabel: "B7", multiShiftName: "Full Time" });
        expect(normalized.allocation?.shiftName).toBeUndefined();
        expect(normalized.multiShift?.componentShiftNames).toEqual(["Morning", "Evening"]);
        expect(normalized.student?.feeSource).toBe("MULTI_SHIFT_PRICE");
    });

    it("fills missing row fees from selected branch shift prices", () => {
        const normalized = applyImportDefaults(
            { student: { name: "Asha" }, allocation: { seatLabel: "A1", shiftName: "Evening" } },
            {},
            {
                defaultFee: 900,
                shiftsByName: new Map([["evening", { name: "Evening", price: 1500 }]]),
                multiShiftsByName: new Map(),
            }
        );

        expect(normalized.student?.monthlyFee).toBe(1500);
        expect(normalized.student?.feeSource).toBe("SHIFT_PRICE");
        expect(normalized.student?.feeLinkedShiftName).toBe("Evening");
    });

    it("flags anniversary payment cycles when joined dates were defaulted", () => {
        const result = validateImportPayment(
            { student: { name: "Asha", joinedAt: "2026-06-21T00:00:00.000Z", joinedAtSource: "TODAY_DEFAULT" } },
            {
                entityTypesDetected: ["STUDENT"],
                columnMappings: [],
                importOptions: {
                    paymentCycle: "USE_JOINED_AT_ANNIVERSARY",
                    paymentAction: "GENERATE_DUE",
                },
            }
        );

        expect(result.warnings.some(warning => warning.code === "PAYMENT_JOINED_AT_REQUIRED")).toBe(true);
    });

    it("blocks import plans where payment action and cycle disagree", () => {
        const checks = buildImportPlanChecks({
            hasOpenQuestions: false,
            mapping: {
                entityTypesDetected: ["STUDENT", "PAYMENT"],
                columnMappings: [],
                importOptions: {
                    paymentAction: "GENERATE_DUE",
                    paymentCycle: "SKIP_PAYMENTS",
                },
            },
            rows: [{
                id: "row_1",
                status: "READY",
                skipped: false,
                normalizedData: { student: { name: "Asha" }, payment: { amount: 1200 } },
            }],
        });

        expect(getBlockingImportPlanChecks(checks).map(check => check.code)).toContain("PAYMENT_PLAN");
    });

    it("does not count deferred allocation rows as seat links in the import plan", () => {
        const checks = buildImportPlanChecks({
            hasOpenQuestions: false,
            mapping: {
                entityTypesDetected: ["STUDENT", "ALLOCATION"],
                columnMappings: [],
                importOptions: { skipConflictingAllocations: true },
            },
            rows: [{
                id: "row_1",
                status: "WARNING",
                skipped: false,
                normalizedData: { student: { name: "Asha" }, allocation: { seatLabel: "A1", shiftName: "Morning" } },
                warnings: [{
                    code: "ALLOCATION_SKIPPED_CONFLICT",
                    field: "allocation.seatLabel",
                    message: "Student will import without allocation.",
                    severity: "info",
                }],
            }],
        });

        expect(checks.find(check => check.code === "SEAT_SHIFT_LINKS")).toMatchObject({
            status: "warning",
            count: 0,
        });
        expect(getBlockingImportPlanChecks(checks)).toEqual([]);
    });

    it("promotes known multi-shift names from plain shift columns", () => {
        const normalized = promoteKnownMultiShiftAllocation(
            { student: { name: "Asha" }, allocation: { seatLabel: "A1", shiftName: "Full Time" } },
            {
                shiftsByName: new Map([["morning", { name: "Morning" }]]),
                multiShiftsByName: new Map([[
                    "full time",
                    {
                        name: "Full Time",
                        components: [
                            { shiftName: "Morning" },
                            { shiftName: "Afternoon" },
                            { shiftName: "Evening" },
                        ],
                    },
                ]]),
            }
        );

        expect(normalized.allocation?.shiftName).toBeUndefined();
        expect(normalized.allocation?.multiShiftName).toBe("Full Time");
        expect(normalized.multiShift?.componentShiftNames).toEqual(["Morning", "Afternoon", "Evening"]);
    });

    it("parses formatted money values", () => {
        expect(parseImportMoney("Rs 1,500")).toBe(1500);
    });

    it("detects duplicate phone in the same file", () => {
        const result = detectDuplicateImportRows([
            { id: "row_1", rowNumber: 2, normalizedData: { student: { name: "A", phone: "9876543210" } } },
            { id: "row_2", rowNumber: 3, normalizedData: { student: { name: "B", phone: "9876543210" } } },
        ]);

        expect(result.get("row_2")?.[0].code).toBe("DUPLICATE_PHONE_IN_FILE");
    });

    it("builds attention buckets and manual edit markers", () => {
        const marked = markManualNormalizedData({ "student.name": "Asha" });
        const attention = buildImportAttention({
            mapping: { entityTypesDetected: ["STUDENT"], columnMappings: [], importOptions: {} },
            questions: [{ status: "OPEN", field: "payment.period" }],
            rows: [{
                rowNumber: 2,
                status: "BLOCKED",
                issues: [{ code: "MISSING_STUDENT_NAME", message: "Student name is required.", severity: "error" }],
                warnings: [],
            }],
        });

        expect(hasManualNormalizedData(marked)).toBe(true);
        expect(attention[0].code).toBe("MISSING_STUDENT_NAME");
        expect(attention.some(item => item.code === "OPEN_QUESTIONS")).toBe(true);
    });
});
