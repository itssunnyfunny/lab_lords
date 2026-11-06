import { describe, expect, it } from "vitest";
import { parsePastedTable } from "@/importing/parsers/pasted-table.parser";
import { parseCsv } from "@/importing/parsers/csv.parser";
import { repeatedRegisterHeader } from "@/importing/parsers/register-headers";
import { normalizeImportRow, parseImportDate, parseImportMoney } from "@/importing/utils/row-normalizer";

describe("untidy register evidence", () => {
    it.each(["tab", "csv"])("keeps titles and repeated headers available for explicit review in %s", kind => {
        const lines = ["November study register", "Name\tJoined Date\tMonthly Fee\tShift", "Synthetic A\t01/01/2026\tRs. 500.00\tmorning", "Name\tJoined Date\tMonthly Fee\tShift", "Synthetic B\t2026-01-28\t₹700\tMorning"];
        const parsed = kind === "tab" ? parsePastedTable(lines.join("\n")) : parseCsv(Buffer.from(lines.join("\n").replaceAll("\t", ",")));
        expect(parsed.rowNumbers).toEqual([1, 3, 4, 5]);
        expect(parsed.rows).toHaveLength(4);
        expect(parsed.rows[0].Name).toBe("November study register");
        expect(repeatedRegisterHeader(parsed.rows[2], parsed.columns)).toBe(true);
    });
    it("normalizes supported money and dates while holding combined identities and uncertain payment notes", () => {
        expect(parseImportMoney("₹ 1,200.00")).toBe(1200); expect(parseImportMoney("Rs. 500")).toBe(500);
        expect(parseImportDate("28/01/26")).toBe("2026-01-28T00:00:00.000Z"); expect(parseImportDate("31/02/26")).toBeUndefined();
        const result = normalizeImportRow({ Name: "Synthetic A / 9876543211", Payment: "probably paid" }, [
            { sourceColumn: "Name", targetField: "student.name", confidence: 100 }, { sourceColumn: "Payment", targetField: "payment.status", confidence: 100 },
        ]);
        expect(result.issues.map(i => i.code)).toContain("COMBINED_IDENTITY_REVIEW");
        expect(result.normalizedData.payment?.status).toBe("UNCLEAR");
        expect(result.normalizedData.student?.phone).toBeUndefined();
    });
});
