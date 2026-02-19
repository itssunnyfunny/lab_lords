import { AIRisk } from "../contracts/risk.contract"
import { AIActionSuggestion } from "../contracts/actionSuggestion.contract"

export function suggestActionsForBranch(
  risks: AIRisk[]
): AIActionSuggestion[] {
  const actions: AIActionSuggestion[] = []

  for (const risk of risks) {
    switch (risk.type) {
      case "PAYMENT_OVERDUE":
        actions.push({
          action: "FOLLOW_UP_OVERDUE_PAYMENTS",
          reason: risk.explanation,
          meta: risk.meta,
        })
        break

      case "LOW_SEAT_UTILIZATION":
        actions.push({
          action: "REVIEW_SEAT_UTILIZATION",
          reason: risk.explanation,
        })
        break

      case "HIGH_INACTIVE_STUDENTS":
        actions.push({
          action: "REENGAGE_INACTIVE_STUDENTS",
          reason: risk.explanation,
        })
        break
    }
  }

  return actions
}
