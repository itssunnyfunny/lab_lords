
import { useTranslation } from "@/components/settings/LocalizedText";import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Pencil, RotateCcw, Save, UserRoundCheck } from "lucide-react";
import { AppButton, AppPanel, AppSelect } from "@/components/ui";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { importRowFieldValue } from "@/importing/utils/manual-row-draft";
import { pageInsetSurfaceClass, pageMutedTextClass, pageTableBodyDividerClass, pageTableHeadClass, pageTableRowClass } from "@/components/ui/pageSurface";
import { pickerSectionLabelClass } from "@/components/ui/pickerSurface";
import { AccessibleTableScroll, formatAmount, importFieldClass, IssueList, rowFilterLabels, StatusBadge } from "./shared";
import { CompactImportAllocationPicker } from "./CompactImportAllocationPicker";
import type { ImportDetail, ImportGoal, ImportRow, RowDraft, RowFilter, RowPreview } from "./types";

type RowsStepProps = {
    branchId: string;
    sessionId: string;
    detail: ImportDetail;
    rows: ImportRow[];
    rowFilter: RowFilter;
    selectedRow: ImportRow | null;
    selectedDraft?: RowDraft;
    rowPreview: RowPreview | null;
    rowPreviewLoading: boolean;
    saving: boolean;
    mutationsDisabled: boolean;
    goal: ImportGoal;
    dirty: boolean;
    onFilterChange: (filter: RowFilter) => void;
    onSelectRow: (rowId: string) => void;
    onLoadMore: () => void;
    onDraftChange: (rowId: string, field: keyof RowDraft, value: string) => void;
    onFeeLinkChange: (rowId: string, linked: boolean) => void;
    feeLinked: boolean;
    onSaveRow: () => void;
    onSaveAndNext: () => void;
    onResetRow: () => void;
    onSkipRow: () => void;
    onImportStudentOnly: () => void;
    activeIssue: { code: string; label: string; count: number } | null;
    onBulkSetSkipped: (rowIds: string[], skipped: boolean) => Promise<boolean>;
    onBulkAffectedIssue: (issueCode: string, skipped: boolean) => Promise<boolean>;
};

const paymentStatusOptions = ["", "DUE", "PAID", "WAIVED", "UNCLEAR"];

function rowTitle(row: ImportRow) {
    return importRowFieldValue(row, "studentName") || "No student name";
}

function rowSubtitle(row: ImportRow) {
    return [
        importRowFieldValue(row, "seat"),
        importRowFieldValue(row, "multiShift") || importRowFieldValue(row, "shift"),
    ].filter(Boolean).join(" / ") || "No seat or shift";
}

