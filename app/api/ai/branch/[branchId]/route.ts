import { runBranchAI } from "@/ai/orchestrator/branchAI.orchestrator"
import { getSessionUser } from "@/lib/auth"
import { StaffService } from "@/services/staff.service"

export async function GET(
    request: Request,
    props: { params: Promise<{ branchId: string }> }
) {
    try {
        const params = await props.params;
        const user = await getSessionUser()
        if (!user) {
            return Response.json({ error: "Unauthorized" }, { status: 401 })
        }

        await StaffService.authorize(user.id, params.branchId, "analytics")

        const result = await runBranchAI(params.branchId)

        return Response.json(result)

    } catch (error) {
        console.error("AI GENERATION ERROR:", error);
        const message = String(error)
        const status = message.includes("Unauthorized") || message.includes("disabled") ? 403 : 500
        return Response.json(
            { error: "Failed to generate AI insights", details: message },
            { status }
        )
    }
}
