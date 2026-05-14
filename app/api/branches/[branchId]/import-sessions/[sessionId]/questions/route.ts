import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { ImportQuestionService } from "@/importing/services/import-question.service";

type Params = { params: Promise<{ branchId: string; sessionId: string }> };

export async function GET(_req: Request, { params }: Params) {
    try {
        const user = await getSessionUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { branchId, sessionId } = await params;
        const questions = await ImportQuestionService.listQuestions(user.id, branchId, sessionId);
        return NextResponse.json(questions);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to list import questions";
        const status = message.includes("Unauthorized") ? 403 : message.includes("not found") ? 404 : 400;
        return NextResponse.json({ error: message }, { status });
    }
}

export async function POST(req: Request, { params }: Params) {
    try {
        const user = await getSessionUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const { branchId, sessionId } = await params;
        const body = await req.json();
        const detail = await ImportQuestionService.answerQuestion(user.id, branchId, sessionId, {
            questionId: body.questionId,
            answer: body.answer,
            applyToAffectedRows: Boolean(body.applyToAffectedRows),
        });
        return NextResponse.json(detail);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to answer import question";
        const status = message.includes("Unauthorized") ? 403 : message.includes("not found") ? 404 : 400;
        return NextResponse.json({ error: message }, { status });
    }
}