export function RowsStep({
    branchId,
    sessionId,
    detail,
    rows,
    rowFilter,
    selectedRow,
    selectedDraft,
    rowPreview,
    rowPreviewLoading,
    saving,
    mutationsDisabled,
    goal,
    dirty,
    onFilterChange,
    onSelectRow,
    onLoadMore,
    onDraftChange,
    onFeeLinkChange,
    feeLinked,
    onSaveRow,
    onSaveAndNext,
    onResetRow,
    onSkipRow,
    onImportStudentOnly,
    activeIssue,
    onBulkSetSkipped,
    onBulkAffectedIssue,
}: RowsStepProps) {
    const t = useTranslation();
    const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(() => new Set());
    const [pendingBulkAction, setPendingBulkAction] = useState<"SKIP" | "UNSKIP" | "ISSUE_SKIP" | "ISSUE_UNSKIP" | null>(null);
    const selectAllRef = useRef<HTMLInputElement>(null);
    const visibleRowIds = useMemo(() => rows.map(row => row.id), [rows]);
    const visibleRowIdSet = useMemo(() => new Set(visibleRowIds), [visibleRowIds]);
    const selectedVisibleIds = useMemo(
        () => visibleRowIds.filter(rowId => selectedRowIds.has(rowId)),
        [selectedRowIds, visibleRowIds]
    );
    const allVisibleSelected = visibleRowIds.length > 0 && selectedVisibleIds.length === visibleRowIds.length;
    const someVisibleSelected = selectedVisibleIds.length > 0 && !allVisibleSelected;

    useEffect(() => {
        setSelectedRowIds(current => {
            const next = new Set(Array.from(current).filter(rowId => visibleRowIdSet.has(rowId)));
            if (next.size === current.size && Array.from(next).every(rowId => current.has(rowId))) return current;
            return next;
        });
    }, [visibleRowIdSet]);

    useEffect(() => {
        if (selectAllRef.current) selectAllRef.current.indeterminate = someVisibleSelected;
    }, [someVisibleSelected]);

    const toggleRowSelection = (rowId: string, checked: boolean) => {
        setSelectedRowIds(current => {
            const next = new Set(current);
            if (checked) next.add(rowId);
            else next.delete(rowId);
            return next;
        });
    };

    const runSelectedBulkAction = async (skipped: boolean) => {
        if (selectedVisibleIds.length === 0) return;
        setPendingBulkAction(skipped ? "SKIP" : "UNSKIP");
        try {
            const saved = await onBulkSetSkipped(selectedVisibleIds, skipped);
            if (saved) setSelectedRowIds(new Set());
        } finally {
            setPendingBulkAction(null);
        }
    };

    const runAffectedBulkAction = async (skipped: boolean) => {
        if (!activeIssue) return;
        setPendingBulkAction(skipped ? "ISSUE_SKIP" : "ISSUE_UNSKIP");
        try {
            await onBulkAffectedIssue(activeIssue.code, skipped);
        } finally {
            setPendingBulkAction(null);
        }
    };
    const branchContext = detail.branchContext;
    const liveIssues = rowPreview
        ? [...rowPreview.issues, ...rowPreview.warnings]
        : selectedRow
            ? [...selectedRow.issues, ...selectedRow.warnings]
            : [];
    const currentPaymentStatus = selectedDraft?.paymentStatus ?? "";
    const hasCustomPaymentStatus = currentPaymentStatus && !paymentStatusOptions.includes(currentPaymentStatus);
    const bulkActionsDisabled = mutationsDisabled || saving || dirty;

    return (
        <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
            <AppPanel
                title={t("Rows")}
                description={detail.rowPage ? `${detail.rowPage.returnedRows} of ${detail.rowPage.filteredRows}` : t("Paged staging rows")}
                action={
                    <AppSelect
                        aria-label={t("Filter import rows")}
                        value={rowFilter}
                        disabled={dirty || saving}
                        aria-describedby={dirty ? "import-row-unsaved" : undefined}
                        onValueChange={value => onFilterChange(value as RowFilter)}
                        options={(["attention", "ready", "all", "skipped"] as RowFilter[]).map(filter => ({
                            value: filter,
                            label: rowFilterLabels[filter],
                        }))}
                        className="h-11 min-h-11 px-2 py-0 text-xs lg:h-8 lg:min-h-8"
                    />
                }
                contentClassName="p-0"
            >
                <div className="space-y-3 border-b border-[color:var(--ui-form-section-divider)] p-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <label className="inline-flex min-h-10 items-center gap-2 text-xs font-semibold text-[color:var(--text-secondary)]">
                            <input
                                ref={selectAllRef}
                                type="checkbox"
                                checked={allVisibleSelected}
                                disabled={rows.length === 0 || saving}
                                onChange={event => setSelectedRowIds(event.target.checked ? new Set(visibleRowIds) : new Set())}
                                className="h-4 w-4 accent-cyan-300"
                            />
                            {t("Select visible rows")}</label>
                        <span className={cn("text-xs", pageMutedTextClass)} role="status" aria-live="polite">{t("{count} selected", { count: selectedVisibleIds.length })}</span>
                    </div>
                    <div className="flex flex-wrap gap-2" role="group" aria-label={t("Selected row actions")}>
                        <AppButton
                            size="sm"
                            variant="secondary"
                            disabled={bulkActionsDisabled || selectedVisibleIds.length === 0}
                            aria-describedby={dirty ? "import-row-bulk-blocked" : mutationsDisabled ? "import-session-mutation-blocker" : undefined}
                            isLoading={pendingBulkAction === "SKIP"}
                            onClick={() => void runSelectedBulkAction(true)}
                        >
                            {t("Skip selected")}</AppButton>
                        <AppButton
                            size="sm"
                            variant="quiet"
                            disabled={bulkActionsDisabled || selectedVisibleIds.length === 0}
                            aria-describedby={dirty ? "import-row-bulk-blocked" : mutationsDisabled ? "import-session-mutation-blocker" : undefined}
                            isLoading={pendingBulkAction === "UNSKIP"}
                            onClick={() => void runSelectedBulkAction(false)}
                        >
                            {t("Unskip selected")}</AppButton>
                        {selectedVisibleIds.length > 0 && (
                            <AppButton size="sm" variant="quiet" disabled={saving} onClick={() => setSelectedRowIds(new Set())}>
                                {t("Clear selection")}</AppButton>
                        )}
                    </div>
                    {dirty && (
                        <p id="import-row-bulk-blocked" className="text-xs text-amber-200" role="status">
                            {t("Save or reset the open row before applying a bulk action.")}</p>
                    )}

                    {activeIssue ? (
                        <div className={cn("space-y-2 p-3", pageInsetSurfaceClass)}>
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="warning">{t("Active issue")}</Badge>
                                <p className="text-xs font-semibold text-[color:var(--text-primary)]">{activeIssue.label}</p>
                                <Badge variant="default">{t("{count} affected", { count: activeIssue.count })}</Badge>
                            </div>
                            <p className={cn("text-xs leading-5", pageMutedTextClass)}>{t("Apply to every unresolved row with issue code {replace}, including rows not loaded in this list.", { replace: activeIssue.code.replace(/_/g, " ") })}</p>
                            <div className="flex flex-wrap gap-2" role="group" aria-label={`All rows affected by ${activeIssue.label}`}>
                                <AppButton
                                    size="sm"
                                    variant="secondary"
                                    disabled={bulkActionsDisabled}
                                    aria-describedby={dirty ? "import-row-bulk-blocked" : mutationsDisabled ? "import-session-mutation-blocker" : undefined}
                                    isLoading={pendingBulkAction === "ISSUE_SKIP"}
                                    onClick={() => void runAffectedBulkAction(true)}
                                >{t("Skip all {count} affected", { count: activeIssue.count })}</AppButton>
                                <AppButton
                                    size="sm"
                                    variant="quiet"
                                    disabled={bulkActionsDisabled}
                                    aria-describedby={dirty ? "import-row-bulk-blocked" : mutationsDisabled ? "import-session-mutation-blocker" : undefined}
                                    isLoading={pendingBulkAction === "ISSUE_UNSKIP"}
                                    onClick={() => void runAffectedBulkAction(false)}
                                >
                                    {t("Unskip all affected")}</AppButton>
                            </div>
                        </div>
                    ) : (
                        <p className={cn("text-xs leading-5", pageMutedTextClass)}>
                            {t("Open an issue group from “Fix these first” to apply an action to every affected row.")}</p>
                    )}
                </div>
                <div className="max-h-[680px] overflow-y-auto p-2">
                    {rows.length === 0 && <p className={cn("p-3 text-sm", pageMutedTextClass)}>{t("No rows in this filter.")}</p>}
                    {rows.map(row => {
                        const issues = [...row.issues, ...row.warnings];
                        const selected = selectedRow?.id === row.id;
                        const bulkSelected = selectedRowIds.has(row.id);
                        return (
                            <div
                                key={row.id}
                                className={cn(
                                    "mb-2 flex w-full overflow-hidden rounded-[8px] border text-left transition-colors hover:bg-white/[0.04]",
                                    selected
                                        ? "border-[color:var(--ui-badge-cyan-border)] bg-[color:var(--ui-badge-cyan-bg)]"
                                        : "border-[color:var(--ui-form-surface-border)] bg-[color:var(--ui-form-muted-surface-bg)]"
                                )}
                            >
                                <label className="flex min-w-11 shrink-0 cursor-pointer items-start justify-center border-r border-[color:var(--ui-form-section-divider)] p-3">
                                    <input
                                        type="checkbox"
                                        checked={bulkSelected}
                                        disabled={saving}
                                        aria-label={`Select row ${row.rowNumber}: ${rowTitle(row)}`}
                                        onChange={event => toggleRowSelection(row.id, event.target.checked)}
                                        className="mt-0.5 h-4 w-4 accent-cyan-300"
                                    />
                                </label>
                                <button
                                    type="button"
                                    aria-current={selected ? "true" : undefined}
                                    onClick={() => onSelectRow(row.id)}
                                    className="min-w-0 flex-1 p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:var(--ui-focus-ring)]"
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-semibold text-[color:var(--text-primary)]">
                                                {t("Row")} {row.rowNumber}: {rowTitle(row)}
                                            </p>
                                            <p className={cn("mt-1 truncate text-xs", pageMutedTextClass)}>{rowSubtitle(row)}</p>
                                        </div>
                                        <StatusBadge status={row.status} />
                                    </div>
                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                        {row.skipped && <Badge variant="default">{t("skipped")}</Badge>}
                                        {issues[0] && (
                                            <Badge variant={issues[0].severity === "error" ? "danger" : issues[0].severity === "warning" ? "warning" : "cyan"}>
                                                {issues[0].code.replace(/_/g, " ")}
                                            </Badge>
                                        )}
                                    </div>
                                </button>
                            </div>
                        );
                    })}
                    {detail.rowPage?.hasMore && (
                        <AppButton className="mt-2 w-full" size="sm" variant="secondary" onClick={onLoadMore} isLoading={saving}>
                            {t("Load more rows")}</AppButton>
                    )}
                </div>
            </AppPanel>

            <div className="space-y-5">
                <AppPanel
                    title={selectedRow ? `Row ${selectedRow.rowNumber}` : t("Select a row")}
                    description={selectedRow ? rowTitle(selectedRow) : t("Choose a row from the left list.")}
                    action={selectedRow && selectedDraft ? (
                        <div className="flex flex-wrap gap-2">
                            {dirty && <Badge variant="warning">{t("Unsaved")}</Badge>}
                            <AppButton
                                size="sm"
                                variant="primary"
                                icon={Save}
                                onClick={onSaveRow}
                                disabled={mutationsDisabled}
                                aria-describedby={mutationsDisabled ? "import-session-mutation-blocker" : undefined}
                                isLoading={saving}
                            >
                                {t("Save")}</AppButton>
                            <AppButton size="sm" variant="quiet" icon={RotateCcw} onClick={onResetRow} disabled={saving}>
                                {t("Reset")}</AppButton>
                        </div>
                    ) : null}
                >
                    {!selectedRow || !selectedDraft ? (
                        <p className={pageMutedTextClass}>{t("Select a row to review.")}</p>
                    ) : (
                        <div className="space-y-5">
                            {dirty && (
                                <div id="import-row-unsaved" className="rounded-[8px] border border-amber-400/25 bg-amber-400/10 p-3 text-xs text-amber-100" role="status">
                                    {t("This row has unsaved edits. Save or reset it before switching rows, filters, or steps.")}</div>
                            )}
                            <div className="grid gap-4 lg:grid-cols-2">
                                <label className="space-y-2">
                                    <span className={pickerSectionLabelClass}>{t("Student name")}</span>
                                    <input value={selectedDraft.studentName} onChange={event => onDraftChange(selectedRow.id, "studentName", event.target.value)} className={cn("w-full", importFieldClass)} />
                                </label>
                                <label className="space-y-2">
                                    <span className={pickerSectionLabelClass}>{t("Phone")}</span>
                                    <input type="tel" inputMode="tel" value={selectedDraft.phone} onChange={event => onDraftChange(selectedRow.id, "phone", event.target.value)} className={cn("w-full", importFieldClass)} />
                                </label>
                                <label className="space-y-2">
                                    <span className={pickerSectionLabelClass}>{t("Joined date")}</span>
                                    <input type="date" value={selectedDraft.joinedAt} onChange={event => onDraftChange(selectedRow.id, "joinedAt", event.target.value)} className={cn("w-full", importFieldClass)} />
                                </label>
                                <label className="space-y-2">
                                    <span className={pickerSectionLabelClass}>{t("Monthly fee")}</span>
                                    <input inputMode="decimal" value={selectedDraft.fee} onChange={event => onDraftChange(selectedRow.id, "fee", event.target.value)} className={cn("w-full", importFieldClass)} />
                                </label>
                            </div>

                            {goal !== "STUDENTS" && (
                                <CompactImportAllocationPicker
                                    branchId={branchId}
                                    sessionId={sessionId}
                                    rowId={selectedRow.id}
                                    draft={selectedDraft}
                                    branchContext={branchContext}
                                    feeLinked={feeLinked}
                                    onDraftChange={(field, value) => onDraftChange(selectedRow.id, field, value)}
                                    onFeeLinkChange={linked => onFeeLinkChange(selectedRow.id, linked)}
                                />
                            )}

                            {goal === "FULL" && <div className={cn("p-4", pageInsetSurfaceClass)}>
                                <p className="text-sm font-semibold text-[color:var(--text-primary)]">{t("Payment amount default")}</p>
                                <p className={cn("mt-1 text-xs leading-5", pageMutedTextClass)}>
                                    {t("If this row has no payment override, payment generation uses the student monthly fee. Open the override only when this row has a different amount, paid status, method, or reference.")}</p>
                            </div>}

                            {goal === "FULL" && <details className={cn("group rounded-[8px] border border-[color:var(--ui-form-surface-border)] bg-[color:var(--ui-form-muted-surface-bg)]")}>
                                <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-[color:var(--text-primary)]">
                                    {t("Row payment override")}<span className={cn("ml-2 text-xs font-normal", pageMutedTextClass)}>
                                        {t("Optional row-level amount/status correction")}</span>
                                </summary>
                                <div className="grid gap-4 border-t border-[color:var(--ui-form-section-divider)] p-4 lg:grid-cols-4">
                                    <label className="space-y-2">
                                        <span className={pickerSectionLabelClass}>{t("Payment amount")}</span>
                                        <input inputMode="decimal" value={selectedDraft.paymentAmount} onChange={event => onDraftChange(selectedRow.id, "paymentAmount", event.target.value)} className={cn("w-full", importFieldClass)} />
                                    </label>
                                    <label className="space-y-2">
                                        <span className={pickerSectionLabelClass}>{t("Payment status")}</span>
                                        <AppSelect
                                            value={selectedDraft.paymentStatus}
                                            onValueChange={value => onDraftChange(selectedRow.id, "paymentStatus", value)}
                                            options={[
                                                ...(hasCustomPaymentStatus ? [{ value: currentPaymentStatus, label: `Raw: ${currentPaymentStatus}` }] : []),
                                                { value: "", label: t("No row status") },
                                                { value: "DUE", label: t("Due") },
                                                { value: "PAID", label: t("Paid") },
                                                { value: "WAIVED", label: t("Waived") },
                                                { value: "UNCLEAR", label: t("Unclear") },
                                            ]}
                                        />
                                    </label>
                                    <label className="space-y-2">
                                        <span className={pickerSectionLabelClass}>{t("Method")}</span>
                                        <AppSelect
                                            value={selectedDraft.paymentMethod}
                                            onValueChange={value => onDraftChange(selectedRow.id, "paymentMethod", value)}
                                            options={[
                                                { value: "", label: t("No method") },
                                                { value: "CASH", label: t("Cash") },
                                                { value: "UPI", label: "UPI" },
                                                { value: "BANK_TRANSFER", label: t("Bank transfer") },
                                            ]}
                                        />
                                    </label>
                                    <label className="space-y-2">
                                        <span className={pickerSectionLabelClass}>{t("Reference")}</span>
                                        <input value={selectedDraft.referenceId} onChange={event => onDraftChange(selectedRow.id, "referenceId", event.target.value)} className={cn("w-full", importFieldClass)} />
                                    </label>
                                </div>
                            </details>}

                            <div className="flex flex-wrap items-center gap-3 border-t border-[color:var(--ui-form-section-divider)] pt-4">
                                <AppButton
                                    variant="primary"
                                    icon={Save}
                                    onClick={onSaveAndNext}
                                    disabled={mutationsDisabled}
                                    aria-describedby={mutationsDisabled ? "import-session-mutation-blocker" : undefined}
                                    isLoading={saving}
                                >
                                    {t("Save & next")}</AppButton>
                                {goal !== "STUDENTS" && <AppButton
                                    variant="secondary"
                                    icon={UserRoundCheck}
                                    onClick={onImportStudentOnly}
                                    disabled={mutationsDisabled}
                                    aria-describedby={mutationsDisabled ? "import-session-mutation-blocker" : undefined}
                                    isLoading={saving}
                                >
                                    {t("Import student only")}</AppButton>}
                                <AppButton
                                    variant="quiet"
                                    icon={Pencil}
                                    onClick={onSkipRow}
                                    disabled={mutationsDisabled}
                                    aria-describedby={mutationsDisabled ? "import-session-mutation-blocker" : undefined}
                                    isLoading={saving}
                                >
                                    {selectedRow.skipped ? t("Unskip row") : t("Skip row")}
                                </AppButton>
                                {rowPreviewLoading && (
                                    <span className="inline-flex items-center gap-2 text-xs text-[color:var(--text-muted)]" role="status" aria-live="polite">
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        {t("Checking row")}</span>
                                )}
                            </div>
                        </div>
                    )}
                </AppPanel>

                <AppPanel title={t("Row checks")} description={t("Validation checks for the selected row.")}>
                    <IssueList issues={liveIssues} />
                </AppPanel>

                {goal === "FULL" && rowPreview?.paymentPreview && (
                    <AppPanel title={t("Payment preview")} description={rowPreview.paymentPreview.enabled ? t("Payment impact for this row.") : t("Payments are currently skipped or incomplete.")}>
                        <div className="grid gap-3 sm:grid-cols-4">
                            <div className={cn("p-3", pageInsetSurfaceClass)}>
                                <p className={cn("text-xs", pageMutedTextClass)}>{t("Amount")}</p>
                                <p className="mt-1 text-sm font-semibold text-[color:var(--text-primary)]">{formatAmount(rowPreview.paymentPreview.amount)}</p>
                            </div>
                            <div className={cn("p-3", pageInsetSurfaceClass)}>
                                <p className={cn("text-xs", pageMutedTextClass)}>{t("Source")}</p>
                                <p className="mt-1 text-sm font-semibold text-[color:var(--text-primary)]">{rowPreview.paymentPreview.amountSource}</p>
                            </div>
                            <div className={cn("p-3", pageInsetSurfaceClass)}>
                                <p className={cn("text-xs", pageMutedTextClass)}>{t("Status")}</p>
                                <p className="mt-1 text-sm font-semibold text-[color:var(--text-primary)]">{rowPreview.paymentPreview.status ?? "-"}</p>
                            </div>
                            <div className={cn("p-3", pageInsetSurfaceClass)}>
                                <p className={cn("text-xs", pageMutedTextClass)}>{t("Method")}</p>
                                <p className="mt-1 text-sm font-semibold text-[color:var(--text-primary)]">{rowPreview.paymentPreview.method ?? "-"}</p>
                            </div>
                        </div>
                        <p className={cn("mt-3 text-xs leading-5", pageMutedTextClass)}>{rowPreview.paymentPreview.message}</p>
                    </AppPanel>
                )}

                <AppPanel title={t("Raw source")} description={t("Original values from the uploaded file.")}>
                    {!selectedRow ? (
                        <p className={pageMutedTextClass}>{t("Select a row.")}</p>
                    ) : (
                        <AccessibleTableScroll
                            label={`Raw source values for row ${selectedRow.rowNumber}`}
                            className="rounded-[8px] border border-[color:var(--ui-table-border)]"
                        >
                            <table className="w-full min-w-[540px] text-left text-xs">
                                <caption className="sr-only">{t("Raw source values for row {rowNumber}", { rowNumber: selectedRow.rowNumber })}</caption>
                                <thead className={pageTableHeadClass}>
                                    <tr>
                                        <th scope="col" className="p-2">{t("Column")}</th>
                                        <th scope="col" className="p-2">{t("Value")}</th>
                                    </tr>
                                </thead>
                                <tbody className={pageTableBodyDividerClass}>
                                    {Object.entries(selectedRow.rawData).map(([key, value]) => (
                                        <tr key={key} className={pageTableRowClass}>
                                            <th scope="row" className="p-2 text-left font-semibold text-[color:var(--text-primary)]">{key}</th>
                                            <td className={cn("p-2", pageMutedTextClass)}>{value || "-"}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </AccessibleTableScroll>
                    )}
                </AppPanel>
            </div>
        </div>
    );
}
