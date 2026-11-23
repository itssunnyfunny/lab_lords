import type { ParsedImportSource } from "@/importing/contracts/import-session.contract";
import { posix } from "node:path";
import { ImportParserError } from "@/importing/utils/import-errors";
import {
    assertImportCell,
    assertImportColumnCount,
    assertImportDataRowCount,
    assertImportFileSize,
    assertWorkbookContentSize,
    assertZipWorkbookDeclaredSize,
    detectImportFileSignature,
    normalizeImportHeaders,
    rowFromPositionalCells,
    type NormalizedImportHeader,
} from "./import-parser-guards";

const MAX_WORKBOOK_PHYSICAL_ROWS = 1_048_576;

function decodedCellText(value: unknown) {
    if (value instanceof Date) return value.toISOString();
    if (value == null) return "";
    return String(value);
}

function stringifyCell(value: unknown, location?: string) {
    const decoded = decodedCellText(value);
    assertImportCell(decoded, location);
    return decoded.trim();
}

export type WorkbookImportOptions = {
    sheetName?: string;
    /** One-based worksheet row number. */
    headerRow?: number;
    expectedFormat?: "XLSX" | "XLS";
};

export type WorkbookHeaderCandidate = {
    rowNumber: number;
    values: string[];
    filledCells: number;
};

export type WorkbookSheetInspection = {
    name: string;
    index: number;
    populatedRows: number;
    columnCount: number;
    suggestedHeaderRow: number | null;
    headerCandidates: WorkbookHeaderCandidate[];
};

export type WorkbookInspection = {
    format: "XLSX" | "XLS";
    fileBytes: number;
    declaredUncompressedBytes: number | null;
    measuredContentBytes: number;
    requiresSheetSelection: boolean;
    sheets: WorkbookSheetInspection[];
};

export function assertWorkbookFormatMatches(
    actual: WorkbookInspection["format"],
    expected: WorkbookInspection["format"]
) {
    if (actual !== expected) {
        throw new ImportParserError(`Workbook contents are ${actual}, but the uploaded file extension is ${expected}.`);
    }
}

export type ParsedWorkbookSource = ParsedImportSource & {
    parserMetadata: {
        format: "XLSX" | "XLS";
        sheetName: string;
        headerRow: number;
        headers: NormalizedImportHeader[];
        workbook: WorkbookInspection;
    };
};

type LoadedWorkbook = {
    XLSX: typeof import("xlsx");
    workbook: import("xlsx").WorkBook;
    inspection: WorkbookInspection;
};

function* cellAddresses(sheet: import("xlsx").WorkSheet) {
    for (const address in sheet) {
        if (!address.startsWith("!")) yield address;
    }
}

function sheetShape(XLSX: typeof import("xlsx"), sheet: import("xlsx").WorkSheet) {
    let maxRow = -1;
    let maxColumn = -1;
    for (const address of cellAddresses(sheet)) {
        const decoded = XLSX.utils.decode_cell(address);
        if (decoded.r >= MAX_WORKBOOK_PHYSICAL_ROWS) {
            throw new ImportParserError("Workbook contains a cell outside the supported worksheet row range.");
        }
        maxRow = Math.max(maxRow, decoded.r);
        maxColumn = Math.max(maxColumn, decoded.c);
    }
    const populatedRowFlags = new Uint8Array(maxRow + 1);
    for (const address of cellAddresses(sheet)) {
        populatedRowFlags[XLSX.utils.decode_cell(address).r] = 1;
    }
    let populatedRowCount = 0;
    const firstPopulatedRows: number[] = [];
    for (let rowNumber = 0; rowNumber < populatedRowFlags.length; rowNumber++) {
        if (!populatedRowFlags[rowNumber]) continue;
        populatedRowCount++;
        if (firstPopulatedRows.length < 5) firstPopulatedRows.push(rowNumber);
    }
    return {
        populatedRowFlags,
        populatedRowCount,
        firstPopulatedRows,
        columnCount: maxColumn + 1,
    };
}

