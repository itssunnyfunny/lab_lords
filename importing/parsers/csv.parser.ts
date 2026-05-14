import type { ParsedImportSource } from "@/importing/contracts/import-session.contract";
import { ImportParserError } from "@/importing/utils/import-errors";

function parseCsvLine(line: string) {
    const cells: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const next = line[i + 1];

        if (char === "\"" && inQuotes && next === "\"") {
            current += "\"";
            i++;
            continue;
        }

        if (char === "\"") {
            inQuotes = !inQuotes;
            continue;
        }

        if (char === "," && !inQuotes) {
            cells.push(current.trim());
            current = "";
            continue;
        }

        current += char;
    }

    cells.push(current.trim());
    return cells;
}

function splitCsvLines(input: string) {
    const lines: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < input.length; i++) {
        const char = input[i];
        const next = input[i + 1];

        if (char === "\"" && inQuotes && next === "\"") {
            current += char + next;
            i++;
            continue;
        }

        if (char === "\"") inQuotes = !inQuotes;

        if ((char === "\n" || char === "\r") && !inQuotes) {
            if (current.trim()) lines.push(current);
            current = "";
            if (char === "\r" && next === "\n") i++;
            continue;
        }

        current += char;
    }

    if (current.trim()) lines.push(current);
    return lines;
}

export function parseCsv(input: string): ParsedImportSource {
    const lines = splitCsvLines(input);
    if (lines.length < 2) throw new ImportParserError("CSV must include a header row and at least one data row.");

    const columns = parseCsvLine(lines[0]).map((column, index) => column || `Column ${index + 1}`);
    const rows = lines.slice(1)
        .map(line => parseCsvLine(line))
        .filter(cells => cells.some(cell => cell.trim()))
        .map(cells => Object.fromEntries(columns.map((column, index) => [column, cells[index] ?? ""])));

    if (rows.length === 0) throw new ImportParserError("CSV did not contain any readable rows.");
    return { columns, rows };
}
