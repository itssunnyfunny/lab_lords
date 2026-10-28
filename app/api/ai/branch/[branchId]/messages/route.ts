import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { AccessPolicy, BranchAccessNotFoundError } from "@/services/accessPolicy.service";

type Context = { params: Promise<{ branchId: string }> };

/** Compatibility tombstone. Historical drafts remain stored; no draft reader,
 * provider, lease or generation service is imported by this endpoint. */
async function retiredMessages(_request: Request, { params }: Context) {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    try {
        const { branchId } = await params;
        await AccessPolicy.resolveBranch(user.id, branchId);
        return NextResponse.json({ code: "AI_MESSAGES_RETIRED", error: "AI Messages has been retired. Use Follow-ups." }, { status: 410 });
    } catch (error) {
        if (error instanceof BranchAccessNotFoundError) return NextResponse.json({ error: "Branch not found" }, { status: 404 });
        return NextResponse.json({ error: "Unable to check this branch." }, { status: 500 });
    }
}

export const GET = retiredMessages;
export const POST = retiredMessages;
