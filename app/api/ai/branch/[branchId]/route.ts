import { runBranchAI } from "@/ai/orchestrator/branchAI.orchestrator"

export async function GET(
  request: Request,
  { params }: { params: { branchId: string } }
) {
  try {
    const { searchParams } = new URL(request.url)
    const langParam = searchParams.get("lang")

    const language =
      langParam === "hi" ? "hi" : "en"

    const result = await runBranchAI(
      params.branchId,
      language
    )

    return Response.json(result)

  } catch (error) {
    return Response.json(
      { error: "Failed to generate AI insights" },
      { status: 500 }
    )
  }
}
