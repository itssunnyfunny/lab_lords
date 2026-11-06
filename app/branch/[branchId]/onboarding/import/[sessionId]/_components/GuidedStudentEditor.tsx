"use client";

import { useEffect, useRef, useState } from "react";
import { AppButton, AppSelect, Dialog } from "@/components/ui";
import { LocalizedError, useTranslation } from "@/components/settings/LocalizedText";
import { useUserPreferences } from "@/components/settings/UserPreferencesApplier";
import { guidedSavedFields, guidedStudentTasks, guidedTaskLabel, type StudentTask } from "@/importing/utils/guided-import-presentation";
import { GuidedPaymentProblem } from "./GuidedPaymentProblem";
import { importReadiness } from "@/importing/utils/import-readiness";
import { parseImportMoney } from "@/importing/utils/row-normalizer";
import { CompactImportAllocationPicker } from "./CompactImportAllocationPicker";
import { GuidedFinancialOutcome } from "./GuidedFinancialReview";
import { importFieldClass, navigateImportTabs } from "./shared";
import type { ImportDetail, ImportRow, RowDraft, RowPreview } from "./types";

type Tab = "details" | "seating" | "payment";
const tabFor = (task: StudentTask): Tab => ["shift", "seat"].includes(task) ? "seating" : task === "payment" ? "payment" : "details";
type Props = {
    branchId: string; sessionId: string; detail: ImportDetail; row: ImportRow; draft: RowDraft; focus: StudentTask;
    dirty: boolean; busy: boolean; disabled: boolean; error: string | null; preview: RowPreview | null; previewLoading: boolean; feeLinked: boolean; assignmentOnly?: boolean; saveOutcome?: React.ReactNode;
    onChange: (field: keyof RowDraft, value: string) => void; onFeeLinkChange: (linked: boolean) => void;
    onSave: () => void; onNext: () => void; onReset: () => void; onDefer: () => void; onExclude: () => void; onClose: () => void; onSource: () => void;
};

