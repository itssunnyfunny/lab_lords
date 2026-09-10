import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { FeeCollectionService } from "@/services/feeCollection.service";
import { feeCollectionError } from "@/lib/feeCollectionHttp";

type Context = { params: Promise<{ branchId: string; collectionId: string }> };
export async function GET(_req: NextRequest, { params }: Context) {
    try {
        const user = await getSessionUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { branchId, collectionId } = await params;
        return NextResponse.json(await FeeCollectionService.get(user.id, branchId, collectionId), { headers: { "Cache-Control": "private, no-store" } });
    } catch (error) { return feeCollectionError(error); }
}
export async function PATCH(req: NextRequest, { params }: Context) {
    try {
        const user = await getSessionUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { branchId, collectionId } = await params;
        return NextResponse.json(await FeeCollectionService.void(user.id, branchId, collectionId, (await req.json()).reason));
    } catch (error) { return feeCollectionError(error); }
}
