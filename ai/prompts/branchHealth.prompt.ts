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
Seats (shift-slot based): ${input.seats.total} Total Slots, ${input.seats.occupied} Used Slots, ${input.seats.available} Available (${input.seats.utilizationPercent.toFixed(1)}%)
Per-Shift Breakdown:
${input.seats.shiftBreakdown.map(s => `  - ${s.shiftName}: ${s.used}/${s.capacity} slots used (${s.occupancyPercent.toFixed(1)}%)`).join('\n')}
Students: ${input.students.total} Total, ${input.students.active} Active, ${input.students.inactive} Inactive
Payments: ${input.payments.paidCount} Paid, ${input.payments.dueCount} Due, ${input.payments.overdueCount} Overdue
As Of: ${input.asOf.toDateString()}

PRE-CALCULATED RISKS (FACTS):
Health Score: ${healthScore}
Risks Identified:
${risks.length > 0 ? risks.map(r => `- [${r.severity}] ${r.type}: ${r.explanation}`).join('\n') : "None. Branch is healthy."}

INSTRUCTIONS:
1. You are NOT allowed to change the Health Score or Risks. These are facts.
2. Generate an owner-ready report narrative that can be read quickly in a dashboard and printed as a one-page paper report.
3. Generate "executiveSummary", "priorityFocus", "keyFindings", "financialAnalysis", "utilizationAnalysis", and "studentActivityAnalysis" based on the Input Data and Risks.
   - ExecutiveSummary: 1-2 concise sentences explaining the overall branch condition and why it matters.
   - PriorityFocus: The single most important thing the owner should look at first. Keep it specific.
   - KeyFindings: 2-3 short bullet-style strings that highlight the clearest operating signals from the data.
   - Observation: A short, professional narrative sentence explaining the situation.
   - RiskLevel: Derive from the specific risks provided (e.g. if PAYMENT_OVERDUE is HIGH, financialAnalysis.riskLevel is CRITICAL). If no specific risk, set to LOW.
4. Use the actual counts and percentages from the input where they make the report clearer.

OUTPUT FORMAT (JSON ONLY):
{
  "executiveSummary": "string",
  "priorityFocus": "string",
  "keyFindings": ["string", "string"],
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
