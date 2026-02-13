import { AIBranchSnapshot } from "./contracts/branch.contract"
import { AIBranchHealthReport } from "./contracts/branchHealthReport.contract"
import { branchHealthPrompt } from "./prompts/branchHealth.prompt"
import { callGemini } from "./llm/gemini.client"

export async function generateBranchHealthReport(
  snapshot: AIBranchSnapshot,
): Promise<AIBranchHealthReport> {
  const prompt = branchHealthPrompt(snapshot)
  const rawResponse = await callGemini(prompt)

  // Phase 5.2: simple, safe parsing
  if (!rawResponse) {
    return {
      summary: "AI could not generate a report at this time.",
      risks: [],
      suggestedActions: [],
    }
  }

  return {
    summary: rawResponse.trim(),
    risks: [],
    suggestedActions: [],
  }
}
