import { describe, expect, it } from "vitest";
import { csvCell, reportCsv, reportQuerySchema } from "@/lib/branchReports";

describe("private branch report filters and CSV", () => {
    it("makes spreadsheet formula prefixes literal, including whitespace and controls", () => {
        for (const text of ["=HYPERLINK(\"x\")", "+1+1", "-2+3", "@SUM(A1)", " \t=1+1", "\r\n@SUM(A1)"]) expect(csvCell(text)).toBe(`"'${text.replaceAll('"', '""')}"`);
        expect(csvCell(-2)).toBe('"-2"');
        expect(csvCell("Aman, \"library\"\nmember")).toBe('"Aman, ""library""\nmember"');
    });
    it("preserves real values and quoted headers with a UTF-8 marker", () => {
        expect(reportCsv({ columns: ["छात्र", "Amount"], rows: [["=name", 1700], ["Aman", 0]] }))
            .toBe('\uFEFF"छात्र","Amount"\r\n"\'=name","1700"\r\n"Aman","0"\r\n');
    });
    it("accepts exactly 93 calendar dates and rejects longer or reversed ranges", () => {
        expect(reportQuerySchema.parse({ from: "2026-07-01", through: "2026-10-01" }).kind).toBe("fees");
        expect(reportQuerySchema.safeParse({ from: "2026-07-01", through: "2026-10-02" }).success).toBe(false);
        expect(reportQuerySchema.safeParse({ from: "2026-09-02", through: "2026-09-01" }).success).toBe(false);
        expect(reportQuerySchema.safeParse({ from: "2026-02-30", through: "2026-03-01" }).success).toBe(false);
    });
    it("rejects unrelated statuses, excess filters and unbounded search", () => {
        const dates = { from: "2026-09-01", through: "2026-09-27" };
        expect(reportQuerySchema.safeParse({ ...dates, kind: "students", status: "PAID" }).success).toBe(false);
        expect(reportQuerySchema.safeParse({ ...dates, branchId: "foreign" }).success).toBe(false);
        expect(reportQuerySchema.safeParse({ ...dates, search: "x".repeat(101) }).success).toBe(false);
    });
});
