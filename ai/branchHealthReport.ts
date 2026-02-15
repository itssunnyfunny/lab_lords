import { AIBranchSnapshot } from "./contracts/branch.contract"
import { AIStructuredBranchReport } from "./contracts/structuredReport.contract"
import { branchHealthPrompt } from "./prompts/branchHealth.prompt"
import { callGemini } from "./llm/gemini.client"
import { detectBranchRisks, calculateHealthScore } from "./riskDetection/branchRiskDetector"
import { suggestActionsForBranch } from "./actionSuggestions/branchActionSuggester"
import { AIActionSuggestion } from "./contracts/actionSuggestion.contract"

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
    return getFallbackReport(healthScore, suggestedActions)
  }

  try {
    const cleanJson = rawResponse.replace(/```json/g, "").replace(/```/g, "").trim()
    const narrativeData = JSON.parse(cleanJson) as Pick<AIStructuredBranchReport, 'financialAnalysis' | 'utilizationAnalysis' | 'studentActivityAnalysis'>

    return {
      healthScore, // Trusted Code
      suggestedActions, // Trusted Code - Passing full AIActionSuggestion[]
      ...narrativeData, // AI Narrative
      generatedAt: new Date().toISOString()
    }
  } catch (error) {
    console.error("Failed to parse Gemini JSON response", error)
    return getFallbackReport(healthScore, suggestedActions)
  }
}

function getFallbackReport(
  healthScore: AIStructuredBranchReport['healthScore'] = 'MODERATE_RISK',
  suggestedActions: AIActionSuggestion[] = []
): AIStructuredBranchReport {
  return {
    healthScore,
    financialAnalysis: {
      observation: "Data unavailable for analysis.",
      riskLevel: "MODERATE"
    },
    utilizationAnalysis: {
      observation: "Data unavailable for analysis.",
      riskLevel: "MODERATE"
    },
    studentActivityAnalysis: {
      observation: "Data unavailable for analysis.",
      riskLevel: "MODERATE"
    },
    suggestedActions: suggestedActions.length > 0 ? suggestedActions : [
      { action: "REVIEW_SEAT_UTILIZATION", reason: "Check manual records" },
      { action: "REENGAGE_INACTIVE_STUDENTS", reason: "Retry analysis later" }
    ], // Return structured fallback
    generatedAt: new Date().toISOString()
  }
}
