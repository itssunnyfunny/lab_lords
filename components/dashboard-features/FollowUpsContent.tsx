"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { AppButton, AppPanel, AppSelect, Dialog } from "@/components/ui";
import { appActionClassName } from "@/components/ui/AppButton";
import { RecordListPage, RecordListSurface, RecordListState } from "@/components/ui/RecordList";
import { pageGridCardClass, pageGridCardHoverClass } from "@/components/ui/pageSurface";
import { DataTable } from "@/components/tables/DataTable";
import { useTranslation } from "@/components/settings/LocalizedText";
import { useUserPreferences } from "@/components/settings/UserPreferencesApplier";
import { getBranchCapabilityDecision } from "@/lib/branchCapabilities";
import { followUpOutcomes, type FollowUpOutcome } from "@/lib/renewals";
import type { DashboardFollowUp } from "@/lib/dashboardContracts";
import type { BranchAccess } from "@/types";
import { dashboardRequest, inputClass, ResourceError, useDashboardResource } from "./shared";
type FollowUpPage = { items: DashboardFollowUp[]; counts: { pending: number; dueToday: number; completed: number }; nextCursor: string | null };

export function FollowUpsContent({ branchId, access }: { branchId: string; access: BranchAccess }) {
    const t = useTranslation(); const { formatDate } = useUserPreferences(); const query = useSearchParams();
    const [filter, setFilter] = useState(query.get("filter") === "DUE" ? "DUE" : "ALL");
    const [search, setSearch] = useState(query.get("search")?.slice(0, 100) ?? ""); const [cursor, setCursor] = useState("");
    const [editing, setEditing] = useState<DashboardFollowUp | null>(null);
    const resource = useDashboardResource<FollowUpPage>(`/api/branches/${branchId}/dashboard/follow-ups?${new URLSearchParams({ filter, search, ...(cursor ? { cursor } : {}) })}`);
    const write = getBranchCapabilityDecision(access, "paymentsRecord");
    const actions = (row: DashboardFollowUp) => <div className="flex flex-wrap justify-end gap-2">
        <AppButton density="compact" variant="secondary" disabled={!write.allowed} onClick={() => setEditing(row)}>{t("Update follow-up")}</AppButton>
        {row.phone && <a href={`tel:${row.phone.replace(/[^+\d]/g, "")}`} className={appActionClassName("quiet")}>{t("Call")}</a>}
    </div>;
    return <RecordListPage title={t("Follow-ups")} description={t("Plan your next conversation and record its outcome. Completing a follow-up does not settle a fee.")}
        actions={<Link className={appActionClassName("secondary")} href={`/branch/${branchId}/renewals`}>{t("Renewals & dues")}</Link>}
        notices={!write.allowed && <p className="text-sm text-[color:var(--text-muted)]">{t.error(write.reason)}</p>}
        overlays={editing && <FollowUpEditor key={editing.id} branchId={branchId} row={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void resource.reload(); }} />}>
        <div className="grid gap-3 sm:grid-cols-3">{([ ["Follow-ups pending", resource.data?.counts.pending], ["Due today", resource.data?.counts.dueToday], ["Completed", resource.data?.counts.completed] ] as const).map(([label, count]) => <AppPanel key={label} density="compact" title={t.owned(label)}><strong className="text-2xl tabular-nums">{count ?? "—"}</strong></AppPanel>)}</div>
        <RecordListSurface label={t("Follow-ups")} busy={resource.loading} toolbar={<>
            <label className="min-w-0 flex-1 text-sm">{t("Search by name or phone")}<input className={inputClass} type="search" maxLength={100} value={search} onChange={event => { setSearch(event.target.value); setCursor(""); }} /></label>
            <div className="min-w-40"><AppSelect label={t("Status")} value={filter} onValueChange={value => { setFilter(value); setCursor(""); }} options={[{ value: "ALL", label: t("Follow-ups pending") }, { value: "DUE", label: t("Due today") }, { value: "COMPLETED", label: t("Completed") }]} /></div>
            <AppButton density="compact" variant="secondary" onClick={() => void resource.reload()} disabled={resource.loading}>{t("Refresh")}</AppButton>
        </>} footer={<div className="flex flex-wrap justify-end gap-2"><AppButton density="compact" variant="secondary" disabled={!cursor || resource.loading} onClick={() => setCursor("")}>{t("First page")}</AppButton><AppButton density="compact" variant="secondary" disabled={!resource.data?.nextCursor || resource.loading || !!resource.error} onClick={() => setCursor(resource.data?.nextCursor ?? "")}>{t("Next page")}</AppButton></div>}>
            {resource.loading ? <RecordListState kind="loading" title="Loading…" /> : resource.error ? <RecordListState kind="error" title="Something went wrong" description={t.error(resource.error)} onRetry={() => void resource.reload()} /> : !resource.data?.items.length ?
                <RecordListState kind="empty" title="No follow-ups in this view. Schedule one from Renewals & dues." /> :
                <DataTable density="compact" caption="Follow-ups" data={resource.data.items} columns={[
                    { header: "Student name", accessor: row => <><span className="font-semibold break-words">{row.studentName}</span><span className="block text-xs text-[color:var(--text-muted)]">{t("Fee date")}: {formatDate(row.periodStart)}</span></>, rowHeader: true },
                    { header: "Contact outcome", accessor: row => <>{t.owned(followUpOutcomes[row.outcome as FollowUpOutcome] ?? row.outcome)}{row.completedAt && <span className="block text-xs">{t("Completed")}</span>}</> },
                    { header: "Next follow-up date", accessor: row => row.nextFollowUpAt ? formatDate(row.nextFollowUpAt) : t("Not scheduled") },
                    { header: "Follow-up note", accessor: row => <span className="whitespace-pre-wrap break-words">{row.note || "—"}</span>, className: "max-w-64" },
                ]} actions={actions} renderGridCard={row => <article className={`${pageGridCardClass} ${pageGridCardHoverClass} ui-record-card`}>
                    <div className="ui-record-card-identity"><div className="min-w-0 flex-1"><p className="ui-record-card-name">{row.studentName}</p><p className="ui-record-card-meta">{t("Fee date")}: {formatDate(row.periodStart)}</p></div>{row.completedAt && <span className="text-xs">{t("Completed")}</span>}</div>
                    <div className="ui-record-card-context">{t("Next follow-up date")}: {row.nextFollowUpAt ? formatDate(row.nextFollowUpAt) : t("Not scheduled")}</div>
                    <div className="ui-record-card-summary"><p className="font-semibold">{t.owned(followUpOutcomes[row.outcome as FollowUpOutcome] ?? row.outcome)}</p><p className="mt-1 whitespace-pre-wrap break-words">{row.note || "—"}</p><div className="mt-3">{actions(row)}</div></div>
                </article>} />}
        </RecordListSurface>
    </RecordListPage>;
}
function FollowUpEditor({ branchId, row, onClose, onSaved }: { branchId: string; row: DashboardFollowUp; onClose: () => void; onSaved: () => void }) {
    const t = useTranslation(); const [note, setNote] = useState(row.note); const [outcome, setOutcome] = useState(row.outcome);
    const [date, setDate] = useState(row.nextFollowUpAt?.slice(0, 10) ?? ""); const [completed, setCompleted] = useState(Boolean(row.completedAt));
    const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
    async function save() { if (busy) return; setBusy(true); setError(null); try { await dashboardRequest(`/api/branches/${branchId}/dashboard/follow-ups/${row.id}`, "PATCH", { note, outcome, nextFollowUpAt: date || null, completed }); onSaved(); } catch (error) { setError(error instanceof Error ? error.message : "Something went wrong. Try again."); } finally { setBusy(false); } }
    return <Dialog density="compact" languagePlacement="header" overlayClassName="ui-record-edit-overlay" open title={t("Follow-up · {name}", { name: row.studentName })} onClose={onClose} closeDisabled={busy} footer={<><AppButton density="compact" variant="secondary" onClick={onClose} disabled={busy}>{t("Cancel")}</AppButton><AppButton density="compact" variant="primary" onClick={() => void save()} isLoading={busy}>{t("Save follow-up")}</AppButton></>}><div className="space-y-4">
        <ResourceError error={error} /><AppSelect label={t("Contact outcome")} value={outcome} onValueChange={setOutcome} disabled={busy} options={Object.entries(followUpOutcomes).map(([value, label]) => ({ value, label: t.owned(label) }))} />
        <label className="block text-sm">{t("Next follow-up date")}<input className={inputClass} type="date" value={date} disabled={busy} onChange={event => setDate(event.target.value)} /></label>
        <label className="block text-sm">{t("Follow-up note")}<textarea className={inputClass} maxLength={2000} rows={4} value={note} disabled={busy} onChange={event => setNote(event.target.value)} /></label>
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={completed} disabled={busy} onChange={event => setCompleted(event.target.checked)} />{t("Follow-up completed")}</label>
        <p className="text-xs text-[color:var(--text-muted)]">{t("Completing this follow-up records your contact work only. Payments and delivery status are unchanged.")}</p>
    </div></Dialog>;
}
