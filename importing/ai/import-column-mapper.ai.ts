import { callGemini } from "@/ai/llm/gemini.client";
import {
    IMPORT_TARGET_FIELDS,
    type ImportMappingResult,
    type ImportTargetField,
    type ParsedImportRow,
} from "@/importing/contracts/import-session.contract";
import { buildFallbackMappings } from "@/importing/utils/column-normalizer";
import { buildImportColumnMappingPrompt } from "./prompts/import-column-mapping.prompt";

function cleanJson(raw: string) {
    return raw.replace(/```json/g, "").replace(/```/g, "").trim();
}

function isTargetField(value: unknown): value is ImportTargetField {
    return typeof value === "string" && (IMPORT_TARGET_FIELDS as readonly string[]).includes(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sanitizeMappingResult(value: unknown, columns: string[]): ImportMappingResult | null {
    if (!value || typeof value !== "object") return null;
    const result = value as Record<string, unknown>;
    const columnMappingsInput = Array.isArray(result.columnMappings) ? result.columnMappings : [];
    const columnSet = new Set(columns);

    const columnMappings = columnMappingsInput
        .filter(isRecord)
        .filter(item => typeof item.sourceColumn === "string" && columnSet.has(item.sourceColumn) && isTargetField(item.targetField))
        .map(item => ({
            sourceColumn: item.sourceColumn as string,
            targetField: item.targetField as ImportTargetField,
            confidence: Math.max(0, Math.min(100, Number(item.confidence) || 50)),
            reason: typeof item.reason === "string" ? item.reason : undefined,
        }));

    if (columnMappings.length === 0) return null;

    const mappedColumns = new Set(columnMappings.map(mapping => mapping.sourceColumn));
    for (const column of columns) {
        if (!mappedColumns.has(column)) {
            columnMappings.push({
                sourceColumn: column,
                targetField: "ignore",
                confidence: 35,
                reason: "AI did not map this column.",
            });
        }
    }

    const entityTypesDetected = Array.isArray(result.entityTypesDetected)
        ? result.entityTypesDetected.filter((item): item is ImportMappingResult["entityTypesDetected"][number] =>
              typeof item === "string" && ["STUDENT", "SEAT", "SHIFT", "ALLOCATION", "PAYMENT"].includes(item)
          )
        : [];

    const questions = Array.isArray(result.questions)
        ? result.questions
              .filter(isRecord)
              .map(item => ({
                  field: typeof item.field === "string" ? item.field : undefined,
                  question: typeof item.question === "string" ? item.question : "",
                  options: Array.isArray(item.options) ? item.options.filter((option): option is string => typeof option === "string") : undefined,
              }))
              .filter(item => item.question)
        : [];

    return {
        entityTypesDetected,
        columnMappings,
        questions,
        warnings: Array.isArray(result.warnings) ? result.warnings.filter((item): item is string => typeof item === "string") : [],
    };
}

export async function mapImportColumns(input: {
    branchContext: unknown;
    columns: string[];
    sampleRows: ParsedImportRow[];
}): Promise<ImportMappingResult> {
    try {
        const raw = await callGemini(buildImportColumnMappingPrompt(input));
        if (raw) {
            const parsed = JSON.parse(cleanJson(raw));
            const sanitized = sanitizeMappingResult(parsed, input.columns);
            if (sanitized) return sanitized;
        }
    } catch {
        // Deterministic fallback below.
    }

    return {
        entityTypesDetected: ["STUDENT"],
        columnMappings: buildFallbackMappings(input.columns),
        questions: [],
        warnings: ["AI mapping was unavailable, so deterministic column matching was used."],
        usedFallback: true,
    };
}
