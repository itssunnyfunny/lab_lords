import { prisma } from "@/lib/prisma";
import { ImportSessionService } from "./import-session.service";
import { StaffService } from "@/services/staff.service";
import type { ImportMappingState, ImportOptions } from "@/importing/contracts/import-session.contract";
import type { Prisma } from "@/app/generated/prisma/client";

function asJson(value: unknown): Prisma.InputJsonValue {
    return value as Prisma.InputJsonValue;
}

function answerToOptions(field: string | null, answer: unknown): Partial<ImportOptions> {
    const value = typeof answer === "string"
        ? answer
        : answer && typeof answer === "object" && "value" in answer
            ? String((answer as { value: unknown }).value)
            : "";

    if (field === "payment.period") return { paymentCycle: value as ImportOptions["paymentCycle"] };
    if (field === "payment.status" && ["GENERATE_DUE", "IMPORT_PAID_UNPAID", "SKIP_PAYMENTS"].includes(value)) {
        return { paymentAction: value as ImportOptions["paymentAction"] };
    }
    if (field === "student.joinedAt") {
        return { defaultJoinedAt: value === "USE_TODAY" ? new Date().toISOString() : value };
    }
    if (field === "seat.label" && value === "YES_CREATE_SEATS") return { createUnknownSeats: true };
    if (field === "seat.label" && value && value !== "NO_SKIP_ALLOCATIONS") return { defaultSeatLabel: value };
    if (field === "allocation.shiftName" && value === "CREATE_SHIFT") return { createUnknownShifts: true };
    if (field === "allocation.shiftName" && value && !["MAP_TO_EXISTING_SHIFT", "SKIP_ALLOCATIONS"].includes(value)) {
        return { defaultShiftName: value };
    }
    if (field === "allocation.multiShiftName" && value === "CREATE_MULTI_SHIFT") return { createUnknownMultiShifts: true };
    if (field === "allocation.multiShiftName" && value && !["MAP_TO_EXISTING_MULTI_SHIFT", "SKIP_ALLOCATIONS"].includes(value)) {
        return { defaultMultiShiftName: value };
    }
    return {};
}

export class ImportQuestionService {
    static async listQuestions(userId: string, branchId: string, sessionId: string) {
        return (await ImportSessionService.getSessionDetail(userId, branchId, sessionId)).questions;
    }

    static async answerQuestion(
        userId: string,
        branchId: string,
        sessionId: string,
        input: { questionId: string; answer: unknown; applyToAffectedRows?: boolean }
    ) {
        await StaffService.authorize(userId, branchId, "students");
        const session = await prisma.importSession.findFirst({
            where: { id: sessionId, branchId },
            include: { questions: { where: { id: input.questionId } }, rows: { take: 1 } },
        });
        if (!session) throw new Error("Import session not found");
        const question = session.questions[0];
        if (!question) throw new Error("Import question not found");

        const columns = Object.keys((session.rows[0]?.rawData ?? {}) as Record<string, unknown>);
        const current = session.mapping as ImportMappingState | null;
        const nextMapping: ImportMappingState = {
            entityTypesDetected: current?.entityTypesDetected ?? ["STUDENT"],
            columnMappings: current?.columnMappings ?? [],
            questions: current?.questions ?? [],
            warnings: current?.warnings ?? [],
            importOptions: {
                ...(current?.importOptions ?? {}),
                ...answerToOptions(question.field, input.answer),
            },
            analysis: current?.analysis,
            usedFallback: current?.usedFallback,
        };

        if (nextMapping.columnMappings.length === 0 && columns.length > 0) {
            const { buildFallbackMappings } = await import("@/importing/utils/column-normalizer");
            nextMapping.columnMappings = buildFallbackMappings(columns);
        }

        await prisma.importQuestion.update({
            where: { id: input.questionId },
            data: {
                answer: asJson(input.answer),
                status: "ANSWERED",
                answeredAt: new Date(),
            },
        });

        await prisma.importSession.update({
            where: { id: sessionId },
            data: { mapping: asJson(nextMapping) },
        });

        return ImportSessionService.revalidateSession(userId, branchId, sessionId);
    }
}
