"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AppButton, AppPanel, PageShell } from "@/components/ui";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { LocalizedError, useTranslation } from "@/components/settings/LocalizedText";
import { useUserPreferences } from "@/components/settings/UserPreferencesApplier";
import { importSessions } from "@/lib/api/importSessions";
import type { CapabilityDecision } from "@/types";
import type { ImportReadinessPolicy } from "@/importing/contracts/import-v2.contract";
import { draftFromImportRowWithFallback, normalizedFromImportDraft } from "@/importing/utils/manual-row-draft";
import { ColumnsStep } from "./ColumnsStep";
import { RowsStep } from "./RowsStep";
import { PreviewStep } from "./PreviewStep";
import { ResultStep } from "./ResultStep";
import type { ImportDetail, ImportRow, Plan, RowDraft, RowFilter, RowPreview, Run } from "./types";
import { importFieldClass } from "./shared";
import { parseImportMoney } from "@/importing/utils/row-normalizer";

const active = new Set(["QUEUED", "RUNNING", "RETRYABLE_FAILURE", "CANCEL_REQUESTED"]);
type Props = { branchId: string; sessionId: string; importDecision: CapabilityDecision };

function guidedDraft(row: ImportRow, mappings: NonNullable<ImportDetail["mapping"]>["columnMappings"] = []) {
    const draft = draftFromImportRowWithFallback(row, mappings);
    for (const mapping of mappings) {
        const field = mapping.targetField === "payment.amount" ? "paymentAmount" : mapping.targetField === "student.monthlyFee" ? "fee" : null;
        const code = field === "fee" ? "INVALID_MONTHLY_FEE" : "INVALID_PAYMENT_AMOUNT";
        const raw = row.rawData[mapping.sourceColumn];
        if (field && raw?.trim() && row.issues.some(issue => issue.code === code) && parseImportMoney(raw) === undefined) draft[field] = raw;
    }
    return draft;
}

function Interpretation({ source, count, suggestionId, detail, disabled, onApply }: {
    source: string; count: number; suggestionId: string | null; detail: ImportDetail; disabled: boolean;
    onApply: (targetId: string) => void;
}) {
    const t = useTranslation();
    const [target, setTarget] = useState(suggestionId ?? "");
    const choices = [...(detail.branchContext?.shifts ?? []), ...(detail.branchContext?.multiShifts ?? [])];
    return <div className="space-y-3 rounded border border-[color:var(--ui-form-surface-border)] p-4">
        <p>{t("{count} students use “{source}”. Choose what it means.", { count, source })}</p>
        <label className="block text-sm">{t("Branch shift or bundle")}
            <select className={`${importFieldClass} mt-1 w-full`} value={target} disabled={disabled} onChange={e => setTarget(e.target.value)}>
                <option value="">{t("Choose a shift")}</option>
                {choices.map(choice => <option key={choice.id} value={choice.id}>{choice.name}</option>)}
            </select>
        </label>
        {suggestionId && <p className="text-sm">{t("Suggested match — please confirm.")}</p>}
        <AppButton density="compact" disabled={disabled || !target} onClick={() => onApply(target)}>{t("Apply to all matching students")}</AppButton>
    </div>;
}

