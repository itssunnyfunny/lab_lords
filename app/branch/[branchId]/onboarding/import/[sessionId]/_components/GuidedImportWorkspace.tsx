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
import { draftFromImportRowWithFallback, importRowFieldWasCleared, normalizedFromImportDraft } from "@/importing/utils/manual-row-draft";
import { ColumnsStep } from "./ColumnsStep";
import { GuidedStudentEditor } from "./GuidedStudentEditor";
import { GuidedFinancialOutcome, GuidedFinancialReview } from "./GuidedFinancialReview";
import { GuidedImportResults } from "./GuidedImportResults";
import { guidedSavedFields, guidedStudentTasks, studentTaskLabels, type StudentTask } from "@/importing/utils/guided-import-presentation";
import { useBasicNavigationGuard } from "@/components/basic/useBasicNavigationGuard";
import { CheckCircle2, CircleAlert, ArrowRight, FileText } from "lucide-react";
import type { ImportDetail, ImportRow, Plan, RowDraft, RowFilter, RowPreview, Run } from "./types";
import { importFieldClass, navigateImportTabs } from "./shared";
import { parseImportMoney } from "@/importing/utils/row-normalizer";
import { isImportPlanFresh } from "@/importing/utils/import-wizard-view-model";

import { GuidedSetupReview } from "./GuidedSetupReview";
import { GuidedPaymentChoices } from "./GuidedPaymentChoices";
import { ImportConfigurationCorrection } from "./ImportConfigurationCorrection";
import { AssignmentSummary } from "./ImportAssignmentSummary";
import { isSetupImport, type ImportSetup, type SetupResolution } from "@/importing/utils/guided-setup";
import { useWorkspaceAccess } from "@/components/layout/BranchAccessProvider";
import { hasBranchCapability } from "@/lib/branchCapabilities";
import { importReadiness, importSaveOutcome } from "@/importing/utils/import-readiness";

const active = new Set(["QUEUED", "RUNNING", "RETRYABLE_FAILURE", "CANCEL_REQUESTED"]);
type Props = { branchId: string; sessionId: string; importDecision: CapabilityDecision };

function guidedDraft(row: ImportRow, mappings: NonNullable<ImportDetail["mapping"]>["columnMappings"] = []) {
    const draft = draftFromImportRowWithFallback(row, mappings, "RECORDED_ONLY");
    for (const mapping of mappings) {
        if (importRowFieldWasCleared(row, mapping.targetField)) continue;
        const field = mapping.targetField === "payment.amount" ? "paymentAmount" : mapping.targetField === "student.monthlyFee" ? "fee" : null;
        const code = field === "fee" ? "INVALID_MONTHLY_FEE" : "INVALID_PAYMENT_AMOUNT";
        const raw = row.rawData[mapping.sourceColumn];
        if (field && raw?.trim() && row.issues.some(issue => issue.code === code) && parseImportMoney(raw) === undefined) draft[field] = raw;
    }
    return draft;
}

function guidedNormalized(row: ImportRow, draft: RowDraft, context: ImportDetail["branchContext"]) {
    const normalized = normalizedFromImportDraft(row, draft, context, "RECORDED_ONLY");
    const saved = guidedSavedFields(row.createdEntityIds);
    if (saved.student) normalized.student = row.normalizedData?.student;
    if (saved.payment) normalized.payment = row.normalizedData?.payment;
    if (saved.seating) {
        normalized.allocation = row.normalizedData?.allocation; normalized.seat = row.normalizedData?.seat;
        normalized.shift = row.normalizedData?.shift; normalized.multiShift = row.normalizedData?.multiShift;
    }
    return normalized;
}

function Interpretation({ source, count, suggestionId, detail, disabled, onApply }: {
    source: string; count: number; suggestionId: string | null; detail: ImportDetail; disabled: boolean;
    onApply: (targetId: string) => void;
}) {
    const t = useTranslation();
    const [target, setTarget] = useState(suggestionId ?? "");
    const choices = [...(detail.branchContext?.shifts ?? []), ...(detail.branchContext?.multiShifts ?? [])];
    return <div className="space-y-3 rounded border border-[color:var(--ui-form-surface-border)] p-4">
        <p className="font-medium">{t("What does “{source}” mean?", { source })}</p>
        <p className="text-sm text-[color:var(--text-secondary)]">{t("Students affected: {count}", { count })}</p>
        <label className="block text-sm">{t("Study timings")}
            <select className={`${importFieldClass} mt-1 w-full`} value={target} disabled={disabled} onChange={e => setTarget(e.target.value)}>
                <option value="">{t("Choose a shift")}</option>
                {choices.map(choice => <option key={choice.id} value={choice.id}>{choice.name}</option>)}
            </select>
        </label>
        {suggestionId && <p className="text-sm">{t("Suggested match — please confirm.")}</p>}
        <AppButton density="compact" disabled={disabled || !target} onClick={() => onApply(target)}>{t("Confirm for matching students")}</AppButton>
    </div>;
}

