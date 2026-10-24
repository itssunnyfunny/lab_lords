"use client";
import { useState } from "react";
import { AppPanel } from "@/components/ui";
import { RecordListState } from "@/components/ui/RecordList";
import { appActionClassName } from "@/components/ui/AppButton";
import { useTranslation } from "@/components/settings/LocalizedText";
import { SetupPager } from "./setupPaging";
import { useDashboardResource } from "./shared";

type GapPage = { items: { id: string; name: string; expectedBy: string }[]; total: number; nextCursor: string | null; today: string; timezone: string };

export function AttendanceGaps({ branchId }: { branchId: string }) {
    const t = useTranslation();
    const [cursors, setCursors] = useState<string[]>([]);
    const query = new URLSearchParams({ limit: "50", ...(cursors.length ? { cursor: cursors.at(-1)! } : {}) });
    const resource = useDashboardResource<GapPage>(`/api/branches/${encodeURIComponent(branchId)}/dashboard/attendance-gaps?${query}`);
    return <AppPanel density="compact" title={t("Expected students without attendance")} description={t("Configure only agreed attendance days. A gap appears after the expected time in the branch timezone, without marking anyone absent.")}>
        {resource.loading ? <RecordListState kind="loading" title="Loading…" /> : resource.error ? <RecordListState kind="error" title="Something went wrong" description={t.error(resource.error)} onRetry={() => void resource.reload()} /> : <div className="space-y-3">
            {resource.data && <p className="text-xs text-[color:var(--text-muted)]">{resource.data.today} · {resource.data.timezone}</p>}
            {resource.data?.items.map(student => <div key={student.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--ui-panel-border)] py-3"><span className="break-words text-sm font-semibold">{student.name}</span><span className="text-sm">{t("Expected by")}: {student.expectedBy}</span><a className={appActionClassName("quiet")} href={`/branch/${encodeURIComponent(branchId)}/attendance?studentId=${encodeURIComponent(student.id)}`}>{t("Attendance")}</a></div>)}
            {!resource.data?.items.length && <p className="text-sm">{t("No attendance gaps are currently recorded.")}</p>}
        </div>}
        <SetupPager label={t("Attendance gaps")} count={resource.data?.items.length ?? 0} total={resource.data?.total ?? null} page={{ index: cursors.length, loading: resource.loading, hasNext: !resource.error && Boolean(resource.data?.nextCursor), previous: () => setCursors(current => current.slice(0, -1)), next: () => { const next = resource.data?.nextCursor; if (next && !resource.loading && !resource.error) setCursors(current => [...current, next]); } }} />
    </AppPanel>;
}