// SheetJS 0.18 converts an OOXML t="d" ISO value to a 1900-system number even
// in a 1904-system workbook. Read that cell's original day before using a serial.
function explicitCalendarDays(XLSX: typeof import("xlsx"), workbook: import("xlsx").WorkBook, sheetName: string) {
    const days = new Map<string, string>();
    const { files, Directory } = workbook as typeof workbook & {
        files?: Record<string, { content?: Uint8Array }>;
        Directory?: { workbooks?: string[] };
    };
    const workbookPath = Directory?.workbooks?.[0]?.replace(/^\//, "");
    if (!files || !workbookPath) return days;
    const readPart = (path: string) => {
        const content = files[path]?.content;
        return content ? Buffer.from(content.buffer, content.byteOffset, content.byteLength).toString("utf8") : "";
    };
    const attribute = (tag: string, name: string) => tag.match(new RegExp(`\\s${name}\\s*=\\s*(["'])(.*?)\\1`))?.[2];
    const metadata = workbook.Workbook?.Sheets?.find(sheet => sheet.name === sheetName) as { id?: string } | undefined;
    const folder = posix.dirname(workbookPath);
    const relationships = readPart(posix.join(folder, "_rels", posix.basename(workbookPath) + ".rels"));
    const relationship = Array.from(relationships.matchAll(/<!--[\s\S]*?(?:-->|$)|<(?:[\w.-]+:)?Relationship\b([^<>]*)>/g))
        .find(([, tag]) => tag && metadata?.id && attribute(tag, "Id") === metadata.id);
    const target = relationship && attribute(relationship[1], "Target");
    const part = target ? posix.resolve("/", folder, target.replaceAll("&amp;", "&")).slice(1)
        : posix.join(folder, "worksheets", `sheet${workbook.SheetNames.indexOf(sheetName) + 1}.xml`);
    const xml = readPart(part);
    if (!/\st\s*=\s*["']d["']/.test(xml)) return days;
    const tokens = /<!--[\s\S]*?(?:-->|$)|<(\/?)(?:[\w.-]+:)?(row|c)\b([^<>]*)>|<(?:[\w.-]+:)?v>\s*(\d{4}-\d{2}-\d{2})(?:T[^<]*)?\s*<\/(?:[\w.-]+:)?v>/g;
    let row = 0;
    let column = -1;
    let address: string | undefined;
    for (const [, closing, element, attributes, day] of xml.matchAll(tokens)) {
        if (closing) {
            address = undefined;
        } else if (element === "row") {
            row = Number(attribute(attributes, "r") ?? row + 1);
            column = -1;
        } else if (element === "c") {
            // OOXML permits implicit coordinates after the prior row or cell.
            const ref = attribute(attributes, "r");
            column = ref ? XLSX.utils.decode_cell(ref).c : column + 1;
            address = !attributes.endsWith("/") && attribute(attributes, "t") === "d"
                ? ref ?? XLSX.utils.encode_cell({ r: row - 1, c: column }) : undefined;
        } else if (address && day) {
            days.set(address, day);
        }
    }
    return days;
}

function rowValues(
    XLSX: typeof import("xlsx"),
    sheet: import("xlsx").WorkSheet,
    zeroBasedRow: number,
    columnCount: number,
    date1904?: boolean,
    explicitDays?: ReadonlyMap<string, string>
) {
    return Array.from({ length: columnCount }, (_, column) => {
        const address = XLSX.utils.encode_cell({ r: zeroBasedRow, c: column });
        const cell = sheet[address];
        const nativeDay = explicitDays?.get(address);
        // Data rows keep the Excel calendar day independently of regional display order.
        // Headers and time-only formats (such as a shift's start time) keep their display text.
        if (date1904 !== undefined && cell?.t === "n" && typeof cell.z === "string" && XLSX.SSF.is_date(cell.z)) {
            const unquoted = cell.z.replace(/"[^"]*"|[\\_*]./g, "");
            const fields = unquoted.replace(/\[[^\]]*\]/g, "");
            const timeOnly = /[hs]/i.test(fields) || /\[(?:h+|m+|s+)\]/i.test(unquoted);
            if (/[yd]/i.test(fields) || (/m/i.test(fields) && !timeOnly)) {
                return nativeDay ?? stringifyCell(XLSX.SSF.format("yyyy-mm-dd", cell.v, { date1904 }), `Workbook cell ${address}`);
            }
        }
        if (nativeDay && !XLSX.SSF.is_date(cell?.z ?? "General")) return nativeDay;
        return stringifyCell(cell ? XLSX.utils.format_cell(cell) : "", `Workbook cell ${address}`);
    });
}

function inspectSheet(
    XLSX: typeof import("xlsx"),
    sheet: import("xlsx").WorkSheet,
    name: string,
    index: number
): WorkbookSheetInspection {
    const shape = sheetShape(XLSX, sheet);
    assertImportColumnCount(shape.columnCount);
    const headerCandidates = shape.firstPopulatedRows.map(rowNumber => {
        const values = rowValues(XLSX, sheet, rowNumber, shape.columnCount);
        return {
            rowNumber: rowNumber + 1,
            values,
            filledCells: values.filter(Boolean).length,
        };
    });
    const suggested = headerCandidates.find(candidate => candidate.filledCells >= 2) ?? headerCandidates[0];
    return {
        name,
        index,
        populatedRows: shape.populatedRowCount,
        columnCount: shape.columnCount,
        suggestedHeaderRow: suggested?.rowNumber ?? null,
        headerCandidates,
    };
}

function measureWorkbookContent(
    XLSX: typeof import("xlsx"),
    workbook: import("xlsx").WorkBook
) {
    let measuredBytes = 0;
    for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) continue;
        for (const address of cellAddresses(sheet)) {
            const value = decodedCellText(XLSX.utils.format_cell(sheet[address]));
            assertImportCell(value, `Workbook cell ${sheetName}!${address}`);
            measuredBytes += Buffer.byteLength(value, "utf8");
            assertWorkbookContentSize(measuredBytes);
        }
    }
    return measuredBytes;
}