export function GuidedStudentEditor(props: Props) {
    const { branchId, sessionId, detail, row, draft, focus, dirty, busy, disabled, error, preview, previewLoading, feeLinked,
        onChange, onFeeLinkChange, onSave, onReset, onDefer, onExclude, onClose, onSource } = props;
    const t = useTranslation(), { formatNumber } = useUserPreferences();
    const [tab, setTab] = useState<Tab>(tabFor(focus));
    const [focusTask, setFocusTask] = useState(focus);
    const content = useRef<HTMLDivElement>(null);
    const frozen = row.status === "IMPORTED" || row.skipped;
    const saved = guidedSavedFields(row.createdEntityIds);
    const tasks = guidedStudentTasks(row).filter(task => !props.assignmentOnly || ["seat", "shift"].includes(task));
    const earlyPayment = !dirty && row.issues.some(issue => issue.code === "PAYMENT_BEFORE_DUE_REVIEW");
    useEffect(() => {
        const frame = requestAnimationFrame(() => content.current?.querySelector<HTMLElement>(`[data-editor-focus="${focusTask}"]`)?.focus());
        return () => cancelAnimationFrame(frame);
    }, [row.id, focusTask, tab]);
    const issues = preview ? [...preview.issues, ...preview.warnings] : [...row.issues, ...row.warnings];
    const relevant = issues.filter(issue => !(tab === "payment" && !dirty && issue.code === "PAYMENT_BEFORE_DUE_REVIEW")).filter(issue => tab === "payment" ? /payment\.|PAYMENT/.test(`${issue.field} ${issue.code}`)
        : tab === "seating" ? /seat|shift|allocation|CONFLICT/i.test(`${issue.field} ${issue.code}`) : !/seat|shift|allocation|payment/i.test(`${issue.field} ${issue.code}`));
    const source = (field: string) => detail.mapping?.columnMappings?.filter(column => column.targetField === field)
        .flatMap(column => row.rawData[column.sourceColumn]?.trim() ? [row.rawData[column.sourceColumn]] : []).join(" · ") ?? "";
    const title = draft.studentName || t("Student details to confirm");
    const sourceTimings = source("shift.name") || source("allocation.shiftName") || source("allocation.multiShiftName");
    return <Dialog open title={<span><span className="block">{title}</span>{tab === "seating" && sourceTimings && <span className="mt-2 block text-xs font-normal leading-normal">{t("Uploaded timings: {value}", { value: sourceTimings })}</span>}</span>} description={t("Source record {number}. Changes stay in this draft until you confirm the import.", { number: row.rowNumber })}
        onClose={onClose} closeDisabled={busy} dismissOnBackdrop={!dirty && !busy} density="compact" languagePlacement="header"
        className="!max-w-4xl [&>.ui-dialog-header-language]:sticky [&>.ui-dialog-header-language]:-top-4 sm:[&>.ui-dialog-header-language]:-top-6 [&>.ui-dialog-header-language]:z-20 [&>.ui-dialog-header-language]:bg-[color:var(--ui-dialog-bg)] [&>.ui-dialog-header-language]:py-2 [&>button[aria-label]]:z-30"
        footer={<div className="space-y-3">
            {dirty && <p role="status" className="text-sm">{t("Unsaved changes. Save or reset before changing students.")}</p>}
            <div className="flex flex-wrap items-center gap-2">
                {!frozen && <AppButton density="compact" onClick={onSave} disabled={disabled || (!dirty && row.status !== "FAILED")} isLoading={busy}>{t.owned(!dirty && row.status === "FAILED" ? "Recheck student for retry" : "Save draft")}</AppButton>}
                {!frozen && !props.assignmentOnly && !(earlyPayment && tab === "payment") && <AppButton density="compact" variant="secondary" onClick={props.onNext} disabled={busy || dirty}>{t.owned(importReadiness(row) === "attention" ? "Keep pending and review next" : "Review next student")}</AppButton>}
                {!frozen && !saved.seating && tab === "seating" && <AppButton density="compact" variant="secondary" onClick={onDefer} disabled={disabled}>{t("Add seating later")}</AppButton>}
                {!frozen && <AppButton density="compact" variant="quiet" onClick={onReset} disabled={busy || !dirty}>{t("Reset changes")}</AppButton>}
                {row.status !== "IMPORTED" && <AppButton density="compact" variant="quiet" onClick={onExclude} disabled={disabled || dirty}>{t(row.skipped ? "Include this student" : "Leave this student out")}</AppButton>}
                <AppButton density="compact" variant="quiet" onClick={onClose} disabled={busy}>{t("Back to student list")}</AppButton>
            </div>
        </div>}>
        <div ref={content} className="space-y-5">
            {props.saveOutcome}
            {error && <p role="alert" className="rounded border border-[color:var(--ui-tone-danger-border)] bg-[color:var(--ui-tone-danger-bg)] p-3 text-sm"><LocalizedError error={error} /></p>}
            {frozen && <p role="status" className="text-sm">{t(row.skipped ? "This student is left out. Include them before making changes." : "This student is already saved. Their import record is kept unchanged.")}</p>}
            {!frozen && saved.student && <p className="text-sm">{t("Student details and the monthly fee are already saved. Finish only the remaining work here.")}</p>}
            {!frozen && saved.payment && tab === "payment" && <p className="text-sm">{t("This fee record is already saved. Its recorded facts stay unchanged during recovery.")}</p>}
            {!frozen && saved.seating && tab === "seating" && <p className="text-sm">{t("This seating is already saved. Finish the remaining fee work without changing it.")}</p>}
            {tasks.length > 1 && <div className="flex flex-wrap gap-2" aria-label={t("What this student needs")}>
                {tasks.map(task => <AppButton key={task} density="compact" variant="secondary" disabled={busy} onClick={() => { if (task === "source") onSource(); else { setFocusTask(task); setTab(tabFor(task)); } }}>{t.owned(guidedTaskLabel(row, task))}</AppButton>)}
            </div>}
            {!props.assignmentOnly && <div role="tablist" aria-label={t("Student information")} onKeyDown={navigateImportTabs} className="flex flex-wrap gap-2 border-b border-[color:var(--ui-form-section-divider)] pb-3">
                {([["details", "Student details"], ["seating", "Seat and timings"], ["payment", "This month's fees"]] as const).map(([value, label]) => <AppButton key={value} role="tab" tabIndex={tab === value ? 0 : -1} aria-selected={tab === value} density="compact" variant={tab === value ? "primary" : "quiet"} onClick={() => setTab(value)} disabled={busy}>{t(label)}</AppButton>)}
            </div>}
            <fieldset disabled={disabled || frozen || (tab === "details" && saved.student) || (tab === "payment" && saved.payment) || (tab === "seating" && saved.seating)} className="min-w-0 space-y-4" aria-label={t("Edit student details")}>
                {tab === "details" && <div className="grid gap-4 sm:grid-cols-2">
                    <label className="space-y-2"><span className="text-sm">{t("Student name")}</span><input data-editor-focus="details" value={draft.studentName} onChange={event => onChange("studentName", event.target.value)} className={`w-full ${importFieldClass}`} /></label>
                    <label className="space-y-2"><span className="text-sm">{t("Phone")}</span><input type="tel" value={draft.phone} onChange={event => onChange("phone", event.target.value)} className={`w-full ${importFieldClass}`} /></label>
                    <label className="space-y-2"><span className="text-sm">{t("Joined date")}</span><input type="date" aria-label={t("Joined date")} data-editor-focus="joining" data-dialog-initial-focus={focus === "joining" || undefined} value={draft.joinedAt} onChange={event => onChange("joinedAt", event.target.value)} className={`w-full ${importFieldClass}`} />{source("student.joinedAt") && <small className="block text-[color:var(--text-muted)]">{t("Uploaded value: {value}", { value: source("student.joinedAt") })}</small>}</label>
                    <label className="space-y-2"><span className="text-sm">{t("Monthly fee")}</span><input inputMode="decimal" aria-label={t("Monthly fee")} data-editor-focus="fee" value={draft.fee} onChange={event => onChange("fee", event.target.value)} className={`w-full ${importFieldClass}`} /><small className="block text-[color:var(--text-muted)]">{t("The monthly fee is separate from any recorded payment.")}</small></label>
                </div>}
                {tab === "seating" && <div className="space-y-4" tabIndex={-1} data-editor-focus={focusTask === "seat" ? "seat" : "shift"}>
                    <p className="text-sm text-[color:var(--text-secondary)]">{t("Choose the student's timings, then a seat. You can save their details and add seating later.")}</p>
                    <CompactImportAllocationPicker branchId={branchId} sessionId={sessionId} rowId={row.id} draft={draft} branchContext={detail.branchContext} feeLinked={feeLinked} feeLocked={saved.student || props.assignmentOnly} showFeeLink={!props.assignmentOnly} onDraftChange={onChange} onFeeLinkChange={onFeeLinkChange} guided />
                </div>}
                {tab === "payment" && <div className="space-y-4">
                    {earlyPayment && <div className="space-y-3 rounded border border-[color:var(--ui-tone-warning-border)] bg-[color:var(--ui-tone-warning-bg)] p-4">
                        <GuidedPaymentProblem row={row} explain />
                        <div className="flex flex-wrap gap-2"><AppButton density="compact" onClick={props.onNext} disabled={busy}>{t.owned("Keep pending and review next")}</AppButton><AppButton density="compact" variant="secondary" onClick={() => { setFocusTask("joining"); setTab("details"); }}>{t.owned("Check original joining date")}</AppButton></div>
                    </div>}
                    <div className="rounded border border-[color:var(--ui-form-section-divider)] bg-[color:var(--ui-form-muted-surface-bg)] p-4"><p className="text-sm">{t("Monthly fee")}: <strong>{parseImportMoney(draft.fee) === undefined ? t("Needs confirmation") : `₹${formatNumber(parseImportMoney(draft.fee)!)}`}</strong></p>{!dirty && row.paymentOutcome ? <div className="mt-3"><GuidedFinancialOutcome outcome={row.paymentOutcome} /></div> : <p className="mt-3 text-sm">{t("Save your changes to refresh this month's outcome.")}</p>}</div>
                    <p className="text-sm">{t("Copy only payment facts recorded in your source. Leave an amount blank when no payment was recorded.")}</p>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <label className="space-y-2"><span className="text-sm">{t("Payment amount")}</span><input data-editor-focus="payment" data-dialog-initial-focus={focus === "payment" || undefined} inputMode="decimal" value={draft.paymentAmount} onChange={event => onChange("paymentAmount", event.target.value)} className={`w-full ${importFieldClass}`} /></label>
                        <label className="space-y-2"><span className="text-sm">{t("Payment status")}</span><AppSelect value={draft.paymentStatus} onValueChange={value => onChange("paymentStatus", value)} options={[{ value: "", label: t("No recorded status") }, ...(!["", "DUE", "PAID", "WAIVED", "UNCLEAR"].includes(draft.paymentStatus) ? [{ value: draft.paymentStatus, label: draft.paymentStatus }] : []), ...["DUE", "PAID", "WAIVED", "UNCLEAR"].map(value => ({ value, label: t(value === "DUE" ? "Due" : value === "PAID" ? "Paid" : value === "WAIVED" ? "Waived" : "Unclear") }))]} /></label>
                        <label className="space-y-2"><span className="text-sm">{t("Method")}</span><AppSelect value={draft.paymentMethod} onValueChange={value => onChange("paymentMethod", value)} options={[{ value: "", label: t("No recorded method") }, ...(!["", "CASH", "UPI", "BANK_TRANSFER"].includes(draft.paymentMethod) ? [{ value: draft.paymentMethod, label: draft.paymentMethod }] : []), { value: "CASH", label: t("Cash") }, { value: "UPI", label: "UPI" }, { value: "BANK_TRANSFER", label: t("Bank transfer") }]} /></label>
                        <label className="space-y-2"><span className="text-sm">{t("Reference")}</span><input value={draft.referenceId} onChange={event => onChange("referenceId", event.target.value)} className={`w-full ${importFieldClass}`} /></label>
                    </div>
                </div>}
            </fieldset>
            {previewLoading && <p role="status" className="text-xs text-[color:var(--text-muted)]">{t("Checking your changes…")}</p>}
            {!!relevant.length && <ul className="space-y-2 rounded border border-[color:var(--ui-tone-warning-border)] bg-[color:var(--ui-tone-warning-bg)] p-3 text-sm" aria-label={t("Information to check")}>{relevant.map((issue, index) => <li key={`${issue.code}:${index}`}>{issue.code.startsWith("ALLOCATION_SKIPPED_") ? t("Seating is left for later. The student can still be saved.") : ["UNKNOWN_SHIFT", "UNKNOWN_MULTI_SHIFT"].includes(issue.code) ? t("Choose the timings meant by the uploaded value.") : issue.code === "UNKNOWN_SEAT" ? t("Choose an existing seat or add seating later.") : /ALLOCATION_CONFLICT|SEAT_CONFLICT|OVERLAP/.test(issue.code) ? t("Check the marked seats and timings, then choose an available seat.") : <LocalizedError error={issue.message} />}</li>)}</ul>}
            <details><summary className="cursor-pointer text-xs text-[color:var(--text-muted)]">{t("Uploaded values for this student")}</summary><dl className="mt-3 grid gap-3 sm:grid-cols-2">{Object.entries(row.rawData).map(([key, value]) => <div className="min-w-0" key={key}><dt className="text-xs text-[color:var(--text-muted)]">{key}</dt><dd className="break-words text-sm">{value || "—"}</dd></div>)}</dl></details>
        </div>
    </Dialog>;
}
