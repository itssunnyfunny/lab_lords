import { prisma } from "@/lib/prisma";
import { StaffService } from "@/services/staff.service";
import { mapImportColumns } from "@/importing/ai/import-column-mapper.ai";
import type {
    CreateImportSessionInput,
    ImportColumnMapping,
    ImportIssue,
    ImportMappingState,
    ImportNormalizedRow,
    ImportSessionSummary,
    ParsedImportSource,
} from "@/importing/contracts/import-session.contract";
import { parseCsv } from "@/importing/parsers/csv.parser";
import { parsePdf } from "@/importing/parsers/pdf.parser";
import { parsePastedTable } from "@/importing/parsers/pasted-table.parser";
import { parseXlsx } from "@/importing/parsers/xlsx.parser";
import { detectDuplicateImportRows, detectExistingStudentDuplicates } from "@/importing/utils/duplicate-detector";
import { normalizeImportRow } from "@/importing/utils/row-normalizer";
import { buildFallbackMappings } from "@/importing/utils/column-normalizer";
import { mergeValidatorResults, validateRequiredImportFields } from "@/importing/validators/import-required-fields.validator";
import { validateImportAllocation } from "@/importing/validators/import-allocation.validator";
import { validateImportPayment } from "@/importing/validators/import-payment.validator";
import { validateImportSeat } from "@/importing/validators/import-seat.validator";
import { validateImportShift } from "@/importing/validators/import-shift.validator";
import { validateImportStudent } from "@/importing/validators/import-student.validator";
import type { Prisma } from "@/app/generated/prisma/client";
import type { ImportRowStatus, ImportSessionStatus } from "@/app/generated/prisma/enums";

function asJson(value: unknown): Prisma.InputJsonValue {
    return value as Prisma.InputJsonValue;
}

function toStringDate(value: Date) {
    return value.toISOString();
}

function getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : "Something went wrong";
}

async function parseImportSource(input: CreateImportSessionInput): Promise<ParsedImportSource> {
    if (input.sourceType === "PASTED_TABLE") return parsePastedTable(input.pastedTable);
    if (input.sourceType === "CSV") return parseCsv(input.fileBuffer.toString("utf8"));
    if (input.sourceType === "XLSX" || input.sourceType === "XLS") return parseXlsx(input.fileBuffer);
    if (input.sourceType === "PDF") return parsePdf(input.fileBuffer);
    return parseCsv(input.fileBuffer.toString("utf8"));
}

function emptySummary(): ImportSessionSummary {
    return {
        totalRows: 0,
        readyRows: 0,
        needsReviewRows: 0,
        blockedRows: 0,
        warningRows: 0,
        duplicateRows: 0,
        conflictRows: 0,
        skippedRows: 0,
        readinessScore: 0,
        detectedEntityCounts: {
            STUDENT: 0,
            SEAT: 0,
            SHIFT: 0,
            ALLOCATION: 0,
            PAYMENT: 0,
        },
        warnings: [],
    };
}

function summarizeRows(rows: Array<{
    status: ImportRowStatus;
    skipped: boolean;
    normalizedData: unknown;
    warnings: unknown;
}>, mapping?: ImportMappingState | null): ImportSessionSummary {
    const summary = emptySummary();
    summary.totalRows = rows.length;
    summary.warnings = mapping?.warnings ?? [];

    for (const row of rows) {
        if (row.status === "READY") summary.readyRows++;
        if (row.status === "NEEDS_REVIEW") summary.needsReviewRows++;
        if (row.status === "BLOCKED") summary.blockedRows++;
        if (row.status === "WARNING") summary.warningRows++;
        if (row.status === "DUPLICATE") summary.duplicateRows++;
        if (row.status === "CONFLICT") summary.conflictRows++;
        if (row.status === "SKIPPED" || row.skipped) summary.skippedRows++;

        const normalized = row.normalizedData as ImportNormalizedRow | null;
        if (normalized?.student?.name) summary.detectedEntityCounts.STUDENT++;
        if (normalized?.seat?.label) summary.detectedEntityCounts.SEAT++;
        if (normalized?.shift?.name) summary.detectedEntityCounts.SHIFT++;
        if (normalized?.allocation?.seatLabel && (normalized.allocation.shiftName || normalized.allocation.multiShiftName)) summary.detectedEntityCounts.ALLOCATION++;
        if (normalized?.payment?.amount || normalized?.payment?.rawStatus) summary.detectedEntityCounts.PAYMENT++;

        const rowWarnings = Array.isArray(row.warnings) ? row.warnings as ImportIssue[] : [];
        for (const warning of rowWarnings) {
            if (summary.warnings.length < 10) summary.warnings.push(warning.message);
        }
    }

    const importableRows = summary.readyRows + summary.warningRows;
    summary.readinessScore = summary.totalRows > 0
        ? Math.round((importableRows / summary.totalRows) * 100)
        : 0;

    return summary;
}

