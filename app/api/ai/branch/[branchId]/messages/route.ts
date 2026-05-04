import { draftOverdueMessages } from "@/ai/messageDrafting/branchMessageDrafter"
import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"

export async function GET(
    req: NextRequest,
    props: { params: Promise<{ branchId: string }> }
) {
    try {
        const { branchId } = await props.params
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
        return NextResponse.json(
            { error: "Failed to generate message drafts", details: String(error) },
            { status: 500 }
        )
    }
}
