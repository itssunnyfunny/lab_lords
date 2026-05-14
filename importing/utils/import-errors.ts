export const PDF_PARSE_ERROR = "Could not read this PDF. Please upload Excel/CSV or paste table.";

export class ImportParserError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ImportParserError";
    }
}

export class ImportValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ImportValidationError";
    }
}
