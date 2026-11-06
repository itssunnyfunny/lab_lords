"use client";
import { useEffect, useState } from "react";
import { AppButton, AppPanel } from "@/components/ui";
import { LocalizedError, useTranslation } from "@/components/settings/LocalizedText";
import { useUserPreferences } from "@/components/settings/UserPreferencesApplier";
import { importSessions } from "@/lib/api/importSessions";
import type { GuidedPaymentResolution, GuidedPaymentReview } from "@/importing/utils/guided-payment-choice";
import { GuidedFinancialOutcome } from "./GuidedFinancialReview";
import { importFieldClass } from "./shared";
import { paymentProblemLabels } from "@/importing/utils/guided-import-presentation";

export function GuidedPaymentChoices({ branchId, sessionId, revision, disabled, onApply, onDirtyChange, onReview, onRecheck }: {
    branchId: string; sessionId: string; revision: number; disabled: boolean;
    onApply: (input: GuidedPaymentResolution) => Promise<boolean>; onDirtyChange: (dirty: boolean) => void;
    onReview: (issueCode: string) => void; onRecheck: () => void;
}) {
    const t = useTranslation(), { formatNumber } = useUserPreferences();
    const [review, setReview] = useState<GuidedPaymentReview | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [open, setOpen] = useState(false);
    const [mode, setMode] = useState<"DUE" | "PAID" | null>(null);
    const [methods, setMethods] = useState<Record<string, "" | "CASH" | "UPI" | "BANK_TRANSFER">>({});
    const [limit, setLimit] = useState(50);
    const [reload, setReload] = useState(0);
    useEffect(() => {
        let alive = true;
        void importSessions.paymentChoices(branchId, sessionId).then(data => { if (alive) {
            setReview(data); setError(null); setMode(null); setMethods({}); onDirtyChange(false);
        } })
            .catch(e => { if (alive) setError(e.message); });
        return () => { alive = false; };
    }, [branchId, sessionId, revision, reload, onDirtyChange]);
    const due = review?.rows.filter(row => row.dueEligible) ?? [];
    const paid = review?.rows.filter(row => row.paidEligible) ?? [];
    const held = review?.rows.filter(row => !row.saved && row.outcome.state === "NEEDS_REVIEW") ?? [];
    const problems = new Map<string, number>();
    for (const row of held) for (const code of new Set(row.outcome.issues.map(issue => issue.code))) {
        if (paymentProblemLabels[code]) problems.set(code, (problems.get(code) ?? 0) + 1);
    }
    const visible = review?.rows.filter(row => mode === "DUE" ? row.dueEligible : row.paidEligible) ?? [];
    const selected = review?.rows.filter(row => mode === "DUE" ? row.dueEligible : Object.hasOwn(methods, row.rowId)) ?? [];
    const sum = selected.reduce((total, row) => total + (row.outcome.amount ?? 0), 0);
    const choose = (next: "DUE" | "PAID") => { setMode(next); setOpen(true); setMethods({}); onDirtyChange(next === "DUE"); };
    const reset = () => { setMode(null); setOpen(false); setMethods({}); onDirtyChange(false); };
    const apply = async () => {
        if (!review || !mode) return;
        const common = { expectedRevision: review.draftRevision, businessDate: review.businessDate };
        const input: GuidedPaymentResolution = mode === "DUE" ? { ...common, action: "DUE", rowIds: selected.map(row => row.rowId) }
            : { ...common, action: "PAID", payments: selected.map(row => ({ rowId: row.rowId, method: methods[row.rowId] as "CASH" | "UPI" | "BANK_TRANSFER" })) };
        const saved = await onApply(input);
        reset();
        // A lost response can follow a successful save. Read the persisted choices
        // before offering another mutation; never replay the old selection.
        if (!saved) setReload(value => value + 1);
    };
    return <AppPanel density="compact" title={t.owned(due.length || paid.length ? "Choose how this month's fees start" : held.length ? "Resolve the recorded payment conflicts" : "Payment review")}>
        {error && <p role="alert"><LocalizedError error={error} /></p>}
        {!review && !error && <p role="status">{t("Preparing your records...")}</p>}
        {(due.length > 0 || paid.length > 0) && <p className="mb-3 text-sm">{t.owned("Eligible current-month fees can stay Due. Record collections later, or confirm selected payments as Paid. Future dues are generated on their normal dates.")}</p>}
        <div className="flex flex-wrap gap-2">
            {due.length > 0 && <AppButton density="compact" disabled={disabled} onClick={() => choose("DUE")}>{t.owned("Keep eligible fees Due")} · {formatNumber(due.length)}</AppButton>}
            {paid.length > 0 && <AppButton density="compact" variant="secondary" disabled={disabled} onClick={() => choose("PAID")}>{t.owned("Review payments and select Paid")}</AppButton>}
            {error && <AppButton density="compact" variant="quiet" disabled={disabled} onClick={() => { reset(); setReload(value => value + 1); }}>{t.owned("Refresh payment choices")}</AppButton>}
        </div>
        {!!problems.size && <div className="space-y-3">
            {problems.has("PAYMENT_BEFORE_DUE_REVIEW") && <p className="text-sm">{t.owned("Recorded payments precede their due dates. Check the dates and source facts, or keep these students pending until their dues are eligible.")}</p>}
            <div className="flex flex-wrap gap-2">{[...problems].map(([code, count]) => <AppButton key={code} density="compact" variant="secondary" disabled={disabled || mode !== null} onClick={() => onReview(code)}>{t.owned("Review: {reason}", { reason: t.owned(paymentProblemLabels[code]) })} · {formatNumber(count)}</AppButton>)}</div>
        </div>}
        {review && !due.length && !paid.length && <p className="mt-3 text-sm">{t.owned("No payments are eligible for a bulk Due or Paid choice. Recorded payment facts stay unchanged.")}</p>}
        {review && <AppButton className="mt-3" density="compact" variant="quiet" disabled={disabled || mode !== null} onClick={onRecheck}>{t.owned("Recheck draft and due dates")}</AppButton>}
        {review?.rows.some(row => row.decision) && <p className="mt-3 text-sm">{t.owned("Saved Due choices: {due}. Confirmed Paid choices: {paid}.", { due: review.rows.filter(row => row.decision === "KEEP_DUE").length, paid: review.rows.filter(row => row.decision === "CONFIRMED_PAID").length })}</p>}
        {open && review && <div className="mt-4 space-y-3">
            <p className="text-sm">{t.owned("Source and confirmed payments stay unchanged by bulk defaults. Open a student's payment details to correct a recorded fact.")}</p>
            <ul className="space-y-3" aria-label={t.owned("Current-month payment choices")}>
                {visible.slice(0, limit).map(row => <li key={row.rowId} className="rounded border border-[color:var(--ui-form-surface-border)] p-3 text-sm">
                    <p className="font-medium">{row.name} · {t("Source record {number}", { number: row.rowNumber })}</p>
                    {!row.saved && <GuidedFinancialOutcome outcome={row.outcome} />}
                    <p className="mt-1 text-[color:var(--text-secondary)]">{t.owned(row.reason)}</p>
                    {mode === "DUE" && row.dueEligible && <p className="mt-2 font-medium">{t.owned("Will be kept Due; collect later.")}</p>}
                    {mode === "PAID" && row.paidEligible && <div className="mt-2 flex flex-wrap items-center gap-3">
                        <label className="flex min-h-11 items-center gap-2"><input type="checkbox" disabled={disabled} checked={Object.hasOwn(methods, row.rowId)} onChange={event => {
                            const next = { ...methods }; if (event.target.checked) next[row.rowId] = ""; else delete next[row.rowId];
                            setMethods(next); onDirtyChange(Object.keys(next).length > 0);
                        }} />{t.owned("Confirm Paid for {name}", { name: row.name })}</label>
                        {Object.hasOwn(methods, row.rowId) && <label>{t("Method")}<select className={`ml-2 ${importFieldClass}`} value={methods[row.rowId]} disabled={disabled} onChange={event => setMethods({ ...methods, [row.rowId]: event.target.value as typeof methods[string] })}>
                            <option value="">{t.owned("Choose the recorded method")}</option><option value="CASH">{t("Cash")}</option><option value="UPI">UPI</option><option value="BANK_TRANSFER">{t("Bank transfer")}</option>
                        </select></label>}
                    </div>}
                </li>)}
            </ul>
            {visible.length > limit && <AppButton density="compact" variant="quiet" onClick={() => setLimit(value => value + 50)}>{t("Show more students")}</AppButton>}
            {mode && <div className="space-y-3 rounded border border-[color:var(--ui-form-surface-border)] p-3">
                <p role="status">{t.owned(mode === "DUE" ? "On final import: {count} eligible fees, ₹{amount}, will be Due. No collection is recorded." : "On final import: {count} selected payments, ₹{amount}, will be recorded as Paid using the methods you chose.", { count: selected.length, amount: formatNumber(sum) })}</p>
                <p className="text-sm">{t.owned("This action saves the choice in your draft. Nothing is imported yet.")}</p>
                <div className="flex gap-2"><AppButton density="compact" disabled={disabled || !selected.length || (mode === "PAID" && selected.some(row => !methods[row.rowId]))} onClick={() => void apply()}>{t.owned("Save payment choices to draft")}</AppButton>
                    <AppButton density="compact" variant="quiet" disabled={disabled} onClick={reset}>{t("Reset changes")}</AppButton></div>
            </div>}
        </div>}
        {review && <details className="mt-3 text-sm"><summary className="cursor-pointer">{t.owned("View protected and future payment records")}</summary>
            <ul className="mt-2 space-y-2">{review.rows.filter(row => !row.dueEligible && !row.paidEligible).slice(0, limit).map(row => <li key={row.rowId}>{row.name} · {t.owned(row.reason)}</li>)}</ul>
            {review.rows.filter(row => !row.dueEligible && !row.paidEligible).length > limit && <AppButton density="compact" variant="quiet" onClick={() => setLimit(value => value + 50)}>{t("Show more students")}</AppButton>}
        </details>}
    </AppPanel>;
}
