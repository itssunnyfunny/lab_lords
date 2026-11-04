"use client";

import { useState } from "react";
import { CheckCircle2, Clock3, CircleAlert, ArrowLeft } from "lucide-react";
import { AppButton, AppPanel } from "@/components/ui";
import { useTranslation, LocalizedError } from "@/components/settings/LocalizedText";
import { useUserPreferences } from "@/components/settings/UserPreferencesApplier";
import { financialKind, financialLabels, financialOutcomeLabels, summarizeGuidedFinancials, type FinancialKind, type FinancialOutcome, type FinancialSummary } from "@/importing/utils/guided-import-presentation";
import { isImportPlanFresh } from "@/importing/utils/import-wizard-view-model";
import type { ImportReadinessPolicy } from "@/importing/contracts/import-v2.contract";
import type { Plan } from "./types";

const savedLabels = { due: "Dues recorded", paid: "Recorded as paid", waived: "Recorded as waived", existing: "Existing records kept",
    future: "Left to normal generation", none: "No fee created this month", review: "Still needs confirmation" } as const satisfies Record<FinancialKind, string>;

export function GuidedFinancialTotals({ summary, saved = false }: { summary: FinancialSummary; saved?: boolean }) {
    const t = useTranslation(), { formatNumber } = useUserPreferences();
    const visible = (Object.keys(financialLabels) as FinancialKind[]).filter(kind => summary[kind].count > 0);
    return <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label={t(saved ? "Fees saved by this import" : "Reviewed fee outcomes")}>
        {visible.map(kind => <div key={kind} className="min-w-0 rounded-[var(--ui-radius-control)] border border-[color:var(--ui-form-section-divider)] bg-[color:var(--ui-form-muted-surface-bg)] p-4">
            <p className="text-sm text-[color:var(--text-secondary)]">{t(saved ? savedLabels[kind] : financialLabels[kind])}</p>
            <p className="mt-2 text-xl font-semibold tabular-nums">{!["none", "review"].includes(kind) ? `₹${formatNumber(summary[kind].amount)}` : formatNumber(summary[kind].count)}</p>
            <p className="mt-1 text-xs text-[color:var(--text-muted)]">{t("Students: {count}", { count: summary[kind].count })}{kind === "future" ? ` · ${t("Nothing created early")}` : ""}</p>
        </div>)}
        {!visible.length && <p className="text-sm">{t(saved ? "No fee records have been saved by this import yet." : "No fees will be created from this selection.")}</p>}
    </div>;
}

export function GuidedFinancialOutcome({ outcome }: { outcome: FinancialOutcome }) {
    const t = useTranslation(), { formatDate, formatNumber } = useUserPreferences();
    const kind = financialKind(outcome), Icon = kind === "review" ? CircleAlert : kind === "future" ? Clock3 : CheckCircle2;
    return <div className="flex min-w-0 gap-2 text-sm">
        <Icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0"><p>{t(financialOutcomeLabels[kind], { date: outcome.dueDate ? formatDate(outcome.dueDate) : "" })}</p>
            {!["none", "review"].includes(kind) && <p className="mt-1 font-medium tabular-nums">₹{formatNumber(outcome.amount ?? 0)}{outcome.dueDate && kind !== "future" ? ` · ${formatDate(outcome.dueDate)}` : ""}</p>}
        </div>
    </div>;
}

