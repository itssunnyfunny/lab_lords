"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, HelpCircle, Loader2, UploadCloud } from "lucide-react";
import { BranchAccessGuard } from "@/components/auth/BranchAccessGuard";
import { AppButton, AppPanel, PageShell } from "@/components/ui";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { IMPORT_TARGET_FIELDS, type CommitMode, type ImportColumnMapping, type ImportOptions } from "@/importing/contracts/import-session.contract";
import { importSessions } from "@/lib/api/importSessions";
import { cn } from "@/lib/utils";
import {
    pageCountBadgeClass,
    pageDescriptionClass,
    pageEyebrowClass,
    pageInsetSurfaceClass,
    pageMutedTextClass,
    pageTitleClass,
} from "@/components/ui/pageSurface";

type Tab = "overview" | "mapping" | "students" | "seats" | "shifts" | "payments" | "questions" | "preview";

type ImportRow = {
    id: string;
    rowNumber: number;
    rawData: Record<string, string>;
    normalizedData: {
        student?: { name?: string; phone?: string; joinedAt?: string; monthlyFee?: number; feeSource?: string };
        seat?: { label?: string };
        shift?: { name?: string };
        multiShift?: { name?: string };
        allocation?: { seatLabel?: string; shiftName?: string; multiShiftName?: string };
        payment?: { amount?: number; status?: string; rawStatus?: string; method?: string; referenceId?: string };
    } | null;
    status: string;
    issues: { message: string; code: string }[];
    warnings: { message: string; code: string }[];
    confidence: number | null;
    skipped: boolean;
};

type ImportQuestion = {
    id: string;
    field: string | null;
    question: string;
    options: string[] | null;
    status: string;
};

type ImportDetail = {
    id: string;
    status: string;
    fileName?: string | null;
    mapping?: {
        columnMappings?: ImportColumnMapping[];
        importOptions?: ImportOptions;
        warnings?: string[];
        usedFallback?: boolean;
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
        detectedEntityCounts: Record<string, number>;
    } | null;
    rows: ImportRow[];
    questions: ImportQuestion[];
    commits?: { status: string; summary: Record<string, number>; errors?: unknown }[];
};

const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "mapping", label: "Mapping" },
    { id: "students", label: "Students" },
    { id: "seats", label: "Seats" },
    { id: "shifts", label: "Shifts / MultiShifts" },
    { id: "payments", label: "Payments" },
    { id: "questions", label: "Questions" },
    { id: "preview", label: "Final Preview" },
];

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

function fieldValue(row: ImportRow, field: string) {
    const data = row.normalizedData;
    if (!data) return "";
    if (field === "student") return data.student?.name ?? "";
    if (field === "phone") return data.student?.phone ?? "";
    if (field === "joinedAt") return data.student?.joinedAt?.slice(0, 10) ?? "";
    if (field === "fee") return data.student?.monthlyFee ?? "";
    if (field === "seat") return data.allocation?.seatLabel ?? data.seat?.label ?? "";
    if (field === "shift") return data.allocation?.multiShiftName ?? data.allocation?.shiftName ?? data.multiShift?.name ?? data.shift?.name ?? "";
    if (field === "payment") return data.payment?.status ?? data.payment?.rawStatus ?? "";
    return "";
}

