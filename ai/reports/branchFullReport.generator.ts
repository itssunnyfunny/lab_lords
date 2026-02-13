import { callGemini } from "../llm/gemini.client"
import { branchFullReportPrompt } from "../prompts/branchFullReport.prompt"
import { AIBranchSnapshot } from "../contracts/branch.contract"
import { AIRisk } from "../contracts/risk.contract"
import { AIActionSuggestion } from "../contracts/actionSuggestion.contract"

export async function generateBranchFullReport(
    snapshot: AIBranchSnapshot,
    risks: AIRisk[],
    actions: AIActionSuggestion[]
): Promise<string> {
    const prompt = branchFullReportPrompt(snapshot, risks, actions)

    const response = await callGemini(prompt)
    if (!response) {
        return "AI could not generate a full report at this time."
    }
    return response
}