function normalizeMapping(mapping: unknown, columns: string[]): ImportMappingState {
    if (!mapping || typeof mapping !== "object") {
        return {
            entityTypesDetected: ["STUDENT"],
            columnMappings: buildFallbackMappings(columns),
            warnings: ["Manual mapping is required."],
            usedFallback: true,
        };
    }

    const state = mapping as Partial<ImportMappingState>;
    const columnMappings = Array.isArray(state.columnMappings) && state.columnMappings.length > 0
        ? state.columnMappings
        : buildFallbackMappings(columns);

    return {
        entityTypesDetected: state.entityTypesDetected ?? ["STUDENT"],
        columnMappings,
        questions: state.questions ?? [],
        warnings: state.warnings ?? [],
        importOptions: state.importOptions ?? {},
        usedFallback: state.usedFallback,
    };
}

function statusForValidation(input: {
    skipped: boolean;
    issues: ImportIssue[];
    warnings: ImportIssue[];
}): ImportRowStatus {
    if (input.skipped) return "SKIPPED";
    if (input.issues.some(issue => issue.code === "ALLOCATION_CONFLICT")) return "CONFLICT";
    if (input.issues.length > 0) return "BLOCKED";
    if (input.warnings.some(warning => warning.code.includes("DUPLICATE"))) return "DUPLICATE";
    if (input.warnings.some(warning =>
        warning.code.includes("UNKNOWN") ||
        warning.code.includes("REQUIRED") ||
        warning.code.includes("UNCONFIRMED") ||
        warning.code.includes("AMBIGUOUS") ||
        warning.code.includes("MISSING_ALLOCATION")
    )) return "NEEDS_REVIEW";
    if (input.warnings.length > 0) return "WARNING";
    return "READY";
}

export class ImportSessionService {
    private static async authorize(userId: string, branchId: string) {
        await StaffService.authorize(userId, branchId, "students");
    }

    static async createSession(userId: string, branchId: string, input: CreateImportSessionInput) {
        await this.authorize(userId, branchId);
        const parsed = await parseImportSource(input);

        const session = await prisma.importSession.create({
            data: {
                branchId,
                uploadedByUserId: userId,
                sourceType: input.sourceType,
                fileName: input.fileName,
                fileMeta: asJson({
                    ...(input.fileMeta ?? {}),
                    columns: parsed.columns,
                    rowCount: parsed.rows.length,
                }),
                rows: {
                    create: parsed.rows.map((row, index) => ({
                        rowNumber: index + 2,
                        rawData: asJson(row),
                    })),
                },
                summary: asJson({ ...emptySummary(), totalRows: parsed.rows.length }),
            },
            include: { rows: true },
        });

        return {
            id: session.id,
            rowCount: parsed.rows.length,
            columns: parsed.columns,
            status: session.status,
        };
    }

    static async listSessions(userId: string, branchId: string) {
        await this.authorize(userId, branchId);
        const sessions = await prisma.importSession.findMany({
            where: { branchId },
            orderBy: { createdAt: "desc" },
            take: 30,
        });

        return sessions.map(session => ({
            id: session.id,
            branchId: session.branchId,
            sourceType: session.sourceType,
            fileName: session.fileName,
            status: session.status,
            summary: session.summary as ImportSessionSummary | null,
            createdAt: toStringDate(session.createdAt),
            updatedAt: toStringDate(session.updatedAt),
        }));
    }

