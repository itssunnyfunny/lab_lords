"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
    ArrowLeft,
    CheckCircle2,
    HelpCircle,
    Loader2,
    Pencil,
    RotateCcw,
    Save,
    UploadCloud,
} from "lucide-react";
import { BranchAccessGuard } from "@/components/auth/BranchAccessGuard";
import { AppButton, AppPanel, PageShell } from "@/components/ui";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
    IMPORT_TARGET_FIELDS,
    type CommitMode,
    type ImportAttentionBucket,
    type ImportBranchContext,
    type ImportColumnMapping,
    type ImportIssue,
    type ImportNormalizedRow,
    type ImportOptions,
    type ImportPipelineStep,
    type ImportSourceProfile,
} from "@/importing/contracts/import-session.contract";
import type {
    ImportPlanCheck,
    ImportPreview,
    ImportRowDraftPreview,
} from "@/importing/contracts/import-preview.contract";
import {
    draftFromImportRow,
    feeFromSelection,
    feeLooksAutoFilled,
    importRowFieldValue,
    normalizedFromImportDraft,
    type ImportRowDraft,
} from "@/importing/utils/manual-row-draft";
import { importSessions } from "@/lib/api/importSessions";
import { cn } from "@/lib/utils";
import {
    pageCountBadgeClass,
    pageDescriptionClass,
    pageEyebrowClass,
    pageInsetMetricClass,
    pageInsetSurfaceClass,
    pageMutedTextClass,
    pageProgressTrackClass,
    pageSubtleTextClass,
    pageTableBodyDividerClass,
    pageTableHeadClass,
    pageTableRowClass,
    pageTitleClass,
} from "@/components/ui/pageSurface";
import {
    pickerGroupLabelClass,
    pickerSectionLabelClass,
} from "@/components/ui/pickerSurface";

type RowFilter = "attention" | "ready" | "all" | "skipped";
type RowDraft = ImportRowDraft;

type ImportRow = {
    id: string;
    rowNumber: number;
    rawData: Record<string, string>;
    mappedData: Record<string, unknown> | null;
    normalizedData: ImportNormalizedRow | null;
    status: string;
    issues: ImportIssue[];
    warnings: ImportIssue[];
    confidence: number | null;
    skipped: boolean;
};

type ImportQuestion = {
    id: string;
    field: string | null;
    question: string;
    options: string[] | null;
    answer?: unknown;
    status: string;
};

type ImportDetail = {
    id: string;
    status: string;
    fileName?: string | null;
    updatedAt?: string;
    mapping?: {
        entityTypesDetected?: string[];
        columnMappings?: ImportColumnMapping[];
        importOptions?: ImportOptions;
        warnings?: string[];
        usedFallback?: boolean;
        analysis?: {
            sourceProfile?: ImportSourceProfile;
            attention?: ImportAttentionBucket[];
            pipeline?: ImportPipelineStep[];
            model?: string;
            notes?: string[];
            detectedPaymentValues?: string[];
            ai?: {
                status: "success" | "fallback" | "unavailable" | "invalid_response" | "error";
                model?: string;
                attemptedAt: string;
                durationMs: number;
                fallbackReason?: string;
                error?: string;
                usedStructuredOutput?: boolean;
            };
        };
    } | null;
    summary?: {
        totalRows: number;
        readyRows: number;
        needsReviewRows: number;
        blockedRows: number;
        warningRows: number;
        duplicateRows: number;
        conflictRows: number;
        skippedRows: number;
        readinessScore: number;
        openQuestions?: number;
        detectedEntityCounts: Record<string, number>;
        attention?: ImportAttentionBucket[];
        sourceProfile?: ImportSourceProfile;
    } | null;
    rows: ImportRow[];
    rowPage?: {
        filter: RowFilter;
        limit: number | null;
        cursor: string | null;
        nextCursor: string | null;
        hasMore: boolean;
        totalRows: number;
        filteredRows: number;
        returnedRows: number;
    };
    branchContext?: ImportBranchContext;
    questions: ImportQuestion[];
    commits?: { status: string; summary: Record<string, number>; errors?: unknown }[];
};

const importFieldClass =
    "rounded-[8px] border border-[color:var(--ui-form-field-border)] bg-[color:var(--ui-form-field-bg)] p-2 text-sm text-[color:var(--text-primary)] outline-none transition-colors placeholder:text-[color:var(--text-muted)] focus:border-[color:var(--ui-form-input-focus-border)] focus:ring-2 focus:ring-[color:var(--ui-form-input-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60";
const importSelectClass = `${importFieldClass} [color-scheme:dark]`;
const importOptionClass = "bg-[color:var(--ui-form-input-select-bg)] text-[color:var(--ui-form-input-text)]";

const statusLabels: Record<string, string> = {
    READY: "Ready",
    READY_TO_COMMIT: "Ready",
    NEEDS_REVIEW: "Needs review",
    NEEDS_INFO: "Needs info",
    VALIDATED: "Validated",
    WARNING: "Warning",
    BLOCKED: "Blocked",
    DUPLICATE: "Duplicate",
    CONFLICT: "Conflict",
    SKIPPED: "Skipped",
    IMPORTED: "Imported",
    FAILED: "Failed",
    COMMITTED: "Committed",
    PARTIAL: "Partial",
};

const rowFilterLabels: Record<RowFilter, string> = {
    attention: "Needs attention",
    ready: "Ready",
    all: "All rows",
    skipped: "Skipped",
};

const optionLabels: Record<string, string> = {
    CURRENT_MONTH: "Current month",
    PREVIOUS_MONTH: "Previous month",
    CUSTOM_PERIOD: "Custom period",
    USE_JOINED_AT_ANNIVERSARY: "Joined date cycle",
    SKIP_PAYMENTS: "Skip payments",
    GENERATE_DUE: "Generate due",
    IMPORT_PAID_UNPAID: "Import paid/unpaid",
    YES_CREATE_SEATS: "Create missing seats",
    SKIP_UNKNOWN_SEAT_ALLOCATION: "Skip unknown seat link",
    CREATE_SHIFT: "Create missing shift",
    SKIP_UNKNOWN_SHIFT_ALLOCATION: "Skip unknown shift link",
    SKIP_ALLOCATIONS: "Skip allocation links",
    SKIP_MISSING_SHIFT_ALLOCATION: "Skip missing shift link",
    CREATE_MULTI_SHIFT: "Create missing bundle",
    SKIP_UNKNOWN_MULTI_SHIFT_ALLOCATION: "Skip unknown bundle link",
};

const previewSummaryLabels: Record<keyof ImportPreview["summary"], string> = {
    createStudents: "Students",
    createSeats: "Create seats",
    createShifts: "Create shifts",
    createMultiShifts: "Create bundles",
    createAllocations: "Seat links",
    generatePayments: "Payments",
    markPaid: "Mark paid",
    markWaived: "Mark waived",
    skippedRows: "Skipped",
    blockedRows: "Blocked",
    warningRows: "Warnings",
};

