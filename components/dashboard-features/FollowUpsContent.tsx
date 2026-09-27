"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { AppButton, AppPanel, AppSelect, Dialog } from "@/components/ui";
import { useTranslation } from "@/components/settings/LocalizedText";
import { useUserPreferences } from "@/components/settings/UserPreferencesApplier";
import { getBranchCapabilityDecision } from "@/lib/branchCapabilities";
import { followUpOutcomes, type FollowUpOutcome } from "@/lib/renewals";
import type { DashboardFollowUp } from "@/lib/dashboardContracts";
import type { BranchAccess } from "@/types";
import { dashboardRequest, FeaturePage, inputClass, ResourceError, tableClass, useDashboardResource } from "./shared";
type FollowUpPage = { items: DashboardFollowUp[]; counts: { pending: number; dueToday: number; completed: number }; nextCursor: string | null };

export function FollowUpsContent({ branchId, access }: { branchId: string; access: BranchAccess }) {
    const t = useTranslation(); const { formatDate } = useUserPreferences(); const query = useSearchParams();
    const [filter, setFilter] = useState(query.get("filter") === "DUE" ? "DUE" : "ALL");
    const [search, setSearch] = useState(query.get("search")?.slice(0, 100) ?? ""); const [cursor, setCursor] = useState("");
    const [editing, setEditing] = useState<DashboardFollowUp | null>(null);
    const resource = useDashboardResource<FollowUpPage>(`/api/branches/${branchId}/dashboard/follow-ups?${new URLSearchParams({ filter, search, ...(cursor ? { cursor } : {}) })}`);
    const write = getBranchCapabilityDecision(access, "paymentsRecord");
    return <FeaturePage title="Follow-ups" description="Plan your next conversation and record its outcome. Completing a follow-up does not settle a fee."
        action={<Link className="text-sm underline" href={`/branch/${branchId}/renewals`}>{t("Renewals & dues")}</Link>}>
        <div className="grid gap-3 sm:grid-cols-3">{([ ["Follow-ups pending", resource.data?.counts.pending], ["Due today", resource.data?.counts.dueToday], ["Completed", resource.data?.counts.completed] ] as const).map(([label, count]) => <AppPanel key={label} title={t.owned(label)}><strong className="text-2xl">{count ?? "—"}</strong></AppPanel>)}</div>
        <div className="flex flex-wrap items-end gap-3"><label className="min-w-48 flex-1 text-sm">{t("Search by name or phone")}<input className={inputClass} type="search" maxLength={100} value={search} onChange={event => { setSearch(event.target.value); setCursor(""); }} /></label>
            <AppSelect label={t("Status")} value={filter} onValueChange={value => { setFilter(value); setCursor(""); }} options={[{ value: "ALL", label: t("Follow-ups pending") }, { value: "DUE", label: t("Due today") }, { value: "COMPLETED", label: t("Completed") }]} />
            <AppButton variant="secondary" onClick={() => void resource.reload()} disabled={resource.loading}>{t("Refresh")}</AppButton></div>
        <ResourceError error={resource.error} retry={() => void resource.reload()} />
        {!write.allowed && <p className="text-sm">{t.error(write.reason)}</p>}
        <AppPanel contentClassName="overflow-x-auto p-0"><table className={tableClass}><thead><tr>{["Student name", "Contact outcome", "Next follow-up date", "Follow-up note", "Action"].map(label => <th key={label}>{t.owned(label)}</th>)}</tr></thead>
            <tbody>{resource.data?.items.map(row => <tr key={row.id}><td><span className="font-semibold">{row.studentName}</span><span className="block text-xs text-[color:var(--text-muted)]">{t("Fee date")}: {formatDate(row.periodStart)}</span></td>
                <td>{t.owned(followUpOutcomes[row.outcome as FollowUpOutcome] ?? row.outcome)}{row.completedAt && <span className="block text-xs">{t("Completed")}</span>}</td><td>{row.nextFollowUpAt ? formatDate(row.nextFollowUpAt) : t("Not scheduled")}</td><td className="max-w-64 whitespace-pre-wrap break-words">{row.note || "—"}</td>
                <td><div className="flex gap-2"><AppButton variant="secondary" disabled={!write.allowed} onClick={() => setEditing(row)}>{t("Update follow-up")}</AppButton>{row.phone && <a href={`tel:${row.phone.replace(/[^+\d]/g, "")}`} className="inline-flex min-h-11 items-center px-2 text-sm underline">{t("Call")}</a>}</div></td></tr>)}</tbody></table>
            {!resource.loading && !resource.error && !resource.data?.items.length && <p className="p-6 text-sm">{t("No follow-ups in this view. Schedule one from Renewals & dues.")}</p>}
            {resource.loading && <p role="status" className="p-6">{t("Loading…")}</p>}</AppPanel>
        <div className="flex gap-2"><AppButton variant="secondary" disabled={!cursor} onClick={() => setCursor("")}>{t("First page")}</AppButton><AppButton variant="secondary" disabled={!resource.data?.nextCursor} onClick={() => setCursor(resource.data?.nextCursor ?? "")}>{t("Next page")}</AppButton></div>
        {editing && <FollowUpEditor branchId={branchId} row={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void resource.reload(); }} />}
    </FeaturePage>;
}
function FollowUpEditor({ branchId, row, onClose, onSaved }: { branchId: string; row: DashboardFollowUp; onClose: () => void; onSaved: () => void }) {
    const t = useTranslation(); const [note, setNote] = useState(row.note); const [outcome, setOutcome] = useState(row.outcome);
    const [date, setDate] = useState(row.nextFollowUpAt?.slice(0, 10) ?? ""); const [completed, setCompleted] = useState(Boolean(row.completedAt));
    const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
    async function save() { if (busy) return; setBusy(true); setError(null); try { await dashboardRequest(`/api/branches/${branchId}/dashboard/follow-ups/${row.id}`, "PATCH", { note, outcome, nextFollowUpAt: date || null, completed }); onSaved(); } catch (error) { setError(error instanceof Error ? error.message : "Something went wrong. Try again."); } finally { setBusy(false); } }
    return <Dialog open title={t("Follow-up · {name}", { name: row.studentName })} onClose={onClose} closeDisabled={busy} footer={<><AppButton variant="secondary" onClick={onClose} disabled={busy}>{t("Cancel")}</AppButton><AppButton onClick={() => void save()} isLoading={busy}>{t("Save follow-up")}</AppButton></>}><div className="space-y-4">
        <ResourceError error={error} /><AppSelect label={t("Contact outcome")} value={outcome} onValueChange={setOutcome} disabled={busy} options={Object.entries(followUpOutcomes).map(([value, label]) => ({ value, label: t.owned(label) }))} />
        <label className="block text-sm">{t("Next follow-up date")}<input className={inputClass} type="date" value={date} disabled={busy} onChange={event => setDate(event.target.value)} /></label>
        <label className="block text-sm">{t("Follow-up note")}<textarea className={inputClass} maxLength={2000} rows={4} value={note} disabled={busy} onChange={event => setNote(event.target.value)} /></label>
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={completed} disabled={busy} onChange={event => setCompleted(event.target.checked)} />{t("Follow-up completed")}</label>
        <p className="text-xs text-[color:var(--text-muted)]">{t("Completing this follow-up records your contact work only. Payments and delivery status are unchanged.")}</p>
    </div></Dialog>;
}