async function loadWorkbook(buffer: Buffer): Promise<LoadedWorkbook> {
    assertImportFileSize(buffer.byteLength, "Workbook");
    const signature = detectImportFileSignature(buffer);
    if (signature !== "ZIP_WORKBOOK" && signature !== "OLE_WORKBOOK") {
        throw new ImportParserError("Workbook must be a valid XLSX or XLS file.");
    }
    const format = signature === "ZIP_WORKBOOK" ? "XLSX" as const : "XLS" as const;
    const declaredUncompressedBytes = signature === "ZIP_WORKBOOK"
        ? assertZipWorkbookDeclaredSize(buffer)
        : null;

    try {
        const XLSX = await import("xlsx");
        const workbook = XLSX.read(buffer, { type: "buffer", cellNF: true, bookFiles: format === "XLSX" });
        if (workbook.SheetNames.length === 0) throw new ImportParserError("Workbook does not contain a sheet.");
        const measuredContentBytes = measureWorkbookContent(XLSX, workbook);
        const sheets = workbook.SheetNames.map((name, index) =>
            inspectSheet(XLSX, workbook.Sheets[name], name, index)
        );
        return {
            XLSX,
            workbook,
            inspection: {
                format,
                fileBytes: buffer.byteLength,
                declaredUncompressedBytes,
                measuredContentBytes,
                requiresSheetSelection: sheets.length > 1,
                sheets,
            },
        };
    } catch (error) {
        if (error instanceof ImportParserError) throw error;
        throw new ImportParserError("Workbook is malformed or uses an unsupported XLS/XLSX feature.");
    }
}

export async function inspectXlsxWorkbook(buffer: Buffer): Promise<WorkbookInspection> {
    return (await loadWorkbook(buffer)).inspection;
}

export async function parseXlsx(
    buffer: Buffer,
    options: WorkbookImportOptions = {}
): Promise<ParsedWorkbookSource> {
    const loaded = await loadWorkbook(buffer);
    const { XLSX, workbook, inspection } = loaded;
    if (options.expectedFormat) assertWorkbookFormatMatches(inspection.format, options.expectedFormat);
    if (inspection.requiresSheetSelection && !options.sheetName) {
        throw new ImportParserError("Workbook contains multiple sheets. Select a sheet before importing.");
    }

    const sheetName = options.sheetName ?? workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const sheetInspection = inspection.sheets.find(candidate => candidate.name === sheetName);
    if (!sheet || !sheetInspection) throw new ImportParserError(`Workbook sheet "${sheetName}" was not found.`);
    if (sheetInspection.columnCount === 0 || sheetInspection.populatedRows === 0) {
        throw new ImportParserError("Workbook sheet did not contain readable rows.");
    }

    const headerRow = options.headerRow ?? sheetInspection.suggestedHeaderRow;
    if (!headerRow || !Number.isInteger(headerRow) || headerRow < 1) {
        throw new ImportParserError("Select a valid one-based workbook header row.");
    }
    const rawHeaders = rowValues(XLSX, sheet, headerRow - 1, sheetInspection.columnCount);
    if (rawHeaders.every(header => !header)) {
        throw new ImportParserError(`Workbook header row ${headerRow} is empty.`);
    }
    const normalized = normalizeImportHeaders(rawHeaders);
    const positionalRows: Array<{ rowNumber: number; cells: string[] }> = [];
    const shape = sheetShape(XLSX, sheet);
    const explicitDays = explicitCalendarDays(XLSX, workbook, sheetName);
    for (let zeroBasedRow = headerRow; zeroBasedRow < shape.populatedRowFlags.length; zeroBasedRow++) {
        if (!shape.populatedRowFlags[zeroBasedRow]) continue;
        const cells = rowValues(XLSX, sheet, zeroBasedRow, sheetInspection.columnCount, workbook.Workbook?.WBProps?.date1904 === true, explicitDays);
        if (!cells.some(Boolean)) continue;
        assertImportDataRowCount(positionalRows.length + 1);
        positionalRows.push({ rowNumber: zeroBasedRow + 1, cells });
    }
    const rows = positionalRows.map(row =>
        rowFromPositionalCells(normalized.columns, row.cells, row.rowNumber)
    );
    if (rows.length === 0) throw new ImportParserError("Workbook sheet did not contain readable data rows.");

    return {
        columns: normalized.columns,
        rows,
        rowNumbers: positionalRows.map(row => row.rowNumber),
        parserMetadata: {
            format: inspection.format,
            sheetName,
            headerRow,
            headers: normalized.headers,
            workbook: inspection,
        },
    };
}