export function GuidedImportWorkspace({ branchId, sessionId, importDecision }: Props) {
    const t = useTranslation();
    const { formatDate, formatNumber } = useUserPreferences();
    const [detail, setDetail] = useState<ImportDetail | null>(null);
    const [filter, setFilter] = useState<RowFilter>("attention");
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [draft, setDraft] = useState<RowDraft | undefined>();
    const [dirty, setDirty] = useState(false);
    const [feeLinked, setFeeLinked] = useState(false);
    const [columnsDirty, setColumnsDirty] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [stage, setStage] = useState<"help" | "review" | "result">("help");
    const [plan, setPlan] = useState<Plan | null>(null);
    const [policy, setPolicy] = useState<ImportReadinessPolicy>("READY_ROWS_ONLY");
    const [reviewPage, setReviewPage] = useState(0);
    const [confirm, setConfirm] = useState(false);
    const [run, setRun] = useState<Run | null>(null);
    const [preview, setPreview] = useState<RowPreview | null>(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const loadSequence = useRef(0);
    const draftRevision = useRef<number | null>(null);
    const resumeAttempts = useRef(new Map<string, number>());
    const selected = detail?.rows.find(row => row.id === selectedId) ?? null;
    const running = !!detail?.latestRun && active.has(detail.latestRun.status);
    const disabled = busy || running || !importDecision.allowed;
    const mutationDisabled = disabled || selected?.status === "IMPORTED";

    const load = useCallback(async (append = false, cursor?: string | null) => {
        const sequence = ++loadSequence.current;
        const next = await importSessions.detail<ImportDetail>(branchId, sessionId, { rowFilter: filter, limit: 25, ...(cursor ? { cursor } : {}) });
        if (sequence !== loadSequence.current) return;
        setDetail(previous => append && previous?.draftRevision === next.draftRevision
            ? { ...next, rows: [...previous.rows, ...next.rows.filter(row => !previous.rows.some(old => old.id === row.id))] } : next);
        if (next.latestRun?.kind === "COMMIT") {
            setRun(await importSessions.getRun(branchId, next.latestRun.id));
        }
    }, [branchId, sessionId, filter]);

    useEffect(() => { void load().catch(e => setError(e.message)); }, [load]);
    useEffect(() => {
        if (!dirty && detail && !detail.rows.some(row => row.id === selectedId)) setSelectedId(detail.rows[0]?.id ?? null);
    }, [detail, selectedId, dirty]);
    useEffect(() => {
        if (!running) return;
        let alive = true;
        const timer = setInterval(() => { if (alive) void load().catch(e => setError(e.message)); }, 2500);
        const latest = detail?.latestRun;
        if (latest?.dispatchRequired && (resumeAttempts.current.get(latest.id) ?? 0) < 3) {
            resumeAttempts.current.set(latest.id, (resumeAttempts.current.get(latest.id) ?? 0) + 1);
            void importSessions.resumeRun(branchId, latest.id).catch(e => { if (alive) setError(e.message); });
        }
        return () => { alive = false; clearInterval(timer); };
    }, [running, detail?.latestRun, branchId, load]);
    useEffect(() => {
        if (!dirty) {
            const row = detail?.rows.find(item => item.id === selectedId);
            setDraft(row ? guidedDraft(row, detail?.mapping?.columnMappings) : undefined);
            draftRevision.current = detail?.draftRevision ?? null;
            setFeeLinked(["SHIFT_PRICE", "MULTI_SHIFT_PRICE"].includes(row?.normalizedData?.student?.feeSource ?? ""));
        }
    }, [detail, selectedId, dirty]);
    useEffect(() => {
        if (!dirty && !columnsDirty) return;
        const protect = (event: BeforeUnloadEvent) => { event.preventDefault(); };
        window.addEventListener("beforeunload", protect);
        return () => window.removeEventListener("beforeunload", protect);
    }, [dirty, columnsDirty]);
    useEffect(() => {
        if (!selected || !draft) { setPreview(null); return; }
        if ([draft.fee, draft.paymentAmount].some(value => value.trim() && parseImportMoney(value) === undefined)) {
            setPreview(null); setPreviewLoading(false); return;
        }
        let alive = true;
        setPreviewLoading(true);
        const timer = setTimeout(() => {
            void importSessions.previewRow<RowPreview>(branchId, sessionId, { rowId: selected.id,
                normalizedData: normalizedFromImportDraft(selected, draft, detail?.branchContext) })
                .then(result => { if (alive) setPreview(result); })
                .catch(e => { if (alive) setError(e.message); })
                .finally(() => { if (alive) setPreviewLoading(false); });
        }, 300);
        return () => { alive = false; clearTimeout(timer); };
    }, [branchId, sessionId, selected, draft, detail?.branchContext]);

    const canNavigate = () => {
        if (busy) { setError(t("Please wait for the current action to finish.")); return false; }
        if (dirty || columnsDirty) { setError(t("Save or reset your edits before continuing.")); return false; }
        return true;
    };
    const act = async (work: () => Promise<unknown>, message?: string, keepBusy = false) => {
        setBusy(true); setError(null);
        try { await work(); setPlan(null); await load(); if (message) setNotice(message); return true; }
        catch (e) { setError(e instanceof Error ? e.message : t("Import request failed")); return false; }
        finally { if (!keepBusy) setBusy(false); }
    };
    const saveRow = async (next = false, defer = false) => {
        if (!selected || !draft || !detail) return;
        if ([draft.fee, draft.paymentAmount].some(value => value.trim() && parseImportMoney(value) === undefined)) {
            setError(t("Use whole non-negative rupee amounts. Recorded amounts will not be rounded.")); return;
        }
        const normalized = normalizedFromImportDraft(selected, draft, detail.branchContext);
        if (normalized.student && !feeLinked) {
            normalized.student.feeSource = "UPLOADED";
            delete normalized.student.feeLinkedShiftName; delete normalized.student.feeLinkedMultiShiftName;
        }
        if (defer) { normalized.allocation = {}; delete normalized.seat; delete normalized.shift; delete normalized.multiShift; }
        try {
        const ok = await act(async () => {
            await importSessions.updateRows(branchId, sessionId, { expectedRevision: draftRevision.current ?? detail.draftRevision, edits: [{ rowId: selected.id, normalizedData: normalized }] });
            setDirty(false);
        }, t("Saved in the draft. Nothing has been imported yet."), true);
        if (ok && next) {
            // Select the next unresolved student across the full draft, including
            // those outside the current page. The server owns the issue filter.
            const attention = await importSessions.detail<ImportDetail>(branchId, sessionId, { rowFilter: "attention", limit: 25 });
            setFilter("attention"); setDetail(attention);
            setSelectedId(attention.rows.find(row => row.id !== selected.id)?.id ?? attention.rows[0]?.id ?? null);
        }
        } catch (e) { setError(e instanceof Error ? e.message : t("Import request failed")); }
        finally { setBusy(false); }
    };
    const buildPlan = async () => {
        if (!detail || !canNavigate()) return;
        setBusy(true); setError(null);
        try { setPlan(await importSessions.createPlan(branchId, sessionId, policy, detail.draftRevision)); setReviewPage(0); setStage("review"); }
        catch (e) { setError(e instanceof Error ? e.message : t("Import request failed")); }
        finally { setBusy(false); }
    };
    const commit = async () => {
        if (!plan || !detail) return;
        setConfirm(false); setBusy(true); setError(null);
        try {
            const storageKey = `guided-import:${sessionId}:${plan.id}`;
            let key = `import:${plan.id}`;
            try { key = localStorage.getItem(storageKey) ?? key; localStorage.setItem(storageKey, key); } catch { /* deterministic plan identity remains retry-safe */ }
            const started = await importSessions.commitPlan(branchId, sessionId, plan.id, key);
            setRun(await importSessions.getRun(branchId, started.runId)); setStage("result"); await load();
        } catch (e) { setError(e instanceof Error ? e.message : t("Import request failed")); await load(); }
        finally { setBusy(false); }
    };

    if (!detail) return <PageShell><p role="status">{error ? <LocalizedError error={error} /> : t("Preparing your records...")}</p></PageShell>;
    const ready = (detail.summary?.readyRows ?? 0) + (detail.summary?.warningRows ?? 0);
    const outcome = selected?.paymentOutcome;
    const outcomeText = outcome?.state === "CREATE_NOW" ? "Due will be created now" : outcome?.state === "GENERATE_LATER" ? "Due will be generated on {date}" : outcome?.state === "NO_DUE" ? "No eligible due this month" : "Payment information needs review";
    return <PageShell className="space-y-5">
        <Link href={`/branch/${branchId}/onboarding/import`} onClick={e => { if (!canNavigate()) e.preventDefault(); }}>{t("Back to imports")}</Link>
        <h1 className="text-2xl font-semibold">{t("Prepare your students")}</h1>
        <p>{t("Add records → AI prepares → Resolve remaining → Review and import")}</p>
        <p className="text-sm">{detail.fileName} · {t("Tracking starts this month. Original joining dates and future due days stay the same.")}</p>
        {error && <div role="alert"><LocalizedError error={error} /><AppButton density="compact" variant="quiet" onClick={() => { if (canNavigate()) void load().catch(e => setError(e.message)); }}>{t("Refresh")}</AppButton></div>}
        {notice && <p role="status">{notice}</p>}
        {!importDecision.allowed && <p id="import-session-mutation-blocker" role="alert">{t("Import access is currently unavailable.")}</p>}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-live="polite">
            {([["Prepared", ready], ["Needs your help", detail.guidance?.needsHelp ?? 0], ["Imported", detail.guidance?.imported ?? 0], ["Excluded", detail.summary?.skippedRows ?? 0]] as const).map(([label, count]) =>
                <div key={label} className="rounded border border-[color:var(--ui-form-surface-border)] p-3"><p>{t(label)}</p><strong className="text-xl">{formatNumber(Number(count))}</strong></div>)}
        </div>
        <nav className="flex flex-wrap gap-2" aria-label={t("Import progress")}>
            <AppButton density="compact" variant={stage === "help" ? "primary" : "secondary"} onClick={() => { if (canNavigate()) setStage("help"); }}>{t("Needs your help")}</AppButton>
            <AppButton density="compact" disabled={disabled || !ready || dirty || columnsDirty} onClick={() => void buildPlan()}>{t("Review and import")}</AppButton>
            {run && <AppButton density="compact" variant="secondary" onClick={() => { if (canNavigate()) setStage("result"); }}>{t("Import results")}</AppButton>}
        </nav>
        {!!detail.guidance?.partialStudents && <p role="status">{t("{count} student records already exist; their remaining operations still need recovery.", { count: detail.guidance.partialStudents })}</p>}
        {stage === "help" && <>
            <AppPanel title={t("AI preparation")} description={t("Supported matches are prepared automatically. Confirm suggestions or correct the remaining fields.")}>
                {detail.latestRun?.status === "WAITING_FOR_USER" && detail.sourceType === "PDF" && <div className="space-y-3">
                    <p>{t("Check the extracted PDF rows before preparing records.")}</p>
                    {detail.extractionPreview?.map(row => <pre key={row.rowNumber} className="whitespace-pre-wrap break-words text-xs">{Object.entries(row.rawData).map(([key, value]) => `${key}: ${String(value)}`).join(" · ")}</pre>)}
                    <AppButton density="compact" disabled={busy || !importDecision.allowed} onClick={() => void act(() => importSessions.analyze(branchId, sessionId, { confirmPdfExtraction: true }))}>{t("Confirm PDF extraction and prepare")}</AppButton>
                </div>}
                {running && detail.latestRun?.kind === "ANALYSIS" ? <div><p role="status">{t("Preparing your records...")}</p><AppButton density="compact" variant="secondary" disabled={busy || !importDecision.allowed} onClick={() => void act(() => importSessions.cancelRun(branchId, detail.latestRun!.id))}>{t("Cancel preparation")}</AppButton></div> : <>
                    <p>{detail.mapping?.analysis?.ai?.status && detail.mapping.analysis.ai.status !== "success" ? t("AI is unavailable. Your saved work is safe; manual corrections still work.") : t("Your draft is ready to check.")}</p>
                    <AppButton density="compact" disabled={disabled || dirty || columnsDirty || (detail.sourceType === "PDF" && detail.latestRun?.status === "WAITING_FOR_USER") || (detail.mapping?.guidance?.passes ?? 0) >= 3} onClick={() => void act(() => importSessions.analyze(branchId, sessionId))}>{t("Prepare remaining records")}</AppButton>
                    <AppButton density="compact" variant="secondary" disabled={disabled || dirty || columnsDirty} onClick={() => void act(() => importSessions.updateMapping(branchId, sessionId, { expectedRevision: detail.draftRevision, columnMappings: detail.mapping?.columnMappings }), t("Payment outcomes refreshed. Review a new plan."))}>{t("Refresh payment outcomes")}</AppButton>
                </>}
                <details className="mt-4" open={detail.mapping?.columnMappings?.some(column => column.needsReview) || undefined}><summary className="cursor-pointer">{t("Inspect column interpretation")}</summary>
                    <ColumnsStep detail={detail} goal="FULL" saving={busy} mutationsDisabled={disabled || dirty} onDirtyChange={setColumnsDirty} onSave={async columnMappings => {
                        await act(async () => { await importSessions.updateMapping(branchId, sessionId, { expectedRevision: detail.draftRevision, columnMappings }); setColumnsDirty(false); });
                    }} />
                </details>
            </AppPanel>
            {!!detail.guidance?.groups.length && <AppPanel title={t("Resolve matching records together")}>
                <div className="grid gap-3 md:grid-cols-2">{detail.guidance.groups.map(group => <Interpretation key={`${detail.draftRevision}:${group.source}`} {...group} detail={detail} disabled={disabled || dirty || columnsDirty} onApply={targetId => void act(() => importSessions.confirmInterpretation(branchId, sessionId, { expectedRevision: detail.draftRevision, source: group.source, targetId }), t("Interpretation applied. Review the remaining fields."))} />)}</div>
            </AppPanel>}
            {outcome && <AppPanel title={t("This month's payment")}>
                <p>{selected?.normalizedData?.student?.name}: {t(outcomeText, { date: outcome.dueDate ? formatDate(outcome.dueDate) : "" })}</p>
                {outcome.state === "CREATE_NOW" && <p>{t("Amount")}: {formatNumber(outcome.amount ?? 0)} · {t(outcome.status === "DUE" ? "Due" : outcome.status === "PAID" ? "Paid" : "Waived")}</p>}
                <p className="text-sm">{t("Past months are excluded. Future dues use normal generation.")}</p>
            </AppPanel>}
            <RowsStep branchId={branchId} sessionId={sessionId} detail={detail} rows={detail.rows} rowFilter={filter} selectedRow={selected} selectedDraft={draft} rowPreview={preview} rowPreviewLoading={previewLoading} saving={busy} mutationsDisabled={mutationDisabled} goal="FULL" dirty={dirty}
                onFilterChange={value => { if (canNavigate()) { setSelectedId(null); setFilter(value); } }}
                onSelectRow={id => { if (canNavigate()) setSelectedId(id); }}
                onLoadMore={() => void load(true, detail.rowPage?.nextCursor).catch(e => setError(e.message))}
                onDraftChange={(_id, field, value) => { if (!draft) return;
                    const next = { ...draft, [field]: value, ...(field === "shift" ? { multiShift: "" } : field === "multiShift" ? { shift: "" } : {}) };
                    if ((field === "shift" || field === "multiShift") && (feeLinked || !draft.fee)) {
                        const choice = [...(detail.branchContext?.shifts ?? []), ...(detail.branchContext?.multiShifts ?? [])].find(s => s.name === value);
                        if (choice) next.fee = String(choice.price);
                    }
                    if (field === "fee") setFeeLinked(false);
                    setDraft(next); setDirty(true);
                }}
                feeLinked={feeLinked}
                onFeeLinkChange={(_id, linked) => { if (!draft) return; setFeeLinked(linked); setDirty(true); if (linked) { const choice = [...(detail.branchContext?.shifts ?? []), ...(detail.branchContext?.multiShifts ?? [])].find(s => s.name === (draft.multiShift || draft.shift)); if (choice) setDraft({ ...draft, fee: String(choice.price) }); } }}
                onSaveRow={() => void saveRow()} onSaveAndNext={() => void saveRow(true)} onResetRow={() => { setDirty(false); setDraft(selected ? guidedDraft(selected, detail.mapping?.columnMappings) : undefined); }}
                onSkipRow={() => selected && canNavigate() && void act(() => importSessions.updateRows(branchId, sessionId, { expectedRevision: detail.draftRevision, ...(selected.skipped ? { unskipRowIds: [selected.id] } : { skipRowIds: [selected.id] }) }))}
                onImportStudentOnly={() => void saveRow(true, true)} activeIssue={null}
                onBulkSetSkipped={async (ids, skipped) => { if (!canNavigate()) return false; return act(() => importSessions.updateRows(branchId, sessionId, { expectedRevision: detail.draftRevision, ...(skipped ? { skipRowIds: ids } : { unskipRowIds: ids }) })); }}
                onBulkAffectedIssue={async (issueCode, skipped) => { if (!canNavigate()) return false; return act(() => importSessions.updateRows(branchId, sessionId, { expectedRevision: detail.draftRevision, bulkAction: { action: skipped ? "SKIP" : "UNSKIP", issueCode } })); }} />
        </>}
        {stage === "review" && <>
            {plan?.currentMonthReview && <AppPanel title={t("Current-month outcomes")}>
                <p>{t("Reviewed for {date}", { date: plan.currentMonthReview.businessDate })}</p>
                <p>{t("Dues now")}: {plan.currentMonthReview.rows.filter(row => row.state === "CREATE_NOW").length} · {t("Future dues")}: {plan.currentMonthReview.rows.filter(row => row.state === "GENERATE_LATER").length} · {t("No due this month")}: {plan.currentMonthReview.rows.filter(row => row.state === "NO_DUE").length}</p>
                <p>{t("Allocations deferred")}: {Math.max(0, (plan.mutationSummary?.students ?? 0) - (plan.mutationSummary?.allocations ?? 0))}</p>
                <div className="mt-3 space-y-2" aria-label={t("Payment outcomes by student")}>
                    {plan.currentMonthReview.rows.slice(reviewPage * 20, (reviewPage + 1) * 20).map(row => <div key={row.rowId} className="rounded border border-[color:var(--ui-form-surface-border)] p-3 text-sm">
                        <strong>{row.studentName}</strong>{row.reviewedBusinessDate !== plan.currentMonthReview?.businessDate && <p>{t("Recovery keeps the review from {date}", { date: row.reviewedBusinessDate })}</p>}<p>{t(row.state === "CREATE_NOW" ? "Due will be created now" : row.state === "GENERATE_LATER" ? "Due will be generated on {date}" : row.state === "EXISTING" ? "An existing payment already covers this cycle" : row.state === "NO_DUE" ? "No eligible due this month" : "Payment information needs review", { date: row.dueDate ? formatDate(row.dueDate) : "" })}</p>
                        <p>{t("Amount")}: {formatNumber(row.amount ?? 0)}{row.status && ["CREATE_NOW", "EXISTING"].includes(row.state) ? ` · ${t(row.status === "PAID" ? "Paid" : row.status === "WAIVED" ? "Waived" : "Due")}` : ""}</p>
                    </div>)}
                    {plan.currentMonthReview.rows.length > 20 && <div className="flex gap-2"><AppButton density="compact" disabled={reviewPage === 0} onClick={() => setReviewPage(page => page - 1)}>{t("Previous")}</AppButton><AppButton density="compact" disabled={(reviewPage + 1) * 20 >= plan.currentMonthReview.rows.length} onClick={() => setReviewPage(page => page + 1)}>{t("Next")}</AppButton></div>}
                </div>
                <AppButton density="compact" variant="secondary" disabled={disabled} onClick={() => void act(() => importSessions.updateMapping(branchId, sessionId, { expectedRevision: detail.draftRevision, columnMappings: detail.mapping?.columnMappings }), t("Payment outcomes refreshed. Review a new plan."))}>{t("Refresh payment outcomes")}</AppButton>
            </AppPanel>}
            <PreviewStep branchId={branchId} sessionId={sessionId} plan={plan} importOptions={detail.mapping?.importOptions ?? {}} readinessPolicy={policy} currentRevision={detail.draftRevision} saving={busy} mutationsDisabled={disabled} onPolicyChange={value => { setPolicy(value); setPlan(null); }} onRefreshPlan={() => void buildPlan()} onConfirmImport={() => setConfirm(true)} />
        </>}
        {stage === "result" && detail.guidance && detail.latestRun?.kind === "COMMIT" && !active.has(detail.latestRun.status) && <AppPanel title={t("Actual saved records")}>
            <p>{t("Students created")}: {formatNumber(detail.guidance.createdStudents)} · {t("Allocations created")}: {formatNumber(detail.guidance.createdAllocations)} · {t("Payments created")}: {formatNumber(detail.guidance.createdPayments)}</p>
        </AppPanel>}
        {stage === "result" && <ResultStep branchId={branchId} detail={detail} run={run} runLoading={false} actionLoading={busy} onGoPreview={() => void buildPlan()} onCancelRun={() => run && void act(() => importSessions.cancelRun(branchId, run.id))} onRetryRun={() => run && void act(() => importSessions.resumeRun(branchId, run.id))} canRetryRun={!!run && ["QUEUED", "RUNNING", "RETRYABLE_FAILURE"].includes(run.status)} onRepairRun={() => { setPlan(null); setStage("help"); setFilter("attention"); }} onExportErrors={format => { if (run) void importSessions.exportRunErrors(branchId, run.id, format).then(blob => { const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `import-errors.${format}`; link.click(); URL.revokeObjectURL(url); }).catch(e => setError(e.message)); }} />}
        <ConfirmDialog isOpen={confirm} onClose={() => setConfirm(false)} onConfirm={() => void commit()} title={t("Import the reviewed records?")} description={t("Only the reviewed plan will run. Completed operations are saved even if another operation needs recovery.")} confirmText={t("Confirm import")} loading={busy} />
    </PageShell>;
}
