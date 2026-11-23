import { AIBranchSnapshot } from "./contracts/branch.contract"
import { AIStructuredBranchReport } from "./contracts/structuredReport.contract"
import { branchHealthPrompt } from "./prompts/branchHealth.prompt"
import { callGemini } from "./llm/gemini.client"
import { detectBranchRisks, calculateHealthScore } from "./riskDetection/branchRiskDetector"
import { suggestActionsForBranch } from "./actionSuggestions/branchActionSuggester"
import type { AIRisk, AIRiskType } from "./contracts/risk.contract"

type AnalysisSection = AIStructuredBranchReport["financialAnalysis"]

function categoryRisk(risks: AIRisk[], type: AIRiskType): AnalysisSection["riskLevel"] {
  const severity = risks.find(risk => risk.type === type)?.severity
  return severity === "HIGH" ? "CRITICAL" : severity === "MEDIUM" ? "MODERATE" : "LOW"
}

export async function generateBranchHealthReport(
  snapshot: AIBranchSnapshot,
): Promise<AIStructuredBranchReport> {
  const risks = detectBranchRisks(snapshot)
  const healthScore = calculateHealthScore(snapshot, risks)
  const report: AIStructuredBranchReport = {
    healthScore,
    executiveSummary: buildExecutiveSummary(snapshot, healthScore),
    priorityFocus: buildPriorityFocus(snapshot, healthScore),
    keyFindings: normalizeKeyFindings(undefined, snapshot),
    financialAnalysis: {
      observation: buildFinancialObservation(snapshot),
      riskLevel: categoryRisk(risks, "PAYMENT_OVERDUE")
    },
    utilizationAnalysis: {
      observation: buildUtilizationObservation(snapshot),
      riskLevel: categoryRisk(risks, "LOW_SEAT_UTILIZATION")
    },
    studentActivityAnalysis: {
      observation: buildActivityObservation(snapshot),
      riskLevel: categoryRisk(risks, "HIGH_INACTIVE_STUDENTS")
    },
    suggestedActions: suggestActionsForBranch(risks),
    generatedAt: new Date().toISOString()
  }

  const raw = await callGemini(branchHealthPrompt(snapshot, risks, healthScore))
  if (!raw) return report

  try {
    const narrative = JSON.parse(raw.replace(/```json/g, "").replace(/```/g, "").trim()) as Partial<AIStructuredBranchReport>
    report.executiveSummary = cleanText(narrative.executiveSummary) ?? report.executiveSummary
    report.priorityFocus = cleanText(narrative.priorityFocus) ?? report.priorityFocus
    report.keyFindings = normalizeKeyFindings(narrative.keyFindings, snapshot)
    for (const key of ["financialAnalysis", "utilizationAnalysis", "studentActivityAnalysis"] as const) {
      report[key].observation = cleanText(narrative[key]?.observation) ?? report[key].observation
    }
  } catch {
    // Malformed narrative leaves the deterministic report available.
  }
  return report
}

function cleanText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined
}

function normalizeKeyFindings(
  findings: unknown,
  snapshot: AIBranchSnapshot
): string[] {
  if (Array.isArray(findings)) {
    const cleaned = findings
      .map(cleanText)
      .filter((finding): finding is string => Boolean(finding))
      .slice(0, 3)

    if (cleaned.length > 0) return cleaned
  }

  return [
    `${snapshot.seats.utilizationPercent.toFixed(1)}% seat utilization across ${snapshot.seats.total} shift slots.`,
    `${snapshot.students.active} active students and ${snapshot.students.inactive} inactive students are currently recorded.`,
    `${snapshot.payments.overdueCount} overdue payments need attention out of ${snapshot.payments.dueCount} due payments.`
  ]
}

function buildExecutiveSummary(
  snapshot: AIBranchSnapshot,
  healthScore: AIStructuredBranchReport["healthScore"]
): string {
  const readableScore = healthScore.replace(/_/g, " ").toLowerCase()
  return `${snapshot.branchName} is currently rated ${readableScore}, with ${snapshot.seats.utilizationPercent.toFixed(1)}% seat utilization, ${snapshot.students.active} active students, and ${snapshot.payments.overdueCount} overdue payments.`
}

function buildPriorityFocus(
  snapshot: AIBranchSnapshot,
  healthScore: AIStructuredBranchReport["healthScore"]
): string {
  if (snapshot.payments.overdueCount > 0) {
    return "Start with overdue payment follow-up before reviewing capacity changes."
  }

  if (snapshot.seats.utilizationPercent < 50) {
    return "Review shift occupancy and improve seat usage before adding more capacity."
  }

  if (snapshot.students.inactive > snapshot.students.active) {
    return "Re-engage inactive students so the active base stays stronger than churn."
  }

  return healthScore === "HEALTHY"
    ? "Maintain the current operating rhythm and watch for early changes in payments or attendance."
    : "Keep monitoring payment, utilization, and activity trends before the next review."
}

function buildFinancialObservation(snapshot: AIBranchSnapshot): string {
  if (snapshot.payments.overdueCount === 0) {
    return `Payments look stable with no overdue dues recorded and ${snapshot.payments.paidCount} payments marked paid.`
  }

  return `${snapshot.payments.overdueCount} overdue payments need follow-up, with ${snapshot.payments.dueCount} total payments still due.`
}

function buildUtilizationObservation(snapshot: AIBranchSnapshot): string {
  return `Seat utilization is ${snapshot.seats.utilizationPercent.toFixed(1)}%, with ${snapshot.seats.occupied} of ${snapshot.seats.total} shift slots occupied.`
}

function buildActivityObservation(snapshot: AIBranchSnapshot): string {
  return `${snapshot.students.active} students are active while ${snapshot.students.inactive} are inactive out of ${snapshot.students.total} total students.`
}
