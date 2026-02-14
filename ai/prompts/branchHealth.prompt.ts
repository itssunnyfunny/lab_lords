import { AIBranchSnapshot } from "../contracts/branch.contract"

export function branchHealthPrompt(input: AIBranchSnapshot): string {
  return `
You are an expert education business analyst.
Your job is to analyze the operational data of a study hall branch and output a structured JSON report.

INPUT DATA:
Branch: ${input.branchName}
Seats: ${input.seats.total} Total, ${input.seats.occupied} Occupied, ${input.seats.available} Available (${input.seats.utilizationPercent}%)
Students: ${input.students.total} Total, ${input.students.active} Active, ${input.students.inactive} Inactive
Payments: ${input.payments.paidCount} Paid, ${input.payments.dueCount} Due, ${input.payments.overdueCount} Overdue
As Of: ${input.asOf.toDateString()}

INSTRUCTIONS:
1. Analyze the data to determine the "healthScore".
   - HIGH utilization (>85%) + LOW overdue = HEALTHY
   - LOW utilization (<50%) = MODERATE_RISK
   - HIGH overdue (>30% of total) = CRITICAL_RISK
   - Otherwise judge based on balance.
2. Generate analysis blocks for Financial, Utilization, and Student Activity.
   - Observation: A short, factual sentence (e.g., "Seat utilization is low at 45%").
   - RiskLevel: 'LOW', 'MODERATE', or 'CRITICAL'.
3. Suggest 3-5 practical, manual actions the owner can take.
   - Examples: "Call students with overdue payments", "Run a promotion to fill seats".

OUTPUT FORMAT (JSON ONLY):
{
  "healthScore": "LOW_RISK" | "MODERATE_RISK" | "CRITICAL_RISK" | "HEALTHY",
  "financialAnalysis": {
    "observation": "string",
    "riskLevel": "LOW" | "MODERATE" | "CRITICAL"
  },
  "utilizationAnalysis": {
    "observation": "string",
    "riskLevel": "LOW" | "MODERATE" | "CRITICAL"
  },
  "studentActivityAnalysis": {
    "observation": "string",
    "riskLevel": "LOW" | "MODERATE" | "CRITICAL"
  },
  "suggestedActions": ["string", "string"]
}

Do NOT output markdown. Do NOT output independent text. Output ONLY valid JSON.
`;
}
