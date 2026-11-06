export type ImportConfigurationCorrection =
    | { kind: "RENAME_SEATS"; seats: Array<{ id: string; label: string }> }
    | { kind: "UPDATE_TIMING"; id: string; name: string; startTime: string; endTime: string; price: number };
export type ImportCorrectionPreview = {
    hash: string; expectedRevision: number; correction: ImportConfigurationCorrection;
    changes: Array<{ before: string; after: string }>; conflicts: string[];
    activeAllocations: number; historyAllocations: number; students: number;
    linkedFees: number; combinedAccess: string[]; drafts: number; draftRows: number;
};
