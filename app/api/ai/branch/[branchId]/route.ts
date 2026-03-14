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
        return Response.json(
            { error: "Failed to generate AI insights", details: String(error) },
            { status: 500 }
        )
    }
}
