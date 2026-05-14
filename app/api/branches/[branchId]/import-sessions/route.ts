import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { ImportSessionService } from "@/importing/services/import-session.service";
import type { ImportSourceType } from "@/app/generated/prisma/enums";

type Params = { params: Promise<{ branchId: string }> };

function statusForError(message: string) {
    if (message.includes("Unauthorized")) return 403;
    if (message.includes("not found")) return 404;
    return 400;
}

type FileImportSourceType = Exclude<ImportSourceType, "PASTED_TABLE">;

function sourceTypeForFile(fileName: string): FileImportSourceType {
    const lower = fileName.toLowerCase();
    if (lower.endsWith(".csv")) return "CSV";
    if (lower.endsWith(".xlsx")) return "XLSX";
    if (lower.endsWith(".xls")) return "XLS";
    if (lower.endsWith(".pdf")) return "PDF";
    return "OTHER";
}

export async function POST(req: Request, { params }: Params) {
    try {
        const user = await getSessionUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { branchId } = await params;
        const contentType = req.headers.get("content-type") ?? "";

        if (contentType.includes("multipart/form-data")) {
            const form = await req.formData();
            const file = form.get("file");
            if (!(file instanceof File)) {
                return NextResponse.json({ error: "File is required." }, { status: 400 });
            }

            const buffer = Buffer.from(await file.arrayBuffer());
            const session = await ImportSessionService.createSession(user.id, branchId, {
                sourceType: sourceTypeForFile(file.name),
                fileName: file.name,
                fileMeta: { size: file.size, type: file.type },
                fileBuffer: buffer,
            });
            return NextResponse.json(session, { status: 201 });
        }

        const body = await req.json();
        const pastedTable = typeof body.pastedTable === "string" ? body.pastedTable : "";
        const session = await ImportSessionService.createSession(user.id, branchId, {
            sourceType: "PASTED_TABLE",
            fileName: body.fileName,
            fileMeta: { pasted: true },
            pastedTable,
        });
        return NextResponse.json(session, { status: 201 });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to create import session";
        return NextResponse.json({ error: message }, { status: statusForError(message) });
    }
}

export async function GET(_req: Request, { params }: Params) {
    try {
        const user = await getSessionUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { branchId } = await params;
        const sessions = await ImportSessionService.listSessions(user.id, branchId);
        return NextResponse.json(sessions);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to list import sessions";
        return NextResponse.json({ error: message }, { status: statusForError(message) });
    }
}