export default function ImportSessionPage({ params }: { params: Promise<{ branchId: string; sessionId: string }> }) {
    const { branchId, sessionId } = use(params);
    const router = useRouter();
    const [detail, setDetail] = useState<ImportDetail | null>(null);
    const [activeTab, setActiveTab] = useState<Tab>("overview");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [commitMode, setCommitMode] = useState<CommitMode>("SAFE_PARTIAL");

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            setDetail(await importSessions.detail<ImportDetail>(branchId, sessionId));
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : "Failed to load import session.");
        } finally {
            setLoading(false);
        }
    }, [branchId, sessionId]);

    useEffect(() => {
        load();
    }, [load]);

    const mapping = detail?.mapping?.columnMappings ?? [];
    const options = detail?.mapping?.importOptions ?? {};
    const rows = useMemo(() => detail?.rows ?? [], [detail?.rows]);
    const latestCommit = detail?.commits?.[0];

    const saveMapping = async (columnMappings: ImportColumnMapping[], importOptions?: Partial<ImportOptions>) => {
        setSaving(true);
        setError(null);
        try {
            setDetail(await importSessions.updateMapping<ImportDetail>(branchId, sessionId, { columnMappings, importOptions }));
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
            setDetail(await importSessions.updateRows<ImportDetail>(branchId, sessionId, skipped ? { unskipRowIds: [rowId] } : { skipRowIds: [rowId] }));
        } catch (rowError) {
            setError(rowError instanceof Error ? rowError.message : "Failed to update row.");
        } finally {
            setSaving(false);
        }
    };

    const commit = async () => {
        setSaving(true);
        try {
            await importSessions.commit(branchId, sessionId, commitMode);
            setConfirmOpen(false);
            await load();
        } catch (commitError) {
            setError(commitError instanceof Error ? commitError.message : "Import failed.");
        } finally {
            setSaving(false);
        }
    };

    const readiness = detail?.summary?.readinessScore ?? 0;
    const paidValues = useMemo(() => Array.from(new Set(rows.map(row => row.normalizedData?.payment?.rawStatus).filter(Boolean))) as string[], [rows]);

    return (
        <BranchAccessGuard branchId={branchId} permission="students">
            <PageShell>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <p className={pageEyebrowClass}>AI Data Onboarding</p>
                        <h1 className={pageTitleClass}>Import review</h1>
                        <p className={pageDescriptionClass}>{detail?.fileName ?? "Review mapped staging data before committing."}</p>
                    </div>
                    <AppButton variant="quiet" icon={ArrowLeft} onClick={() => router.push(`/branch/${branchId}/onboarding/import`)}>
                        Back
                    </AppButton>
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

                {!loading && detail && (
                    <>
                        {latestCommit && (
                            <AppPanel title="Import result" description="Final commit report from the last run.">
                                <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
                                    {Object.entries(latestCommit.summary ?? {}).map(([label, value]) => (
                                        <div key={label} className={cn("rounded-[8px] p-3", pageInsetSurfaceClass)}>
                                            <p className={cn("text-xs", pageMutedTextClass)}>{label}</p>
                                            <p className="mt-1 text-xl font-semibold text-[color:var(--text-primary)]">{String(value)}</p>
                                        </div>
                                    ))}
                                </div>
                            </AppPanel>
                        )}

                        <div className="flex gap-2 overflow-x-auto rounded-[8px] border border-[color:var(--ui-table-border)] bg-[color:var(--ui-table-bg)] p-1">
                            {tabs.map(tab => (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setActiveTab(tab.id)}
                                    className={cn(
                                        "h-9 shrink-0 rounded-[var(--ui-radius-control)] px-3 text-sm font-semibold transition-colors",
                                        activeTab === tab.id
                                            ? "bg-[color:var(--ui-button-primary-bg)] text-[color:var(--ui-button-primary-text)]"
                                            : "text-[color:var(--text-secondary)] hover:bg-white/[0.04]"
                                    )}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {activeTab === "overview" && (
                            <AppPanel title="Readiness" description="Rows with review questions must be resolved before final import.">
                                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                                    {[
                                        ["Readiness", `${readiness}%`],
                                        ["Total rows", detail.summary?.totalRows ?? 0],
                                        ["Ready", detail.summary?.readyRows ?? 0],
                                        ["Needs review", detail.summary?.needsReviewRows ?? 0],
                                        ["Blocked", (detail.summary?.blockedRows ?? 0) + (detail.summary?.conflictRows ?? 0)],
                                    ].map(([label, value]) => (
                                        <div key={label} className={cn("rounded-[8px] p-4", pageInsetSurfaceClass)}>
                                            <p className={cn("text-xs", pageMutedTextClass)}>{label}</p>
                                            <p className="mt-2 text-2xl font-semibold text-[color:var(--text-primary)]">{value}</p>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-4 flex flex-wrap gap-2">
                                    {Object.entries(detail.summary?.detectedEntityCounts ?? {}).map(([entity, count]) => (
                                        <Badge key={entity} variant={count > 0 ? "cyan" : "default"}>{entity}: {count}</Badge>
                                    ))}
                                </div>
                            </AppPanel>
                        )}

                        {activeTab === "mapping" && (
                            <AppPanel title="Column mapping" description={detail.mapping?.usedFallback ? "AI was unavailable, so fallback mapping is active." : "Review AI suggestions and adjust target fields."}>
                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[720px] text-left text-sm">
                                        <thead className="text-xs uppercase text-[color:var(--text-muted)]">
                                            <tr><th className="p-3">Uploaded column</th><th className="p-3">Target field</th><th className="p-3">Confidence</th><th className="p-3">Reason</th></tr>
                                        </thead>
                                        <tbody>
                                            {mapping.map((item, index) => (
                                                <tr key={item.sourceColumn} className="border-t border-[color:var(--ui-table-divider)]">
                                                    <td className="p-3 text-[color:var(--text-primary)]">{item.sourceColumn}</td>
                                                    <td className="p-3">
                                                        <select
                                                            value={item.targetField}
                                                            onChange={(event) => {
                                                                const next = [...mapping];
                                                                next[index] = { ...item, targetField: event.target.value as ImportColumnMapping["targetField"], confidence: 100, reason: "Manually selected." };
                                                                saveMapping(next);
                                                            }}
                                                            className="w-full rounded-[8px] border border-[color:var(--ui-form-field-border)] bg-[color:var(--ui-form-field-bg)] p-2 text-[color:var(--text-primary)]"
                                                        >
                                                            {IMPORT_TARGET_FIELDS.map(field => <option key={field} value={field}>{field}</option>)}
                                                        </select>
                                                    </td>
                                                    <td className="p-3">{item.confidence}%</td>
                                                    <td className={cn("p-3", pageMutedTextClass)}>{item.reason ?? "No reason"}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </AppPanel>
                        )}

                        {["students", "seats", "shifts"].includes(activeTab) && (
                            <AppPanel title="Review grid" description="Correct mappings, answer questions, or skip rows before final import.">
                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[960px] text-left text-sm">
                                        <thead className="text-xs uppercase text-[color:var(--text-muted)]">
                                            <tr>
                                                <th className="p-3">Status</th><th className="p-3">Student</th><th className="p-3">Phone</th><th className="p-3">Joined</th><th className="p-3">Fee</th><th className="p-3">Seat</th><th className="p-3">Shift</th><th className="p-3">Issues</th><th className="p-3">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {rows.map(row => (
                                                <tr key={row.id} className="border-t border-[color:var(--ui-table-divider)]">
                                                    <td className="p-3"><Badge variant={statusVariant(row.status)}>{statusLabels[row.status] ?? row.status}</Badge></td>
                                                    <td className="p-3 text-[color:var(--text-primary)]">{fieldValue(row, "student")}</td>
                                                    <td className="p-3">{fieldValue(row, "phone")}</td>
                                                    <td className="p-3">{fieldValue(row, "joinedAt")}</td>
                                                    <td className="p-3">{fieldValue(row, "fee")}</td>
                                                    <td className="p-3">{fieldValue(row, "seat")}</td>
                                                    <td className="p-3">{fieldValue(row, "shift")}</td>
                                                    <td className="p-3 max-w-xs truncate" title={[...row.issues, ...row.warnings].map(issue => issue.message).join("\n")}>
                                                        {[...row.issues, ...row.warnings][0]?.message ?? "None"}
                                                    </td>
                                                    <td className="p-3">
                                                        <AppButton size="sm" variant="quiet" onClick={() => skipRow(row.id, row.skipped)} isLoading={saving}>
                                                            {row.skipped ? "Unskip" : "Skip"}
                                                        </AppButton>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </AppPanel>
                        )}

                        {activeTab === "payments" && (
                            <AppPanel title="Payment decisions" description="Payment cycle and paid/unpaid mapping must be explicit.">
                                <div className="grid gap-4 lg:grid-cols-3">
                                    <label className="space-y-2">
                                        <span className="text-xs font-semibold uppercase text-[color:var(--text-muted)]">Payment cycle</span>
                                        <select value={options.paymentCycle ?? ""} onChange={(event) => updateOption({ paymentCycle: event.target.value as ImportOptions["paymentCycle"] })} className="w-full rounded-[8px] border border-[color:var(--ui-form-field-border)] bg-[color:var(--ui-form-field-bg)] p-2 text-sm text-[color:var(--text-primary)]">
                                            <option value="">Choose cycle</option>
                                            <option value="CURRENT_MONTH">Current month</option>
                                            <option value="PREVIOUS_MONTH">Previous month</option>
                                            <option value="CUSTOM_PERIOD">Custom period</option>
                                            <option value="USE_JOINED_AT_ANNIVERSARY">JoinedAt anniversary</option>
                                            <option value="SKIP_PAYMENTS">Import students only</option>
                                        </select>
                                    </label>
                                    <label className="space-y-2">
                                        <span className="text-xs font-semibold uppercase text-[color:var(--text-muted)]">After student import</span>
                                        <select value={options.paymentAction ?? ""} onChange={(event) => updateOption({ paymentAction: event.target.value as ImportOptions["paymentAction"] })} className="w-full rounded-[8px] border border-[color:var(--ui-form-field-border)] bg-[color:var(--ui-form-field-bg)] p-2 text-sm text-[color:var(--text-primary)]">
                                            <option value="">Choose action</option>
                                            <option value="GENERATE_DUE">Generate due payments</option>
                                            <option value="IMPORT_PAID_UNPAID">Import paid/unpaid from file</option>
                                            <option value="SKIP_PAYMENTS">Skip payments for now</option>
                                        </select>
                                    </label>
                                    <label className="space-y-2">
                                        <span className="text-xs font-semibold uppercase text-[color:var(--text-muted)]">Fallback method</span>
                                        <select value={options.paymentMapping?.defaultMethod ?? ""} onChange={(event) => updateOption({ paymentMapping: { ...(options.paymentMapping ?? { paidValues: [], unpaidValues: [], waivedValues: [], unclearValues: [], confirmed: false }), defaultMethod: event.target.value as NonNullable<ImportOptions["paymentMapping"]>["defaultMethod"] } })} className="w-full rounded-[8px] border border-[color:var(--ui-form-field-border)] bg-[color:var(--ui-form-field-bg)] p-2 text-sm text-[color:var(--text-primary)]">
                                            <option value="">No fallback</option>
                                            <option value="CASH">Cash</option>
                                            <option value="UPI">UPI</option>
                                            <option value="BANK_TRANSFER">Bank transfer</option>
                                        </select>
                                    </label>
                                </div>
                                <div className="mt-5">
                                    <p className="mb-2 text-xs font-semibold uppercase text-[color:var(--text-muted)]">Detected payment values</p>
                                    <div className="flex flex-wrap gap-2">
                                        {paidValues.length === 0 ? <span className={pageMutedTextClass}>No payment status values detected.</span> : paidValues.map(value => <Badge key={value} variant="warning">{value}</Badge>)}
                                    </div>
                                    <AppButton
                                        className="mt-4"
                                        variant="secondary"
                                        icon={CheckCircle2}
                                        onClick={() => updateOption({
                                            paymentMapping: {
                                                paidValues: ["paid", "yes", "done", "clear", "cleared", "received"],
                                                unpaidValues: ["unpaid", "no", "due", "pending", "not paid"],
                                                waivedValues: ["waived", "free", "skip"],
                                                unclearValues: paidValues,
                                                confirmed: true,
                                                defaultMethod: options.paymentMapping?.defaultMethod,
                                            },
                                        })}
                                    >
                                        Confirm common paid/unpaid mapping
                                    </AppButton>
                                </div>
                            </AppPanel>
                        )}

                        {activeTab === "questions" && (
                            <AppPanel title="Questions" description="Answers revalidate affected rows.">
                                <div className="space-y-3">
                                    {detail.questions.length === 0 && <p className={pageMutedTextClass}>No open questions.</p>}
                                    {detail.questions.map(question => (
                                        <div key={question.id} className={cn("rounded-[8px] p-4", pageInsetSurfaceClass)}>
                                            <div className="flex items-start gap-3">
                                                <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                                                <div className="min-w-0 flex-1">
                                                    <p className="font-medium text-[color:var(--text-primary)]">{question.question}</p>
                                                    {question.field && <p className={cn("mt-1 text-xs", pageMutedTextClass)}>{question.field}</p>}
                                                    <div className="mt-3 flex flex-wrap gap-2">
                                                        {(question.options ?? []).map(option => (
                                                            <AppButton
                                                                key={option}
                                                                size="sm"
                                                                variant="secondary"
                                                                onClick={async () => {
                                                                    setSaving(true);
                                                                    setDetail(await importSessions.answerQuestion<ImportDetail>(branchId, sessionId, { questionId: question.id, answer: option, applyToAffectedRows: true }));
                                                                    setSaving(false);
                                                                }}
                                                            >
                                                                {option}
                                                            </AppButton>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </AppPanel>
                        )}

                        {activeTab === "preview" && (
                            <AppPanel title="Final preview" description="This is the exact import surface for the current validated rows.">
                                <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
                                    {[
                                        ["Students", rows.filter(row => ["READY", "WARNING"].includes(row.status) && row.normalizedData?.student?.name).length],
                                        ["Allocations", rows.filter(row => ["READY", "WARNING"].includes(row.status) && fieldValue(row, "seat") && fieldValue(row, "shift")).length],
                                        ["Payments", rows.filter(row => ["READY", "WARNING"].includes(row.status) && row.normalizedData?.payment).length],
                                        ["Skipped", rows.filter(row => row.status === "SKIPPED").length],
                                        ["Warnings", rows.filter(row => row.warnings.length > 0).length],
                                        ["Blocked", rows.filter(row => ["BLOCKED", "CONFLICT"].includes(row.status)).length],
                                    ].map(([label, value]) => (
                                        <div key={label} className={cn("rounded-[8px] p-3", pageInsetSurfaceClass)}>
                                            <p className={cn("text-xs", pageMutedTextClass)}>{label}</p>
                                            <p className="mt-1 text-xl font-semibold text-[color:var(--text-primary)]">{value}</p>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-5 flex flex-wrap items-center gap-3">
                                    <select value={commitMode} onChange={(event) => setCommitMode(event.target.value as CommitMode)} className="h-10 rounded-[8px] border border-[color:var(--ui-form-field-border)] bg-[color:var(--ui-form-field-bg)] px-3 text-sm text-[color:var(--text-primary)]">
                                        <option value="SAFE_PARTIAL">Safe partial</option>
                                        <option value="STRICT_ALL_OR_NOTHING">Strict all or nothing</option>
                                    </select>
                                    <AppButton variant="primary" icon={UploadCloud} onClick={() => setConfirmOpen(true)} disabled={detail.status !== "READY_TO_COMMIT"}>
                                        Confirm and import
                                    </AppButton>
                                    <span className={cn("text-xs", pageMutedTextClass)}>Current session status: <span className={pageCountBadgeClass}>{detail.status}</span></span>
                                </div>
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
                    description="This will create business records through existing services. Blocked rows stay in the import workspace."
                    confirmText="Confirm and import"
                />
            </PageShell>
        </BranchAccessGuard>
    );
}
