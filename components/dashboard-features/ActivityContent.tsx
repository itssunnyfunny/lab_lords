"use client";
import Link from "next/link";
import { ClipboardList, History, RefreshCw } from "lucide-react";
import { ActivityLink } from "@/components/dashboard/ActivityLink";
import { activityDetailLabels } from "@/lib/dashboardLabels";
import { AppButton } from "@/components/ui";
import { appActionClassName } from "@/components/ui/AppButton";
import { RecordListPage, RecordListSurface, RecordListState } from "@/components/ui/RecordList";
import { useTranslation } from "@/components/settings/LocalizedText";
import { useUserPreferences } from "@/components/settings/UserPreferencesApplier";
import type { DashboardOverview } from "@/lib/dashboardContracts";
import { useDashboardResource } from "./shared";

export function ActivityContent({ branchId }: { branchId: string }) {
    const t = useTranslation(); const { formatDateTime, formatNumber } = useUserPreferences();
    const resource = useDashboardResource<DashboardOverview>(`/api/branches/${branchId}/dashboard`);
    const labels = { COLLECTION: "Payment received", STUDENT: "New student added", ATTENDANCE: "Attendance recorded", FOLLOW_UP: "Follow-up updated", TASK: "Task updated", ALLOCATION: "Allocation began", CONFIGURATION: "Settings updated" };
    return <RecordListPage title={t("Recent activity")} description={t("Recent recorded events in your authorized branch sources. This is a bounded activity feed, not a complete audit log.")}
        actions={<Link className={appActionClassName("secondary")} href={`/branch/${branchId}/tasks`}><ClipboardList size={14} aria-hidden="true" />{t("Tasks")}</Link>}>
        <RecordListSurface label={t("Recent activity")} busy={resource.loading} toolbar={<><span className="inline-flex items-center gap-2 text-sm font-semibold"><History size={16} aria-hidden="true" />{t("Recent activity")}</span><AppButton density="compact" variant="secondary" icon={RefreshCw} disabled={resource.loading} onClick={() => void resource.reload()}>{t("Refresh")}</AppButton></>}>
            {resource.loading ? <RecordListState kind="loading" title="Loading…" /> : resource.error ? <RecordListState kind="error" title="Something went wrong" description={t.error(resource.error)} onRetry={() => void resource.reload()} /> : <>
                {resource.data?.activityStatus === "error" && <p role="alert" className="p-4 text-sm text-[color:var(--ui-tone-danger-text)]">{t.owned("Recent activity could not be verified because one or more data sources failed.")}</p>}
                <ol className="divide-y divide-[color:var(--ui-panel-border)]">{resource.data?.activity.map(event => <li key={event.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3"><div className="min-w-0 flex-1"><ActivityLink href={event.href} className="inline-flex min-h-11 items-center break-words text-sm font-semibold underline">{t.owned(labels[event.kind])}</ActivityLink><p className="break-words text-sm text-[color:var(--text-secondary)]">{event.studentName ?? (event.detail && activityDetailLabels[event.detail] ? t.owned(activityDetailLabels[event.detail]) : event.detail ?? "")}{event.amount != null && ` · ${formatNumber(event.amount, { style: "currency", currency: "INR", maximumFractionDigits: 0 })}`}</p></div><time className="pt-3 text-xs text-[color:var(--text-muted)]" dateTime={event.occurredAt}>{formatDateTime(event.occurredAt)}</time></li>)}</ol>
                {resource.data?.activityStatus === "success" && resource.data.activity.length === 0 && <RecordListState kind="empty" title="No recent activity" />}
            </>}
        </RecordListSurface>
    </RecordListPage>;
}
