import { draftOverdueMessages } from "@/ai/messageDrafting/branchMessageDrafter"
import { getSessionUser } from "@/lib/auth"
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
        const result = await draftOverdueMessages(branchId, {
            language: searchParams.get("lang") === "hi" ? "hi" : searchParams.get("lang") === "en" ? "en" : undefined,
            tone: searchParams.get("tone") === "friendly" || searchParams.get("tone") === "firm" || searchParams.get("tone") === "polite"
                ? searchParams.get("tone") as "friendly" | "firm" | "polite"
                : undefined,
            include: searchParams.get("include") ?? undefined,
            allowGeneration: false,
        })

        return NextResponse.json(result)

    } catch (error) {
        console.error("[AI MESSAGES ERROR]", error)
        const message = String(error)
        return NextResponse.json(
            { error: "Failed to generate message drafts", details: message },
            { status: message.includes("Unauthorized") ? 403 : 500 }
        )
    }
}

export async function POST(
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

        const body = await req.json().catch(() => ({})) as {
            language?: "en" | "hi";
            tone?: "polite" | "friendly" | "firm";
            include?: unknown;
            studentIds?: unknown;
        }
        const studentIds = Array.isArray(body.studentIds)
            ? body.studentIds.filter((value): value is string => typeof value === "string")
            : []

        const result = await draftOverdueMessages(branchId, {
            language: body.language,
            tone: body.tone,
            include: body.include,
            regenerateStudentIds: studentIds,
            allowGeneration: true,
            generateMissing: false,
        })

        return NextResponse.json(result)

    } catch (error) {
        console.error("[AI MESSAGES ERROR]", error)
        const message = String(error)
        return NextResponse.json(
            { error: "Failed to generate message drafts", details: message },
            { status: message.includes("Unauthorized") ? 403 : 500 }
        )
    }
}
