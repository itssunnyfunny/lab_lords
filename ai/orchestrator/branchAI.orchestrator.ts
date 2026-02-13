import { readBranchSnapshotForAI } from "../readers/branch.reader"
import { detectBranchRisks } from "../riskDetection/branchRiskDetector"
import { suggestActionsForBranch } from "../actionSuggestions/branchActionSuggester"
import { draftMessagesForBranch } from "../messageDrafting/branchMessageDrafter"
import { generateBranchHealthReport } from "../branchHealthReport"

export interface BranchAIResponse {
  version: "1.0"

  meta: {
    branchId: string
    branchName: string
    generatedAt: string
  }

  health: {
    summary: string
  }

  risks: {
    total: number
    items: any[]
  }

  actions: {
    total: number
    items: any[]
  }

  messages: {
    language: "en" | "hi"
    items: Array<{
      action: string
      message: string
    }>
  }
}

export async function runBranchAI(
  branchId: string,
  language: "en" | "hi" = "en"
): Promise<BranchAIResponse> {
  // 1️⃣ Read analytics snapshot
  const snapshot = await readBranchSnapshotForAI(branchId)

  // 2️⃣ Generate health narrative (LLM-backed or template)
  const healthReport = await generateBranchHealthReport(snapshot, async (p) => {
    // Plug real LLM later
    return "Branch operations appear stable with minor areas needing attention."
  })

  // 3️⃣ Detect deterministic risks
  const risks = detectBranchRisks(snapshot)

  // 4️⃣ Suggest actions
  const actions = suggestActionsForBranch(risks)

  // 5️⃣ Draft messages
  const messages = draftMessagesForBranch(actions, language)

  return {
    version: "1.0",

    meta: {
      branchId,
      branchName: snapshot.branchName,
      generatedAt: new Date().toISOString(),
    },

    health: {
      summary: healthReport.summary,
    },

    risks: {
      total: risks.length,
      items: risks,
    },

    actions: {
      total: actions.length,
      items: actions,
    },

    messages: {
      language,
      items: messages.map((m, i) => ({
        action: actions[i]?.action,
        message: m.message,
      })),
    },
  }
}
