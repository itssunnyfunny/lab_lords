import { draftOverdueMessages } from "@/ai/messageDrafting/branchMessageDrafter"
import { getSessionUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { StaffService } from "@/services/staff.service"
import { NextRequest, NextResponse } from "next/server"

export async function GET(
    req: NextRequest,
    props: { params: Promise<{ branchId: string }> }
) {
    try {
        const { branchId } = await props.params
        const user = await getSessionUser()
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        await StaffService.authorize(user.id, branchId, "analytics")

        const { searchParams } = new URL(req.url)
        const langParam = searchParams.get("lang")
        const branch = await prisma.branch.findUnique({
            where: { id: branchId },
            select: { defaultMessageLanguage: true },
        })
        const fallbackLanguage = branch?.defaultMessageLanguage === "hi" ? "hi" : "en"
        const language: "en" | "hi" = langParam === "hi" || langParam === "en" ? langParam : fallbackLanguage

        const drafts = await draftOverdueMessages(branchId, language)

        return NextResponse.json({ language, items: drafts })

    } catch (error) {
        console.error("[AI MESSAGES ERROR]", error)
        const message = String(error)
        return NextResponse.json(
            { error: "Failed to generate message drafts", details: message },
            { status: message.includes("Unauthorized") ? 403 : 500 }
        )
    }
}
