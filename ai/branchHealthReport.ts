import { AIBranchSnapshot } from "./contracts/branch.contract"
import { AIStructuredBranchReport } from "./contracts/structuredReport.contract"
import { branchHealthPrompt } from "./prompts/branchHealth.prompt"
import { callGemini } from "./llm/gemini.client"

export async function generateBranchHealthReport(
  snapshot: AIBranchSnapshot,
): Promise<AIStructuredBranchReport> {
  const prompt = branchHealthPrompt(snapshot)
  const rawResponse = await callGemini(prompt)

  if (!rawResponse) {
    return getFallbackReport()
  }

  try {
    const cleanJson = rawResponse.replace(/```json/g, "").replace(/```/g, "").trim()
    const data = JSON.parse(cleanJson) as AIStructuredBranchReport
    return {
      ...data,
      generatedAt: new Date().toISOString()
    }
  } catch (error) {
    console.error("Failed to parse Gemini JSON response", error)
    return getFallbackReport()
  }
}

function getFallbackReport(): AIStructuredBranchReport {
  return {
    healthScore: 'MODERATE_RISK',
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
    suggestedActions: ["Check manual records", "Retry analysis later"],
    generatedAt: new Date().toISOString()
  }
}