export function GuidedImportWorkspace({ branchId, sessionId, importDecision }: Props) {
    const t = useTranslation();
    const { formatNumber } = useUserPreferences();
    const [detail, setDetail] = useState<ImportDetail | null>(null);
    const [filter, setFilter] = useState<RowFilter>("all");
    const [issueFilter, setIssueFilter] = useState<string | undefined>();
    const [section, setSection] = useState<"records" | "timings" | "seats">("records");
    const [setupDirty, setSetupDirty] = useState(false);
    const [paymentsDirty, setPaymentsDirty] = useState(false);
    const [correctionDirty, setCorrectionDirty] = useState(false);
    const workspace = useWorkspaceAccess();
    const canConfigure = !!workspace?.access && hasBranchCapability(workspace.access, "settingsManage");
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [draft, setDraft] = useState<RowDraft | undefined>();
    const [dirty, setDirty] = useState(false);
    const [feeLinked, setFeeLinked] = useState(false);
    const [columnsDirty, setColumnsDirty] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [saveOutcome, setSaveOutcome] = useState<{ name: string; result: ReturnType<typeof importSaveOutcome> } | null>(null);
    const [stage, setStage] = useState<"help" | "review" | "result">("help");
    const [plan, setPlan] = useState<Plan | null>(null);
    const [policy, setPolicy] = useState<ImportReadinessPolicy>("READY_ROWS_ONLY");
    const [editorOpen, setEditorOpen] = useState(false);
    const [task, setTask] = useState<StudentTask>("details");
    const [sourceOpen, setSourceOpen] = useState(false);
    const [confirm, setConfirm] = useState(false);
    const [run, setRun] = useState<Run | null>(null);
    const [preview, setPreview] = useState<RowPreview | null>(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const loadSequence = useRef(0);
    const draftRevision = useRef<number | null>(null);
    const resumeAttempts = useRef(new Map<string, number>());
    const initialDisplay = useRef(false);
    const sourceSection = useRef<HTMLDetailsElement>(null);
    const workspaceHeading = useRef<HTMLHeadingElement>(null);
    const selected = detail?.rows.find(row => row.id === selectedId) ?? null;
    const saved = guidedSavedFields(selected?.createdEntityIds);
    const running = !!detail?.latestRun && active.has(detail.latestRun.status);
    const disabled = busy || running || !importDecision.allowed;
    const mutationDisabled = disabled || selected?.status === "IMPORTED";
    const setupExperience = isSetupImport(detail?.sourceConfiguration);
    const assignmentOnly = setupExperience && ["seat", "shift"].includes(task);
    useEffect(() => {
        if (!setupExperience) return;
        workspaceHeading.current?.focus({ preventScroll: true });
        workspaceHeading.current?.scrollIntoView({ block: "start" });
    }, [setupExperience, stage, section]);

    const load = useCallback(async (append = false, cursor?: string | null) => {
        const sequence = ++loadSequence.current;
        const next = await importSessions.detail<ImportDetail>(branchId, sessionId, { rowFilter: filter, issueCode: issueFilter, limit: 25, ...(cursor ? { cursor } : {}) });
        if (sequence !== loadSequence.current) return;
        if (!initialDisplay.current) {
            initialDisplay.current = true;
            if (!isSetupImport(next.sourceConfiguration) && !next.guidance?.needsHelp && (next.summary?.readyRows ?? 0) + (next.summary?.warningRows ?? 0) > 0) setFilter("ready");
            if (next.latestRun?.kind === "COMMIT") setStage("result");
        }
        setDetail(previous => append && previous?.draftRevision === next.draftRevision
            ? { ...next, rows: [...previous.rows, ...next.rows.filter(row => !previous.rows.some(old => old.id === row.id))] } : next);
        if (next.latestRun?.kind === "COMMIT") {
            const nextRun = await importSessions.getRun(branchId, next.latestRun.id);
            if (sequence === loadSequence.current) setRun(nextRun);
        }
        return next;
    }, [branchId, sessionId, filter, issueFilter]);

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
        if (!editorOpen || !selected || !draft) { setPreview(null); return; }
        if (!assignmentOnly && [draft.fee, draft.paymentAmount].some(value => value.trim() && parseImportMoney(value) === undefined)) {
            setPreview(null); setPreviewLoading(false); return;
        }
        let alive = true;
        setPreviewLoading(true);
        const timer = setTimeout(() => {
            void importSessions.previewRow<RowPreview>(branchId, sessionId, { rowId: selected.id,
                normalizedData: assignmentOnly ? { ...guidedNormalized(selected, draft, detail?.branchContext), student: selected.normalizedData?.student, payment: selected.normalizedData?.payment } : guidedNormalized(selected, draft, detail?.branchContext) })
                .then(result => { if (alive) setPreview(result); })
                .catch(e => { if (alive) setError(e.message); })
                .finally(() => { if (alive) setPreviewLoading(false); });
        }, 300);
        return () => { alive = false; clearTimeout(timer); };
    }, [branchId, sessionId, selected, draft, detail?.branchContext, editorOpen, assignmentOnly]);

    const canNavigate = () => {
        if (busy) { setError(t("Please wait for the current action to finish.")); return false; }
        if (dirty || columnsDirty || setupDirty || paymentsDirty || correctionDirty) { setError(t("Save or reset your edits before continuing.")); return false; }
        return true;
    };
    useBasicNavigationGuard(canNavigate, dirty || columnsDirty || setupDirty || paymentsDirty || correctionDirty || busy, "guidedImportIndex");
    const act = async (work: () => Promise<unknown>, message?: string, keepBusy = false) => {
        setBusy(true); setError(null);
        try { await work(); setPlan(null); const next = await load(); if (message) setNotice(message + (next ? ` ${t("Ready: {ready}. Still need help: {help}.", { ready: (next.summary?.readyRows ?? 0) + (next.summary?.warningRows ?? 0), help: next.guidance?.needsHelp ?? 0 })}` : "")); return true; }
        catch (e) { setError(e instanceof Error ? e.message : t("Import request failed")); return false; }
        finally { if (!keepBusy) setBusy(false); }
    };
    const saveRow = async (next = false, defer = false) => {
        if (!selected || !draft || !detail) return;
        if (!assignmentOnly && [draft.fee, draft.paymentAmount].some(value => value.trim() && parseImportMoney(value) === undefined)) {
            setError(t("Use whole non-negative rupee amounts. Recorded amounts will not be rounded.")); return;
        }
        const normalized = guidedNormalized(selected, draft, detail.branchContext);
        if (!saved.student && normalized.student && !feeLinked) {
            normalized.student.feeSource = "UPLOADED";
            delete normalized.student.feeLinkedShiftName; delete normalized.student.feeLinkedMultiShiftName;
        }
        if (defer && !saved.seating) { normalized.allocation = { deferred: true }; delete normalized.seat; delete normalized.shift; delete normalized.multiShift; }
        try {
        let updatedRow: ImportRow | undefined;
        const ok = await act(async () => {
            const expectedRevision = draftRevision.current ?? detail.draftRevision;
            let updated: ImportDetail;
            if (assignmentOnly) {
                const timing = [...(detail.branchContext?.shifts ?? []), ...(detail.branchContext?.multiShifts ?? [])].find(s => s.name === (draft.multiShift || draft.shift));
                const seat = detail.branchContext?.seats.find(s => s.label === draft.seat);
                updated = await importSessions.resolveSetup<ImportDetail>(branchId, sessionId, { expectedRevision, action: defer ? "DEFER_ROW" : "ASSIGN_ROW", rowId: selected.id, targetId: timing?.id, seatId: seat?.id });
            } else updated = await importSessions.updateRows<ImportDetail>(branchId, sessionId, { expectedRevision, edits: [{ rowId: selected.id, normalizedData: normalized }] });
            updatedRow = updated.rows.find(row => row.id === selected.id);
            if (updatedRow) setSaveOutcome({ name: updatedRow.normalizedData?.student?.name || t("Student details to confirm"), result: importSaveOutcome(selected, updatedRow) });
            setNotice(null);
            setDirty(false);
        }, undefined, true);
        // A successful draft write is not necessarily a resolved student. Keep
        // their remaining decisions visible instead of cycling through the queue.
        if (ok && updatedRow && importReadiness(updatedRow) === "attention") {
            setTask(guidedStudentTasks(updatedRow)[0] ?? "details");
        } else if (ok && next) {
            // Select the next unresolved student across the full draft, including
            // those outside the current page. The server owns the issue filter.
            const attention = await importSessions.detail<ImportDetail>(branchId, sessionId, { rowFilter: "attention", limit: 25 });
            setIssueFilter(undefined); setFilter("attention"); setDetail(attention);
            const following = attention.rows.find(row => row.id !== selected.id) ?? attention.rows[0];
            setSelectedId(following?.id ?? null);
            setDraft(following ? guidedDraft(following, attention.mapping?.columnMappings) : undefined);
            setFeeLinked(["SHIFT_PRICE", "MULTI_SHIFT_PRICE"].includes(following?.normalizedData?.student?.feeSource ?? ""));
            draftRevision.current = attention.draftRevision;
            setTask(following ? guidedStudentTasks(following)[0] ?? "details" : "details");
            if (!following) setEditorOpen(false);
        }
        } catch (e) { setError(e instanceof Error ? e.message : t("Import request failed")); }
        finally { setBusy(false); }
    };
    const resolveSetup = async (input: Omit<SetupResolution, "expectedRevision">) => {
        if (!detail || !canNavigate()) return false;
        return act(() => importSessions.resolveSetup(branchId, sessionId, { ...input, expectedRevision: detail.draftRevision }), t.owned("Assignment decisions saved for the matching group."));
    };
    const prepareSetup = async (preparedSetup: ImportSetup) => {
        if (!detail) return false;
        const ok = await act(() => importSessions.updateMapping(branchId, sessionId, { expectedRevision: detail.draftRevision, importOptions: { preparedSetup } }), t.owned("Proposed setup saved in this draft. Nothing live has changed."));
        if (ok) setSetupDirty(false);
        return ok;
    };
    const approveSetup = async () => {
        if (!detail || !canNavigate()) return;
        setBusy(true); setError(null);
        try {
            await importSessions.updateMapping(branchId, sessionId, { expectedRevision: detail.draftRevision, importOptions: { configurationBatchApproved: true } });
            const latest = await load();
            if (latest) setPlan(await importSessions.createPlan(branchId, sessionId, policy, latest.draftRevision));
        } catch (e) { setError(e instanceof Error ? e.message : t("Import request failed")); }
        finally { setBusy(false); }
    };
    const buildPlan = async () => {
        if (!detail || !canNavigate()) return;
        setBusy(true); setError(null);
        try { setPlan(await importSessions.createPlan(branchId, sessionId, policy, detail.draftRevision)); setStage("review"); }
        catch (e) { setPlan(null); setStage("review"); setError(e instanceof Error ? e.message : t("Import request failed")); }
        finally { setBusy(false); }
    };
    const commit = async () => {
        if (!plan || !detail) return;
        if (!plan.canRun || !isImportPlanFresh(plan, policy, detail.draftRevision)) { setError(t("The review changed. Refresh it before confirming.")); return; }
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

    const refreshReview = async () => {
        if (!detail || !canNavigate()) return;
        setBusy(true); setError(null); ++loadSequence.current;
        try {
            const options = { rowFilter: filter, limit: 25 };
            const current = await importSessions.detail<ImportDetail>(branchId, sessionId, options);
            await importSessions.updateMapping(branchId, sessionId, {
                expectedRevision: current.draftRevision,
                columnMappings: current.mapping?.columnMappings,
            });
            const latest = await importSessions.detail<ImportDetail>(branchId, sessionId, options);
            setDetail(latest);
            setPlan(await importSessions.createPlan(branchId, sessionId, policy, latest.draftRevision)); setStage("review");
        } catch (e) { setError(e instanceof Error ? e.message : t("Import request failed")); }
        finally { setBusy(false); }
    };
    const showSource = () => {
        if (!canNavigate()) return;
        setEditorOpen(false); setSection("records"); setSourceOpen(true);
        requestAnimationFrame(() => { sourceSection.current?.scrollIntoView({ block: "center" }); sourceSection.current?.querySelector("summary")?.focus(); });
    };
    const openStudent = (row: ImportRow, nextTask: StudentTask = guidedStudentTasks(row)[0] ?? "details") => {
        if (!canNavigate()) return;
        if (nextTask === "source") { showSource(); return; }
        setSelectedId(row.id); setDraft(guidedDraft(row, detail?.mapping?.columnMappings));
        setFeeLinked(["SHIFT_PRICE", "MULTI_SHIFT_PRICE"].includes(row.normalizedData?.student?.feeSource ?? ""));
        draftRevision.current = detail?.draftRevision ?? null;
        setTask(nextTask); setEditorOpen(true); setError(null);
    };

    if (!detail) return <PageShell><p role="status">{error ? <LocalizedError error={error} /> : t("Preparing your records...")}</p></PageShell>;
    const ready = detail.guidance?.ready ?? (detail.summary?.readyRows ?? 0) + (detail.summary?.warningRows ?? 0);
    const help = detail.guidance?.needsHelp ?? 0;
    const allReady = help === 0 && ready > 0;
    const pdfWaiting = detail.latestRun?.status === "WAITING_FOR_USER" && detail.sourceType === "PDF";
    const analyzing = running && detail.latestRun?.kind === "ANALYSIS";
    const passes = detail.mapping?.guidance?.passes ?? 0;
    const preparation = detail.guidance?.preparation;
    const unavailable = !!detail.mapping?.analysis?.ai?.status && detail.mapping.analysis.ai.status !== "success";
    const cancelled = detail.latestRun?.kind === "ANALYSIS" && detail.latestRun.status === "CANCELLED";
    const changeFilter = (value: RowFilter) => { if (canNavigate()) { setIssueFilter(undefined); setEditorOpen(false); setSelectedId(null); setFilter(value); } };
    const outcomeNotice = saveOutcome && <div role="status" className="space-y-2 rounded border border-[color:var(--ui-form-surface-border)] bg-[color:var(--ui-form-muted-surface-bg)] p-3 text-sm">
        <p className="font-medium">{t.owned("{name}: saved to draft, not imported.", { name: saveOutcome.name })}</p>
        <p>{t.owned(saveOutcome.result.readiness === "ready" ? "Ready for final review." : "This student still needs your help.")}</p>
        {!!saveOutcome.result.resolved.length && <p>{t.owned("Resolved: {tasks}", { tasks: guidedStudentTasks({ status: "BLOCKED", skipped: false, normalizedData: null, issues: saveOutcome.result.resolved, warnings: [] }).map(item => t(studentTaskLabels[item])).join(" · ") })}</p>}
        {!!saveOutcome.result.remaining.length && <div><p>{t.owned("Still to resolve:")}</p><ul className="list-disc pl-5">{saveOutcome.result.remaining.map(issue => <li key={`${issue.code}:${issue.field}`}><LocalizedError error={issue.message} /></li>)}</ul></div>}
    </div>;
    return <PageShell data-import-experience="guided" className="space-y-5">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0"><p className="text-xs font-medium text-[color:var(--text-muted)]">{t("Student import")} · {detail.fileName}</p><h1 ref={workspaceHeading} tabIndex={-1} className="mt-2 scroll-mt-4 text-2xl font-semibold">{t(stage === "result" ? "Your import results" : stage === "review" ? "Review your import" : "Check your students")}</h1></div>
            {stage === "help" && <AppButton density="compact" icon={ArrowRight} disabled={disabled || !ready || dirty || columnsDirty || setupDirty} onClick={() => void buildPlan()}>{t("Review and save")} · {formatNumber(ready)}</AppButton>}
        </header>
        {error && !editorOpen && <div role="alert" className="rounded border border-[color:var(--ui-tone-danger-border)] bg-[color:var(--ui-tone-danger-bg)] p-3 text-sm"><LocalizedError error={error} /></div>}
        {notice && <p role="status" className="rounded border border-[color:var(--ui-tone-success-border)] bg-[color:var(--ui-tone-success-bg)] p-3 text-sm">{notice}</p>}
        {!editorOpen && outcomeNotice}
        {!importDecision.allowed && <p id="import-session-mutation-blocker" role="alert">{t("Import access is currently unavailable.")}</p>}
        {setupExperience && stage !== "result" && <nav className="flex flex-wrap gap-2 border-b border-[color:var(--ui-form-section-divider)] pb-3" aria-label={t.owned("Import steps")}>
            {([["records", "Records"], ["timings", "Timings"], ["seats", "Seats and assignments"]] as const).map(([value, label]) => <AppButton key={value} density="compact" variant={stage === "help" && section === value ? "primary" : "quiet"} aria-current={stage === "help" && section === value ? "step" : undefined} disabled={busy || running} onClick={() => { if (canNavigate()) { setStage("help"); setSection(value); setIssueFilter(undefined); setFilter("all"); } }}>{t.owned(label)}</AppButton>)}
            <AppButton density="compact" variant={stage === "review" ? "primary" : "quiet"} aria-current={stage === "review" ? "step" : undefined} disabled={disabled || !ready} onClick={() => void buildPlan()}>{t.owned("Review and import")}</AppButton>
        </nav>}
        {stage === "help" && <>
            {setupExperience && section !== "records" && <>
                <GuidedSetupReview key={section} detail={detail} section={section} disabled={disabled || dirty || columnsDirty || correctionDirty} canConfigure={canConfigure} onResolve={resolveSetup} onSetup={prepareSetup} onDirtyChange={setSetupDirty} />
                {canConfigure && <ImportConfigurationCorrection key={`correct:${section}`} branchId={branchId} detail={detail} section={section} disabled={disabled || dirty || columnsDirty || setupDirty} onDirtyChange={setCorrectionDirty}
                    onApply={preview => act(() => importSessions.applyCorrection(branchId, sessionId, preview), t.owned("Existing setup corrected. Drafts revalidated; review the remaining decisions."))} />}
            </>}
            {section === "records" && <>
            <div className="flex items-start gap-3 rounded-[var(--ui-radius-panel)] border border-[color:var(--ui-form-surface-border)] bg-[color:var(--ui-panel-bg)] p-4 sm:p-5">
                {allReady ? <CheckCircle2 aria-hidden="true" className="mt-1 h-6 w-6 shrink-0 text-[color:var(--ui-tone-success-text)]" /> : <CircleAlert aria-hidden="true" className="mt-1 h-6 w-6 shrink-0 text-[color:var(--ui-tone-warning-text)]" />}
                <div className="min-w-0"><h2 className="font-semibold">{t(analyzing ? "Preparing your student list" : pdfWaiting ? "Confirm the extracted records" : allReady ? "Your students are ready to review" : !detail.summary?.totalRows ? "No students in this import" : help ? "A few decisions need your help" : "Choose which students to include")}</h2>
                    <p className="mt-1 text-sm text-[color:var(--text-secondary)]">{t(!detail.summary?.totalRows ? "Start again with a file or pasted table that includes student records." : allReady ? "Check the students below, then review exactly what will be saved." : help ? "Choose a task beside a student's name. Correct details stay prepared while you finish the rest." : "Left-out students stay in this draft. Include them when you are ready.")}</p>
                    {!detail.summary?.totalRows && <Link className="mt-3 inline-flex underline" href={`/branch/${branchId}/onboarding/import`}>{t("Add your student records")}</Link>}
                    <p className="mt-2 text-sm">{t("Ready for review: {count}", { count: ready })} · {t("Students needing help: {count}", { count: help })}{!!detail.guidance?.createdStudents && ` · ${t("Already saved: {count}", { count: detail.guidance.createdStudents })}`}</p>
                </div>
            </div>
            {!!detail.guidance?.nonStudentRows?.length && <AppPanel density="compact" title={t.owned("Check title and repeated header rows")} description={t.owned("These source rows are retained for your review. Leave them out only after confirming they are not students.")}>
                <p className="mb-3 text-sm">{t.owned("Source rows: {rows}", { rows: detail.guidance.nonStudentRows.map(row => row.rowNumber).join(", ") })}</p>
                <AppButton density="compact" variant="secondary" disabled={disabled} onClick={() => { if (canNavigate()) { setIssueFilter("NON_STUDENT_SOURCE_ROW"); setFilter("attention"); } }}>{t.owned("Review title and header rows")}</AppButton>
                {issueFilter === "NON_STUDENT_SOURCE_ROW" && <AppButton className="ml-2" density="compact" disabled={disabled} onClick={() => { if (canNavigate()) void act(() => importSessions.updateRows(branchId, sessionId, { expectedRevision: detail.draftRevision, bulkAction: { action: "SKIP", issueCode: "NON_STUDENT_SOURCE_ROW" } }), t.owned("Reviewed title and header rows left out. Source evidence remains in this draft.")).then(ok => { if (ok) { setIssueFilter(undefined); setFilter("all"); } }); }}>{t.owned("These are not students — leave them out")}</AppButton>}
            </AppPanel>}
            <GuidedPaymentChoices branchId={branchId} sessionId={sessionId} revision={detail.draftRevision} disabled={disabled || dirty || columnsDirty || setupDirty} onDirtyChange={setPaymentsDirty}
                onApply={input => act(() => importSessions.resolvePayments(branchId, sessionId, input), t.owned("Payment choices saved to draft. Review them before final import."))} />
            {(analyzing || pdfWaiting || help > 0) && <AppPanel density="compact">
                {pdfWaiting ? <div className="space-y-3"><h2 className="font-semibold">{t("Check the extracted PDF rows before preparing records.")}</h2>{detail.extractionPreview?.map(row => <pre className="whitespace-pre-wrap break-words text-xs" key={row.rowNumber}>{Object.entries(row.rawData).map(([key, value]) => `${key}: ${String(value)}`).join(" · ")}</pre>)}<AppButton density="compact" disabled={busy || !importDecision.allowed} onClick={() => void act(() => importSessions.analyze(branchId, sessionId, { confirmPdfExtraction: true }), t("Preparation finished. Check the remaining decisions."))}>{t("Confirm PDF extraction and prepare")}</AppButton></div>
                : analyzing ? <div className="flex flex-wrap items-center justify-between gap-3"><p role="status">{t("Preparing your records...")}</p><AppButton density="compact" variant="quiet" disabled={busy || !importDecision.allowed} onClick={() => void act(() => importSessions.cancelRun(branchId, detail.latestRun!.id), t("Preparation stopped. Your saved work is still here."))}>{t("Cancel preparation")}</AppButton></div>
                : <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><h2 className="text-sm font-semibold">{t(cancelled ? "Preparation stopped. Your saved work is still here." : passes >= 3 ? "Automatic preparation has finished" : unavailable ? "Preparation is unavailable; your saved work is safe" : preparation?.canImprove ? "Your answers can prepare more students" : "These decisions need your confirmation")}</h2><p className="mt-1 text-sm text-[color:var(--text-secondary)]">{t(preparation?.canImprove && passes < 3 ? "Preparation can reuse supported meanings and check unresolved columns. Review what changes afterward." : "Choose the remaining tasks below. Dates, payment facts and seats need your confirmation.")}</p>{!!detail.mapping?.guidance?.preparedRows && <p className="mt-2 text-sm">{t("Students updated from your confirmed meanings: {count}", { count: detail.mapping.guidance.preparedRows })}</p>}</div>
                    {preparation?.canImprove && passes < 3 && <AppButton density="compact" variant="secondary" disabled={disabled || dirty || columnsDirty} onClick={() => void act(() => importSessions.analyze(branchId, sessionId), t("Preparation finished. Check the remaining decisions."))}>{t("Prepare remaining records")}</AppButton>}
                </div>}
            </AppPanel>}
            {!setupExperience && !!detail.guidance?.groups.length && <AppPanel density="compact" title={t("One answer can help matching students")} description={t("Choose the timings meant by the uploaded value. No seat is chosen automatically.")}>
                <div className="grid gap-3 md:grid-cols-2">{detail.guidance.groups.map(group => <Interpretation key={`${detail.draftRevision}:${group.source}`} {...group} detail={detail} disabled={disabled || dirty || columnsDirty} onApply={targetId => void act(() => importSessions.confirmInterpretation(branchId, sessionId, { expectedRevision: detail.draftRevision, source: group.source, targetId }), t("Meaning applied to matching students."))} />)}</div>
            </AppPanel>}
            </>}
            {section !== "timings" && <section aria-label={t("Students in this import")} className="space-y-4">
                <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label={t("Filter students")} onKeyDown={navigateImportTabs}>
                    {([["attention", "Needs your help", help], ["ready", "Ready for review", ready], ["all", "All students", detail.summary?.totalRows ?? 0], ["skipped", "Left out", detail.summary?.skippedRows ?? 0]] as const).map(([value, label, count]) => <AppButton key={value} role="tab" tabIndex={filter === value ? 0 : -1} aria-selected={filter === value} density="compact" variant={filter === value ? "primary" : "quiet"} disabled={busy} onClick={() => changeFilter(value)}>{t(label)} · {formatNumber(count)}</AppButton>)}
                </div>
                <p className="text-xs text-[color:var(--text-muted)]">{t("Showing {shown} of {total} students", { shown: detail.rows.length, total: detail.rowPage?.filteredRows ?? detail.rows.length })}</p>
                <div className="grid min-w-0 gap-3 lg:grid-cols-2">{detail.rows.map(row => {
                    const tasks = guidedStudentTasks(row), needsHelp = importReadiness(row) === "attention";
                    const name = row.normalizedData?.student?.name || t("Student details to confirm");
                    const hasStudent = !!row.createdEntityIds?.studentId;
                    return <article key={row.id} className="min-w-0 rounded-[var(--ui-radius-panel)] border border-[color:var(--ui-panel-border)] bg-[color:var(--ui-panel-bg)] p-4 sm:p-5">
                        <div className="flex items-start justify-between gap-3"><button className="min-w-0 text-left font-semibold underline-offset-4 hover:underline focus-visible:underline" onClick={() => openStudent(row)} disabled={busy}>{name}</button><span className="shrink-0 rounded-full border border-[color:var(--ui-form-section-divider)] px-2 py-1 text-xs">{t(row.skipped ? "Left out" : row.status === "IMPORTED" ? "Saved" : needsHelp ? "Needs your help" : "Ready for review")}</span></div>
                        <p className="mt-2 text-xs text-[color:var(--text-muted)]">{t("Source record {number}", { number: row.rowNumber })}{hasStudent && row.status !== "IMPORTED" ? ` · ${t("Student saved; remaining work is kept for recovery")}` : ""}</p>
                        {issueFilter === "NON_STUDENT_SOURCE_ROW" && <dl className="mt-3 text-sm">{Object.entries(row.rawData).map(([key, value]) => <div className="break-words" key={key}><dt className="inline text-[color:var(--text-muted)]">{key}: </dt><dd className="inline">{value || "—"}</dd></div>)}</dl>}
                        {!row.skipped && <AssignmentSummary row={row} detail={detail} />}
                        {importReadiness(row) === "ready" && !!row.warnings.length && <details className="mt-3 text-sm"><summary className="cursor-pointer text-[color:var(--text-secondary)]">{t.owned("Notes that do not block import")} · {row.warnings.length}</summary><ul className="mt-2 list-disc space-y-1 pl-5">{row.warnings.map((issue, index) => <li key={`${issue.code}:${index}`}><LocalizedError error={issue.message} /></li>)}</ul></details>}
                        {!row.skipped && row.status !== "IMPORTED" && <AppButton className="mt-3" density="compact" variant="secondary" disabled={busy} onClick={() => openStudent(row, "seat")}>{t.owned("Edit assignment")}</AppButton>}
                        {row.normalizedData?.student?.monthlyFee !== undefined && <p className="mt-3 text-sm">{t("Monthly fee")}: <strong>₹{formatNumber(row.normalizedData.student.monthlyFee)}</strong></p>}
                        {needsHelp ? <div className="mt-3 flex flex-wrap gap-2">{tasks.map(nextTask => <AppButton key={nextTask} density="compact" variant="secondary" disabled={busy} onClick={() => openStudent(row, nextTask)}>{t(studentTaskLabels[nextTask])}</AppButton>)}</div>
                        : <div className="mt-3 space-y-3">{row.paymentOutcome && row.status !== "IMPORTED" && !row.skipped && <GuidedFinancialOutcome outcome={row.paymentOutcome} />}<AppButton density="compact" variant="quiet" disabled={busy} onClick={() => openStudent(row, "details")}>{t(row.status === "IMPORTED" || row.skipped ? "View student" : "Check or change details")}</AppButton></div>}
                    </article>;
                })}</div>
                {!detail.rows.length && <AppPanel density="compact"><p>{t(filter === "attention" && allReady ? "Nothing needs your help. The ready students can now be reviewed." : filter === "ready" ? "No students are ready yet. Choose Needs your help to finish their details." : filter === "skipped" ? "No students have been left out." : "No students match this view.")}</p>{filter === "attention" && allReady && <AppButton density="compact" className="mt-3" variant="secondary" onClick={() => changeFilter("ready")}>{t("See ready students")}</AppButton>}</AppPanel>}
                {detail.rowPage?.hasMore && <AppButton density="compact" variant="secondary" disabled={disabled || dirty || columnsDirty} onClick={() => void load(true, detail.rowPage?.nextCursor).catch(e => setError(e.message))}>{t("Show more students")}</AppButton>}
            </section>}
            {section === "records" && <details ref={sourceSection} open={sourceOpen || columnsDirty} onToggle={event => setSourceOpen(event.currentTarget.open)} className="rounded-[var(--ui-radius-panel)] border border-[color:var(--ui-form-surface-border)] bg-[color:var(--ui-panel-bg)] p-4">
                <summary className="cursor-pointer text-sm font-medium"><FileText aria-hidden="true" className="mr-2 inline h-4 w-4" />{t(preparation?.columnsToReview ? "Confirm the remaining source columns" : "Inspect uploaded columns and meanings")}</summary>
                <div className="mt-4"><ColumnsStep detail={detail} goal="FULL" saving={busy} mutationsDisabled={disabled || dirty} onDirtyChange={setColumnsDirty} onSave={async columnMappings => { await act(async () => { await importSessions.updateMapping(branchId, sessionId, { expectedRevision: detail.draftRevision, columnMappings }); setColumnsDirty(false); setSourceOpen(false); }, t("Source meanings saved.")); }} /></div>
            </details>}
            {setupExperience && section !== "seats" && <AppButton density="compact" disabled={disabled || setupDirty || dirty || columnsDirty} onClick={() => { setSection(section === "records" ? "timings" : "seats"); setIssueFilter(undefined); setFilter("all"); }}>{t.owned(section === "records" ? "Continue to timings" : "Continue to seats and assignments")}</AppButton>}
        </>}
        {stage === "review" && <GuidedFinancialReview plan={plan} currentRevision={detail.draftRevision} policy={policy} busy={busy} disabled={disabled} onBack={() => { if (canNavigate()) setStage("help"); }} onPolicyChange={value => { setPolicy(value); setPlan(null); }} onRefresh={() => void refreshReview()} onConfirm={() => setConfirm(true)} onApproveSetup={canConfigure ? () => void approveSetup() : undefined} />}
        {stage === "result" && <GuidedImportResults branchId={branchId} detail={detail} run={run} busy={busy} onRepair={() => { if (canNavigate()) { setStage("help"); setFilter("attention"); setPlan(null); void load().catch(e => setError(e.message)); } }} onCancel={() => run && void act(() => importSessions.cancelRun(branchId, run.id))} onRefresh={() => void act(async () => {})} onExport={() => { if (!run) return; void importSessions.exportRunErrors(branchId, run.id, "csv").then(blob => { const url = URL.createObjectURL(blob), link = document.createElement("a"); link.href = url; link.download = "import-recovery.csv"; link.click(); URL.revokeObjectURL(url); }).catch(e => setError(e.message)); }} />}
        {run && stage === "help" && <AppButton density="compact" variant="quiet" onClick={() => { if (canNavigate()) setStage("result"); }}>{t("View saved progress")}</AppButton>}
        {editorOpen && selected && draft && <GuidedStudentEditor key={`${selected.id}:${task}`} branchId={branchId} sessionId={sessionId} detail={detail} row={selected} draft={draft} focus={task} dirty={dirty} busy={busy} disabled={!!mutationDisabled} error={error} preview={preview} previewLoading={previewLoading} feeLinked={feeLinked} assignmentOnly={assignmentOnly} saveOutcome={outcomeNotice}
            onChange={(field, value) => {
                if (saved.student && ["studentName", "phone", "joinedAt", "fee"].includes(field)) return;
                if (saved.payment && ["paymentAmount", "paymentStatus", "paymentMethod", "referenceId"].includes(field)) return;
                if (saved.seating && ["seat", "shift", "multiShift"].includes(field)) return;
                const next = { ...draft, [field]: value, ...(field === "shift" ? { multiShift: "" } : field === "multiShift" ? { shift: "" } : {}) };
                if (!assignmentOnly && !saved.student && (field === "shift" || field === "multiShift") && (feeLinked || !draft.fee)) { const choice = [...(detail.branchContext?.shifts ?? []), ...(detail.branchContext?.multiShifts ?? [])].find(choice => choice.name === value); if (choice) next.fee = String(choice.price); }
                if (field === "fee") setFeeLinked(false);
                setDraft(next); setDirty(true);
            }}
            onFeeLinkChange={linked => { if (saved.student) return; setFeeLinked(linked); setDirty(true); if (linked) { const choice = [...(detail.branchContext?.shifts ?? []), ...(detail.branchContext?.multiShifts ?? [])].find(choice => choice.name === (draft.multiShift || draft.shift)); if (choice) setDraft({ ...draft, fee: String(choice.price) }); } }}
            onSave={() => void saveRow(true)} onDefer={() => void saveRow(true, true)} onReset={() => { setDirty(false); setError(null); setDraft(guidedDraft(selected, detail.mapping?.columnMappings)); setFeeLinked(["SHIFT_PRICE", "MULTI_SHIFT_PRICE"].includes(selected.normalizedData?.student?.feeSource ?? "")); }}
            onClose={() => { if (canNavigate()) { setEditorOpen(false); setError(null); } }} onSource={showSource}
            onExclude={() => { if (canNavigate()) void act(() => importSessions.updateRows(branchId, sessionId, { expectedRevision: detail.draftRevision, ...(selected.skipped ? { unskipRowIds: [selected.id] } : { skipRowIds: [selected.id] }) }), t(selected.skipped ? "Student included in this draft." : "Student left out of this import.")).then(ok => { if (ok) setEditorOpen(false); }); }} />}
        <ConfirmDialog isOpen={confirm} onClose={() => setConfirm(false)} onConfirm={() => void commit()} title={t("Save the reviewed students?")} description={t("Only this reviewed plan will run. Successful records stay saved if another operation needs recovery.")} confirmText={t("Confirm import")} loading={busy} />
    </PageShell>;
}