    static async getSessionDetail(userId: string, branchId: string, sessionId: string) {
        await this.authorize(userId, branchId);
        const session = await prisma.importSession.findFirst({
            where: { id: sessionId, branchId },
            include: {
                rows: { orderBy: { rowNumber: "asc" } },
                questions: { orderBy: { createdAt: "asc" } },
                commits: { orderBy: { createdAt: "desc" } },
            },
        });

        if (!session) throw new Error("Import session not found");
        return {
            ...session,
            createdAt: toStringDate(session.createdAt),
            updatedAt: toStringDate(session.updatedAt),
            rows: session.rows.map(row => ({
                id: row.id,
                rowNumber: row.rowNumber,
                rawData: row.rawData,
                mappedData: row.mappedData,
                normalizedData: row.normalizedData,
                status: row.status,
                issues: row.issues ?? [],
                warnings: row.warnings ?? [],
                confidence: row.confidence,
                skipped: row.skipped,
                createdEntityIds: row.createdEntityIds,
            })),
            questions: session.questions.map(question => ({
                id: question.id,
                rowId: question.rowId,
                field: question.field,
                question: question.question,
                options: question.options,
                answer: question.answer,
                status: question.status,
                createdAt: toStringDate(question.createdAt),
                answeredAt: question.answeredAt ? toStringDate(question.answeredAt) : null,
            })),
            commits: session.commits.map(commit => ({
                id: commit.id,
                status: commit.status,
                summary: commit.summary,
                errors: commit.errors,
                createdAt: toStringDate(commit.createdAt),
            })),
        };
    }

    private static async getValidationContext(branchId: string) {
        const branch = await prisma.branch.findUnique({
            where: { id: branchId },
            select: {
                defaultFee: true,
                defaultAdmissionFee: true,
                seats: { select: { id: true, label: true } },
                shifts: {
                    where: { status: "ACTIVE" },
                    select: { id: true, name: true, startTime: true, endTime: true, price: true },
                },
                multiShifts: {
                    select: {
                        id: true,
                        name: true,
                        price: true,
                        components: { include: { shift: { select: { id: true, name: true } } } },
                    },
                },
                students: {
                    select: {
                        id: true,
                        name: true,
                        phone: true,
                        joinedAt: true,
                        seatAllocations: {
                            where: { endDate: null },
                            include: { seat: { select: { label: true } }, shift: { select: { name: true } } },
                        },
                    },
                },
            },
        });

        if (!branch) throw new Error("Branch not found");
        const activeAllocations = await prisma.seatAllocation.findMany({
            where: { endDate: null, seat: { branchId } },
            include: { seat: { select: { label: true } }, shift: { select: { name: true } } },
        });

        return {
            branchDefaultFee: branch.defaultFee ?? 0,
            defaultAdmissionFee: branch.defaultAdmissionFee ?? 0,
            seatsByLabel: new Map(branch.seats.map(seat => [seat.label.toLowerCase(), seat])),
            shiftsByName: new Map(branch.shifts.map(shift => [shift.name.toLowerCase(), shift])),
            multiShiftsByName: new Map(branch.multiShifts.map(multiShift => [
                multiShift.name.toLowerCase(),
                {
                    id: multiShift.id,
                    name: multiShift.name,
                    price: multiShift.price,
                    components: multiShift.components.map(component => ({
                        shiftId: component.shift.id,
                        shiftName: component.shift.name,
                    })),
                },
            ])),
            existingStudents: branch.students,
            activeAllocations,
            aiBranchContext: {
                defaultFee: branch.defaultFee ?? 0,
                defaultAdmissionFee: branch.defaultAdmissionFee ?? 0,
                seats: branch.seats.map(seat => seat.label),
                shifts: branch.shifts.map(shift => ({
                    name: shift.name,
                    startTime: shift.startTime,
                    endTime: shift.endTime,
                    price: shift.price,
                })),
                multiShifts: branch.multiShifts.map(multiShift => ({
                    name: multiShift.name,
                    price: multiShift.price,
                    componentShiftNames: multiShift.components.map(component => component.shift.name),
                })),
            },
        };
    }

