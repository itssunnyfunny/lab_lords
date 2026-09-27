import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getSessionUser } from "@/lib/auth";
import { BranchAccessNotFoundError } from "@/services/accessPolicy.service";
import { DashboardInputError, DashboardNotFoundError } from "@/services/dashboard.service";

class DashboardRequestError extends Error { constructor(message: string, readonly status: number) { super(message); } }
export async function dashboardRequestBody(request: Request) {
    const origin = request.headers.get("origin");
    if ((origin && origin !== new URL(request.url).origin) || request.headers.get("sec-fetch-site") === "cross-site")
        throw new DashboardRequestError("Forbidden", 403);
    if (!request.headers.get("content-type")?.startsWith("application/json")) throw new DashboardRequestError("JSON required", 415);
    const maximumBytes = 12_000;
    if (Number(request.headers.get("content-length")) > maximumBytes) throw new DashboardRequestError("Request too large", 413);
    const reader = request.body?.getReader();
    if (!reader) throw new DashboardRequestError("JSON required", 400);
    const chunks: Uint8Array[] = [];
    let total = 0;
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            total += value.byteLength;
            if (total > maximumBytes) {
                await reader.cancel();
                throw new DashboardRequestError("Request too large", 413);
            }
            chunks.push(value);
        }
    } finally { reader.releaseLock(); }
    const body = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
    let text: string;
    try { text = new TextDecoder("utf-8", { fatal: true }).decode(body); }
    catch { throw new DashboardRequestError("Invalid JSON encoding", 400); }
    return JSON.parse(text);
}
export function dashboardErrorResponse(error: unknown) {
    if (error instanceof DashboardRequestError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof ZodError || error instanceof SyntaxError || error instanceof DashboardInputError)
        return NextResponse.json({ error: error instanceof DashboardInputError ? error.message : "Invalid dashboard request" }, { status: 400 });
    if (error instanceof BranchAccessNotFoundError || error instanceof DashboardNotFoundError)
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (error instanceof Error && /Unauthorized|permission|read.only|writ|archived|entitlement|subscription|activation/i.test(error.message))
        return NextResponse.json({ error: "This action is unavailable with your current access or branch status." }, { status: 403 });
    return NextResponse.json({ error: "Unable to load or save this dashboard. Please try again." }, { status: 500 });
}
export async function dashboardResponse<T>(run: (actorId: string) => Promise<T>) {
    try {
        const user = await getSessionUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        return NextResponse.json(await run(user.id), { headers: { "Cache-Control": "private, no-store" } });
    } catch (error) { return dashboardErrorResponse(error); }
}
