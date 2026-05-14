import type { CommitMode, ImportIssue, ImportNormalizedRow } from "./import-session.contract";

export type ImportPreviewRow = {
    rowId: string;
    rowNumber: number;
    status: string;
    normalizedData: ImportNormalizedRow | null;
    issues: ImportIssue[];
    warnings: ImportIssue[];
    willImport: boolean;
};

export type ImportPreview = {
    mode: CommitMode;
    canCommit: boolean;
    summary: {
        createStudents: number;
        createSeats: number;
        createShifts: number;
        createMultiShifts: number;
        createAllocations: number;
        generatePayments: number;
        markPaid: number;
        markWaived: number;
        skippedRows: number;
        blockedRows: number;
        warningRows: number;
    };
    rows: ImportPreviewRow[];
    warnings: string[];
};
