import { IMPORT_TARGET_FIELDS, type ParsedImportRow } from "@/importing/contracts/import-session.contract";

export function buildImportColumnMappingPrompt(input: {
    branchContext: unknown;
    columns: string[];
    sampleRows: ParsedImportRow[];
}) {
    return `
You are helping map messy study hall ERP import columns.
You do not decide final truth and you never mutate data.
Return only strict JSON with this shape:
{
  "entityTypesDetected": ["STUDENT", "SEAT", "SHIFT", "ALLOCATION", "PAYMENT"],
  "columnMappings": [
    {
      "sourceColumn": "Mobile",
      "targetField": "student.phone",
      "confidence": 91,
      "reason": "Looks like an Indian phone number"
    }
  ],
  "questions": [
    {
      "field": "payment.period",
      "question": "Which payment cycle should this file represent?",
      "options": ["CURRENT_MONTH", "PREVIOUS_MONTH", "CUSTOM_PERIOD", "USE_JOINED_AT_ANNIVERSARY", "SKIP_PAYMENTS"]
    }
  ],
  "warnings": []
}

Supported target fields:
${IMPORT_TARGET_FIELDS.join("\n")}

Branch context:
${JSON.stringify(input.branchContext, null, 2)}

Uploaded columns:
${JSON.stringify(input.columns)}

Sample rows:
${JSON.stringify(input.sampleRows.slice(0, 8), null, 2)}
`;
}