    static async analyzeSession(userId: string, branchId: string, sessionId: string) {
        await this.authorize(userId, branchId);
        const session = await prisma.importSession.findFirst({
            where: { id: sessionId, branchId },
            include: { rows: { orderBy: { rowNumber: "asc" } } },
        });
        if (!session) throw new Error("Import session not found");

        await prisma.importSession.update({
            where: { id: sessionId },
            data: { status: "ANALYZING" },
        });

        try {
            const columns = Object.keys((session.rows[0]?.rawData ?? {}) as Record<string, unknown>);
            const context = await this.getValidationContext(branchId);
            const aiMapping = await mapImportColumns({
                branchContext: context.aiBranchContext,
                columns,
                sampleRows: session.rows.slice(0, 8).map(row => row.rawData as Record<string, string>),
            });

            const mapping: ImportMappingState = {
                ...aiMapping,
                importOptions: {},
            };

            await prisma.importSession.update({
                where: { id: sessionId },
                data: { mapping: asJson(mapping) },
            });

            return this.revalidateSession(userId, branchId, sessionId);
        } catch (error) {
            await prisma.importSession.update({
                where: { id: sessionId },
                data: {
                    status: "NEEDS_MAPPING",
                    summary: asJson({
                        ...emptySummary(),
                        warnings: [getErrorMessage(error)],
                    }),
                },
            });
            throw error;
        }
    }

    static async updateMapping(
        userId: string,
        branchId: string,
        sessionId: string,
        input: { columnMappings?: ImportColumnMapping[]; importOptions?: Partial<ImportMappingState["importOptions"]> }
    ) {
        await this.authorize(userId, branchId);
        const session = await prisma.importSession.findFirst({
            where: { id: sessionId, branchId },
            include: { rows: { take: 1 } },
        });
        if (!session) throw new Error("Import session not found");

        const columns = Object.keys((session.rows[0]?.rawData ?? {}) as Record<string, unknown>);
        const current = normalizeMapping(session.mapping, columns);
        const next: ImportMappingState = {
            ...current,
            columnMappings: input.columnMappings ?? current.columnMappings,
            importOptions: {
                ...(current.importOptions ?? {}),
                ...(input.importOptions ?? {}),
                paymentMapping: {
                    ...(current.importOptions?.paymentMapping ?? {
                        paidValues: [],
                        unpaidValues: [],
                        waivedValues: [],
                        unclearValues: [],
                        confirmed: false,
                    }),
                    ...(input.importOptions?.paymentMapping ?? {}),
                },
            },
        };

        await prisma.importSession.update({
            where: { id: sessionId },
            data: { mapping: asJson(next) },
        });

        return this.revalidateSession(userId, branchId, sessionId);
    }

    static async updateRows(
        userId: string,
        branchId: string,
        sessionId: string,
        input: {
            edits?: { rowId: string; rawData?: Record<string, string>; normalizedData?: ImportNormalizedRow }[];
            skipRowIds?: string[];
            unskipRowIds?: string[];
        }
    ) {
        await this.authorize(userId, branchId);
        const session = await prisma.importSession.findFirst({ where: { id: sessionId, branchId } });
        if (!session) throw new Error("Import session not found");

        for (const edit of input.edits ?? []) {
            await prisma.importRow.updateMany({
                where: { id: edit.rowId, importSessionId: sessionId },
                data: {
                    ...(edit.rawData ? { rawData: asJson(edit.rawData) } : {}),
                    ...(edit.normalizedData ? { normalizedData: asJson(edit.normalizedData) } : {}),
                },
            });
        }

        if (input.skipRowIds?.length) {
            await prisma.importRow.updateMany({
                where: { id: { in: input.skipRowIds }, importSessionId: sessionId },
                data: { skipped: true, status: "SKIPPED" },
            });
        }

        if (input.unskipRowIds?.length) {
            await prisma.importRow.updateMany({
                where: { id: { in: input.unskipRowIds }, importSessionId: sessionId },
                data: { skipped: false },
            });
        }

        return this.revalidateSession(userId, branchId, sessionId);
    }

