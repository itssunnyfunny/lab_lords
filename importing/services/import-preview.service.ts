import { ImportSessionService } from "./import-session.service";
import type { CommitMode, ImportIssue, ImportMappingState, ImportNormalizedRow } from "@/importing/contracts/import-session.contract";
import type { ImportPreview } from "@/importing/contracts/import-preview.contract";
import { buildImportPlanChecks, createImportPlanVersion, getBlockingImportPlanChecks } from "@/importing/utils/import-plan-checks";

function defersAllocation(warnings: ImportIssue[]) {
    return warnings.some(warning => warning.code.startsWith("ALLOCATION_SKIPPED_"));
}

export class ImportPreviewService {
    static async getPreview(
        userId: string,
        branchId: string,
        sessionId: string,
        mode: CommitMode = "SAFE_PARTIAL"
    ): Promise<ImportPreview> {
        const detail = await ImportSessionService.revalidateSession(userId, branchId, sessionId);
        const rows = detail.rows.map(row => {
            const issues = (Array.isArray(row.issues) ? row.issues : []) as ImportIssue[];
            const warnings = (Array.isArray(row.warnings) ? row.warnings : []) as ImportIssue[];
            const willImport = !row.skipped && ["READY", "WARNING"].includes(row.status);

            return {
                rowId: row.id,
                rowNumber: row.rowNumber,
                status: row.status,
                normalizedData: row.normalizedData as ImportNormalizedRow | null,
                issues,
                warnings,
                willImport,
            };
        });

        const importableRows = rows.filter(row => row.willImport);
        const createSeats = new Set<string>();
        const createShifts = new Set<string>();
        const createMultiShifts = new Set<string>();

        for (const row of importableRows) {
            const normalized = row.normalizedData;
            if (!normalized) continue;
            if (normalized.seat?.label && row.warnings.some(warning => warning.code === "WILL_CREATE_SEAT")) createSeats.add(normalized.seat.label);
            if (normalized.shift?.name && row.warnings.some(warning => warning.code === "WILL_CREATE_SHIFT")) createShifts.add(normalized.shift.name);
            if (normalized.multiShift?.name && row.warnings.some(warning => warning.code === "WILL_CREATE_MULTI_SHIFT")) createMultiShifts.add(normalized.multiShift.name);
        }

        const mappingState = detail.mapping as ImportMappingState;
        const mapping = mappingState as { importOptions?: { paymentAction?: string; paymentCycle?: string } } | null;
        const generatesMonthlyPayments = Boolean(
            mapping?.importOptions?.paymentAction &&
            mapping.importOptions.paymentAction !== "SKIP_PAYMENTS" &&
            mapping.importOptions.paymentCycle !== "SKIP_PAYMENTS"
        );
        const importsPaymentStatuses = mapping?.importOptions?.paymentAction === "IMPORT_PAID_UNPAID";
        const paymentRows = generatesMonthlyPayments
            ? importableRows.filter(row => row.normalizedData?.student?.name)
            : importableRows.filter(row => row.normalizedData?.payment);
        const hasOpenQuestions = detail.questions?.some((question: { status?: string }) => question.status === "OPEN") ?? false;
        const checks = buildImportPlanChecks({
            mapping: mappingState,
            rows,
            hasOpenQuestions,
            mode,
        });
        const blockers = getBlockingImportPlanChecks(checks);

        return {
            mode,
            canCommit: blockers.length === 0 && (
                detail.status === "READY_TO_COMMIT" ||
                (mode === "SAFE_PARTIAL" && !hasOpenQuestions && importableRows.length > 0)
            ),
            generatedAt: new Date().toISOString(),
            planVersion: createImportPlanVersion({
                sessionId,
                status: detail.status,
                mapping: mappingState,
                rows,
            }),
            summary: {
                createStudents: importableRows.filter(row => row.normalizedData?.student?.name).length,
                createSeats: createSeats.size,
                createShifts: createShifts.size,
                createMultiShifts: createMultiShifts.size,
                createAllocations: importableRows.filter(row =>
                    !defersAllocation(row.warnings) &&
                    row.normalizedData?.allocation?.seatLabel &&
                    (row.normalizedData.allocation.shiftName || row.normalizedData.allocation.multiShiftName)
                ).length,
                generatePayments: paymentRows.length,
                markPaid: importsPaymentStatuses ? paymentRows.filter(row => row.normalizedData?.payment?.status === "PAID").length : 0,
                markWaived: importsPaymentStatuses ? paymentRows.filter(row => row.normalizedData?.payment?.status === "WAIVED").length : 0,
                skippedRows: rows.filter(row => row.status === "SKIPPED").length,
                blockedRows: rows.filter(row => ["BLOCKED", "CONFLICT"].includes(row.status)).length,
                warningRows: rows.filter(row => row.warnings.length > 0).length,
            },
            checks,
            rows,
            warnings: rows.flatMap(row => row.warnings.map(warning => warning.message)).slice(0, 20),
        };
    }
}
