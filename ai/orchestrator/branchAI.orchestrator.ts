import { readBranchSnapshotForAI } from "../readers/branch.reader"
import { detectBranchRisks } from "../riskDetection/branchRiskDetector"
import { suggestActionsForBranch } from "../actionSuggestions/branchActionSuggester"
import { draftMessagesForBranch } from "../messageDrafting/branchMessageDrafter"
import { generateBranchHealthReport } from "../branchHealthReport"
import { generateBranchFullReport } from "../reports/branchFullReport.generator"
import { AIStructuredBranchReport } from "../contracts/structuredReport.contract"


export interface BranchAIResponse {
    version: "1.0"

    meta: {
        branchId: string
        branchName: string
        generatedAt: string
    }

    report: AIStructuredBranchReport

    // Legacy fields kept for compatibility if needed, but 'report' is now the main structured object
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
// Fix cache type to match new response
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
    const snapshot = await readBranchSnapshotForAI(branchId)

    // 2️⃣ [DETERMINISTIC] Detect risks (Legacy/Parallel)
    const risks = detectBranchRisks(snapshot)

    // 3️⃣ [DETERMINISTIC] Suggest actions (Legacy/Parallel)
    const actions = suggestActionsForBranch(risks)

    // 4️⃣ [AI - GEMINI] Generate STRUCTURED health report
    // This now returns the JSON object we defined
    const structuredReport = await generateBranchHealthReport(snapshot)

    // 5️⃣ [AI - GEMINI] Generate full report (Legacy Text)
    // We might depreciate this if structured report is sufficient, but keeping for now.
    // const fullReport = await generateBranchFullReport(snapshot, risks, actions) 

    // 6️⃣ [DETERMINISTIC] Draft messages
    const messages = draftMessagesForBranch(actions, language)

    const result: BranchAIResponse = {
        version: "1.0",

        meta: {
            branchId,
            branchName: snapshot.branchName,
            generatedAt: new Date().toISOString(),
        },

        report: structuredReport,

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
