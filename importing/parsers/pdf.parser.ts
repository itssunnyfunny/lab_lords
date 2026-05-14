import type { ParsedImportSource } from "@/importing/contracts/import-session.contract";
import { ImportParserError, PDF_PARSE_ERROR } from "@/importing/utils/import-errors";
import { parsePastedTable } from "./pasted-table.parser";

export async function parsePdf(buffer: Buffer): Promise<ParsedImportSource> {
    try {
        const { PDFParse } = await import("pdf-parse");
        const parser = new PDFParse({ data: buffer });
        const result = await parser.getText();
        await parser.destroy();

        const text = result.text?.trim();
        if (!text) throw new ImportParserError(PDF_PARSE_ERROR);

        return parsePastedTable(text);
    } catch {
        throw new ImportParserError(PDF_PARSE_ERROR);
    }
}
