"use client";
import Link from "next/link";
import { useState } from "react";
import { AppButton, AppPanel, AppSelect, Dialog } from "@/components/ui";
import { useTranslation } from "@/components/settings/LocalizedText";
import { useUserPreferences } from "@/components/settings/UserPreferencesApplier";
import { getBranchCapabilityDecision } from "@/lib/branchCapabilities";
import type { DashboardTask, DashboardNotification } from "@/lib/dashboardContracts";
import type { BranchAccess } from "@/types";
import { dashboardRequest, FeaturePage, inputClass, ResourceError, tableClass, useDashboardResource } from "./shared";
type TaskPage = { items: DashboardTask[]; assignees: { id: string; name: string | null }[]; nextCursor: string | null };
import { notificationLabels } from "@/lib/dashboardLabels";
export function SourceTasksContent({ branchId }: { branchId: string }) {
    const t = useTranslation(); const source = useDashboardResource<{ items: DashboardNotification[] }>(`/api/branches/${branchId}/dashboard/notifications`);
    return <FeaturePage title="Tasks" description="Open the source to review fees, follow-ups, attendance and renewals."><ResourceError error={source.error} retry={() => void source.reload()} /><AppPanel title={t("Source work")}><ul className="space-y-2">{source.data?.items.map(item => <li key={item.key}><Link className="inline-flex min-h-11 items-center gap-3 text-sm underline" href={item.href}>{t.owned(notificationLabels[item.kind])} · {item.count} →</Link></li>)}</ul>{source.data?.items.length === 0 && <p>{t("No source work needs attention.")}</p>}{source.loading && <p role="status">{t("Loading…")}</p>}</AppPanel></FeaturePage>;
}
export function TasksContent({ branchId, access }: { branchId: string; access: BranchAccess }) {
    const t = useTranslation(); const { formatDateTime } = useUserPreferences();
    const [status, setStatus] = useState("OPEN"); const [search, setSearch] = useState(""); const [cursor, setCursor] = useState(""); const [editing, setEditing] = useState<DashboardTask | "new" | null>(null);
    const resource = useDashboardResource<TaskPage>(`/api/branches/${branchId}/dashboard/tasks?${new URLSearchParams({ status, search, ...(cursor ? { cursor } : {}) })}`);
    const sources = useDashboardResource<{ items: DashboardNotification[] }>(`/api/branches/${branchId}/dashboard/notifications`);
    const write = getBranchCapabilityDecision(access, "settingsManage");
    return <FeaturePage title="Tasks" description="Keep branch work in one place. Source alerts stay open until the underlying work is resolved."
        action={<AppButton disabled={!write.allowed} onClick={() => setEditing("new")}>{t("Add task")}</AppButton>}>
        <AppPanel title={t("Source work")} description={t("Open the source to review fees, follow-ups, attendance and renewals.")}><ResourceError error={sources.error} retry={() => void sources.reload()} /><div className="flex flex-wrap gap-3">{sources.data?.items.filter(item => item.kind !== "TASK").map(item => <Link key={item.key} className="rounded-lg border border-[color:var(--ui-panel-border)] px-4 py-3 text-sm hover:bg-[color:var(--ui-form-surface-hover-bg)]" href={item.href}>{t.owned(notificationLabels[item.kind])} <strong>{item.count}</strong> →</Link>)}</div>{sources.data?.items.filter(item => item.kind !== "TASK").length === 0 && <p className="text-sm">{t("No source work needs attention.")}</p>}</AppPanel>
        <div className="flex flex-wrap items-end gap-3"><label className="min-w-48 flex-1 text-sm">{t("Search tasks")}<input className={inputClass} type="search" maxLength={100} value={search} onChange={event => { setSearch(event.target.value); setCursor(""); }} /></label><AppSelect label={t("Status")} value={status} onValueChange={value => { setStatus(value); setCursor(""); }} options={[{ value: "OPEN", label: t("Open") }, { value: "DONE", label: t("Completed") }, { value: "ALL", label: t("All") }]} /><AppButton variant="secondary" disabled={resource.loading} onClick={() => void resource.reload()}>{t("Refresh")}</AppButton></div>
        <ResourceError error={resource.error} retry={() => void resource.reload()} />{!write.allowed && <p className="text-sm">{t.error(write.reason)}</p>}
        <AppPanel title={t("Manual tasks")} contentClassName="overflow-x-auto p-0"><table className={tableClass}><thead><tr>{["Task", "Due date", "Owner", "Status", "Action"].map(label => <th key={label}>{t.owned(label)}</th>)}</tr></thead><tbody>{resource.data?.items.map(task => <tr key={task.id}><td className="max-w-80 break-words font-medium">{task.title}</td><td>{task.dueAt ? formatDateTime(task.dueAt) : t("Not scheduled")}</td><td>{task.assigneeName || t("Unassigned")}</td><td>{t.owned(task.status === "DONE" ? "Completed" : "Open")}</td><td><AppButton variant="secondary" disabled={!write.allowed} onClick={() => setEditing(task)}>{t("Edit task")}</AppButton></td></tr>)}</tbody></table>{resource.loading ? <p role="status" className="p-6">{t("Loading…")}</p> : !resource.error && !resource.data?.items.length && <p className="p-6 text-sm">{t("No tasks in this view.")}</p>}</AppPanel>
        <div className="flex gap-2"><AppButton variant="secondary" disabled={!cursor} onClick={() => setCursor("")}>{t("First page")}</AppButton><AppButton variant="secondary" disabled={!resource.data?.nextCursor} onClick={() => setCursor(resource.data?.nextCursor ?? "")}>{t("Next page")}</AppButton></div>
        <Link className="inline-flex min-h-11 items-center text-sm underline" href={`/branch/${branchId}/dashboard-settings`}>{t("Dashboard setup")}</Link>
        {editing && <TaskEditor key={editing === "new" ? "new" : editing.id} branchId={branchId} task={editing === "new" ? null : editing} assignees={resource.data?.assignees ?? []} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void resource.reload(); void sources.reload(); }} />}
    </FeaturePage>;
}
function TaskEditor({ branchId, task, assignees, onClose, onSaved }: { branchId: string; task: DashboardTask | null; assignees: TaskPage["assignees"]; onClose: () => void; onSaved: () => void }) {
    const t = useTranslation(); const [title, setTitle] = useState(task?.title ?? ""); const [date, setDate] = useState(() => task?.dueAt ? new Date(Date.parse(task.dueAt) - new Date(task.dueAt).getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : ""); const [assigneeId, setAssignee] = useState(task?.assigneeId ?? ""); const [status, setStatus] = useState(task?.status ?? "OPEN"); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
    async function save() { if (busy) return; setBusy(true); setError(null); try { await dashboardRequest(`/api/branches/${branchId}/dashboard/tasks${task ? `/${task.id}` : ""}`, task ? "PATCH" : "POST", { title, dueAt: date ? new Date(date).toISOString() : null, assigneeId: assigneeId || null, ...(task ? { status } : {}) }); onSaved(); } catch (error) { setError(error instanceof Error ? error.message : "Something went wrong. Try again."); } finally { setBusy(false); } }
    return <Dialog open title={t.owned(task ? "Edit task" : "Add task")} onClose={onClose} closeDisabled={busy} footer={<><AppButton variant="secondary" onClick={onClose} disabled={busy}>{t("Cancel")}</AppButton><AppButton disabled={!title.trim()} onClick={() => void save()} isLoading={busy}>{t("Save task")}</AppButton></>}><div className="space-y-4"><ResourceError error={error} />
        <label className="block text-sm">{t("Task")}<input autoFocus className={inputClass} maxLength={160} value={title} disabled={busy} onChange={event => setTitle(event.target.value)} /></label>
        <label className="block text-sm">{t("Due date and time (device timezone)")}<input className={inputClass} type="datetime-local" value={date} disabled={busy} onChange={event => setDate(event.target.value)} /></label>
        <AppSelect label={t("Owner")} value={assigneeId} disabled={busy} onValueChange={setAssignee} options={[{ value: "", label: t("Unassigned") }, ...assignees.map(person => ({ value: person.id, label: person.name || t("Team member") }))]} />
        {task && <AppSelect label={t("Status")} value={status} disabled={busy} onValueChange={value => setStatus(value as "OPEN" | "DONE")} options={[{ value: "OPEN", label: t("Open") }, { value: "DONE", label: t("Completed") }]} />}
    </div></Dialog>;
}
