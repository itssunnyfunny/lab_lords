"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
    AlertTriangle,
    ArrowLeft,
    CheckCircle2,
    Circle,
    CircleAlert,
    HelpCircle,
    Loader2,
    Pencil,
    RotateCcw,
    Save,
    SlidersHorizontal,
    UploadCloud,
    XCircle,
} from "lucide-react";
import { BranchAccessGuard } from "@/components/auth/BranchAccessGuard";
import { AppButton, AppPanel, PageShell } from "@/components/ui";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
    IMPORT_TARGET_FIELDS,
    type ImportBranchContext,
    type CommitMode,
    type ImportAttentionBucket,
    type ImportColumnMapping,
    type ImportIssue,
    type ImportNormalizedRow,
    type ImportOptions,
    type ImportPipelineStep,
    type ImportSourceProfile,
} from "@/importing/contracts/import-session.contract";
import type { ImportPreview } from "@/importing/contracts/import-preview.contract";
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
    pageTableShellClass,
    pageTitleClass,
} from "@/components/ui/pageSurface";

type Tab = "attention" | "mapping" | "rows" | "payments" | "questions" | "preview";
type RowFilter = "attention" | "ready" | "all" | "skipped";

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

type RowDraft = {
    studentName: string;
    phone: string;
    joinedAt: string;
    fee: string;
    seat: string;
    shift: string;
    multiShift: string;
    paymentAmount: string;
    paymentStatus: string;
    paymentMethod: string;
    referenceId: string;
};

type PaymentStatusDraft = NonNullable<ImportNormalizedRow["payment"]>["status"];
type PaymentMethodDraft = NonNullable<ImportNormalizedRow["payment"]>["method"];

const tabs: { id: Tab; label: string }[] = [
    { id: "attention", label: "Attention" },
    { id: "mapping", label: "Column meanings" },
    { id: "rows", label: "Fix rows" },
    { id: "payments", label: "Payments" },
    { id: "questions", label: "Decisions" },
    { id: "preview", label: "Final check" },
];

const importFieldClass =
    "rounded-[8px] border border-[color:var(--ui-form-field-border)] bg-[color:var(--ui-form-field-bg)] p-2 text-sm text-[color:var(--text-primary)] outline-none transition-colors placeholder:text-[color:var(--text-muted)] focus:border-[color:var(--ui-form-input-focus-border)] focus:ring-2 focus:ring-[color:var(--ui-form-input-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60";
const importSelectClass = `${importFieldClass} [color-scheme:dark]`;
const importOptionClass = "bg-[color:var(--ui-form-input-select-bg)] text-[color:var(--ui-form-input-text)]";

const statusLabels: Record<string, string> = {
    READY: "Ready",
    NEEDS_REVIEW: "Needs review",
    WARNING: "Warning",
    BLOCKED: "Blocked",
    DUPLICATE: "Possible duplicate",
    CONFLICT: "Conflict",
    SKIPPED: "Skipped",
    IMPORTED: "Imported",
    FAILED: "Failed",
};

function statusVariant(status: string): "success" | "warning" | "danger" | "default" | "cyan" {
    if (status === "READY" || status === "IMPORTED") return "success";
    if (status === "WARNING" || status === "NEEDS_REVIEW" || status === "DUPLICATE") return "warning";
    if (status === "BLOCKED" || status === "CONFLICT" || status === "FAILED") return "danger";
    if (status === "SKIPPED") return "default";
    return "cyan";
}

function attentionVariant(severity: ImportAttentionBucket["severity"]): "danger" | "warning" | "cyan" {
    if (severity === "error") return "danger";
    if (severity === "warning") return "warning";
    return "cyan";
}

function aiVariant(status?: string): "success" | "warning" | "danger" | "cyan" {
    if (status === "success") return "success";
    if (status === "error" || status === "invalid_response") return "danger";
    if (status === "fallback" || status === "unavailable") return "warning";
    return "cyan";
}

function manualRow(row: ImportRow) {
    return row.mappedData?.__manualNormalizedData === true;
}

function stepIcon(step: ImportPipelineStep) {
    if (step.status === "completed") return CheckCircle2;
    if (step.status === "failed") return XCircle;
    if (step.status === "needs_attention") return CircleAlert;
    return Circle;
}

function fieldValue(row: ImportRow, field: keyof RowDraft) {
    const data = row.normalizedData;
    if (!data) return "";
    if (field === "studentName") return data.student?.name ?? "";
    if (field === "phone") return data.student?.phone ?? "";
    if (field === "joinedAt") return data.student?.joinedAt?.slice(0, 10) ?? "";
    if (field === "fee") return data.student?.monthlyFee?.toString() ?? "";
    if (field === "seat") return data.allocation?.seatLabel ?? data.seat?.label ?? "";
    if (field === "shift") return data.allocation?.shiftName ?? data.shift?.name ?? "";
    if (field === "multiShift") return data.allocation?.multiShiftName ?? data.multiShift?.name ?? "";
    if (field === "paymentAmount") return data.payment?.amount?.toString() ?? "";
    if (field === "paymentStatus") return data.payment?.status ?? data.payment?.rawStatus ?? "";
    if (field === "paymentMethod") return data.payment?.method ?? "";
    if (field === "referenceId") return data.payment?.referenceId ?? "";
    return "";
}

function draftFromRow(row: ImportRow): RowDraft {
    return {
        studentName: fieldValue(row, "studentName"),
        phone: fieldValue(row, "phone"),
        joinedAt: fieldValue(row, "joinedAt"),
        fee: fieldValue(row, "fee"),
        seat: fieldValue(row, "seat"),
        shift: fieldValue(row, "shift"),
        multiShift: fieldValue(row, "multiShift"),
        paymentAmount: fieldValue(row, "paymentAmount"),
        paymentStatus: fieldValue(row, "paymentStatus"),
        paymentMethod: fieldValue(row, "paymentMethod"),
        referenceId: fieldValue(row, "referenceId"),
    };
}

function dateToIso(value: string) {
    if (!value.trim()) return undefined;
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
}

function numberFromDraft(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const parsed = Number(trimmed.replace(/[^\d.]/g, ""));
    return Number.isFinite(parsed) ? Math.round(parsed) : undefined;
}

function importNameKey(value: string | undefined | null) {
    return (value ?? "").trim().toLocaleLowerCase("en-IN");
}

function findShift(context: ImportBranchContext | undefined, name: string) {
    const target = importNameKey(name);
    return context?.shifts.find(shift => importNameKey(shift.name) === target);
}

function findMultiShift(context: ImportBranchContext | undefined, name: string) {
    const target = importNameKey(name);
    return context?.multiShifts.find(multiShift => importNameKey(multiShift.name) === target);
}

function feeLooksAutoFilled(draft: RowDraft, context: ImportBranchContext | undefined) {
    const fee = numberFromDraft(draft.fee);
    if (fee === undefined) return true;
    const shift = findShift(context, draft.shift);
    const multiShift = findMultiShift(context, draft.multiShift);
    return fee === shift?.price || fee === multiShift?.price || fee === (context?.defaultFee ?? 0);
}

