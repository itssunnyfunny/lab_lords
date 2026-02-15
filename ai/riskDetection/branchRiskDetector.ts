import { AIBranchSnapshot } from "../contracts/branch.contract"
import { AIRisk } from "../contracts/risk.contract"
import { AIStructuredBranchReport } from "../contracts/structuredReport.contract"

export function detectBranchRisks(
  snapshot: AIBranchSnapshot
): AIRisk[] {
  const risks: AIRisk[] = []

  // 0. Zero Data / New Branch Check
  if (snapshot.students.total === 0) {
    return [{
      type: "NO_DATA",
      severity: "LOW",
      explanation: "No students registered yet. Add students to enable analysis."
    }]
  }

  // 1. Payment overdue risk
  // Strict Rule: > 30% of active students have overdue payments = CRITICAL
  // Strict Rule: > 0 overdue = MEDIUM/HIGH depending on count
  const overduePercent = snapshot.students.active > 0
    ? (snapshot.payments.overdueCount / snapshot.students.active) * 100
    : 0;

  if (overduePercent > 30) {
    risks.push({
      type: "PAYMENT_OVERDUE",
      severity: "HIGH",
      explanation: `Critical: ${overduePercent.toFixed(1)}% of students have overdue payments.`
    })
  } else if (snapshot.payments.overdueCount > 0) {
    risks.push({
      type: "PAYMENT_OVERDUE",
      severity: snapshot.payments.overdueCount > 5 ? "HIGH" : "MEDIUM",
      explanation: `${snapshot.payments.overdueCount} payments are overdue.`,
    })
  }

  // 2. Seat utilization risk
  // Strict Rule: < 50% = Low Utilization
  if (snapshot.seats.utilizationPercent < 50) {
    risks.push({
      type: "LOW_SEAT_UTILIZATION",
      severity: "MEDIUM",
      explanation: `Seat utilization is low at ${snapshot.seats.utilizationPercent}%.`,
    })
  }

  // 3. Student inactivity risk
  // Strict Rule: Inactive > Active
  if (snapshot.students.inactive > snapshot.students.active) {
    risks.push({
      type: "HIGH_INACTIVE_STUDENTS",
      severity: "HIGH",
      explanation: `Inactive students (${snapshot.students.inactive}) outnumber active students (${snapshot.students.active}).`,
    })
  }

  return risks
}

export function calculateHealthScore(
  snapshot: AIBranchSnapshot,
  risks: AIRisk[]
): AIStructuredBranchReport['healthScore'] {
  // 1. Zero Data
  if (snapshot.students.total === 0) return 'LOW_RISK'; // Default state for new branch

  // 2. Critical Risks
  const hasHighRisk = risks.some(r => r.severity === 'HIGH');
  if (hasHighRisk) return 'CRITICAL_RISK';

  // 3. Moderate Risks
  const hasMediumRisk = risks.some(r => r.severity === 'MEDIUM');
  if (hasMediumRisk) return 'MODERATE_RISK';

  // 4. Healthy Criteria
  // Must have good utilization and low overdue
  if (snapshot.seats.utilizationPercent > 70 && snapshot.payments.overdueCount === 0) {
    return 'HEALTHY';
  }

  return 'LOW_RISK';
}
