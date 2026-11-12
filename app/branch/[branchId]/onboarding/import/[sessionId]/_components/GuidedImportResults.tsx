"use client";
import Link from "next/link";
import { CheckCircle2, CircleAlert, Loader2 } from "lucide-react";
import { AppButton, AppPanel } from "@/components/ui";
import { appActionClassName } from "@/components/ui/AppButton";
import { LocalizedError, useTranslation } from "@/components/settings/LocalizedText";
import { useUserPreferences } from "@/components/settings/UserPreferencesApplier";
import { GuidedFinancialTotals } from "./GuidedFinancialReview";
import type { ImportDetail, Run } from "./types";

export function GuidedImportResults({ branchId, detail, run, busy, onRepair, onCancel, onRefresh, onExport }: {
    branchId: string; detail: ImportDetail; run: Run | null; busy: boolean; onRepair: () => void; onCancel: () => void; onRefresh: () => void; onExport: () => void;
}) {
    const t = useTranslation(), { formatNumber } = useUserPreferences();
    const active = !!run && ["QUEUED", "RUNNING", "RETRYABLE_FAILURE", "CANCEL_REQUESTED"].includes(run.status);
    const guidance = detail.guidance;
    const remaining = (guidance?.needsHelp ?? 0) + (detail.summary?.readyRows ?? 0) + (detail.summary?.warningRows ?? 0);
    const cancelled = run?.status === "CANCELLED";
    const incomplete = !!run && !active && !cancelled && (remaining > 0 || run.failedItems > 0 || run.status === "PERMANENT_FAILURE");
    const title = !run ? t("Checking saved progress") : active ? t("Saving your students") : cancelled ? t("Import stopped; saved records are kept") : incomplete ? t("Saved progress — a few things still need help") : t("Your students are saved");
    const Icon = !run || active ? Loader2 : incomplete || cancelled ? CircleAlert : CheckCircle2;
    const progress = run?.totalItems ? Math.min(100, Math.round(run.completedItems / run.totalItems * 100)) : 0;
    return <div className="space-y-5">
        <AppPanel density="compact"><div className="flex items-start gap-3"><Icon aria-hidden="true" className={`mt-1 h-6 w-6 shrink-0 ${active ? "animate-spin motion-reduce:animate-none" : ""}`} /><div><h2 className="text-xl font-semibold">{title}</h2><p className="mt-2 text-sm text-[color:var(--text-secondary)]">{t(active ? "You can return to this import to check progress. Completed records stay saved." : cancelled ? "Unsaved work was stopped. Review saved students or return to import history; this stopped import cannot be edited." : incomplete ? "Successful records are already in Lab Lords. Finish only the remaining work; saved records will not be added twice." : "These are the records saved by this import. Future fees continue on each student's normal due date.")}</p></div></div>
            {active && <div className="mt-5"><label className="text-sm">{t("Saving progress")} · {progress}%</label><progress className="mt-2 h-2 w-full accent-[color:var(--ui-tone-success-text)]" value={progress} max={100} aria-label={t("Saving progress")} /></div>}
            <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{[["Students saved", guidance?.createdStudents ?? 0], ["Students fully completed", guidance?.imported ?? 0], ["Students with work remaining", remaining], ["Left out", detail.summary?.skippedRows ?? 0]].map(([label, count]) => <div key={label}><dt className="text-sm text-[color:var(--text-secondary)]">{t.owned(String(label))}</dt><dd className="mt-1 text-2xl font-semibold tabular-nums">{formatNumber(Number(count))}</dd></div>)}</dl>
            {!!detail.summary?.skippedRows && <p className="mt-4 text-sm">{t.owned("Source rows deliberately left out: {count}. They were not imported.", { count: detail.summary.skippedRows })}</p>}
            {run?.error?.message && <p className="mt-4 text-sm" role="alert"><LocalizedError error={run.error.message} /></p>}
            <div className="mt-4 flex flex-wrap gap-3">{incomplete && <AppButton density="compact" onClick={onRepair} disabled={busy}>{t("Finish the remaining work")}</AppButton>}
                {!active && <Link className={appActionClassName(incomplete ? "secondary" : "primary")} href={`/branch/${branchId}/students`}>{t("View saved students")}</Link>}
                {cancelled && <Link className={appActionClassName("secondary")} href={`/branch/${branchId}/onboarding/import`}>{t("Back to import history")}</Link>}
                {active && run?.status !== "CANCEL_REQUESTED" && <AppButton density="compact" variant="secondary" onClick={onCancel} disabled={busy}>{t("Stop unsaved work")}</AppButton>}
                <AppButton density="compact" variant="quiet" onClick={onRefresh} disabled={busy}>{t("Refresh progress")}</AppButton>
            </div>
        </AppPanel>
        {guidance?.savedSeating && <AppPanel density="compact" title={t.owned("Saved assignments")}>
            <p className="text-sm">{t.owned("Students assigned: {count}", { count: guidance.savedSeating.assigned })} · {t.owned("Seating deliberately left for later: {count}", { count: guidance.savedSeating.deferred })}</p>
            <Link className={`${appActionClassName("secondary")} mt-3`} href={`/branch/${branchId}/seats`}>{t.owned("View seats and timings")}</Link>
        </AppPanel>}
        {guidance?.savedFinancials && <AppPanel density="compact" title={t("Fees recorded by this import")} description={t("Successful fee operations at import time. Check Fees for today's balances and later collections.")}><GuidedFinancialTotals summary={guidance.savedFinancials} saved /></AppPanel>}
        <details><summary className="cursor-pointer text-sm text-[color:var(--text-secondary)]">{t("Import details and recovery report")}</summary><div className="mt-3 space-y-3 text-sm"><p>{t("Saved seat links: {count}", { count: guidance?.createdAllocations ?? 0 })} · {t("Saved fee records: {count}", { count: guidance?.createdPayments ?? 0 })}</p>{run && <p>{t("Operations completed: {completed} of {total}", { completed: run.completedItems, total: run.totalItems })}</p>}{!!run?.failedItems && <AppButton density="compact" variant="secondary" onClick={onExport} disabled={busy}>{t("Download the recovery report")}</AppButton>}</div></details>
    </div>;
}