function feeFromSelection(draft: RowDraft, context: ImportBranchContext | undefined) {
    const multiShift = findMultiShift(context, draft.multiShift);
    if (multiShift) return multiShift.price.toString();
    const shift = findShift(context, draft.shift);
    if (shift) return shift.price.toString();
    return draft.fee;
}

function normalizedFromDraft(row: ImportRow, draft: RowDraft, context?: ImportBranchContext): ImportNormalizedRow {
    const next: ImportNormalizedRow = JSON.parse(JSON.stringify(row.normalizedData ?? {}));
    const studentName = draft.studentName.trim();
    const phone = draft.phone.trim();
    const joinedAt = dateToIso(draft.joinedAt);
    const monthlyFee = numberFromDraft(draft.fee);
    const seat = draft.seat.trim();
    const shift = draft.shift.trim();
    const multiShift = draft.multiShift.trim();
    const paymentAmount = numberFromDraft(draft.paymentAmount);
    const paymentStatus = draft.paymentStatus.trim();
    const paymentMethod = draft.paymentMethod.trim();
    const referenceId = draft.referenceId.trim();
    const shiftContext = findShift(context, shift);
    const multiShiftContext = findMultiShift(context, multiShift);
    const feeSource =
        monthlyFee !== undefined && multiShiftContext && monthlyFee === multiShiftContext.price
            ? "MULTI_SHIFT_PRICE"
            : monthlyFee !== undefined && shiftContext && monthlyFee === shiftContext.price
                ? "SHIFT_PRICE"
                : monthlyFee !== undefined
                    ? "UPLOADED"
                    : undefined;

    next.student = {
        ...next.student,
        ...(studentName ? { name: studentName } : { name: undefined }),
        ...(phone ? { phone } : { phone: undefined }),
        ...(joinedAt ? { joinedAt, joinedAtSource: "UPLOADED" as const } : { joinedAt: undefined }),
        ...(monthlyFee !== undefined ? {
            monthlyFee,
            feeSource,
            feeLinkedShiftName: feeSource === "SHIFT_PRICE" ? shiftContext?.name ?? shift : undefined,
            feeLinkedMultiShiftName: feeSource === "MULTI_SHIFT_PRICE" ? multiShiftContext?.name ?? multiShift : undefined,
        } : {}),
    };

    next.seat = { ...next.seat, ...(seat ? { label: seat } : { label: undefined }) };
    next.allocation = {
        ...next.allocation,
        ...(seat ? { seatLabel: seat } : { seatLabel: undefined }),
        ...(shift ? { shiftName: shift, multiShiftName: undefined } : {}),
        ...(multiShift ? { multiShiftName: multiShift, shiftName: undefined } : {}),
    };
    if (shift) next.shift = { ...next.shift, name: shift };
    if (multiShift) next.multiShift = { ...next.multiShift, name: multiShift };

    if (paymentAmount !== undefined || paymentStatus || paymentMethod || referenceId) {
        next.payment = {
            ...next.payment,
            ...(paymentAmount !== undefined ? { amount: paymentAmount } : {}),
            ...(paymentStatus ? { status: paymentStatus as PaymentStatusDraft, rawStatus: paymentStatus } : {}),
            ...(paymentMethod ? { method: paymentMethod as PaymentMethodDraft } : {}),
            ...(referenceId ? { referenceId } : {}),
        };
    }

    return next;
}

function splitValues(value: string) {
    return value.split(",").map(part => part.trim()).filter(Boolean);
}

function joinValues(values?: string[]) {
    return (values ?? []).join(", ");
}

const optionLabels: Record<string, string> = {
    CURRENT_MONTH: "Current month",
    PREVIOUS_MONTH: "Previous month",
    CUSTOM_PERIOD: "Custom period",
    USE_JOINED_AT_ANNIVERSARY: "Use joined date cycle",
    SKIP_PAYMENTS: "Import students only",
    GENERATE_DUE: "Generate due payments",
    IMPORT_PAID_UNPAID: "Import paid/unpaid from file",
    YES_CREATE_SEATS: "Create missing seats",
    SKIP_UNKNOWN_SEAT_ALLOCATION: "Import student without that seat",
    CREATE_SHIFT: "Create missing shift",
    SKIP_UNKNOWN_SHIFT_ALLOCATION: "Import student without that shift",
    SKIP_MISSING_SHIFT_ALLOCATION: "Import student without allocation",
    CREATE_MULTI_SHIFT: "Create missing multi-shift",
    SKIP_UNKNOWN_MULTI_SHIFT_ALLOCATION: "Import student without that multi-shift",
};

const rowFilterLabels: Record<RowFilter, string> = {
    attention: "Needs attention",
    ready: "Ready",
    all: "All rows",
    skipped: "Skipped",
};

function optionLabel(option: string) {
    return optionLabels[option] ?? option;
}

function tabCount(tab: Tab, detail: ImportDetail | null, attention: ImportAttentionBucket[]) {
    if (!detail) return 0;
    if (tab === "attention") return attention.length;
    if (tab === "mapping") return detail.mapping?.columnMappings?.filter(mapping => mapping.targetField !== "ignore").length ?? 0;
    if (tab === "rows") return detail.rows.length;
    if (tab === "payments") return detail.rows.filter(row => row.normalizedData?.payment).length;
    if (tab === "questions") return detail.questions.filter(question => question.status === "OPEN").length;
    return detail.summary?.readyRows ?? 0;
}