function statusVariant(status: string): "success" | "warning" | "danger" | "default" | "cyan" | "purple" {
    if (["READY", "READY_TO_COMMIT", "IMPORTED", "COMMITTED"].includes(status)) return "success";
    if (["WARNING", "NEEDS_REVIEW", "DUPLICATE", "VALIDATED", "NEEDS_INFO", "PARTIAL"].includes(status)) return "warning";
    if (["BLOCKED", "CONFLICT", "FAILED"].includes(status)) return "danger";
    if (status === "SKIPPED") return "default";
    return "cyan";
}

function aiVariant(status?: string): "success" | "warning" | "danger" | "cyan" {
    if (status === "success") return "success";
    if (status === "error" || status === "invalid_response") return "danger";
    if (status === "fallback" || status === "unavailable") return "warning";
    return "cyan";
}

function planCheckVariant(status: ImportPlanCheck["status"]): "success" | "warning" | "danger" {
    if (status === "pass") return "success";
    if (status === "warning") return "warning";
    return "danger";
}

function optionLabel(option: string) {
    return optionLabels[option] ?? option;
}

function splitValues(value: string) {
    return value.split(",").map(part => part.trim()).filter(Boolean);
}

function joinValues(values?: string[]) {
    return (values ?? []).join(", ");
}

function manualRow(row: ImportRow) {
    return row.mappedData?.__manualNormalizedData === true;
}

function fieldValue(row: ImportRow, field: keyof RowDraft) {
    return importRowFieldValue(row, field);
}

function formatAmount(value: number | string | null | undefined) {
    if (value === null || value === undefined || value === "") return "-";
    const amount = Number(value);
    if (!Number.isFinite(amount)) return String(value);
    return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(amount);
}

function metricVariant(value: number, dangerWhenPositive = false): "success" | "warning" | "danger" | "default" | "cyan" {
    if (dangerWhenPositive) return value > 0 ? "danger" : "success";
    return value > 0 ? "cyan" : "default";
}

function missingRecords(rows: ImportRow[], context: ImportBranchContext | undefined) {
    const seats = new Set<string>();
    const shifts = new Set<string>();
    const multiShifts = new Set<string>();
    const seatNames = new Set((context?.seats ?? []).map(seat => seat.label.toLowerCase()));
    const shiftNames = new Set((context?.shifts ?? []).map(shift => shift.name.toLowerCase()));
    const multiShiftNames = new Set((context?.multiShifts ?? []).map(multiShift => multiShift.name.toLowerCase()));

    for (const row of rows) {
        const normalized = row.normalizedData;
        const seat = normalized?.allocation?.seatLabel ?? normalized?.seat?.label;
        const shift = normalized?.allocation?.shiftName ?? normalized?.shift?.name;
        const multiShift = normalized?.allocation?.multiShiftName ?? normalized?.multiShift?.name;
        if (seat && !seatNames.has(seat.toLowerCase())) seats.add(seat);
        if (shift && !shiftNames.has(shift.toLowerCase())) shifts.add(shift);
        if (multiShift && !multiShiftNames.has(multiShift.toLowerCase())) multiShifts.add(multiShift);
    }

    return { seats: Array.from(seats), shifts: Array.from(shifts), multiShifts: Array.from(multiShifts) };
}

function Metric({ label, value, variant = "cyan" }: {
    label: string;
    value: number | string;
    variant?: "success" | "warning" | "danger" | "default" | "cyan" | "purple";
}) {
    return (
        <div className={pageInsetMetricClass}>
            <div className="flex items-center justify-between gap-2">
                <p className={cn("text-xs", pageMutedTextClass)}>{label}</p>
                <Badge variant={variant}>{String(value)}</Badge>
            </div>
            <p className="mt-2 text-lg font-semibold text-[color:var(--text-primary)]">{String(value)}</p>
        </div>
    );
}

