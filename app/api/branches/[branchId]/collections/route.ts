import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSessionUser } from "@/lib/auth";
import { FeeCollectionService } from "@/services/feeCollection.service";
import { feeCollectionError } from "@/lib/feeCollectionHttp";

export async function POST(req: NextRequest, { params }: { params: Promise<{ branchId: string }> }) {
    try {
        const expectedAccount = req.headers.get("X-Collection-Account");
        if (expectedAccount !== null && (await auth()).userId !== expectedAccount) {
            return NextResponse.json({ error: "Your signed-in account changed. Reopen the collection." }, { status: 409 });
        }
        const user = await getSessionUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { branchId } = await params;
        return NextResponse.json(await FeeCollectionService.collect(user.id, branchId, await req.json()));
    } catch (error) { return feeCollectionError(error); }
}
export async function GET(req: NextRequest, { params }: { params: Promise<{ branchId: string }> }) {
    try {
        const user = await getSessionUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { branchId } = await params;
        const query = Object.fromEntries(req.nextUrl.searchParams);
        if (query.recoveryKey) return NextResponse.json(await FeeCollectionService.recover(user.id, branchId, query.recoveryKey), { headers: { "Cache-Control": "private, no-store" } });
        if (query.dues === "true") return NextResponse.json(await FeeCollectionService.dues(user.id, branchId, query.studentId ?? ""), { headers: { "Cache-Control": "private, no-store" } });
        return NextResponse.json(await FeeCollectionService.list(user.id, branchId, query), { headers: { "Cache-Control": "private, no-store" } });
    } catch (error) { return feeCollectionError(error); }
}
