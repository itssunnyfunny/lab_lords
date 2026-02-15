import { AIBranchSnapshot } from "../contracts/branch.contract"
import { AIRisk } from "../contracts/risk.contract"
import { AIStructuredBranchReport } from "../contracts/structuredReport.contract"

export function branchHealthPrompt(
  input: AIBranchSnapshot,
  risks: AIRisk[],
  healthScore: AIStructuredBranchReport['healthScore']
): string {
  return `
You are an expert education business analyst.
Your job is to generate a NARRATIVE summary based on the provided data and pre-calculated risk assessment.

INPUT DATA:
Branch: ${input.branchName}
Seats: ${input.seats.total} Total, ${input.seats.occupied} Occupied, ${input.seats.available} Available (${input.seats.utilizationPercent}%)
Students: ${input.students.total} Total, ${input.students.active} Active, ${input.students.inactive} Inactive
Payments: ${input.payments.paidCount} Paid, ${input.payments.dueCount} Due, ${input.payments.overdueCount} Overdue
As Of: ${input.asOf.toDateString()}

PRE-CALCULATED RISKS (FACTS):
Health Score: ${healthScore}
Risks Identified:
${risks.length > 0 ? risks.map(r => `- [${r.severity}] ${r.type}: ${r.explanation}`).join('\n') : "None. Branch is healthy."}

INSTRUCTIONS:
1. You are NOT allowed to change the Health Score or Risks. These are facts.
2. Generate a "financialAnalysis", "utilizationAnalysis", and "studentActivityAnalysis" based on the Input Data and Risks.
   - Observation: A short, professional narrative sentence explaining the situation.
   - RiskLevel: Derive from the specific risks provided (e.g. if PAYMENT_OVERDUE is HIGH, financialAnalysis.riskLevel is CRITICAL). If no specific risk, set to LOW.

OUTPUT FORMAT (JSON ONLY):
{
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
  }
}

Do NOT output suggestedActions. They are already handled by the system.
Do NOT output healthScore. It is already handled by the system.
Do NOT output markdown. Do NOT output independent text. Output ONLY valid JSON.
`;
}