function IssueList({ issues }: { issues: ImportIssue[] }) {
    if (issues.length === 0) {
        return (
            <div className={cn("p-3", pageInsetSurfaceClass)}>
                <div className="flex items-center gap-2 text-sm text-emerald-200">
                    <CheckCircle2 className="h-4 w-4" />
                    Clean
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {issues.map((issue, index) => (
                <div key={`${issue.code}-${index}`} className={cn("p-3", pageInsetSurfaceClass)}>
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={issue.severity === "error" ? "danger" : issue.severity === "warning" ? "warning" : "cyan"}>{issue.severity}</Badge>
                        <p className="text-sm font-semibold text-[color:var(--text-primary)]">{issue.code.replace(/_/g, " ")}</p>
                    </div>
                    <p className={cn("mt-2 text-xs", pageMutedTextClass)}>{issue.message}</p>
                </div>
            ))}
        </div>
    );
}

export default function ImportSessionPage({ params }: { params: Promise<{ branchId: string; sessionId: string }> }) {
    const { branchId, sessionId } = use(params);
    const router = useRouter();
    const [detail, setDetail] = useState<ImportDetail | null>(null);
    const [rowFilter, setRowFilter] = useState<RowFilter>("attention");
    const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [analyzing, setAnalyzing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [commitMode, setCommitMode] = useState<CommitMode>("SAFE_PARTIAL");
    const [preview, setPreview] = useState<ImportPreview | null>(null);
    const [rowDrafts, setRowDrafts] = useState<Record<string, RowDraft>>({});
    const [rowPreview, setRowPreview] = useState<ImportRowDraftPreview | null>(null);
    const [rowPreviewLoading, setRowPreviewLoading] = useState(false);
    const [questionDrafts, setQuestionDrafts] = useState<Record<string, string>>({});
    const [paymentDraft, setPaymentDraft] = useState({ paid: "", unpaid: "", waived: "" });
    const [showAdvancedMapping, setShowAdvancedMapping] = useState(false);
    const analysisStartedRef = useRef(false);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            setDetail(await importSessions.detail<ImportDetail>(branchId, sessionId, {
                rowFilter,
                limit: 150,
            }));
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : "Failed to load import session.");
        } finally {
            setLoading(false);
        }
    }, [branchId, rowFilter, sessionId]);

    useEffect(() => {
        load();
    }, [load]);

    useEffect(() => {
        if (!detail || detail.status !== "UPLOADED" || analysisStartedRef.current) return;
        analysisStartedRef.current = true;
        setAnalyzing(true);
        setError(null);
        importSessions.analyze<ImportDetail>(branchId, sessionId)
            .then(nextDetail => {
                setDetail(nextDetail);
                setPreview(null);
            })
            .catch(analyzeError => {
                setError(analyzeError instanceof Error ? analyzeError.message : "Failed to analyze import session.");
            })
            .finally(() => setAnalyzing(false));
    }, [branchId, detail, sessionId]);

    const mapping = detail?.mapping?.columnMappings ?? [];
    const options = detail?.mapping?.importOptions ?? {};
    const branchContext = detail?.branchContext;
    const rows = useMemo(() => detail?.rows ?? [], [detail?.rows]);
    const questions = detail?.questions ?? [];
    const openQuestions = questions.filter(question => question.status === "OPEN");
    const attention = detail?.mapping?.analysis?.attention ?? detail?.summary?.attention ?? [];
    const aiTrace = detail?.mapping?.analysis?.ai;
    const sourceProfile = detail?.mapping?.analysis?.sourceProfile ?? detail?.summary?.sourceProfile;
    const sourceColumns = useMemo(() => new Map((sourceProfile?.columns ?? []).map(column => [column.column, column])), [sourceProfile]);
    const mappingNeedsReview = mapping.some(item => item.needsReview);
    const latestCommit = detail?.commits?.[0];
    const readiness = detail?.summary?.readinessScore ?? 0;
    const selectedRow = rows.find(row => row.id === selectedRowId) ?? rows[0] ?? null;
    const selectedDraft = selectedRow ? rowDrafts[selectedRow.id] : undefined;
    const selectedNormalized = useMemo(
        () => selectedRow && selectedDraft ? normalizedFromImportDraft(selectedRow, selectedDraft, branchContext) : null,
        [branchContext, selectedDraft, selectedRow]
    );
    const selectedNormalizedKey = useMemo(() => JSON.stringify(selectedNormalized), [selectedNormalized]);
    const missing = useMemo(() => missingRecords(rows, branchContext), [branchContext, rows]);
    const detectedPaymentValues = useMemo(
        () => detail?.mapping?.analysis?.detectedPaymentValues?.length
            ? detail.mapping.analysis.detectedPaymentValues
            : Array.from(new Set(rows.map(row => row.normalizedData?.payment?.rawStatus).filter((value): value is string => Boolean(value)))),
        [detail?.mapping?.analysis?.detectedPaymentValues, rows]
    );
    const missingRecordGroups = useMemo<Array<[keyof ImportOptions, string, string[]]>>(() => [
        ["createUnknownSeats", "Create missing seats", missing.seats],
        ["createUnknownShifts", "Create missing shifts", missing.shifts],
        ["createUnknownMultiShifts", "Create missing bundles", missing.multiShifts],
    ], [missing]);
    const deferAllocationFollowups = Boolean(
        options.skipUnknownSeatAllocations &&
        options.skipUnknownShiftAllocations &&
        options.skipUnknownMultiShiftAllocations &&
        options.skipMissingShiftAllocations &&
        options.skipConflictingAllocations
    );
    const skipPaymentsForNow = options.paymentCycle === "SKIP_PAYMENTS" && options.paymentAction === "SKIP_PAYMENTS";
    const showPaymentWords = options.paymentAction === "IMPORT_PAID_UNPAID";
    const paymentWordDraftHasValues = [paymentDraft.paid, paymentDraft.unpaid, paymentDraft.waived]
        .some(value => splitValues(value).length > 0);
    const previewMatchesMode = preview?.mode === commitMode;
    const rowIssues = selectedRow ? [...selectedRow.issues, ...selectedRow.warnings] : [];
    const liveIssues = rowPreview ? [...rowPreview.issues, ...rowPreview.warnings] : rowIssues;

    useEffect(() => {
        setPaymentDraft({
            paid: joinValues(options.paymentMapping?.paidValues),
            unpaid: joinValues(options.paymentMapping?.unpaidValues),
            waived: joinValues(options.paymentMapping?.waivedValues),
        });
    }, [options.paymentMapping?.paidValues, options.paymentMapping?.unpaidValues, options.paymentMapping?.waivedValues]);

    useEffect(() => {
        if (mappingNeedsReview) setShowAdvancedMapping(true);
    }, [mappingNeedsReview]);

    useEffect(() => {
        if (rows.length === 0) {
            setSelectedRowId(null);
            return;
        }
        if (!selectedRowId || !rows.some(row => row.id === selectedRowId)) {
            setSelectedRowId(rows[0].id);
        }
    }, [rows, selectedRowId]);

    useEffect(() => {
        if (!selectedRow) return;
        setRowDrafts(prev => prev[selectedRow.id] ? prev : { ...prev, [selectedRow.id]: draftFromImportRow(selectedRow) });
    }, [selectedRow]);

    useEffect(() => {
        if (!selectedRow || !selectedNormalized) {
            setRowPreview(null);
            return;
        }
        let alive = true;
        setRowPreview(null);
        setRowPreviewLoading(true);
        const timer = window.setTimeout(() => {
            importSessions.previewRow<ImportRowDraftPreview>(branchId, sessionId, {
                rowId: selectedRow.id,
                normalizedData: selectedNormalized,
            })
                .then(result => {
                    if (alive) setRowPreview(result);
                })
                .catch(previewError => {
                    if (alive) setError(previewError instanceof Error ? previewError.message : "Failed to preview row.");
                })
                .finally(() => {
                    if (alive) setRowPreviewLoading(false);
                });
        }, 250);

        return () => {
            alive = false;
            window.clearTimeout(timer);
        };
    }, [branchId, selectedNormalized, selectedNormalizedKey, selectedRow, sessionId]);

    const saveMapping = async (columnMappings: ImportColumnMapping[], importOptions?: Partial<ImportOptions>) => {
        setSaving(true);
        setError(null);
        try {
            const nextDetail = await importSessions.updateMapping<ImportDetail>(branchId, sessionId, { columnMappings, importOptions });
            setDetail(nextDetail);
            setPreview(null);
        } catch (saveError) {
            setError(saveError instanceof Error ? saveError.message : "Failed to save mapping.");
        } finally {
            setSaving(false);
        }
    };

    const updateOption = async (importOptions: Partial<ImportOptions>) => {
        await saveMapping(mapping, importOptions);
    };

    const updateRowDraft = (rowId: string, field: keyof RowDraft, value: string) => {
        setRowDrafts(prev => {
            const current = prev[rowId];
            if (!current) return prev;
            const shouldAutofillFee = (field === "shift" || field === "multiShift") && feeLooksAutoFilled(current, branchContext);
            const nextDraft = {
                ...current,
                [field]: value,
                ...(field === "shift" ? { multiShift: "" } : {}),
                ...(field === "multiShift" ? { shift: "" } : {}),
            };

            return {
                ...prev,
                [rowId]: {
                    ...nextDraft,
                    ...(shouldAutofillFee ? { fee: feeFromSelection(nextDraft, branchContext) } : {}),
                },
            };
        });
    };

    const resetSelectedDraft = () => {
        if (!selectedRow) return;
        setRowDrafts(prev => ({ ...prev, [selectedRow.id]: draftFromImportRow(selectedRow) }));
    };

    const saveSelectedRow = async () => {
        if (!selectedRow || !selectedDraft) return;
        setSaving(true);
        setError(null);
        try {
            const normalizedData = normalizedFromImportDraft(selectedRow, selectedDraft, branchContext);
            const nextDetail = await importSessions.updateRows<ImportDetail>(branchId, sessionId, {
                edits: [{ rowId: selectedRow.id, normalizedData }],
            });
            setDetail(nextDetail);
            setPreview(null);
            setRowDrafts(prev => {
                const next = { ...prev };
                delete next[selectedRow.id];
                return next;
            });
        } catch (rowError) {
            setError(rowError instanceof Error ? rowError.message : "Failed to save row.");
        } finally {
            setSaving(false);
        }
    };

    const skipSelectedRow = async () => {
        if (!selectedRow) return;
        setSaving(true);
        setError(null);
        try {
            const nextDetail = await importSessions.updateRows<ImportDetail>(
                branchId,
                sessionId,
                selectedRow.skipped ? { unskipRowIds: [selectedRow.id] } : { skipRowIds: [selectedRow.id] }
            );
            setDetail(nextDetail);
            setPreview(null);
        } catch (rowError) {
            setError(rowError instanceof Error ? rowError.message : "Failed to update row.");
        } finally {
            setSaving(false);
        }
    };

    const answerQuestion = async (questionId: string, answer: unknown) => {
        setSaving(true);
        setError(null);
        try {
            const nextDetail = await importSessions.answerQuestion<ImportDetail>(branchId, sessionId, {
                questionId,
                answer,
                applyToAffectedRows: true,
            });
            setDetail(nextDetail);
            setPreview(null);
            setQuestionDrafts(prev => ({ ...prev, [questionId]: "" }));
        } catch (questionError) {
            setError(questionError instanceof Error ? questionError.message : "Failed to answer question.");
        } finally {
            setSaving(false);
        }
    };

    const loadMoreRows = async () => {
        if (!detail?.rowPage?.hasMore || !detail.rowPage.nextCursor) return;
        setSaving(true);
        try {
            const nextPage = await importSessions.detail<ImportDetail>(branchId, sessionId, {
                rowFilter,
                limit: 150,
                cursor: detail.rowPage.nextCursor,
            });
            setDetail(prev => prev ? {
                ...nextPage,
                rows: [...prev.rows, ...nextPage.rows],
            } : nextPage);
        } catch (loadMoreError) {
            setError(loadMoreError instanceof Error ? loadMoreError.message : "Failed to load more rows.");
        } finally {
            setSaving(false);
        }
    };

    const loadPreview = useCallback(async () => {
        setSaving(true);
        setError(null);
        try {
            setPreview(await importSessions.preview<ImportPreview>(branchId, sessionId, commitMode));
        } catch (previewError) {
            setError(previewError instanceof Error ? previewError.message : "Failed to load final review.");
        } finally {
            setSaving(false);
        }
    }, [branchId, commitMode, sessionId]);

    const commit = async () => {
        if (!preview?.planVersion) {
            setError("Refresh final check before importing.");
            return;
        }
        if (preview.mode !== commitMode) {
            setError("Refresh final check for the selected import mode.");
            return;
        }
        setSaving(true);
        try {
            await importSessions.commit(branchId, sessionId, preview.planVersion, commitMode);
            setConfirmOpen(false);
            setPreview(null);
            await load();
        } catch (commitError) {
            setError(commitError instanceof Error ? commitError.message : "Import failed.");
        } finally {
            setSaving(false);
        }
    };

    if (!detail && loading) {
        return (
            <BranchAccessGuard branchId={branchId} permission="students">
                <PageShell>
                    <div className="flex items-center gap-2 text-sm text-[color:var(--text-secondary)]">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading import session...
                    </div>
                </PageShell>
            </BranchAccessGuard>
        );
    }

    return (
        <BranchAccessGuard branchId={branchId} permission="students">
            <PageShell>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <p className={pageEyebrowClass}>Data import</p>
                        <h1 className={pageTitleClass}>Import review</h1>
                        <p className={pageDescriptionClass}>{detail?.fileName ?? "Review staged records before import."}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        {detail?.status && <Badge variant={statusVariant(detail.status)}>{statusLabels[detail.status] ?? detail.status.replace(/_/g, " ")}</Badge>}
                        <AppButton variant="quiet" icon={ArrowLeft} onClick={() => router.push(`/branch/${branchId}/onboarding/import`)}>
                            Back
                        </AppButton>
                    </div>
                </div>

                {error && (
                    <div className="rounded-[8px] border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">
                        {error}
                    </div>
                )}

                {analyzing && (
                    <div className="flex items-center gap-3 rounded-[8px] border border-[color:var(--ui-badge-cyan-border)] bg-[color:var(--ui-badge-cyan-bg)] p-3 text-sm text-[color:var(--ui-badge-cyan-text)]">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Analyzing source data...
                    </div>
                )}

                {detail && (
                    <>
                        {latestCommit && (
                            <AppPanel title="Import result" description="Last commit report.">
                                <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
                                    {Object.entries(latestCommit.summary ?? {}).map(([label, value]) => (
                                        <Metric key={label} label={label} value={String(value)} variant="success" />
                                    ))}
                                </div>
                            </AppPanel>
                        )}

                        <AppPanel contentClassName="space-y-4">
                            <div className="grid gap-3 md:grid-cols-5">
                                <Metric label="Readiness" value={`${readiness}%`} variant={readiness >= 80 ? "success" : readiness >= 50 ? "warning" : "danger"} />
                                <Metric label="Ready" value={detail.summary?.readyRows ?? 0} variant="success" />
                                <Metric label="Review" value={(detail.summary?.needsReviewRows ?? 0) + (detail.summary?.duplicateRows ?? 0)} variant={metricVariant((detail.summary?.needsReviewRows ?? 0) + (detail.summary?.duplicateRows ?? 0), true)} />
                                <Metric label="Blocked" value={(detail.summary?.blockedRows ?? 0) + (detail.summary?.conflictRows ?? 0)} variant={metricVariant((detail.summary?.blockedRows ?? 0) + (detail.summary?.conflictRows ?? 0), true)} />
                                <Metric label="Questions" value={openQuestions.length} variant={metricVariant(openQuestions.length, true)} />
                            </div>
                            <div className={pageProgressTrackClass}>
                                <div className="h-full rounded-full bg-cyan-300 transition-all" style={{ width: `${Math.max(0, Math.min(100, readiness))}%` }} />
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                {aiTrace && <Badge variant={aiVariant(aiTrace.status)}>AI {aiTrace.status.replace(/_/g, " ")}</Badge>}
                                {detail.mapping?.usedFallback && <Badge variant="warning">Fallback mapping</Badge>}
                                {attention.slice(0, 5).map(item => (
                                    <Badge key={item.code} variant={item.severity === "error" ? "danger" : item.severity === "warning" ? "warning" : "cyan"}>
                                        {item.label}: {item.count}
                                    </Badge>
                                ))}
                            </div>
                        </AppPanel>

                        <div className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)_360px]">
                            <AppPanel
                                title="Rows"
                                description={detail.rowPage ? `${detail.rowPage.returnedRows} of ${detail.rowPage.filteredRows}` : "Staged rows"}
                                action={
                                    <select value={rowFilter} onChange={event => setRowFilter(event.target.value as RowFilter)} className={cn("h-8 px-2 py-0 text-xs", importSelectClass)}>
                                        {(["attention", "ready", "all", "skipped"] as RowFilter[]).map(filter => (
                                            <option key={filter} value={filter} className={importOptionClass}>{rowFilterLabels[filter]}</option>
                                        ))}
                                    </select>
                                }
                                contentClassName="p-0"
                            >
                                <div className="max-h-[760px] overflow-y-auto p-2">
                                    {rows.length === 0 && <p className={cn("p-3 text-sm", pageMutedTextClass)}>No rows in this filter.</p>}
                                    {rows.map(row => {
                                        const issues = [...row.issues, ...row.warnings];
                                        const selected = selectedRow?.id === row.id;
                                        return (
                                            <button
                                                key={row.id}
                                                type="button"
                                                onClick={() => setSelectedRowId(row.id)}
                                                className={cn(
                                                    "mb-2 w-full rounded-[8px] border p-3 text-left transition-colors hover:bg-white/[0.04]",
                                                    selected
                                                        ? "border-[color:var(--ui-badge-cyan-border)] bg-[color:var(--ui-badge-cyan-bg)]"
                                                        : "border-[color:var(--ui-form-surface-border)] bg-[color:var(--ui-form-muted-surface-bg)]"
                                                )}
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="min-w-0">
                                                        <p className="truncate text-sm font-semibold text-[color:var(--text-primary)]">
                                                            Row {row.rowNumber}: {fieldValue(row, "studentName") || "No name"}
                                                        </p>
                                                        <p className={cn("mt-1 truncate text-xs", pageMutedTextClass)}>
                                                            {[fieldValue(row, "seat"), fieldValue(row, "multiShift") || fieldValue(row, "shift")].filter(Boolean).join(" / ") || "No seat or shift"}
                                                        </p>
                                                    </div>
                                                    <Badge variant={statusVariant(row.status)}>{statusLabels[row.status] ?? row.status}</Badge>
                                                </div>
                                                <div className="mt-2 flex flex-wrap gap-1.5">
                                                    {manualRow(row) && <Badge variant="purple">manual</Badge>}
                                                    {issues[0] && <Badge variant={issues[0].severity === "error" ? "danger" : issues[0].severity === "warning" ? "warning" : "cyan"}>{issues[0].code.replace(/_/g, " ")}</Badge>}
                                                </div>
                                            </button>
                                        );
                                    })}
                                    {detail.rowPage?.hasMore && (
                                        <AppButton className="mt-2 w-full" size="sm" variant="secondary" onClick={loadMoreRows} isLoading={saving}>
                                            Load more rows
                                        </AppButton>
                                    )}
                                </div>
                            </AppPanel>

                            <div className="space-y-5">
                                <AppPanel
                                    title={selectedRow ? `Row ${selectedRow.rowNumber}` : "Selected row"}
                                    description={selectedRow ? (fieldValue(selectedRow, "studentName") || "No student name") : "No row selected"}
                                    action={selectedRow && (
                                        <div className="flex flex-wrap gap-2">
                                            <AppButton size="sm" variant="primary" icon={Save} onClick={saveSelectedRow} isLoading={saving}>
                                                Save
                                            </AppButton>
                                            <AppButton size="sm" variant="quiet" icon={RotateCcw} onClick={resetSelectedDraft} disabled={saving}>
                                                Reset
                                            </AppButton>
                                        </div>
                                    )}
                                >
                                    {!selectedRow || !selectedDraft ? (
                                        <p className={pageMutedTextClass}>Select a row.</p>
                                    ) : (
                                        <div className="space-y-5">
                                            <div className="grid gap-4 lg:grid-cols-2">
                                                <label className="space-y-2">
                                                    <span className={pickerSectionLabelClass}>Student name</span>
                                                    <input value={selectedDraft.studentName} onChange={event => updateRowDraft(selectedRow.id, "studentName", event.target.value)} className={cn("w-full", importFieldClass)} />
                                                </label>
                                                <label className="space-y-2">
                                                    <span className={pickerSectionLabelClass}>Phone</span>
                                                    <input value={selectedDraft.phone} onChange={event => updateRowDraft(selectedRow.id, "phone", event.target.value)} className={cn("w-full", importFieldClass)} />
                                                </label>
                                                <label className="space-y-2">
                                                    <span className={pickerSectionLabelClass}>Joined date</span>
                                                    <input type="date" value={selectedDraft.joinedAt} onChange={event => updateRowDraft(selectedRow.id, "joinedAt", event.target.value)} className={cn("w-full", importFieldClass)} />
                                                </label>
                                                <label className="space-y-2">
                                                    <span className={pickerSectionLabelClass}>Monthly fee</span>
                                                    <input value={selectedDraft.fee} onChange={event => updateRowDraft(selectedRow.id, "fee", event.target.value)} className={cn("w-full", importFieldClass)} />
                                                </label>
                                            </div>

                                            <div className="grid gap-4 lg:grid-cols-3">
                                                <label className="space-y-2">
                                                    <span className={pickerSectionLabelClass}>Seat</span>
                                                    <input list="import-seats" value={selectedDraft.seat} onChange={event => updateRowDraft(selectedRow.id, "seat", event.target.value)} className={cn("w-full", importFieldClass)} />
                                                    <datalist id="import-seats">
                                                        {(branchContext?.seats ?? []).map(seat => <option key={seat.id} value={seat.label} />)}
                                                    </datalist>
                                                </label>
                                                <label className="space-y-2">
                                                    <span className={pickerSectionLabelClass}>Shift</span>
                                                    <select value={selectedDraft.shift} onChange={event => updateRowDraft(selectedRow.id, "shift", event.target.value)} className={cn("w-full", importSelectClass)}>
                                                        <option value="" className={importOptionClass}>No shift</option>
                                                        {(branchContext?.shifts ?? []).map(shift => (
                                                            <option key={shift.id} value={shift.name} className={importOptionClass}>{shift.name} - Fee {formatAmount(shift.price)}</option>
                                                        ))}
                                                    </select>
                                                </label>
                                                <label className="space-y-2">
                                                    <span className={pickerSectionLabelClass}>Bundle</span>
                                                    <select value={selectedDraft.multiShift} onChange={event => updateRowDraft(selectedRow.id, "multiShift", event.target.value)} className={cn("w-full", importSelectClass)}>
                                                        <option value="" className={importOptionClass}>No bundle</option>
                                                        {(branchContext?.multiShifts ?? []).map(multiShift => (
                                                            <option key={multiShift.id} value={multiShift.name} className={importOptionClass}>{multiShift.name} - Fee {formatAmount(multiShift.price)}</option>
                                                        ))}
                                                    </select>
                                                </label>
                                            </div>

                                            <div className="grid gap-4 lg:grid-cols-4">
                                                <label className="space-y-2">
                                                    <span className={pickerSectionLabelClass}>Payment amount</span>
                                                    <input value={selectedDraft.paymentAmount} onChange={event => updateRowDraft(selectedRow.id, "paymentAmount", event.target.value)} className={cn("w-full", importFieldClass)} />
                                                </label>
                                                <label className="space-y-2">
                                                    <span className={pickerSectionLabelClass}>Payment status</span>
                                                    <select value={selectedDraft.paymentStatus} onChange={event => updateRowDraft(selectedRow.id, "paymentStatus", event.target.value)} className={cn("w-full", importSelectClass)}>
                                                        <option value="" className={importOptionClass}>No row status</option>
                                                        <option value="DUE" className={importOptionClass}>Due</option>
                                                        <option value="PAID" className={importOptionClass}>Paid</option>
                                                        <option value="WAIVED" className={importOptionClass}>Waived</option>
                                                    </select>
                                                </label>
                                                <label className="space-y-2">
                                                    <span className={pickerSectionLabelClass}>Method</span>
                                                    <select value={selectedDraft.paymentMethod} onChange={event => updateRowDraft(selectedRow.id, "paymentMethod", event.target.value)} className={cn("w-full", importSelectClass)}>
                                                        <option value="" className={importOptionClass}>No method</option>
                                                        <option value="CASH" className={importOptionClass}>Cash</option>
                                                        <option value="UPI" className={importOptionClass}>UPI</option>
                                                        <option value="BANK_TRANSFER" className={importOptionClass}>Bank transfer</option>
                                                    </select>
                                                </label>
                                                <label className="space-y-2">
                                                    <span className={pickerSectionLabelClass}>Reference</span>
                                                    <input value={selectedDraft.referenceId} onChange={event => updateRowDraft(selectedRow.id, "referenceId", event.target.value)} className={cn("w-full", importFieldClass)} />
                                                </label>
                                            </div>

                                            <div className="flex flex-wrap items-center gap-3 border-t border-[color:var(--ui-form-section-divider)] pt-4">
                                                <AppButton variant="primary" icon={Save} onClick={saveSelectedRow} isLoading={saving}>Save row</AppButton>
                                                <AppButton variant="secondary" icon={Pencil} onClick={skipSelectedRow} isLoading={saving}>
                                                    {selectedRow.skipped ? "Unskip row" : "Skip row"}
                                                </AppButton>
                                            </div>
                                        </div>
                                    )}
                                </AppPanel>

                                <AppPanel
                                    title="Live checks"
                                    description={rowPreview?.paymentPreview.message ?? "Selected row validation"}
                                    action={rowPreviewLoading ? <Loader2 className="h-4 w-4 animate-spin text-[color:var(--text-muted)]" /> : rowPreview ? <Badge variant={statusVariant(rowPreview.status)}>{statusLabels[rowPreview.status] ?? rowPreview.status}</Badge> : undefined}
                                >
                                    <IssueList issues={liveIssues} />
                                </AppPanel>

                                <AppPanel
                                    title="Column mapping"
                                    description={mappingNeedsReview ? "Review suggested fields." : `${mapping.length} columns mapped.`}
                                    action={
                                        <AppButton size="sm" variant="quiet" onClick={() => setShowAdvancedMapping(value => !value)} disabled={saving}>
                                            {showAdvancedMapping ? "Hide" : "Show"}
                                        </AppButton>
                                    }
                                >
                                    {!showAdvancedMapping ? (
                                        <div className="flex flex-wrap gap-2">
                                            {mapping.slice(0, 8).map(item => (
                                                <Badge
                                                    key={item.sourceColumn}
                                                    variant={item.needsReview ? "warning" : item.targetField === "ignore" ? "default" : "success"}
                                                    className="max-w-full truncate normal-case"
                                                >
                                                    {item.sourceColumn} {"->"} {item.targetField}
                                                </Badge>
                                            ))}
                                            {mapping.length > 8 && <Badge variant="default">+{mapping.length - 8}</Badge>}
                                        </div>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full min-w-[820px] text-left text-sm">
                                                <thead className={cn("text-xs uppercase text-[color:var(--text-muted)]", pageTableHeadClass)}>
                                                    <tr>
                                                        <th className="p-3">Uploaded column</th>
                                                        <th className="p-3">Target field</th>
                                                        <th className="p-3">Confidence</th>
                                                        <th className="p-3">Samples</th>
                                                    </tr>
                                                </thead>
                                                <tbody className={pageTableBodyDividerClass}>
                                                    {mapping.map((item, index) => {
                                                        const profile = sourceColumns.get(item.sourceColumn);
                                                        return (
                                                            <tr key={item.sourceColumn} className={pageTableRowClass}>
                                                                <td className="p-3 font-medium text-[color:var(--text-primary)]">
                                                                    <div className="flex flex-wrap items-center gap-2">
                                                                        {item.sourceColumn}
                                                                        {item.needsReview && <Badge variant="warning">review</Badge>}
                                                                        {item.autoApplied && <Badge variant="success">auto</Badge>}
                                                                    </div>
                                                                </td>
                                                                <td className="p-3">
                                                                    <select
                                                                        value={item.targetField}
                                                                        disabled={saving}
                                                                        onChange={(event) => {
                                                                            const next = [...mapping];
                                                                            next[index] = {
                                                                                ...item,
                                                                                targetField: event.target.value as ImportColumnMapping["targetField"],
                                                                                confidence: 100,
                                                                                reason: "Manually selected.",
                                                                                source: "MANUAL",
                                                                                autoApplied: event.target.value !== "ignore",
                                                                                needsReview: false,
                                                                            };
                                                                            saveMapping(next);
                                                                        }}
                                                                        className={cn("w-full", importSelectClass)}
                                                                    >
                                                                        {IMPORT_TARGET_FIELDS.map(field => <option key={field} value={field} className={importOptionClass}>{field}</option>)}
                                                                    </select>
                                                                </td>
                                                                <td className="p-3">
                                                                    <Badge variant={item.needsReview ? "warning" : item.targetField === "ignore" ? "default" : "success"}>{item.confidence}%</Badge>
                                                                </td>
                                                                <td className={cn("max-w-xs truncate p-3", pageMutedTextClass)}>
                                                                    {profile?.sampleValues.join(" | ") || item.reason || "No samples"}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </AppPanel>
                            </div>

                            <div className="space-y-5">
                                <AppPanel title="Import setup" description="Branch records and decisions.">
                                    <div className="space-y-4">
                                        <label className={cn("flex items-start gap-3 p-3", pageInsetSurfaceClass)}>
                                            <input
                                                type="checkbox"
                                                checked={deferAllocationFollowups}
                                                disabled={saving}
                                                onChange={event => updateOption({
                                                    createUnknownSeats: event.target.checked ? false : options.createUnknownSeats,
                                                    createUnknownShifts: event.target.checked ? false : options.createUnknownShifts,
                                                    createUnknownMultiShifts: event.target.checked ? false : options.createUnknownMultiShifts,
                                                    skipUnknownSeatAllocations: event.target.checked,
                                                    skipUnknownShiftAllocations: event.target.checked,
                                                    skipUnknownMultiShiftAllocations: event.target.checked,
                                                    skipMissingShiftAllocations: event.target.checked,
                                                    skipConflictingAllocations: event.target.checked,
                                                })}
                                                className="mt-0.5 h-4 w-4 rounded border-[color:var(--ui-form-field-border)] bg-[color:var(--ui-form-field-bg)]"
                                            />
                                            <span className="min-w-0">
                                                <span className="block text-sm font-semibold text-[color:var(--text-primary)]">Defer unclear allocation links</span>
                                                <span className={cn("mt-1 block text-xs", pageMutedTextClass)}>Import students first; assign seats and shifts later.</span>
                                            </span>
                                        </label>
                                        {missingRecordGroups.map(([key, label, list]) => (
                                            <div key={key} className={cn("p-3", pageInsetSurfaceClass)}>
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-semibold text-[color:var(--text-primary)]">{label}</p>
                                                        <p className={cn("mt-1 truncate text-xs", pageMutedTextClass)}>
                                                            {list.length ? list.slice(0, 4).join(", ") : "None"}
                                                        </p>
                                                    </div>
                                                    <Badge variant={list.length ? "warning" : "success"}>{list.length}</Badge>
                                                </div>
                                                <label className="mt-3 flex items-center gap-2 text-sm text-[color:var(--text-secondary)]">
                                                    <input
                                                        type="checkbox"
                                                        checked={Boolean(options[key])}
                                                        disabled={deferAllocationFollowups || list.length === 0 || saving}
                                                        onChange={event => updateOption({ [key]: event.target.checked } as Partial<ImportOptions>)}
                                                        className="h-4 w-4 rounded border-[color:var(--ui-form-field-border)] bg-[color:var(--ui-form-field-bg)]"
                                                    />
                                                    <span>Create during import</span>
                                                </label>
                                            </div>
                                        ))}
                                    </div>
                                </AppPanel>

                                <AppPanel title="Decisions" description={`${openQuestions.length} open`}>
                                    <div className="space-y-3">
                                        {questions.length === 0 && <p className={pageMutedTextClass}>No decisions.</p>}
                                        {questions.map(question => (
                                            <div key={question.id} className={cn("p-3", pageInsetSurfaceClass)}>
                                                <div className="flex items-start gap-3">
                                                    {question.status === "OPEN" ? <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />}
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <p className="font-medium text-[color:var(--text-primary)]">{question.question}</p>
                                                            <Badge variant={question.status === "OPEN" ? "warning" : "success"}>{question.status}</Badge>
                                                        </div>
                                                        {question.field && <p className={cn("mt-1 text-xs", pageMutedTextClass)}>{question.field}</p>}
                                                        {question.status === "OPEN" && (
                                                            <>
                                                                <div className="mt-3 flex flex-wrap gap-2">
                                                                    {(question.options ?? []).map(option => (
                                                                        <AppButton key={option} size="sm" variant="secondary" onClick={() => answerQuestion(question.id, option)} isLoading={saving}>
                                                                            {optionLabel(option)}
                                                                        </AppButton>
                                                                    ))}
                                                                </div>
                                                                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                                                                    <input
                                                                        value={questionDrafts[question.id] ?? ""}
                                                                        onChange={event => setQuestionDrafts(prev => ({ ...prev, [question.id]: event.target.value }))}
                                                                        className={cn("min-w-0 flex-1", importFieldClass)}
                                                                    />
                                                                    <AppButton
                                                                        variant="primary"
                                                                        size="sm"
                                                                        icon={Save}
                                                                        disabled={!questionDrafts[question.id]?.trim()}
                                                                        onClick={() => answerQuestion(question.id, questionDrafts[question.id])}
                                                                        isLoading={saving}
                                                                    >
                                                                        Answer
                                                                    </AppButton>
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </AppPanel>

                                <AppPanel title="Payments" description="Cycle and paid status import.">
                                    <div className="space-y-4">
                                        <div className={cn("flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between", pageInsetSurfaceClass)}>
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold text-[color:var(--text-primary)]">Student records only</p>
                                                <p className={cn("mt-1 text-xs", pageMutedTextClass)}>Import now; handle dues and paid status later.</p>
                                            </div>
                                            <AppButton
                                                size="sm"
                                                variant={skipPaymentsForNow ? "secondary" : "primary"}
                                                icon={CheckCircle2}
                                                onClick={() => updateOption({ paymentCycle: "SKIP_PAYMENTS", paymentAction: "SKIP_PAYMENTS" })}
                                                disabled={skipPaymentsForNow || saving}
                                                isLoading={saving && !skipPaymentsForNow}
                                            >
                                                {skipPaymentsForNow ? "Payments skipped" : "Skip payments"}
                                            </AppButton>
                                        </div>
                                        <label className="space-y-2">
                                            <span className={pickerSectionLabelClass}>Payment cycle</span>
                                            <select value={options.paymentCycle ?? ""} onChange={(event) => updateOption({ paymentCycle: event.target.value as ImportOptions["paymentCycle"] })} className={cn("w-full", importSelectClass)}>
                                                <option value="" className={importOptionClass}>Choose cycle</option>
                                                <option value="CURRENT_MONTH" className={importOptionClass}>Current month</option>
                                                <option value="PREVIOUS_MONTH" className={importOptionClass}>Previous month</option>
                                                <option value="CUSTOM_PERIOD" className={importOptionClass}>Custom period</option>
                                                <option value="USE_JOINED_AT_ANNIVERSARY" className={importOptionClass}>Joined date cycle</option>
                                                <option value="SKIP_PAYMENTS" className={importOptionClass}>Skip payments</option>
                                            </select>
                                        </label>
                                        <label className="space-y-2">
                                            <span className={pickerSectionLabelClass}>After student import</span>
                                            <select value={options.paymentAction ?? ""} onChange={(event) => updateOption({ paymentAction: event.target.value as ImportOptions["paymentAction"] })} className={cn("w-full", importSelectClass)}>
                                                <option value="" className={importOptionClass}>Choose action</option>
                                                <option value="GENERATE_DUE" className={importOptionClass}>Generate due payments</option>
                                                <option value="IMPORT_PAID_UNPAID" className={importOptionClass}>Import paid/unpaid status</option>
                                                <option value="SKIP_PAYMENTS" className={importOptionClass}>Skip payments</option>
                                            </select>
                                        </label>
                                        {options.paymentCycle === "CUSTOM_PERIOD" && (
                                            <div className="grid gap-3 sm:grid-cols-2">
                                                <input type="date" value={options.customPeriodStart?.slice(0, 10) ?? ""} onChange={event => updateOption({ customPeriodStart: event.target.value })} className={cn("w-full", importFieldClass)} />
                                                <input type="date" value={options.customPeriodEnd?.slice(0, 10) ?? ""} onChange={event => updateOption({ customPeriodEnd: event.target.value })} className={cn("w-full", importFieldClass)} />
                                            </div>
                                        )}
                                        {showPaymentWords ? (
                                            <div className="space-y-3">
                                                <p className={pickerGroupLabelClass}>Paid/unpaid words</p>
                                                <input value={paymentDraft.paid} onChange={event => setPaymentDraft(prev => ({ ...prev, paid: event.target.value }))} className={cn("w-full", importFieldClass)} placeholder="Paid values" />
                                                <input value={paymentDraft.unpaid} onChange={event => setPaymentDraft(prev => ({ ...prev, unpaid: event.target.value }))} className={cn("w-full", importFieldClass)} placeholder="Unpaid values" />
                                                <input value={paymentDraft.waived} onChange={event => setPaymentDraft(prev => ({ ...prev, waived: event.target.value }))} className={cn("w-full", importFieldClass)} placeholder="Waived values" />
                                                <AppButton
                                                    variant="primary"
                                                    icon={CheckCircle2}
                                                    disabled={!paymentWordDraftHasValues || saving}
                                                    onClick={() => updateOption({
                                                        paymentMapping: {
                                                            paidValues: splitValues(paymentDraft.paid),
                                                            unpaidValues: splitValues(paymentDraft.unpaid),
                                                            waivedValues: splitValues(paymentDraft.waived),
                                                            unclearValues: detectedPaymentValues,
                                                            confirmed: true,
                                                            defaultMethod: options.paymentMapping?.defaultMethod,
                                                        },
                                                    })}
                                                    isLoading={saving}
                                                >
                                                    Confirm words
                                                </AppButton>
                                                <div className="flex flex-wrap gap-2">
                                                    <Badge variant={options.paymentMapping?.confirmed ? "success" : "warning"}>{options.paymentMapping?.confirmed ? "Confirmed" : "Needs confirmation"}</Badge>
                                                    {detectedPaymentValues.slice(0, 8).map(value => <Badge key={value} variant="warning">{value}</Badge>)}
                                                </div>
                                            </div>
                                        ) : detectedPaymentValues.length > 0 && !skipPaymentsForNow ? (
                                            <div className="flex flex-wrap gap-2">
                                                {detectedPaymentValues.slice(0, 8).map(value => <Badge key={value} variant="default">{value}</Badge>)}
                                            </div>
                                        ) : null}
                                    </div>
                                </AppPanel>

                                <AppPanel title="Final check" description={preview?.planVersion ? `Plan ${preview.planVersion}` : "Refresh before import."}>
                                    <div className="space-y-4">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <select
                                                value={commitMode}
                                                onChange={(event) => {
                                                    setCommitMode(event.target.value as CommitMode);
                                                    setPreview(null);
                                                }}
                                                className={cn("h-10 px-3 py-0", importSelectClass)}
                                            >
                                                <option value="SAFE_PARTIAL" className={importOptionClass}>Safe partial</option>
                                                <option value="STRICT_ALL_OR_NOTHING" className={importOptionClass}>Strict all or nothing</option>
                                            </select>
                                            <AppButton variant="secondary" icon={RotateCcw} onClick={loadPreview} isLoading={saving}>
                                                Refresh
                                            </AppButton>
                                        </div>

                                        {!preview ? (
                                            <p className={pageMutedTextClass}>No final check yet.</p>
                                        ) : (
                                            <>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <Badge variant={preview.canCommit ? "success" : "danger"}>{preview.canCommit ? "Ready" : "Blocked"}</Badge>
                                                    <span className={cn("text-xs", pageSubtleTextClass)}>{new Date(preview.generatedAt).toLocaleString()}</span>
                                                </div>
                                                <div className="grid gap-2 sm:grid-cols-2">
                                                    {Object.entries(preview.summary).map(([label, value]) => (
                                                        <div key={label} className={cn("p-2", pageInsetSurfaceClass)}>
                                                            <p className={cn("text-xs", pageMutedTextClass)}>{previewSummaryLabels[label as keyof ImportPreview["summary"]] ?? label}</p>
                                                            <p className="mt-1 text-base font-semibold text-[color:var(--text-primary)]">{String(value)}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="space-y-2">
                                                    {preview.checks.map(check => (
                                                        <div key={check.code} className={cn("p-2", pageInsetSurfaceClass)}>
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <Badge variant={planCheckVariant(check.status)}>{check.status}</Badge>
                                                                <p className="text-xs font-semibold text-[color:var(--text-primary)]">{check.label}</p>
                                                                {typeof check.count === "number" && <span className={pageCountBadgeClass}>{check.count}</span>}
                                                            </div>
                                                            <p className={cn("mt-1 text-xs", pageMutedTextClass)}>{check.message}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </>
                                        )}

                                        <AppButton variant="primary" icon={UploadCloud} onClick={() => setConfirmOpen(true)} disabled={!preview?.canCommit || !previewMatchesMode} isLoading={saving}>
                                            Confirm and import
                                        </AppButton>
                                    </div>
                                </AppPanel>
                            </div>
                        </div>
                    </>
                )}

                <ConfirmDialog
                    isOpen={confirmOpen}
                    onClose={() => setConfirmOpen(false)}
                    onConfirm={commit}
                    loading={saving}
                    variant="warning"
                    title="Confirm final import"
                    description="This creates business records from the refreshed final plan."
                    confirmText="Confirm and import"
                />
            </PageShell>
        </BranchAccessGuard>
    );
}
