import type {
    ImportAITrace,
    ImportAttentionBucket,
    ImportColumnProfile,
    ImportDetectedColumnKind,
    ImportIssue,
    ImportMappingState,
    ImportPipelineStep,
    ImportSessionAnalysis,
    ImportSourceProfile,
    ParsedImportRow,
    ParsedImportSource,
} from "@/importing/contracts/import-session.contract";
import { compactImportText } from "@/importing/utils/row-normalizer";

const MANUAL_NORMALIZED_DATA_KEY = "__manualNormalizedData";

type ImportAttentionRow = {
    rowNumber: number;
    status: string;
    skipped?: boolean;
    issues?: unknown;
    warnings?: unknown;
    confidence?: number | null;
};

type ImportAttentionQuestion = {
    status: string;
    field?: string | null;
    rowId?: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function uniqueSamples(values: string[]) {
    const seen = new Set<string>();
    const samples: string[] = [];

    for (const value of values) {
        const text = compactImportText(value);
        if (!text || seen.has(text.toLowerCase())) continue;
        seen.add(text.toLowerCase());
        samples.push(text);
        if (samples.length >= 5) break;
    }

    return samples;
}

function looksLikeDate(value: string) {
    if (/^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/.test(value)) return true;
    const parsed = new Date(value);
    return value.length >= 6 && !Number.isNaN(parsed.getTime());
}

function detectColumnKind(column: string, sampleValues: string[]): ImportDetectedColumnKind {
    const normalizedColumn = column.toLowerCase();
    const values = sampleValues.map(value => value.toLowerCase());
    const joined = `${normalizedColumn} ${values.join(" ")}`;

    if (sampleValues.length === 0) return "empty";
    if (/(mobile|phone|contact|whatsapp)/.test(normalizedColumn)) return "phone";
    if (/(fee|amount|rent|paid amount|payment)/.test(normalizedColumn)) return "money";
    if (/(join|admission|start date|date)/.test(normalizedColumn)) return "date";
    if (/(paid|unpaid|due|clear|payment status)/.test(joined)) return "paymentStatus";
    if (/(method|mode|upi|cash|bank|gpay|phonepe|paytm)/.test(joined)) return "paymentMethod";
    if (/(seat|desk|table)/.test(normalizedColumn)) return "seat";
    if (/(shift|batch|slot|timing)/.test(normalizedColumn)) return "shift";
    if (/(time|from|to)/.test(normalizedColumn)) return "time";

    const phoneHits = sampleValues.filter(value => value.replace(/\D/g, "").length >= 10).length;
    if (phoneHits >= Math.max(1, Math.ceil(sampleValues.length * 0.6))) return "phone";

    const moneyHits = sampleValues.filter(value => /^[a-zA-Z$.\s,\d]+$/.test(value) && /\d/.test(value)).length;
    if (moneyHits >= Math.max(1, Math.ceil(sampleValues.length * 0.7))) return "money";

    const dateHits = sampleValues.filter(looksLikeDate).length;
    if (dateHits >= Math.max(1, Math.ceil(sampleValues.length * 0.6))) return "date";

    return "text";
}

export function buildImportSourceProfile(parsed: ParsedImportSource): ImportSourceProfile {
    return buildImportSourceProfileFromRows(parsed.columns, parsed.rows);
}

export function buildImportSourceProfileFromRows(columns: string[], rows: ParsedImportRow[]): ImportSourceProfile {
    const rowCount = rows.length;
    const totalCells = Math.max(1, rowCount * Math.max(1, columns.length));
    let emptyCells = 0;

    const columnProfiles: ImportColumnProfile[] = columns.map(column => {
        const values = rows.map(row => compactImportText(row[column]));
        const filledValues = values.filter(Boolean);
        const uniqueValues = new Set(filledValues.map(value => value.toLowerCase()));
        const emptyRows = rowCount - filledValues.length;
        emptyCells += emptyRows;

        const samples = uniqueSamples(filledValues);
        return {
            column,
            filledRows: filledValues.length,
            emptyRows,
            fillRate: rowCount > 0 ? Math.round((filledValues.length / rowCount) * 100) : 0,
            uniqueValueCount: uniqueValues.size,
            sampleValues: samples,
            detectedKind: detectColumnKind(column, samples),
        };
    });

    return {
        rowCount,
        columnCount: columns.length,
        emptyCellRate: Math.round((emptyCells / totalCells) * 100),
        columns: columnProfiles,
        highSignalColumns: columnProfiles
            .filter(column => column.fillRate >= 80 && column.detectedKind !== "empty")
            .map(column => column.column),
        lowSignalColumns: columnProfiles
            .filter(column => column.fillRate <= 20)
            .map(column => column.column),
    };
}

export function markManualNormalizedData(mappedData: unknown) {
    return {
        ...(isRecord(mappedData) ? mappedData : {}),
        [MANUAL_NORMALIZED_DATA_KEY]: true,
    };
}

export function hasManualNormalizedData(mappedData: unknown) {
    return isRecord(mappedData) && mappedData[MANUAL_NORMALIZED_DATA_KEY] === true;
}

function issuesFrom(value: unknown): ImportIssue[] {
    if (!Array.isArray(value)) return [];
    return value.filter((issue): issue is ImportIssue =>
        isRecord(issue) &&
        typeof issue.code === "string" &&
        typeof issue.message === "string" &&
        ["error", "warning", "info"].includes(String(issue.severity))
    );
}

function titleFromCode(code: string) {
    return code
        .toLowerCase()
        .split("_")
        .filter(Boolean)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}

function actionForCode(code: string) {
    if (code.includes("MISSING_STUDENT_NAME")) return "Edit the guessed student name or remap the source column.";
    if (code.includes("ALLOCATION_CONFLICT")) return "Pick a different seat or shift, then revalidate.";
    if (code.includes("UNKNOWN_SEAT")) return "Create missing seats or correct the seat labels.";
    if (code.includes("UNKNOWN_SHIFT")) return "Create missing shifts, map to an existing shift, or correct the shift column.";
    if (code.includes("PAYMENT")) return "Confirm payment cycle and paid/unpaid meanings.";
    if (code.includes("DUPLICATE")) return "Skip duplicate rows or edit the duplicate identifier.";
    if (code.includes("DEFAULT")) return "Review the guessed fallback value before import.";
    return "Review the affected rows.";
}

function pushIssueBucket(
    buckets: Map<string, ImportAttentionBucket>,
    issue: ImportIssue,
    rowNumber: number
) {
    const key = issue.code;
    const existing = buckets.get(key);
    const severity = issue.severity;
    if (!existing) {
        buckets.set(key, {
            code: key,
            label: titleFromCode(key),
            severity,
            count: 1,
            message: issue.message,
            action: actionForCode(key),
            fields: issue.field ? [issue.field] : [],
            sampleRowNumbers: [rowNumber],
        });
        return;
    }

    existing.count += 1;
    if (issue.field && !(existing.fields ?? []).includes(issue.field)) {
        existing.fields = [...(existing.fields ?? []), issue.field];
    }
    if ((existing.sampleRowNumbers ?? []).length < 5 && !(existing.sampleRowNumbers ?? []).includes(rowNumber)) {
        existing.sampleRowNumbers = [...(existing.sampleRowNumbers ?? []), rowNumber];
    }
}

function severityRank(severity: ImportAttentionBucket["severity"]) {
    if (severity === "error") return 0;
    if (severity === "warning") return 1;
    return 2;
}

export function buildImportAttention(input: {
    rows: ImportAttentionRow[];
    questions: ImportAttentionQuestion[];
    mapping?: ImportMappingState | null;
}): ImportAttentionBucket[] {
    const buckets = new Map<string, ImportAttentionBucket>();
    const openQuestions = input.questions.filter(question => question.status === "OPEN");
    if (openQuestions.length > 0) {
        buckets.set("OPEN_QUESTIONS", {
            code: "OPEN_QUESTIONS",
            label: "Open Questions",
            severity: "warning",
            count: openQuestions.length,
            message: "Import decisions need confirmation.",
            action: "Answer the highlighted import questions.",
            fields: Array.from(new Set(openQuestions.map(question => question.field).filter((field): field is string => Boolean(field)))),
        });
    }

    if (input.mapping?.usedFallback) {
        buckets.set("FALLBACK_MAPPING", {
            code: "FALLBACK_MAPPING",
            label: "Fallback Mapping",
            severity: "warning",
            count: 1,
            message: "AI mapping was unavailable, so deterministic matching was used.",
            action: "Review the guessed column mapping.",
        });
    }

    if ((input.mapping?.warnings ?? []).length > 0) {
        buckets.set("MAPPING_WARNINGS", {
            code: "MAPPING_WARNINGS",
            label: "Mapping Warnings",
            severity: "warning",
            count: input.mapping?.warnings?.length ?? 0,
            message: input.mapping?.warnings?.[0] ?? "Column mapping needs review.",
            action: "Review column meanings before importing.",
        });
    }

    const lowConfidenceMappings = (input.mapping?.columnMappings ?? []).filter(mapping =>
        mapping.targetField !== "ignore" && mapping.confidence < 70
    );
    if (lowConfidenceMappings.length > 0) {
        buckets.set("LOW_CONFIDENCE_MAPPING", {
            code: "LOW_CONFIDENCE_MAPPING",
            label: "Low Confidence Mapping",
            severity: "warning",
            count: lowConfidenceMappings.length,
            message: "Some mapped columns are uncertain.",
            action: "Review low-confidence target fields.",
            fields: lowConfidenceMappings.map(mapping => mapping.targetField),
        });
    }

    for (const row of input.rows) {
        for (const issue of issuesFrom(row.issues)) pushIssueBucket(buckets, issue, row.rowNumber);
        for (const warning of issuesFrom(row.warnings)) pushIssueBucket(buckets, warning, row.rowNumber);
    }

    const skippedRows = input.rows.filter(row => row.skipped || row.status === "SKIPPED").length;
    if (skippedRows > 0) {
        buckets.set("SKIPPED_ROWS", {
            code: "SKIPPED_ROWS",
            label: "Skipped Rows",
            severity: "info",
            count: skippedRows,
            message: "Some rows are excluded from the final import.",
            action: "Unskip rows you want to import.",
        });
    }

    return Array.from(buckets.values()).sort((a, b) =>
        severityRank(a.severity) - severityRank(b.severity) || b.count - a.count || a.label.localeCompare(b.label)
    );
}

export function buildImportPipelineSteps(input: {
    sessionStatus?: string;
    sourceProfile: ImportSourceProfile;
    attention: ImportAttentionBucket[];
    mapping?: ImportMappingState | null;
}): ImportPipelineStep[] {
    const hasErrors = input.attention.some(item => item.severity === "error");
    const hasWarnings = input.attention.some(item => item.severity === "warning");
    const status = input.sessionStatus;

    return [
        {
            id: "extract",
            label: "Extract",
            status: input.sourceProfile.rowCount > 0 ? "completed" : "pending",
            detail: `${input.sourceProfile.rowCount} rows, ${input.sourceProfile.columnCount} columns`,
        },
        {
            id: "profile",
            label: "Profile",
            status: "completed",
            detail: `${input.sourceProfile.emptyCellRate}% empty cells`,
        },
        {
            id: "ai_mapping",
            label: "Map",
            status: input.mapping?.usedFallback ? "needs_attention" : "completed",
            detail: input.mapping?.usedFallback ? "Fallback mapping" : "AI-assisted mapping",
        },
        {
            id: "validate",
            label: "Validate",
            status: hasErrors ? "needs_attention" : "completed",
            detail: hasErrors ? "Blocking rows found" : "Rules checked",
        },
        {
            id: "review",
            label: "Review",
            status: hasErrors || hasWarnings ? "needs_attention" : "completed",
            detail: `${input.attention.length} attention group${input.attention.length === 1 ? "" : "s"}`,
        },
        {
            id: "commit",
            label: "Commit",
            status:
                status === "COMMITTING" ? "running" :
                status === "COMMITTED" || status === "PARTIAL" ? "completed" :
                status === "FAILED" ? "failed" :
                "pending",
            detail: status ?? "Waiting",
        },
    ];
}

export function buildImportSessionAnalysis(input: {
    sourceProfile: ImportSourceProfile;
    attention: ImportAttentionBucket[];
    mapping?: ImportMappingState | null;
    sessionStatus?: string;
    model?: string;
    notes?: string[];
    ai?: ImportAITrace;
    detectedPaymentValues?: string[];
}): ImportSessionAnalysis {
    return {
        generatedAt: new Date().toISOString(),
        sourceProfile: input.sourceProfile,
        attention: input.attention,
        pipeline: buildImportPipelineSteps({
            sessionStatus: input.sessionStatus,
            sourceProfile: input.sourceProfile,
            attention: input.attention,
            mapping: input.mapping,
        }),
        model: input.model,
        notes: input.notes,
        ai: input.ai,
        detectedPaymentValues: input.detectedPaymentValues,
    };
}
