import type { ParsedImportSource } from "@/importing/contracts/import-session.contract";
import { ImportParserError } from "@/importing/utils/import-errors";

function stringifyCell(value: unknown) {
    if (value instanceof Date) return value.toISOString();
    if (value == null) return "";
    return String(value).trim();
}

export async function parseXlsx(buffer: Buffer): Promise<ParsedImportSource> {
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) throw new ImportParserError("Workbook does not contain a sheet.");

    const sheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: "",
        raw: false,
    });

    if (rows.length === 0) throw new ImportParserError("Workbook sheet did not contain readable rows.");

    const columns = Object.keys(rows[0]).map((column, index) => column || `Column ${index + 1}`);
    return {
        columns,
        rows: rows.map(row => Object.fromEntries(columns.map(column => [column, stringifyCell(row[column])]))),
    };
}
