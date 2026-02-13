import { readBranchSnapshotForAI } from "../readers/branch.reader"
import { detectBranchRisks } from "../riskDetection/branchRiskDetector"
import { suggestActionsForBranch } from "../actionSuggestions/branchActionSuggester"
import { draftMessagesForBranch } from "../messageDrafting/branchMessageDrafter"
import { generateBranchHealthReport } from "../branchHealthReport"
import { generateBranchFullReport } from "../reports/branchFullReport.generator"


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

    report: {
        full: string
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

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const responseCache = new Map<string, { timestamp: number; data: BranchAIResponse }>();

export async function runBranchAI(
    branchId: string,
    language: "en" | "hi" = "en"
): Promise<BranchAIResponse> {
    const cacheKey = `${branchId}:${language}`;
    const now = Date.now();

    if (responseCache.has(cacheKey)) {
        const cached = responseCache.get(cacheKey)!;
        if (now - cached.timestamp < CACHE_TTL_MS) {
            console.log(`[CACHE HIT] Returning cached AI result for ${branchId}`);
            return cached.data;
        }
    }

    console.log(`[CACHE MISS] Generating new AI result for ${branchId}`);

    // 1️⃣ [DETERMINISTIC] Read analytics snapshot
    // This is the source of truth. No AI here.
    const snapshot = await readBranchSnapshotForAI(branchId)

    // 2️⃣ [DETERMINISTIC] Detect risks
    // We use hard-coded business rules to find risks.
    // NEVER use LLM to decide what is a risk.
    const risks = detectBranchRisks(snapshot)

    // 3️⃣ [DETERMINISTIC] Suggest actions
    // We map specific risks to specific actions using a switch case.
    // NEVER use LLM to invent actions.
    const actions = suggestActionsForBranch(risks)

    // 4️⃣ [AI - GEMINI] Generate health narrative
    // Gemini explains the health status in human language.
    // It does NOT decide the status, only describes it.
    const healthReport = await generateBranchHealthReport(snapshot)

    // 5️⃣ [AI - GEMINI] Generate full report
    // Gemini writes a detailed report using the snapshot, risks, and actions.
    // It provides the "narrative layer".
    const fullReport = await generateBranchFullReport(snapshot, risks, actions)

    // 6️⃣ [DETERMINISTIC] Draft messages
    // We use a safe message drafter.
    // (In future phases, this might have an optional AI tone-enhancer)
    const messages = draftMessagesForBranch(actions, language)

    const result: BranchAIResponse = {
        version: "1.0",

        meta: {
            branchId,
            branchName: snapshot.branchName,
            generatedAt: new Date().toISOString(),
        },

        health: {
            summary: healthReport.summary,
        },
        report: {
            full: fullReport
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

    responseCache.set(cacheKey, { timestamp: Date.now(), data: result });
    return result;
}