    static async revalidateSession(userId: string, branchId: string, sessionId: string) {
        await this.authorize(userId, branchId);
        const session = await prisma.importSession.findFirst({
            where: { id: sessionId, branchId },
            include: { rows: { orderBy: { rowNumber: "asc" } } },
        });
        if (!session) throw new Error("Import session not found");

        const columns = Object.keys((session.rows[0]?.rawData ?? {}) as Record<string, unknown>);
        const mapping = normalizeMapping(session.mapping, columns);
        const context = await this.getValidationContext(branchId);
        const normalizedRows = session.rows.map(row => {
            if (
                row.normalizedData &&
                typeof row.normalizedData === "object" &&
                !Array.isArray(row.normalizedData) &&
                Object.keys(row.normalizedData as Record<string, unknown>).length > 0
            ) {
                return {
                    row,
                    mappedData: row.mappedData ?? {},
                    normalizedData: row.normalizedData as ImportNormalizedRow,
                    normalizationIssues: [] as ImportIssue[],
                    confidence: row.confidence,
                };
            }

            const normalized = normalizeImportRow(
                row.rawData as Record<string, string>,
                mapping.columnMappings,
                mapping.importOptions?.paymentMapping
            );
            return {
                row,
                mappedData: normalized.mappedData,
                normalizedData: normalized.normalizedData,
                normalizationIssues: normalized.issues,
                confidence: normalized.confidence,
            };
        });

        const duplicateMap = detectDuplicateImportRows(normalizedRows.map(item => ({
            id: item.row.id,
            rowNumber: item.row.rowNumber,
            normalizedData: item.normalizedData,
        })));

        const questionDrafts: { rowId?: string; field?: string; question: string; options?: unknown }[] = [
            ...(mapping.questions ?? []).map(question => ({
                field: question.field,
                question: question.question,
                options: question.options,
            })),
        ];

        for (const item of normalizedRows) {
            const baseIssues = item.normalizationIssues;
            const result = mergeValidatorResults(
                { issues: baseIssues, warnings: [], questions: [] },
                validateRequiredImportFields(item.normalizedData),
                validateImportStudent(item.normalizedData, context),
                validateImportSeat(item.normalizedData, {
                    seatsByLabel: context.seatsByLabel,
                    createUnknownSeats: mapping.importOptions?.createUnknownSeats,
                }),
                validateImportShift(item.normalizedData, {
                    shiftsByName: context.shiftsByName,
                    multiShiftsByName: context.multiShiftsByName,
                    createUnknownShifts: mapping.importOptions?.createUnknownShifts,
                    createUnknownMultiShifts: mapping.importOptions?.createUnknownMultiShifts,
                }),
                validateImportAllocation(item.normalizedData, context),
                validateImportPayment(item.normalizedData, mapping)
            );

            const duplicateWarnings = [
                ...(duplicateMap.get(item.row.id) ?? []),
                ...detectExistingStudentDuplicates(item.normalizedData, context.existingStudents),
            ];
            const warnings = [...result.warnings, ...duplicateWarnings];
            const status = statusForValidation({
                skipped: item.row.skipped,
                issues: result.issues,
                warnings,
            });

            questionDrafts.push(...result.questions.map(question => ({
                ...question,
                rowId: item.row.id,
            })));

            await prisma.importRow.update({
                where: { id: item.row.id },
                data: {
                    mappedData: asJson(item.mappedData),
                    normalizedData: asJson(item.normalizedData),
                    issues: asJson(result.issues),
                    warnings: asJson(warnings),
                    confidence: item.confidence,
                    status,
                },
            });
        }

        await prisma.importQuestion.deleteMany({
            where: { importSessionId: sessionId, status: "OPEN" },
        });

        const uniqueQuestions = new Map<string, { rowId?: string; field?: string; question: string; options?: unknown }>();
        for (const question of questionDrafts) {
            const key = `${question.rowId ?? "session"}:${question.field ?? ""}:${question.question}`;
            if (!uniqueQuestions.has(key)) uniqueQuestions.set(key, question);
        }

        if (uniqueQuestions.size > 0) {
            await prisma.importQuestion.createMany({
                data: Array.from(uniqueQuestions.values()).map(question => ({
                    importSessionId: sessionId,
                    rowId: question.rowId,
                    field: question.field,
                    question: question.question,
                    options: asJson(question.options ?? null),
                })),
            });
        }

        const rows = await prisma.importRow.findMany({ where: { importSessionId: sessionId } });
        const openQuestions = await prisma.importQuestion.count({ where: { importSessionId: sessionId, status: "OPEN" } });
        const summary = summarizeRows(rows, mapping);
        const hasReviewBlocking = rows.some(row => ["NEEDS_REVIEW", "DUPLICATE"].includes(row.status));
        const status: ImportSessionStatus =
            openQuestions > 0 ? "NEEDS_INFO" :
            hasReviewBlocking ? "VALIDATED" :
            rows.some(row => row.status === "READY" || row.status === "WARNING") ? "READY_TO_COMMIT" :
            "NEEDS_MAPPING";

        await prisma.importSession.update({
            where: { id: sessionId },
            data: {
                status,
                mapping: asJson(mapping),
                summary: asJson(summary),
            },
        });

        return this.getSessionDetail(userId, branchId, sessionId);
    }
}
