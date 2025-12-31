import { getSessionUser } from "@/lib/auth"
import { NextResponse } from "next/server"

export async function GET(
    _: Request,
    { params }: { params: { orgId: string } }
) {
    const user = await getSessionUser()
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // "No need to overbuild yet"
    // Organization-level trends require aggregating branch trends over time,
    // which is computationally expensive and not yet optimized.
    return NextResponse.json(
        { message: "Organization trends not yet implemented" },
        { status: 501 }
    )
}
