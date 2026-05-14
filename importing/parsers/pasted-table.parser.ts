import type { ParsedImportSource } from "@/importing/contracts/import-session.contract";
import { ImportParserError } from "@/importing/utils/import-errors";
import { parseCsv } from "./csv.parser";

function splitLine(line: string, delimiter: string) {
    return line.split(delimiter).map(cell => cell.trim());
}

export function parsePastedTable(input: string): ParsedImportSource {
    const text = input.trim();
    if (!text) throw new ImportParserError("Paste a table with headers and rows.");

    if (text.includes(",")) {
        try {
            return parseCsv(text);
        } catch {
            // Fall through to delimiter heuristics.
        }
    }

    const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    if (lines.length < 2) throw new ImportParserError("Pasted table must include headers and at least one data row.");

    const delimiter = lines[0].includes("\t")
        ? "\t"
        : lines[0].includes("|")
            ? "|"
            : /\s{2,}/.test(lines[0])
                ? "MULTISPACE"
                : "\t";

    const split = (line: string) => delimiter === "MULTISPACE"
        ? line.split(/\s{2,}/).map(cell => cell.trim())
        : splitLine(line, delimiter);

    const columns = split(lines[0]).map((column, index) => column || `Column ${index + 1}`);
    const rows = lines.slice(1)
        .map(split)
        .filter(cells => cells.some(Boolean))
        .map(cells => Object.fromEntries(columns.map((column, index) => [column, cells[index] ?? ""])));

    if (rows.length === 0) throw new ImportParserError("Pasted table did not contain any readable rows.");
    return { columns, rows };
}
