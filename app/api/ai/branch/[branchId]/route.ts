import { runBranchAI } from "@/ai/orchestrator/branchAI.orchestrator"

export async function GET(
    request: Request,
    props: { params: Promise<{ branchId: string }> }
) {
    try {
        const params = await props.params;
        const { searchParams } = new URL(request.url)
        const langParam = searchParams.get("lang")

        const language =
            langParam === "hi" ? "hi" : "en"

        const result = await runBranchAI(
            params.branchId,
            language
        )

        console.log("API Result:", JSON.stringify(result, null, 2));

        return Response.json(result)

    } catch (error) {
        console.error("AI GENERATION ERROR:", error);
        return Response.json(
            { error: "Failed to generate AI insights", details: String(error) },
            { status: 500 }
        )
    }
}
