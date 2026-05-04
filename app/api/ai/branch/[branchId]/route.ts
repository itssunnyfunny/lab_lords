import { runBranchAI } from "@/ai/orchestrator/branchAI.orchestrator"

export async function GET(
    request: Request,
    props: { params: Promise<{ branchId: string }> }
) {
    try {
        const params = await props.params;

        const result = await runBranchAI(params.branchId)

        return Response.json(result)

    } catch (error) {
        console.error("AI GENERATION ERROR:", error);
        const message = String(error)
        const status = message.includes("disabled") ? 403 : 500
        return Response.json(
            { error: "Failed to generate AI insights", details: message },
            { status }
        )
    }
}