export function GuidedFinancialReview({ plan, currentRevision, policy, busy, disabled, onBack, onPolicyChange, onRefresh, onConfirm }: {
    plan: Plan | null; currentRevision: number; policy: ImportReadinessPolicy; busy: boolean; disabled: boolean;
    onBack: () => void; onPolicyChange: (policy: ImportReadinessPolicy) => void; onRefresh: () => void; onConfirm: () => void;
}) {
    const t = useTranslation(), { formatNumber, formatDate } = useUserPreferences();
    const [page, setPage] = useState(0);
    const fresh = isImportPlanFresh(plan, policy, currentRevision), review = plan?.currentMonthReview;
    const completeSummary = review?.heldFinancialRows !== undefined && review.seatingDeferredRows !== undefined;
    const mutations = plan?.summary?.mutations ?? plan?.mutationSummary;
    const totals = summarizeGuidedFinancials(review?.rows ?? []);
    totals.review.count += review?.heldFinancialRows ?? 0;
    const notSaving = (plan?.blockedRows ?? 0) + Math.max(0, (plan?.skippedRows ?? 0) - (plan?.alreadyImportedRows ?? 0));
    const pageCount = Math.max(1, Math.ceil((review?.rows.length ?? 0) / 15)), safePage = Math.min(page, pageCount - 1);
    return <div className="space-y-5">
        <AppButton density="compact" variant="quiet" icon={ArrowLeft} onClick={onBack} disabled={busy}>{t("Back to students")}</AppButton>
        <div><h2 className="text-2xl font-semibold">{t("Check what will be saved")}</h2><p className="mt-2 text-sm text-[color:var(--text-secondary)]">{t("This review uses your saved student details. Nothing is added until you confirm.")}</p></div>
        {!plan || !fresh || !completeSummary ? <AppPanel density="compact"><p role="status">{t(plan && fresh ? "Refresh this saved review to see the complete student and fee summary." : "Refresh the review after changing student details or which students to include.")}</p><AppButton density="compact" className="mt-3" onClick={onRefresh} disabled={disabled} isLoading={busy}>{t("Refresh review")}</AppButton></AppPanel> : <>
            <AppPanel density="compact" title={t("Students and seating")}>
                <dl className="grid grid-cols-2 gap-5 sm:grid-cols-4">{[["New students", mutations?.students ?? 0], ["Students getting seats", mutations?.affectedRows.allocations ?? 0], ["Seating left for later", review?.seatingDeferredRows ?? 0], ["Students fully completed", plan.alreadyImportedRows ?? 0]].map(([label, count]) => <div key={label}><dt className="text-sm text-[color:var(--text-secondary)]">{t.owned(String(label))}</dt><dd className="mt-1 text-xl font-semibold tabular-nums">{formatNumber(Number(count))}</dd></div>)}</dl>
                {notSaving > 0 && <p className="mt-5 rounded border border-[color:var(--ui-tone-warning-border)] bg-[color:var(--ui-tone-warning-bg)] p-3 text-sm">{t("Students staying in the draft: {count}. You can finish their details after saving the ready students.", { count: notSaving })}</p>}
            </AppPanel>
            <AppPanel density="compact" title={t("This month's fees")} description={review ? t("Reviewed for {date}", { date: formatDate(`${review.businessDate}T12:00:00`) }) : undefined}>
                <GuidedFinancialTotals summary={totals} />
                <p className="mt-4 text-sm text-[color:var(--text-secondary)]">{t("Original joining dates set each due date. Past months are not added; future dues are generated when their dates arrive.")}</p>
                {!!totals.review.count && <AppButton density="compact" className="mt-3" variant="secondary" onClick={onBack}>{t("Confirm the remaining fee information")}</AppButton>}
                <details className="mt-5"><summary className="cursor-pointer text-sm font-medium">{t("Check fees student by student")}</summary>
                    <div className="mt-3 divide-y divide-[color:var(--ui-form-section-divider)]">{review?.rows.slice(safePage * 15, (safePage + 1) * 15).map(row => <div key={row.rowId} className="grid gap-2 py-4 sm:grid-cols-2"><strong className="min-w-0 break-words">{row.studentName}</strong><GuidedFinancialOutcome outcome={row} />{row.reviewedBusinessDate !== review.businessDate && <p className="text-xs text-[color:var(--text-muted)] sm:col-span-2">{t("Recovery keeps the review from {date}", { date: formatDate(`${row.reviewedBusinessDate}T12:00:00`) })}</p>}</div>)}</div>
                    {pageCount > 1 && <div className="mt-3 flex items-center gap-3"><AppButton density="compact" variant="secondary" disabled={!safePage} onClick={() => setPage(safePage - 1)}>{t("Previous")}</AppButton><span>{safePage + 1} / {pageCount}</span><AppButton density="compact" variant="secondary" disabled={safePage + 1 >= pageCount} onClick={() => setPage(safePage + 1)}>{t("Next")}</AppButton></div>}
                </details>
            </AppPanel>
            <AppPanel density="compact" title={t("Ready to save?")}>
                <p className="text-sm">{t("Only the reviewed students and fee outcomes above will be saved. Successful records are kept during retries.")}</p>
                <label className="mt-4 flex items-start gap-2 text-sm"><input type="checkbox" checked={policy === "REQUIRE_ALL_ROWS_READY"} disabled={disabled} onChange={event => onPolicyChange(event.target.checked ? "REQUIRE_ALL_ROWS_READY" : "READY_ROWS_ONLY")} /><span>{t("Wait until every student is ready")}</span></label>
                {!plan.canRun && <div role="alert" className="mt-4 space-y-2">{plan.checks.filter(check => check.status === "block").map(check => <p className="text-sm" key={check.code}><LocalizedError error={check.message} /></p>)}</div>}
                <div className="mt-5 flex flex-wrap gap-3"><AppButton density="compact" onClick={onConfirm} disabled={disabled || !plan.canRun || !fresh} isLoading={busy}>{t("Confirm and save")}</AppButton><AppButton density="compact" variant="quiet" onClick={onRefresh} disabled={disabled}>{t("Update fee dates and review")}</AppButton></div>
                <details className="mt-5"><summary className="cursor-pointer text-xs text-[color:var(--text-muted)]">{t("Review checks")}</summary><ul className="mt-2 list-disc space-y-1 pl-5 text-xs">{plan.checks.map(check => <li key={check.code}>{check.status === "pass" ? "✓ " : "! "}<LocalizedError error={check.message} /></li>)}</ul></details>
            </AppPanel>
        </>}
    </div>;
}
