import { AIBranchSnapshot } from "./contracts/branch.contract"
import { AIBranchHealthReport } from "./contracts/branchHealthReport.contract"
import { branchHealthPrompt } from "./prompts/branchHealth.prompt"

export async function generateBranchHealthReport(
  snapshot: AIBranchSnapshot,
  llmCall: (prompt: string) => Promise<string>
): Promise<AIBranchHealthReport> {
  const prompt = branchHealthPrompt(snapshot)
  const rawResponse = await llmCall(prompt)

  // Phase 5.2: simple, safe parsing
  return {
    summary: rawResponse.trim(),
    risks: [],
    suggestedActions: [],
  }
}
