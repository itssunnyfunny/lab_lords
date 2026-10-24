"use client";
import Link from "next/link";
import { useState } from "react";
import { AppPanel } from "@/components/ui";
import { appActionClassName } from "@/components/ui/AppButton";
import { RecordListState } from "@/components/ui/RecordList";
import { useTranslation } from "@/components/settings/LocalizedText";
import { useUserPreferences } from "@/components/settings/UserPreferencesApplier";
import { useDashboardResource } from "@/components/dashboard-features/shared";
import { getOverduePaymentHref } from "@/lib/overdueQueue";
import type { DashboardOverview } from "@/lib/dashboardContracts";
import type { BranchAccess } from "@/types";
import type { RenewalPage } from "@/lib/renewals";
import { SourceState } from "./ReferenceDashboard";

export function DashboardOperationalPreviews({ branchId, access, students, retry }: {
    branchId: string; access: BranchAccess; students: DashboardOverview["students"]; retry: () => void;
}) {
    const t = useTranslation(); const { formatDate } = useUserPreferences();
    const base = `/branch/${encodeURIComponent(branchId)}`;
    return <section className="mt-3 grid min-w-0 gap-3 lg:grid-cols-2" aria-label={t.owned("Branch work previews")}>
        {access.permissions.students && <AppPanel density="compact" title={t.owned("New enrollments")}>
            {students.data ? students.data.recent ? <ul className="divide-y divide-[color:var(--ui-panel-border)]">{students.data.recent.map(student => <li key={student.id} className="flex flex-wrap items-center justify-between gap-2 py-2"><Link className="inline-flex min-h-11 items-center break-words text-sm font-semibold underline" href={`${base}/students?studentId=${encodeURIComponent(student.id)}&status=${student.status}`}>{student.name}</Link><span className="text-xs text-[color:var(--text-muted)]">{t("Joined")}: {formatDate(student.joinedAt)}</span></li>)}{!students.data.recent.length && <li className="py-3 text-sm">{t.owned("No students yet")}</li>}</ul> : <p className="text-sm">{t.owned("Recent student records could not be refreshed.")}</p> : <SourceState source={students} retry={retry} />}
            <Link className={appActionClassName("quiet")} href={`${base}/students`}>{t.owned("View all students")}</Link>
        </AppPanel>}
        {access.permissions.view_payments && <OverduePreview branchId={branchId} />}
    </section>;
}

function OverduePreview({ branchId }: { branchId: string }) {
    const t = useTranslation(); const { formatNumber, formatDate } = useUserPreferences();
    const resource = useDashboardResource<RenewalPage>(`/api/branches/${encodeURIComponent(branchId)}/renewals?filter=OVERDUE&limit=5`);
    const [selected, setSelected] = useState<string[]>([]);
    const rows = resource.data?.items.filter(row => row.paymentId) ?? [];
    return <AppPanel density="compact" title={t.owned("Payment follow-ups")} description={t.owned("Select recorded overdue fees to review. Opening a fee does not record payment.")}>
        {resource.loading ? <RecordListState kind="loading" title="Loading…" /> : resource.error ? <RecordListState kind="error" title="Something went wrong" description={t.error(resource.error)} onRetry={() => void resource.reload()} /> : <ul className="divide-y divide-[color:var(--ui-panel-border)]">{rows.map(row => <li key={row.paymentId} className="flex flex-wrap items-center gap-3 py-2"><label className="flex min-h-11 min-w-0 flex-1 items-center gap-2 text-sm"><input type="checkbox" checked={selected.includes(row.paymentId!)} onChange={event => setSelected(current => event.target.checked ? [...current, row.paymentId!] : current.filter(id => id !== row.paymentId))} /><span className="break-words">{row.studentName}<small className="block text-[color:var(--text-muted)]">{formatDate(row.dueDate)} · {formatNumber(row.amount, { style: "currency", currency: "INR", maximumFractionDigits: 0 })}</small></span></label><Link className={appActionClassName("secondary")} href={getOverduePaymentHref(branchId, { paymentId: row.paymentId!, studentId: row.studentId, dueDate: row.dueDate })}>{t("Review")}</Link></li>)}{!rows.length && <li className="py-3 text-sm">{t.owned("No overdue payments returned")}</li>}</ul>}
        <div className="mt-3 flex flex-wrap gap-2">{rows.filter(row => selected.includes(row.paymentId!)).map(row => <Link key={row.paymentId} className={appActionClassName("secondary")} href={getOverduePaymentHref(branchId, { paymentId: row.paymentId!, studentId: row.studentId, dueDate: row.dueDate })}>{t("Review")} · {row.studentName}</Link>)}</div>
        <p className="mt-3 text-xs text-[color:var(--text-muted)]">{t.owned("The preview shows up to 5 recorded fees. Open the full queue for all overdue work.")}</p>
        <Link className={appActionClassName("quiet")} href={`/branch/${encodeURIComponent(branchId)}/overdue`}>{t.owned("Full queue")}</Link>
    </AppPanel>;
}