export default function ImportSessionPage({ params }: { params: Promise<{ branchId: string; sessionId: string }> }) {
    const { branchId, sessionId } = use(params);
    const router = useRouter();
    const [detail, setDetail] = useState<ImportDetail | null>(null);
    const [activeTab, setActiveTab] = useState<Tab>("attention");
    const [rowFilter, setRowFilter] = useState<RowFilter>("attention");
    const [loading, setLoading] = useState(true);
    const [analyzing, setAnalyzing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [commitMode, setCommitMode] = useState<CommitMode>("SAFE_PARTIAL");
    const [preview, setPreview] = useState<ImportPreview | null>(null);
    const [rowDrafts, setRowDrafts] = useState<Record<string, RowDraft>>({});
    const [questionDrafts, setQuestionDrafts] = useState<Record<string, string>>({});
    const [paymentDraft, setPaymentDraft] = useState({ paid: "", unpaid: "", waived: "" });
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
    const pipeline = detail?.mapping?.analysis?.pipeline ?? [];
    const aiTrace = detail?.mapping?.analysis?.ai;
    const sourceProfile = detail?.mapping?.analysis?.sourceProfile ?? detail?.summary?.sourceProfile;
    const sourceColumns = useMemo(() => new Map((sourceProfile?.columns ?? []).map(column => [column.column, column])), [sourceProfile]);
    const latestCommit = detail?.commits?.[0];

    useEffect(() => {
        setPaymentDraft({
            paid: joinValues(options.paymentMapping?.paidValues),
            unpaid: joinValues(options.paymentMapping?.unpaidValues),
            waived: joinValues(options.paymentMapping?.waivedValues),
        });
    }, [options.paymentMapping?.paidValues, options.paymentMapping?.unpaidValues, options.paymentMapping?.waivedValues]);

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

    const skipRow = async (rowId: string, skipped: boolean) => {
        setSaving(true);
        try {
            const nextDetail = await importSessions.updateRows<ImportDetail>(
                branchId,
                sessionId,
                skipped ? { unskipRowIds: [rowId] } : { skipRowIds: [rowId] }
            );
            setDetail(nextDetail);
            setPreview(null);
        } catch (rowError) {
            setError(rowError instanceof Error ? rowError.message : "Failed to update row.");
        } finally {
            setSaving(false);
        }
    };

    const beginEdit = (row: ImportRow) => {
        setRowDrafts(prev => ({ ...prev, [row.id]: draftFromRow(row) }));
    };

    const cancelEdit = (rowId: string) => {
        setRowDrafts(prev => {
            const next = { ...prev };
            delete next[rowId];
            return next;
        });
    };

    const cancelAllEdits = () => setRowDrafts({});

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

    const saveRow = async (row: ImportRow) => {
        const rowDraft = rowDrafts[row.id];
        if (!rowDraft) return;
        setSaving(true);
        try {
            const normalizedData = normalizedFromDraft(row, rowDraft, branchContext);
            const nextDetail = await importSessions.updateRows<ImportDetail>(branchId, sessionId, {
                edits: [{ rowId: row.id, normalizedData }],
            });
            setDetail(nextDetail);
            setPreview(null);
            cancelEdit(row.id);
        } catch (rowError) {
            setError(rowError instanceof Error ? rowError.message : "Failed to save row correction.");
        } finally {
            setSaving(false);
        }
    };

    const saveAllEditedRows = async () => {
        const edits = rows
            .filter(row => rowDrafts[row.id])
            .map(row => ({
                rowId: row.id,
                normalizedData: normalizedFromDraft(row, rowDrafts[row.id], branchContext),
            }));
        if (edits.length === 0) return;

        setSaving(true);
        try {
            const nextDetail = await importSessions.updateRows<ImportDetail>(branchId, sessionId, { edits });
            setDetail(nextDetail);
            setPreview(null);
            setRowDrafts({});
        } catch (rowError) {
            setError(rowError instanceof Error ? rowError.message : "Failed to save row corrections.");
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

    const loadPreview = useCallback(async () => {
        try {
            setPreview(await importSessions.preview<ImportPreview>(branchId, sessionId, commitMode));
        } catch (previewError) {
            setError(previewError instanceof Error ? previewError.message : "Failed to load preview.");
        }
    }, [branchId, commitMode, sessionId]);

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

    useEffect(() => {
        if (activeTab === "preview" && detail) loadPreview();
    }, [activeTab, detail, loadPreview]);

    const commit = async () => {
        setSaving(true);
        try {
            await importSessions.commit(branchId, sessionId, commitMode);
            setConfirmOpen(false);
            setPreview(null);
            await load();
        } catch (commitError) {
            setError(commitError instanceof Error ? commitError.message : "Import failed.");
        } finally {
            setSaving(false);
        }
    };

    const filteredRows = rows.filter(row => {
        if (rowFilter === "all") return true;
        if (rowFilter === "ready") return ["READY", "WARNING"].includes(row.status);
        if (rowFilter === "skipped") return row.skipped || row.status === "SKIPPED";
        return !["READY", "IMPORTED"].includes(row.status) || row.issues.length > 0 || row.warnings.length > 0;
    });
    const editedRowCount = Object.keys(rowDrafts).length;
    const readiness = detail?.summary?.readinessScore ?? 0;
    const detectedPaymentValues = useMemo(
        () => detail?.mapping?.analysis?.detectedPaymentValues?.length
            ? detail.mapping.analysis.detectedPaymentValues
            : Array.from(new Set(rows.map(row => row.normalizedData?.payment?.rawStatus).filter((value): value is string => Boolean(value)))),
        [detail?.mapping?.analysis?.detectedPaymentValues, rows]
    );
    const canCommit = preview?.canCommit ?? (detail?.status === "READY_TO_COMMIT" && openQuestions.length === 0);
    const hasBlockingAttention = attention.some(item => item.severity === "error");
    const paymentsEnabled = Boolean(options.paymentAction && options.paymentAction !== "SKIP_PAYMENTS" && options.paymentCycle !== "SKIP_PAYMENTS");
    const plannedPaymentRows = paymentsEnabled
        ? (detail?.summary?.readyRows ?? 0) + (detail?.summary?.warningRows ?? 0)
        : detail?.summary?.detectedEntityCounts?.PAYMENT ?? 0;
    const importImpact: Array<[string, number, "success" | "warning" | "danger" | "default" | "cyan"]> = [
        ["Students", preview?.summary.createStudents ?? detail?.summary?.detectedEntityCounts?.STUDENT ?? 0, "success" as const],
        ["Allocations", preview?.summary.createAllocations ?? detail?.summary?.detectedEntityCounts?.ALLOCATION ?? 0, "cyan" as const],
        ["Payments", preview?.summary.generatePayments ?? plannedPaymentRows, "warning" as const],
        ["Create seats", preview?.summary.createSeats ?? 0, "cyan" as const],
        ["Skipped", preview?.summary.skippedRows ?? detail?.summary?.skippedRows ?? 0, "default" as const],
        ["Blocked", preview?.summary.blockedRows ?? ((detail?.summary?.blockedRows ?? 0) + (detail?.summary?.conflictRows ?? 0)), "danger" as const],
    ];
    const guideSteps = [
        {
            label: "Upload",
            tab: "attention" as Tab,
            status: "completed",
            detail: sourceProfile ? `${sourceProfile.rowCount} rows extracted` : "Source received",
        },
        {
            label: "Column meanings",
            tab: "mapping" as Tab,
            status: mapping.length > 0 && !detail?.mapping?.usedFallback ? "completed" : "needs_attention",
            detail: detail?.mapping?.usedFallback ? "Review fallback mapping" : `${mapping.filter(item => item.targetField !== "ignore").length} mapped`,
        },
        {
            label: "Decisions",
            tab: "questions" as Tab,
            status: openQuestions.length === 0 ? "completed" : "needs_attention",
            detail: openQuestions.length === 0 ? "No open decisions" : `${openQuestions.length} to answer`,
        },
        {
            label: "Fix rows",
            tab: "rows" as Tab,
            status: hasBlockingAttention ? "needs_attention" : "completed",
            detail: hasBlockingAttention ? "Blocking rows remain" : "Importable rows available",
        },
        {
            label: "Final check",
            tab: "preview" as Tab,
            status: canCommit ? "completed" : "pending",
            detail: canCommit ? "Ready for confirmation" : "Preview before import",
        },
    ];

    return (
        <BranchAccessGuard branchId={branchId} permission="students">
            <PageShell>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <p className={pageEyebrowClass}>AI Data Onboarding</p>
                        <h1 className={pageTitleClass}>Import review</h1>
                        <p className={pageDescriptionClass}>{detail?.fileName ?? "Review mapped staging data before committing."}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        {detail?.status && <Badge variant={statusVariant(detail.status)}>{detail.status}</Badge>}
                        <AppButton
                            variant="quiet"
                            icon={ArrowLeft}
                            onClick={() => router.push(`/branch/${branchId}/onboarding/import`)}
                        >
                            Back
                        </AppButton>
                    </div>
                </div>

                {error && (
                    <div className="rounded-[8px] border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">
                        {error}
                    </div>
                )}

                {loading && (
                    <div className="flex items-center gap-2 text-sm text-[color:var(--text-secondary)]">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading import session...
                    </div>
                )}

                {analyzing && (
                    <div className="flex items-center gap-3 rounded-[8px] border border-[color:var(--ui-badge-cyan-border)] bg-[color:var(--ui-badge-cyan-bg)] p-3 text-sm text-[color:var(--ui-badge-cyan-text)]">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Analyzing source data with Gemini and deterministic import checks...
                    </div>
                )}

                {!loading && detail && (
                    <>
                        <datalist id="import-seat-options">
                            {(branchContext?.seats ?? []).map(seat => <option key={seat.id} value={seat.label} />)}
                        </datalist>
                        <datalist id="import-shift-options">
                            {(branchContext?.shifts ?? []).map(shift => <option key={shift.id} value={shift.name} label={`${shift.price}`} />)}
                        </datalist>
                        <datalist id="import-multi-shift-options">
                            {(branchContext?.multiShifts ?? []).map(multiShift => <option key={multiShift.id} value={multiShift.name} label={`${multiShift.price}`} />)}
                        </datalist>

                        {latestCommit && (
                            <AppPanel title="Import result" description="Last commit report.">
                                <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
                                    {Object.entries(latestCommit.summary ?? {}).map(([label, value]) => (
                                        <div key={label} className={pageInsetMetricClass}>
                                            <p className={cn("text-xs", pageMutedTextClass)}>{label}</p>
                                            <p className="mt-1 text-xl font-semibold text-[color:var(--text-primary)]">{String(value)}</p>
                                        </div>
                                    ))}
                                </div>
                            </AppPanel>
                        )}

                        <AppPanel contentClassName="space-y-4">
                            <div className="grid gap-3 md:grid-cols-5">
                                {[
                                    ["Readiness", `${readiness}%`],
                                    ["Ready", detail.summary?.readyRows ?? 0],
                                    ["Needs attention", (detail.summary?.needsReviewRows ?? 0) + (detail.summary?.duplicateRows ?? 0)],
                                    ["Blocked", (detail.summary?.blockedRows ?? 0) + (detail.summary?.conflictRows ?? 0)],
                                    ["Questions", openQuestions.length],
                                ].map(([label, value]) => (
                                    <div key={label} className={pageInsetMetricClass}>
                                        <p className={cn("text-xs", pageMutedTextClass)}>{label}</p>
                                        <p className="mt-1 text-xl font-semibold text-[color:var(--text-primary)]">{value}</p>
                                    </div>
                                ))}
                            </div>

                            <div>
                                <div className={pageProgressTrackClass}>
                                    <div
                                        className="h-full rounded-full bg-cyan-300 transition-all"
                                        style={{ width: `${Math.max(0, Math.min(100, readiness))}%` }}
                                    />
                                </div>
                            </div>

                            {pipeline.length > 0 && (
                                <div className="grid gap-2 md:grid-cols-6">
                                    {pipeline.map(step => {
                                        const StepIcon = stepIcon(step);
                                        return (
                                            <div key={step.id} className={cn("min-h-20 p-3", pageInsetSurfaceClass)}>
                                                <div className="flex items-center gap-2">
                                                    <StepIcon className={cn(
                                                        "h-4 w-4",
                                                        step.status === "completed" && "text-emerald-300",
                                                        step.status === "needs_attention" && "text-amber-300",
                                                        step.status === "failed" && "text-red-300"
                                                    )} />
                                                    <p className="text-sm font-semibold text-[color:var(--text-primary)]">{step.label}</p>
                                                </div>
                                                {step.detail && <p className={cn("mt-2 text-xs", pageMutedTextClass)}>{step.detail}</p>}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {aiTrace && (
                                <div className={cn("flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between", pageInsetSurfaceClass)}>
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <Badge variant={aiVariant(aiTrace.status)}>AI {aiTrace.status.replace(/_/g, " ")}</Badge>
                                            {aiTrace.model && <span className={cn("text-xs", pageMutedTextClass)}>{aiTrace.model}</span>}
                                            <span className={cn("text-xs", pageSubtleTextClass)}>{aiTrace.durationMs}ms</span>
                                        </div>
                                        {(aiTrace.fallbackReason || aiTrace.error) && (
                                            <p className={cn("mt-1 text-xs", pageMutedTextClass)}>{aiTrace.fallbackReason ?? aiTrace.error}</p>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div className="grid gap-2 md:grid-cols-3">
                                {[
                                    ["AI maps", "Columns, payment words, and likely seat/shift fields are proposed from the file and branch setup."],
                                    ["Checks risks", "Missing dates, unclear payment cycles, duplicate students, and allocation conflicts are surfaced before commit."],
                                    ["You confirm", "Branch records are created only after visible decisions, row edits, and the final preview."],
                                ].map(([label, detail]) => (
                                    <div key={label} className={cn("p-3", pageInsetSurfaceClass)}>
                                        <p className="text-sm font-semibold text-[color:var(--text-primary)]">{label}</p>
                                        <p className={cn("mt-1 text-xs", pageMutedTextClass)}>{detail}</p>
                                    </div>
                                ))}
                            </div>

                            <div className="grid gap-2 md:grid-cols-5">
                                {guideSteps.map(step => {
                                    const variant = step.status === "completed" ? "success" : step.status === "needs_attention" ? "warning" : "default";
                                    return (
                                        <button
                                            key={step.label}
                                            type="button"
                                            onClick={() => setActiveTab(step.tab)}
                                            className={cn(
                                                "min-h-24 rounded-[8px] border p-3 text-left transition-colors hover:bg-white/[0.04]",
                                                activeTab === step.tab
                                                    ? "border-[color:var(--ui-badge-cyan-border)] bg-[color:var(--ui-badge-cyan-bg)]"
                                                    : "border-[color:var(--ui-form-surface-border)] bg-[color:var(--ui-form-muted-surface-bg)]"
                                            )}
                                        >
                                            <Badge variant={variant}>{step.status.replace("_", " ")}</Badge>
                                            <p className="mt-2 text-sm font-semibold text-[color:var(--text-primary)]">{step.label}</p>
                                            <p className={cn("mt-1 text-xs", pageMutedTextClass)}>{step.detail}</p>
                                        </button>
                                    );
                                })}
                            </div>
                        </AppPanel>

                        <AppPanel title="What will happen" description="Current import plan based on the staged rows. Final check gives the exact commit count.">
                            <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
                                {importImpact.map(([label, value, variant]) => (
                                    <div key={label} className={pageInsetMetricClass}>
                                        <div className="flex items-center justify-between gap-2">
                                            <p className={cn("text-xs", pageMutedTextClass)}>{label}</p>
                                            <Badge variant={variant}>{String(value)}</Badge>
                                        </div>
                                        <p className="mt-2 text-lg font-semibold text-[color:var(--text-primary)]">{String(value)}</p>
                                    </div>
                                ))}
                            </div>
                        </AppPanel>

                        <div className="flex gap-2 overflow-x-auto rounded-[8px] border border-[color:var(--ui-table-border)] bg-[color:var(--ui-table-bg)] p-1">
                            {tabs.map(tab => (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setActiveTab(tab.id)}
                                    className={cn(
                                        "flex h-9 shrink-0 items-center gap-2 rounded-[var(--ui-radius-control)] px-3 text-sm font-semibold transition-colors",
                                        activeTab === tab.id
                                            ? "bg-[color:var(--ui-button-primary-bg)] text-[color:var(--ui-button-primary-text)]"
                                            : "text-[color:var(--text-secondary)] hover:bg-white/[0.04]"
                                    )}
                                >
                                    <span>{tab.label}</span>
                                    <span className={pageCountBadgeClass}>{tabCount(tab.id, detail, attention)}</span>
                                </button>
                            ))}
                        </div>

                        {activeTab === "attention" && (
                            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
                                <AppPanel title="Needs attention" description="Grouped by blocker, warning, and decision.">
                                    <div className="space-y-3">
                                        {attention.length === 0 && (
                                            <div className={cn("p-4 text-sm", pageInsetSurfaceClass, pageMutedTextClass)}>
                                                No attention groups remain.
                                            </div>
                                        )}
                                        {attention.map(item => (
                                            <div key={item.code} className={cn("p-4", pageInsetSurfaceClass)}>
                                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                                    <div className="min-w-0">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <Badge variant={attentionVariant(item.severity)}>{item.severity}</Badge>
                                                            <h2 className="text-sm font-semibold text-[color:var(--text-primary)]">{item.label}</h2>
                                                            <span className={pageCountBadgeClass}>{item.count}</span>
                                                        </div>
                                                        <p className={cn("mt-2 text-sm", pageMutedTextClass)}>{item.message}</p>
                                                        {item.action && <p className={cn("mt-1 text-xs", pageSubtleTextClass)}>{item.action}</p>}
                                                        {item.sampleRowNumbers?.length ? (
                                                            <p className={cn("mt-2 text-xs", pageSubtleTextClass)}>Rows {item.sampleRowNumbers.join(", ")}</p>
                                                        ) : null}
                                                    </div>
                                                    <AppButton
                                                        size="sm"
                                                        variant="secondary"
                                                        icon={item.code.includes("QUESTION") ? HelpCircle : item.code.includes("MAPPING") ? SlidersHorizontal : Pencil}
                                                        onClick={() => {
                                                            if (item.code.includes("QUESTION")) setActiveTab("questions");
                                                            else if (item.code.includes("PAYMENT")) setActiveTab("payments");
                                                            else if (item.code.includes("MAPPING")) setActiveTab("mapping");
                                                            else setActiveTab("rows");
                                                        }}
                                                    >
                                                        Open
                                                    </AppButton>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </AppPanel>

                                <AppPanel title="Extract profile" description="Column signal from the uploaded source.">
                                    {!sourceProfile ? (
                                        <p className={pageMutedTextClass}>No source profile available.</p>
                                    ) : (
                                        <div className="space-y-4">
                                            <div className="grid grid-cols-3 gap-2">
                                                {[
                                                    ["Rows", sourceProfile.rowCount],
                                                    ["Columns", sourceProfile.columnCount],
                                                    ["Empty", `${sourceProfile.emptyCellRate}%`],
                                                ].map(([label, value]) => (
                                                    <div key={label} className={pageInsetMetricClass}>
                                                        <p className={cn("text-xs", pageMutedTextClass)}>{label}</p>
                                                        <p className="mt-1 text-lg font-semibold text-[color:var(--text-primary)]">{value}</p>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="space-y-2">
                                                {sourceProfile.columns.slice(0, 10).map(column => (
                                                    <div key={column.column} className={cn("p-3", pageInsetSurfaceClass)}>
                                                        <div className="flex items-center justify-between gap-3">
                                                            <p className="min-w-0 truncate text-sm font-medium text-[color:var(--text-primary)]">{column.column}</p>
                                                            <Badge variant={column.fillRate < 50 ? "warning" : "cyan"}>{column.detectedKind}</Badge>
                                                        </div>
                                                        <p className={cn("mt-1 text-xs", pageMutedTextClass)}>{column.fillRate}% filled</p>
                                                        {column.sampleValues.length > 0 && (
                                                            <p className={cn("mt-1 truncate text-xs", pageSubtleTextClass)}>{column.sampleValues.join(" | ")}</p>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </AppPanel>
                            </div>
                        )}

                        {activeTab === "mapping" && (
                            <AppPanel
                                title="Column meanings"
                                description={detail.mapping?.usedFallback ? "Fallback matching is active." : "AI-assisted column mapping."}
                            >
                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[900px] text-left text-sm">
                                        <thead className={cn("text-xs uppercase text-[color:var(--text-muted)]", pageTableHeadClass)}>
                                            <tr>
                                                <th className="p-3">Uploaded column</th>
                                                <th className="p-3">Detected</th>
                                                <th className="p-3">Target field</th>
                                                <th className="p-3">Confidence</th>
                                                <th className="p-3">Samples</th>
                                                <th className="p-3">Reason</th>
                                            </tr>
                                        </thead>
                                        <tbody className={pageTableBodyDividerClass}>
                                            {mapping.map((item, index) => {
                                                const profile = sourceColumns.get(item.sourceColumn);
                                                return (
                                                    <tr key={item.sourceColumn} className={pageTableRowClass}>
                                                        <td className="p-3 font-medium text-[color:var(--text-primary)]">{item.sourceColumn}</td>
                                                        <td className="p-3">
                                                            <Badge variant={profile && profile.fillRate < 50 ? "warning" : "cyan"}>
                                                                {profile?.detectedKind ?? "text"}
                                                            </Badge>
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
                                                                    };
                                                                    saveMapping(next);
                                                                }}
                                                                className={cn("w-full", importSelectClass)}
                                                            >
                                                                {IMPORT_TARGET_FIELDS.map(field => <option key={field} value={field} className={importOptionClass}>{field}</option>)}
                                                            </select>
                                                        </td>
                                                        <td className="p-3">
                                                            <Badge variant={item.confidence < 70 ? "warning" : "success"}>{item.confidence}%</Badge>
                                                        </td>
                                                        <td className={cn("max-w-xs truncate p-3", pageMutedTextClass)}>
                                                            {profile?.sampleValues.join(" | ") || "No samples"}
                                                        </td>
                                                        <td className={cn("p-3", pageMutedTextClass)}>{item.reason ?? "No reason"}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </AppPanel>
                        )}

                        {activeTab === "rows" && (
                            <AppPanel
                                title="Row corrections"
                                description="Edit guessed values, then revalidate the staged row."
                                action={
                                    <div className="flex flex-wrap gap-2">
                                        {editedRowCount > 0 && (
                                            <>
                                                <AppButton size="sm" variant="primary" icon={Save} onClick={saveAllEditedRows} isLoading={saving}>
                                                    Save {editedRowCount} edit{editedRowCount === 1 ? "" : "s"}
                                                </AppButton>
                                                <AppButton size="sm" variant="quiet" icon={RotateCcw} onClick={cancelAllEdits} disabled={saving}>
                                                    Cancel edits
                                                </AppButton>
                                            </>
                                        )}
                                        {(["attention", "ready", "skipped", "all"] as RowFilter[]).map(filter => (
                                            <AppButton
                                                key={filter}
                                                size="sm"
                                                variant={rowFilter === filter ? "primary" : "secondary"}
                                                onClick={() => setRowFilter(filter)}
                                            >
                                                {rowFilterLabels[filter]}
                                            </AppButton>
                                        ))}
                                    </div>
                                }
                            >
                                <div className={cn("mb-4 p-4", pageInsetSurfaceClass)}>
                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                        <div>
                                            <p className="text-sm font-semibold text-[color:var(--text-primary)]">Branch defaults and generated records</p>
                                            <p className={cn("mt-1 text-xs", pageMutedTextClass)}>
                                                {(branchContext?.seats.length ?? 0)} seats, {(branchContext?.shifts.length ?? 0)} shifts, and {(branchContext?.multiShifts.length ?? 0)} bundles are available for selection.
                                            </p>
                                        </div>
                                        <Badge variant="cyan">Default fee {branchContext?.defaultFee ?? 0}</Badge>
                                    </div>
                                    <div className="mt-4 grid gap-3 lg:grid-cols-4">
                                        <label className="space-y-2">
                                            <span className="text-xs font-semibold uppercase text-[color:var(--text-muted)]">Default joined date</span>
                                            <input
                                                type="date"
                                                value={options.defaultJoinedAt?.slice(0, 10) ?? ""}
                                                onChange={event => updateOption({ defaultJoinedAt: event.target.value })}
                                                className={cn("w-full", importFieldClass)}
                                            />
                                        </label>
                                        <label className="space-y-2">
                                            <span className="text-xs font-semibold uppercase text-[color:var(--text-muted)]">Default seat</span>
                                            <select
                                                value={options.defaultSeatLabel ?? ""}
                                                onChange={event => updateOption({ defaultSeatLabel: event.target.value })}
                                                className={cn("w-full", importSelectClass)}
                                            >
                                                <option value="" className={importOptionClass}>Use file seat</option>
                                                {(branchContext?.seats ?? []).map(seat => <option key={seat.id} value={seat.label} className={importOptionClass}>{seat.label}</option>)}
                                            </select>
                                        </label>
                                        <label className="space-y-2">
                                            <span className="text-xs font-semibold uppercase text-[color:var(--text-muted)]">Default shift</span>
                                            <select
                                                value={options.defaultShiftName ?? ""}
                                                onChange={event => updateOption({ defaultShiftName: event.target.value, defaultMultiShiftName: "" })}
                                                className={cn("w-full", importSelectClass)}
                                            >
                                                <option value="" className={importOptionClass}>Use file shift</option>
                                                {(branchContext?.shifts ?? []).map(shift => (
                                                    <option key={shift.id} value={shift.name} className={importOptionClass}>
                                                        {shift.name} - {shift.price}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>
                                        <label className="space-y-2">
                                            <span className="text-xs font-semibold uppercase text-[color:var(--text-muted)]">Default bundle</span>
                                            <select
                                                value={options.defaultMultiShiftName ?? ""}
                                                onChange={event => updateOption({ defaultMultiShiftName: event.target.value, defaultShiftName: "" })}
                                                className={cn("w-full", importSelectClass)}
                                            >
                                                <option value="" className={importOptionClass}>Use file bundle</option>
                                                {(branchContext?.multiShifts ?? []).map(multiShift => (
                                                    <option key={multiShift.id} value={multiShift.name} className={importOptionClass}>
                                                        {multiShift.name} - {multiShift.price}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>
                                    </div>
                                    <div className="mt-4 grid gap-2 md:grid-cols-3">
                                        {[
                                            ["createUnknownSeats", "Create missing seats"],
                                            ["createUnknownShifts", "Create missing shifts"],
                                            ["createUnknownMultiShifts", "Create missing bundles"],
                                        ].map(([key, label]) => (
                                            <label key={key} className="flex items-center gap-2 text-sm text-[color:var(--text-secondary)]">
                                                <input
                                                    type="checkbox"
                                                    checked={Boolean(options[key as keyof ImportOptions])}
                                                    onChange={event => updateOption({ [key]: event.target.checked } as Partial<ImportOptions>)}
                                                    className="h-4 w-4 rounded border-[color:var(--ui-form-field-border)] bg-[color:var(--ui-form-field-bg)]"
                                                />
                                                <span>{label}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                {detail.rowPage && (
                                    <div className={cn("mb-3 flex flex-wrap items-center gap-2 text-xs", pageMutedTextClass)}>
                                        <span>Showing {detail.rowPage.returnedRows} of {detail.rowPage.filteredRows} {rowFilterLabels[detail.rowPage.filter].toLowerCase()}.</span>
                                        {detail.rowPage.hasMore && <Badge variant="warning">More rows available</Badge>}
                                    </div>
                                )}
                                <div className={cn("overflow-x-auto", pageTableShellClass)}>
                                    <table className="w-full min-w-[1360px] text-left text-sm">
                                        <thead className={cn("text-xs uppercase text-[color:var(--text-muted)]", pageTableHeadClass)}>
                                            <tr>
                                                <th className="p-3">Status</th>
                                                <th className="p-3">Student</th>
                                                <th className="p-3">Phone</th>
                                                <th className="p-3">Joined</th>
                                                <th className="p-3">Fee</th>
                                                <th className="p-3">Seat</th>
                                                <th className="p-3">Shift</th>
                                                <th className="p-3">Payment</th>
                                                <th className="p-3">Attention</th>
                                                <th className="p-3">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className={pageTableBodyDividerClass}>
                                            {filteredRows.map(row => {
                                                const rowDraft = rowDrafts[row.id];
                                                const editing = Boolean(rowDraft);
                                                const issues = [...row.issues, ...row.warnings];
                                                const updateDraft = (field: keyof RowDraft, value: string) => {
                                                    updateRowDraft(row.id, field, value);
                                                };
                                                return (
                                                    <tr key={row.id} className={pageTableRowClass}>
                                                        <td className="p-3">
                                                            <div className="flex flex-wrap gap-1.5">
                                                                <Badge variant={statusVariant(row.status)}>{statusLabels[row.status] ?? row.status}</Badge>
                                                                {manualRow(row) && <Badge variant="purple">Manual</Badge>}
                                                            </div>
                                                        </td>
                                                        {editing && rowDraft ? (
                                                            <>
                                                                <td className="p-3"><input value={rowDraft.studentName} onChange={event => updateDraft("studentName", event.target.value)} className={cn("w-36", importFieldClass)} /></td>
                                                                <td className="p-3"><input value={rowDraft.phone} onChange={event => updateDraft("phone", event.target.value)} className={cn("w-32", importFieldClass)} /></td>
                                                                <td className="p-3"><input type="date" value={rowDraft.joinedAt} onChange={event => updateDraft("joinedAt", event.target.value)} className={cn("w-36", importFieldClass)} /></td>
                                                                <td className="p-3"><input value={rowDraft.fee} onChange={event => updateDraft("fee", event.target.value)} className={cn("w-24", importFieldClass)} /></td>
                                                                <td className="p-3"><input list="import-seat-options" value={rowDraft.seat} onChange={event => updateDraft("seat", event.target.value)} className={cn("w-24", importFieldClass)} /></td>
                                                                <td className="p-3">
                                                                    <div className="flex gap-2">
                                                                        <input list="import-shift-options" value={rowDraft.shift} onChange={event => updateDraft("shift", event.target.value)} placeholder="Shift" className={cn("w-32", importFieldClass)} />
                                                                        <input list="import-multi-shift-options" value={rowDraft.multiShift} onChange={event => updateDraft("multiShift", event.target.value)} placeholder="Bundle" className={cn("w-32", importFieldClass)} />
                                                                    </div>
                                                                </td>
                                                                <td className="p-3">
                                                                    <div className="flex gap-2">
                                                                        <input value={rowDraft.paymentAmount} onChange={event => updateDraft("paymentAmount", event.target.value)} placeholder="Amount" className={cn("w-24", importFieldClass)} />
                                                                        <select value={rowDraft.paymentStatus} onChange={event => updateDraft("paymentStatus", event.target.value)} className={cn("w-28", importSelectClass)}>
                                                                            <option value="" className={importOptionClass}>None</option>
                                                                            <option value="PAID" className={importOptionClass}>Paid</option>
                                                                            <option value="DUE" className={importOptionClass}>Due</option>
                                                                            <option value="WAIVED" className={importOptionClass}>Waived</option>
                                                                            <option value="UNCLEAR" className={importOptionClass}>Unclear</option>
                                                                        </select>
                                                                        <select value={rowDraft.paymentMethod} onChange={event => updateDraft("paymentMethod", event.target.value)} className={cn("w-24", importSelectClass)}>
                                                                            <option value="" className={importOptionClass}>Method</option>
                                                                            <option value="CASH" className={importOptionClass}>Cash</option>
                                                                            <option value="UPI" className={importOptionClass}>UPI</option>
                                                                            <option value="BANK_TRANSFER" className={importOptionClass}>Bank</option>
                                                                        </select>
                                                                        <input value={rowDraft.referenceId} onChange={event => updateDraft("referenceId", event.target.value)} placeholder="Ref" className={cn("w-24", importFieldClass)} />
                                                                    </div>
                                                                </td>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <td className="p-3 font-medium text-[color:var(--text-primary)]">{fieldValue(row, "studentName") || "-"}</td>
                                                                <td className="p-3">{fieldValue(row, "phone") || "-"}</td>
                                                                <td className="p-3">{fieldValue(row, "joinedAt") || "-"}</td>
                                                                <td className="p-3">{fieldValue(row, "fee") || "-"}</td>
                                                                <td className="p-3">{fieldValue(row, "seat") || "-"}</td>
                                                                <td className="p-3">{fieldValue(row, "multiShift") || fieldValue(row, "shift") || "-"}</td>
                                                                <td className="p-3">
                                                                    {[fieldValue(row, "paymentAmount"), fieldValue(row, "paymentStatus"), fieldValue(row, "paymentMethod")]
                                                                        .filter(Boolean)
                                                                        .join(" / ") || "-"}
                                                                </td>
                                                            </>
                                                        )}
                                                        <td className="max-w-xs p-3">
                                                            <span className={cn("line-clamp-2", issues.length ? "text-amber-200" : pageMutedTextClass)}>
                                                                {issues[0]?.message ?? "None"}
                                                            </span>
                                                        </td>
                                                        <td className="p-3">
                                                            <div className="flex gap-2">
                                                                {editing ? (
                                                                    <>
                                                                        <AppButton size="sm" variant="primary" icon={Save} onClick={() => saveRow(row)} isLoading={saving}>Save</AppButton>
                                                                        <AppButton size="sm" variant="quiet" icon={RotateCcw} onClick={() => cancelEdit(row.id)}>Cancel</AppButton>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <AppButton size="sm" variant="secondary" icon={Pencil} onClick={() => beginEdit(row)}>Edit</AppButton>
                                                                        <AppButton size="sm" variant="quiet" onClick={() => skipRow(row.id, row.skipped)} isLoading={saving}>
                                                                            {row.skipped ? "Unskip" : "Skip"}
                                                                        </AppButton>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                                {detail.rowPage?.hasMore && (
                                    <div className="mt-3 flex justify-center">
                                        <AppButton variant="secondary" size="sm" onClick={loadMoreRows} isLoading={saving}>
                                            Load more rows
                                        </AppButton>
                                    </div>
                                )}
                            </AppPanel>
                        )}

                        {activeTab === "payments" && (
                            <AppPanel title="Payment decisions" description="Confirm cycle, action, and paid/unpaid meanings.">
                                <div className={cn("mb-4 p-3 text-sm", pageInsetSurfaceClass)}>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Badge variant={paymentsEnabled ? "success" : "warning"}>
                                            {paymentsEnabled ? "Payments will be generated" : "Payments not enabled"}
                                        </Badge>
                                        <span className={pageMutedTextClass}>
                                            Amount uses the file payment amount first, otherwise the row fee. Shift and bundle selections fill row fees from branch prices and can still be edited.
                                        </span>
                                    </div>
                                </div>
                                <div className="grid gap-4 lg:grid-cols-3">
                                    <label className="space-y-2">
                                        <span className="text-xs font-semibold uppercase text-[color:var(--text-muted)]">Payment cycle</span>
                                        <select value={options.paymentCycle ?? ""} onChange={(event) => updateOption({ paymentCycle: event.target.value as ImportOptions["paymentCycle"] })} className={cn("w-full", importSelectClass)}>
                                            <option value="" className={importOptionClass}>Choose cycle</option>
                                            <option value="CURRENT_MONTH" className={importOptionClass}>Current month</option>
                                            <option value="PREVIOUS_MONTH" className={importOptionClass}>Previous month</option>
                                            <option value="CUSTOM_PERIOD" className={importOptionClass}>Custom period</option>
                                            <option value="USE_JOINED_AT_ANNIVERSARY" className={importOptionClass}>JoinedAt anniversary</option>
                                            <option value="SKIP_PAYMENTS" className={importOptionClass}>Import students only</option>
                                        </select>
                                    </label>
                                    <label className="space-y-2">
                                        <span className="text-xs font-semibold uppercase text-[color:var(--text-muted)]">After student import</span>
                                        <select value={options.paymentAction ?? ""} onChange={(event) => updateOption({ paymentAction: event.target.value as ImportOptions["paymentAction"] })} className={cn("w-full", importSelectClass)}>
                                            <option value="" className={importOptionClass}>Choose action</option>
                                            <option value="GENERATE_DUE" className={importOptionClass}>Generate due payments</option>
                                            <option value="IMPORT_PAID_UNPAID" className={importOptionClass}>Import paid/unpaid from file</option>
                                            <option value="SKIP_PAYMENTS" className={importOptionClass}>Skip payments for now</option>
                                        </select>
                                    </label>
                                    <label className="space-y-2">
                                        <span className="text-xs font-semibold uppercase text-[color:var(--text-muted)]">Fallback method</span>
                                        <select value={options.paymentMapping?.defaultMethod ?? ""} onChange={(event) => updateOption({ paymentMapping: { ...(options.paymentMapping ?? { paidValues: [], unpaidValues: [], waivedValues: [], unclearValues: [], confirmed: false }), defaultMethod: event.target.value as NonNullable<ImportOptions["paymentMapping"]>["defaultMethod"] } })} className={cn("w-full", importSelectClass)}>
                                            <option value="" className={importOptionClass}>No fallback</option>
                                            <option value="CASH" className={importOptionClass}>Cash</option>
                                            <option value="UPI" className={importOptionClass}>UPI</option>
                                            <option value="BANK_TRANSFER" className={importOptionClass}>Bank transfer</option>
                                        </select>
                                    </label>
                                </div>
                                {options.paymentCycle === "CUSTOM_PERIOD" && (
                                    <div className="mt-5 grid gap-4 lg:grid-cols-2">
                                        <label className="space-y-2">
                                            <span className="text-xs font-semibold uppercase text-[color:var(--text-muted)]">Custom period start</span>
                                            <input
                                                type="date"
                                                value={options.customPeriodStart?.slice(0, 10) ?? ""}
                                                onChange={event => updateOption({ customPeriodStart: event.target.value })}
                                                className={cn("w-full", importFieldClass)}
                                            />
                                        </label>
                                        <label className="space-y-2">
                                            <span className="text-xs font-semibold uppercase text-[color:var(--text-muted)]">Custom period end</span>
                                            <input
                                                type="date"
                                                value={options.customPeriodEnd?.slice(0, 10) ?? ""}
                                                onChange={event => updateOption({ customPeriodEnd: event.target.value })}
                                                className={cn("w-full", importFieldClass)}
                                            />
                                        </label>
                                    </div>
                                )}
                                <div className="mt-5 grid gap-4 lg:grid-cols-3">
                                    <label className="space-y-2">
                                        <span className="text-xs font-semibold uppercase text-[color:var(--text-muted)]">Paid values</span>
                                        <input value={paymentDraft.paid} onChange={event => setPaymentDraft(prev => ({ ...prev, paid: event.target.value }))} className={cn("w-full", importFieldClass)} />
                                    </label>
                                    <label className="space-y-2">
                                        <span className="text-xs font-semibold uppercase text-[color:var(--text-muted)]">Unpaid values</span>
                                        <input value={paymentDraft.unpaid} onChange={event => setPaymentDraft(prev => ({ ...prev, unpaid: event.target.value }))} className={cn("w-full", importFieldClass)} />
                                    </label>
                                    <label className="space-y-2">
                                        <span className="text-xs font-semibold uppercase text-[color:var(--text-muted)]">Waived values</span>
                                        <input value={paymentDraft.waived} onChange={event => setPaymentDraft(prev => ({ ...prev, waived: event.target.value }))} className={cn("w-full", importFieldClass)} />
                                    </label>
                                </div>
                                <div className="mt-4 flex flex-wrap gap-3">
                                    <AppButton
                                        variant="primary"
                                        icon={CheckCircle2}
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
                                        Save payment mapping
                                    </AppButton>
                                    <Badge variant={options.paymentMapping?.confirmed ? "success" : "warning"}>
                                        {options.paymentMapping?.confirmed ? "Confirmed" : "Needs confirmation"}
                                    </Badge>
                                </div>
                                <div className="mt-5">
                                    <p className="mb-2 text-xs font-semibold uppercase text-[color:var(--text-muted)]">Detected values</p>
                                    <div className="flex flex-wrap gap-2">
                                        {detectedPaymentValues.length === 0 ? <span className={pageMutedTextClass}>No payment status values detected.</span> : detectedPaymentValues.map(value => <Badge key={value} variant="warning">{value}</Badge>)}
                                    </div>
                                </div>
                            </AppPanel>
                        )}

                        {activeTab === "questions" && (
                            <AppPanel title="Decisions" description="Answers revalidate affected rows.">
                                <div className="space-y-3">
                                    {questions.length === 0 && <p className={pageMutedTextClass}>No decisions are waiting.</p>}
                                    {questions.map(question => (
                                        <div key={question.id} className={cn("p-4", pageInsetSurfaceClass)}>
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
                        )}

                        {activeTab === "preview" && (
                            <AppPanel title="Final check" description="Importable rows and business records for this commit.">
                                {!preview ? (
                                    <div className="flex items-center gap-2 text-sm text-[color:var(--text-secondary)]">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Loading preview...
                                    </div>
                                ) : (
                                    <>
                                        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
                                            {Object.entries(preview.summary).map(([label, value]) => (
                                                <div key={label} className={pageInsetMetricClass}>
                                                    <p className={cn("text-xs", pageMutedTextClass)}>{label}</p>
                                                    <p className="mt-1 text-xl font-semibold text-[color:var(--text-primary)]">{String(value)}</p>
                                                </div>
                                            ))}
                                        </div>
                                        {preview.warnings.length > 0 && (
                                            <div className="mt-4 rounded-[8px] border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-100">
                                                <div className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" /> Review warnings</div>
                                                <ul className="mt-2 list-inside list-disc space-y-1">
                                                    {preview.warnings.slice(0, 5).map((warning, index) => <li key={`${warning}-${index}`}>{warning}</li>)}
                                                </ul>
                                            </div>
                                        )}
                                        <div className="mt-5 flex flex-wrap items-center gap-3">
                                            <select value={commitMode} onChange={(event) => setCommitMode(event.target.value as CommitMode)} className={cn("h-10 px-3 py-0", importSelectClass)}>
                                                <option value="SAFE_PARTIAL" className={importOptionClass}>Safe partial</option>
                                                <option value="STRICT_ALL_OR_NOTHING" className={importOptionClass}>Strict all or nothing</option>
                                            </select>
                                            <AppButton variant="primary" icon={UploadCloud} onClick={() => setConfirmOpen(true)} disabled={!canCommit}>
                                                Confirm and import
                                            </AppButton>
                                            <span className={cn("text-xs", pageMutedTextClass)}>Current session status: <span className={pageCountBadgeClass}>{detail.status}</span></span>
                                        </div>
                                    </>
                                )}
                            </AppPanel>
                        )}
                    </>
                )}

                <ConfirmDialog
                    isOpen={confirmOpen}
                    onClose={() => setConfirmOpen(false)}
                    onConfirm={commit}
                    loading={saving}
                    variant="warning"
                    title="Confirm final import"
                    description="This creates business records through the existing branch services. Rows still blocked or skipped stay in the import workspace."
                    confirmText="Confirm and import"
                />
            </PageShell>
        </BranchAccessGuard>
    );
}
