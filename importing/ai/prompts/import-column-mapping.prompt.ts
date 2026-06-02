import { IMPORT_TARGET_FIELDS, type ParsedImportRow } from "@/importing/contracts/import-session.contract";

export function buildImportColumnMappingPrompt(input: {
    branchContext: unknown;
    sourceProfile?: unknown;
    columns: string[];
    sampleRows: ParsedImportRow[];
}) {
    return `
You are helping map messy study hall ERP import columns into a staging import.
You do not decide final truth, you never mutate data, and you must ask for confirmation when a business decision is ambiguous.
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
  "warnings": [],
  "suggestedImportOptions": {
    "paymentMapping": {
      "paidValues": ["paid", "yes"],
      "unpaidValues": ["due", "pending"],
      "waivedValues": ["waived"],
      "unclearValues": ["maybe"],
      "confirmed": false
    }
  },
  "analysisNotes": [
    "The file appears to include student and payment status data."
  ]
}

Supported target fields:
${IMPORT_TARGET_FIELDS.join("\n")}

Branch context:
${JSON.stringify(input.branchContext, null, 2)}

Source profile:
${JSON.stringify(input.sourceProfile ?? null, null, 2)}

Uploaded columns:
${JSON.stringify(input.columns)}

Sample rows:
${JSON.stringify(input.sampleRows.slice(0, 8), null, 2)}

Rules:
- Map every uploaded column exactly once. Use "ignore" when the column should not be imported.
- Prefer existing branch seats, shifts, and multi-shifts when names are close.
- Do not set paymentCycle unless the file explicitly contains a usable cycle/period.
- Do not set createUnknownSeats, createUnknownShifts, or createUnknownMultiShifts.
- If paid/unpaid values are present, guess paymentMapping but keep confirmed false.
- Questions should be short, answerable, and only for decisions the operator must confirm.
`;
}
