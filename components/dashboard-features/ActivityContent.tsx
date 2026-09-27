"use client";
import { ActivityLink } from "@/components/dashboard/ActivityLink";
import { activityDetailLabels } from "@/lib/dashboardLabels";
import { AppButton, AppPanel } from "@/components/ui";
import { useTranslation } from "@/components/settings/LocalizedText";
import { useUserPreferences } from "@/components/settings/UserPreferencesApplier";
import type { DashboardOverview } from "@/lib/dashboardContracts";
import { FeaturePage, ResourceError, useDashboardResource } from "./shared";
export function ActivityContent({ branchId }: { branchId: string }) {
    const t = useTranslation(); const { formatDateTime, formatNumber } = useUserPreferences();
    const resource = useDashboardResource<DashboardOverview>(`/api/branches/${branchId}/dashboard`);
    const labels = { COLLECTION: "Payment received", STUDENT: "New student added", ATTENDANCE: "Attendance recorded", FOLLOW_UP: "Follow-up updated", TASK: "Task updated", ALLOCATION: "Allocation began", CONFIGURATION: "Settings updated" };
    return <FeaturePage title="Recent activity" description="Recent recorded events in your authorized branch sources. This is a bounded activity feed, not a complete audit log."
        action={<AppButton variant="secondary" disabled={resource.loading} onClick={() => void resource.reload()}>{t("Refresh")}</AppButton>}>
        <ResourceError error={resource.error} retry={() => void resource.reload()} />
        {resource.data?.activityStatus === "error" && <p role="alert">{t.owned("Recent activity could not be verified because one or more data sources failed.")}</p>}
        <AppPanel><ol className="divide-y divide-[color:var(--ui-panel-border)]">{resource.data?.activity.map(event => <li key={event.id} className="flex flex-wrap items-start justify-between gap-3 py-4"><div><ActivityLink href={event.href} className="font-semibold underline">{t.owned(labels[event.kind])}</ActivityLink><p className="mt-1 text-sm">{event.studentName ?? (event.detail && activityDetailLabels[event.detail] ? t.owned(activityDetailLabels[event.detail]) : event.detail ?? "")}{event.amount != null && ` · ${formatNumber(event.amount, { style: "currency", currency: "INR", maximumFractionDigits: 0 })}`}</p></div><time className="text-xs text-[color:var(--text-muted)]" dateTime={event.occurredAt}>{formatDateTime(event.occurredAt)}</time></li>)}</ol>
            {resource.loading && <p role="status">{t("Loading…")}</p>}{resource.data?.activityStatus === "success" && resource.data.activity.length === 0 && <p>{t("No recent activity")}</p>}</AppPanel>
    </FeaturePage>;
}
