import { AIBranchSnapshot } from "../contracts/branch.contract"
import { AIRisk } from "../contracts/risk.contract"
import { AIActionSuggestion } from "../contracts/actionSuggestion.contract"

export function branchFullReportPrompt(
  snapshot: AIBranchSnapshot,
  risks: AIRisk[],
  actions: AIActionSuggestion[]
): string {
  return `
You are generating a professional operational report for the owner of a study hall.

Use only the provided data.
Do not invent data.
Do not suggest automation.
Do not mention AI or systems.

Branch: ${snapshot.branchName}

Seats:
- Total: ${snapshot.seats.total}
- Occupied: ${snapshot.seats.occupied}
- Utilization: ${snapshot.seats.utilizationPercent}%

Students:
- Total: ${snapshot.students.total}
- Active: ${snapshot.students.active}
- Inactive: ${snapshot.students.inactive}

Payments:
- Paid: ${snapshot.payments.paidCount}
- Due: ${snapshot.payments.dueCount}
- Overdue: ${snapshot.payments.overdueCount}

Detected Risks:
${risks.map(r => `- ${r.explanation}`).join("\n")}

Suggested Actions:
${actions.map(a => `- ${a.action}`).join("\n")}

Generate a structured report with:
1. Overall operational assessment
2. Financial status assessment
3. Capacity utilization assessment
4. Risk analysis explanation
5. Strategic recommendations (manual actions only)

Keep tone professional and practical.
`
}
