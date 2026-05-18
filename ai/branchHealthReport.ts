import { AIBranchSnapshot } from "./contracts/branch.contract"
import { AIStructuredBranchReport } from "./contracts/structuredReport.contract"
import { branchHealthPrompt } from "./prompts/branchHealth.prompt"
import { callGemini } from "./llm/gemini.client"
import { detectBranchRisks, calculateHealthScore } from "./riskDetection/branchRiskDetector"
import { suggestActionsForBranch } from "./actionSuggestions/branchActionSuggester"
import { AIActionSuggestion } from "./contracts/actionSuggestion.contract"

type BranchNarrativePayload = Pick<
  AIStructuredBranchReport,
  | "executiveSummary"
  | "priorityFocus"
  | "keyFindings"
  | "financialAnalysis"
  | "utilizationAnalysis"
  | "studentActivityAnalysis"
>

type AnalysisSection = AIStructuredBranchReport["financialAnalysis"]

export async function generateBranchHealthReport(
  snapshot: AIBranchSnapshot,
): Promise<AIStructuredBranchReport> {
  // 1. Deterministic Calculations (The "Hard" Logic)
  const risks = detectBranchRisks(snapshot)
  const healthScore = calculateHealthScore(snapshot, risks)
  const suggestedActions = suggestActionsForBranch(risks)

  // 2. AI Narrative Generation (The "Soft" Logic)
  // We feed the DECISIONS to the AI, and ask it to explain them.
  const prompt = branchHealthPrompt(snapshot, risks, healthScore)
  const rawResponse = await callGemini(prompt)

  if (!rawResponse) {
    return getFallbackReport(snapshot, healthScore, suggestedActions)
  }

  try {
    const cleanJson = rawResponse.replace(/```json/g, "").replace(/```/g, "").trim()
    const narrativeData = JSON.parse(cleanJson) as Partial<BranchNarrativePayload>

    return {
      healthScore, // Trusted Code
      executiveSummary: cleanText(narrativeData.executiveSummary) ?? buildExecutiveSummary(snapshot, healthScore),
      priorityFocus: cleanText(narrativeData.priorityFocus) ?? buildPriorityFocus(snapshot, healthScore),
      keyFindings: normalizeKeyFindings(narrativeData.keyFindings, snapshot),
      financialAnalysis: normalizeAnalysis(
        narrativeData.financialAnalysis,
        buildFinancialObservation(snapshot),
        snapshot.payments.overdueCount > 0 ? "MODERATE" : "LOW"
      ),
      utilizationAnalysis: normalizeAnalysis(
        narrativeData.utilizationAnalysis,
        buildUtilizationObservation(snapshot),
        snapshot.seats.utilizationPercent < 50 ? "MODERATE" : "LOW"
      ),
      studentActivityAnalysis: normalizeAnalysis(
        narrativeData.studentActivityAnalysis,
        buildActivityObservation(snapshot),
        snapshot.students.inactive > snapshot.students.active ? "CRITICAL" : "LOW"
      ),
      suggestedActions, // Trusted Code - Passing full AIActionSuggestion[]
      generatedAt: new Date().toISOString()
    }
  } catch (error) {
    console.error("Failed to parse Gemini JSON response", error)
    return getFallbackReport(snapshot, healthScore, suggestedActions)
  }
}

function getFallbackReport(
  snapshot: AIBranchSnapshot,
  healthScore: AIStructuredBranchReport['healthScore'] = 'MODERATE_RISK',
  suggestedActions: AIActionSuggestion[] = []
): AIStructuredBranchReport {
  return {
    healthScore,
    executiveSummary: buildExecutiveSummary(snapshot, healthScore),
    priorityFocus: buildPriorityFocus(snapshot, healthScore),
    keyFindings: normalizeKeyFindings(undefined, snapshot),
    financialAnalysis: {
      observation: buildFinancialObservation(snapshot),
      riskLevel: snapshot.payments.overdueCount > 0 ? "MODERATE" : "LOW"
    },
    utilizationAnalysis: {
      observation: buildUtilizationObservation(snapshot),
      riskLevel: snapshot.seats.utilizationPercent < 50 ? "MODERATE" : "LOW"
    },
    studentActivityAnalysis: {
      observation: buildActivityObservation(snapshot),
      riskLevel: snapshot.students.inactive > snapshot.students.active ? "CRITICAL" : "LOW"
    },
    suggestedActions: suggestedActions.length > 0 ? suggestedActions : [
      { action: "REVIEW_SEAT_UTILIZATION", reason: "Check manual records" },
      { action: "REENGAGE_INACTIVE_STUDENTS", reason: "Retry analysis later" }
    ], // Return structured fallback
    generatedAt: new Date().toISOString()
  }
}

function cleanText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined
}

function isRiskLevel(value: unknown): value is AnalysisSection["riskLevel"] {
  return value === "LOW" || value === "MODERATE" || value === "CRITICAL"
}

function normalizeAnalysis(
  section: Partial<AnalysisSection> | undefined,
  fallbackObservation: string,
  fallbackRiskLevel: AnalysisSection["riskLevel"]
): AnalysisSection {
  return {
    observation: cleanText(section?.observation) ?? fallbackObservation,
    riskLevel: isRiskLevel(section?.riskLevel) ? section.riskLevel : fallbackRiskLevel
  }
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
