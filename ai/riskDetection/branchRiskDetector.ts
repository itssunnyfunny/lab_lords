import { AIBranchSnapshot } from "../contracts/branch.contract"
import { AIRisk } from "../contracts/risk.contract"

export function detectBranchRisks(
  snapshot: AIBranchSnapshot
): AIRisk[] {
  const risks: AIRisk[] = []

  // 1. Payment overdue risk
  if (snapshot.payments.overdueCount > 0) {
    risks.push({
      type: "PAYMENT_OVERDUE",
      severity:
        snapshot.payments.overdueCount > 5 ? "HIGH" : "MEDIUM",
      explanation: `${snapshot.payments.overdueCount} payments are overdue.`,
    })
  }

  // 2. Seat utilization risk
  if (snapshot.seats.utilizationPercent < 50) {
    risks.push({
      type: "LOW_SEAT_UTILIZATION",
      severity: "MEDIUM",
      explanation: `Seat utilization is low at ${snapshot.seats.utilizationPercent}%.`,
    })
  }

  // 3. Student inactivity risk
  if (snapshot.students.inactive > snapshot.students.active) {
    risks.push({
      type: "HIGH_INACTIVE_STUDENTS",
      severity: "HIGH",
      explanation: `Inactive students outnumber active students.`,
    })
  }

  return risks
}
