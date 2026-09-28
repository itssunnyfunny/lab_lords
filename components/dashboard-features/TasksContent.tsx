"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, ClipboardList, History, Pencil, Plus, RefreshCw, Settings } from "lucide-react";
import { AppButton, AppPanel, AppSelect, Dialog, FormField } from "@/components/ui";
import { appActionClassName } from "@/components/ui/AppButton";
import { RecordListPage, RecordListSurface, RecordListState } from "@/components/ui/RecordList";
import { DataTable } from "@/components/tables/DataTable";
import { useTranslation } from "@/components/settings/LocalizedText";
import { useUserPreferences } from "@/components/settings/UserPreferencesApplier";
import { getBranchCapabilityDecision } from "@/lib/branchCapabilities";
import type { DashboardTask, DashboardNotification } from "@/lib/dashboardContracts";
import type { BranchAccess } from "@/types";
import { notificationLabels } from "@/lib/dashboardLabels";
import { dashboardRequest, inputClass, useDashboardResource } from "./shared";
import { TaskRecordCard, TaskState } from "./TaskRecordCard";
import { formErrorBannerClass } from "@/components/ui/formSurface";

type TaskPage = { items: DashboardTask[]; assignees: { id: string; name: string | null }[]; nextCursor: string | null };
type SourceResource = ReturnType<typeof useDashboardResource<{ items: DashboardNotification[] }>>;

/** Existing authorized source links; resolving a manual task never settles them. */
function SourceWork({ resource, excludeManual = false }: { resource: SourceResource; excludeManual?: boolean }) {
    const t = useTranslation();
    const items = resource.data?.items.filter(item => !excludeManual || item.kind !== "TASK");
    return <AppPanel density="compact" title={t("Source work")} description={t("Open the source to review fees, follow-ups, attendance and renewals.")} aria-busy={resource.loading || undefined}>
        {resource.loading ? <RecordListState kind="loading" title="Loading…" /> : resource.error ?
            <RecordListState kind="error" title="Something went wrong" description={t.error(resource.error)} onRetry={() => void resource.reload()} /> :
            items?.length === 0 ? <p className="text-sm text-[color:var(--text-muted)]">{t("No source work needs attention.")}</p> :
                <ul className="flex flex-wrap gap-2">{items?.map(item => <li key={item.key} className="min-w-0 max-w-full"><Link className={appActionClassName("secondary")} href={item.href}>
                    {t.owned(notificationLabels[item.kind])} <strong>{item.count}</strong><ArrowRight size={14} aria-hidden="true" />
                </Link></li>)}</ul>}
    </AppPanel>;
}

function ActivityAction({ branchId }: { branchId: string }) {
    const t = useTranslation();
    return <Link className={appActionClassName("secondary")} href={`/branch/${branchId}/tasks?view=activity`}><History size={14} aria-hidden="true" />{t("Recent activity")}</Link>;
}

export function SourceTasksContent({ branchId }: { branchId: string }) {
    const t = useTranslation();
    const source = useDashboardResource<{ items: DashboardNotification[] }>(`/api/branches/${branchId}/dashboard/notifications`);
    return <RecordListPage title={t("Tasks")} description={t("Open the source to review fees, follow-ups, attendance and renewals.")} actions={<ActivityAction branchId={branchId} />}>
        <SourceWork resource={source} />
    </RecordListPage>;
}

export function TasksContent({ branchId, access }: { branchId: string; access: BranchAccess }) {
    const t = useTranslation(); const { formatDateTime } = useUserPreferences();
    const [status, setStatus] = useState("OPEN"); const [search, setSearch] = useState(""); const [cursor, setCursor] = useState(""); const [editing, setEditing] = useState<DashboardTask | "new" | null>(null);
    const [restoreFocus, setRestoreFocus] = useState(false);
    const resource = useDashboardResource<TaskPage>(`/api/branches/${branchId}/dashboard/tasks?${new URLSearchParams({ status, search, ...(cursor ? { cursor } : {}) })}`);
    const sources = useDashboardResource<{ items: DashboardNotification[] }>(`/api/branches/${branchId}/dashboard/notifications`);
    const write = getBranchCapabilityDecision(access, "settingsManage");
    useEffect(() => {
        if (!restoreFocus || resource.loading) return;
        const frame = requestAnimationFrame(() => { document.getElementById("task-search")?.focus(); setRestoreFocus(false); });
        return () => cancelAnimationFrame(frame);
    }, [restoreFocus, resource.loading]);
    return <RecordListPage title={t("Tasks")} description={t("Keep branch work in one place. Source alerts stay open until the underlying work is resolved.")}
        actions={<><ActivityAction branchId={branchId} /><AppButton density="compact" variant="primary" icon={Plus} disabled={!write.allowed} onClick={() => setEditing("new")}>{t("Add task")}</AppButton></>}
        notices={!write.allowed && <p className="text-sm text-[color:var(--text-muted)]">{t.error(write.reason)}</p>}
        overlays={editing && <TaskEditor key={editing === "new" ? "new" : editing.id} branchId={branchId} task={editing === "new" ? null : editing} assignees={resource.data?.assignees ?? []} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); setRestoreFocus(true); void resource.reload(); void sources.reload(); }} />}>
        <SourceWork resource={sources} excludeManual />
        <RecordListSurface label={t("Manual tasks")} busy={resource.loading} toolbar={<>
            <FormField label={t("Search tasks")} id="task-search" className="min-w-0 flex-1"><input className={inputClass} type="search" maxLength={100} value={search} onChange={event => { setSearch(event.target.value); setCursor(""); }} /></FormField>
            <div className="min-w-36"><AppSelect label={t("Status")} value={status} onValueChange={value => { setStatus(value); setCursor(""); }} options={[{ value: "OPEN", label: t("Open") }, { value: "DONE", label: t("Completed") }, { value: "ALL", label: t("All") }]} /></div>
            <AppButton density="compact" variant="secondary" icon={RefreshCw} disabled={resource.loading} onClick={() => void resource.reload()}>{t("Refresh")}</AppButton>
        </>} footer={<div className="flex w-full flex-wrap items-center justify-between gap-2">
            <Link className={appActionClassName("quiet")} href={`/branch/${branchId}/dashboard-settings`}><Settings size={14} aria-hidden="true" />{t("Dashboard setup")}</Link>
            <div className="flex flex-wrap gap-2"><AppButton density="compact" variant="secondary" disabled={!cursor || resource.loading} onClick={() => setCursor("")}>{t("First page")}</AppButton><AppButton density="compact" variant="secondary" disabled={!resource.data?.nextCursor || resource.loading || !!resource.error} onClick={() => setCursor(resource.data?.nextCursor ?? "")}>{t("Next page")}</AppButton></div>
        </div>}>
            {resource.loading ? <RecordListState kind="loading" title="Loading…" /> : resource.error ? <RecordListState kind="error" title="Something went wrong" description={t.error(resource.error)} onRetry={() => void resource.reload()} /> : !resource.data?.items.length ?
                <RecordListState kind="empty" title="No tasks in this view." /> : <DataTable density="compact" caption="Manual tasks" data={resource.data.items}
                    columns={[
                        { header: "Task", accessor: task => <span className="break-words font-semibold">{task.title}</span>, rowHeader: true, className: "max-w-80" },
                        { header: "Due date", accessor: task => task.dueAt ? formatDateTime(task.dueAt) : t("Not scheduled") },
                        { header: "Owner", accessor: task => task.assigneeName || t("Unassigned") },
                        { header: "Status", accessor: task => <TaskState task={task} /> },
                    ]}
                    getRowAttributes={(task, view) => ({ id: `task-${view}-${task.id}` })}
                    actions={task => <AppButton density="compact" variant="secondary" icon={Pencil} disabled={!write.allowed} onClick={() => setEditing(task)} aria-label={`${t("Edit task")} · ${task.title}`}>{t("Edit task")}</AppButton>}
                    renderGridCard={task => <TaskRecordCard task={task} canEdit={write.allowed} onEdit={() => setEditing(task)} />}
                />}
        </RecordListSurface>
    </RecordListPage>;
}

function TaskEditor({ branchId, task, assignees, onClose, onSaved }: { branchId: string; task: DashboardTask | null; assignees: TaskPage["assignees"]; onClose: () => void; onSaved: () => void }) {
    const t = useTranslation(); const [title, setTitle] = useState(task?.title ?? ""); const [date, setDate] = useState(() => task?.dueAt ? new Date(Date.parse(task.dueAt) - new Date(task.dueAt).getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : ""); const [assigneeId, setAssignee] = useState(task?.assigneeId ?? ""); const [status, setStatus] = useState(task?.status ?? "OPEN"); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
    async function save() { if (busy) return; setBusy(true); setError(null); try { await dashboardRequest(`/api/branches/${branchId}/dashboard/tasks${task ? `/${task.id}` : ""}`, task ? "PATCH" : "POST", { title, dueAt: date ? new Date(date).toISOString() : null, assigneeId: assigneeId || null, ...(task ? { status } : {}) }); onSaved(); } catch (error) { setError(error instanceof Error ? error.message : "Something went wrong. Try again."); } finally { setBusy(false); } }
    return <Dialog density="compact" languagePlacement="header" overlayClassName="ui-record-edit-overlay" open title={t.owned(task ? "Edit task" : "Add task")} icon={<ClipboardList size={20} aria-hidden="true" />} onClose={onClose} closeDisabled={busy}
        footer={<><AppButton density="compact" variant="secondary" onClick={onClose} disabled={busy}>{t("Cancel")}</AppButton><AppButton density="compact" variant="primary" disabled={!title.trim()} onClick={() => void save()} isLoading={busy}>{t("Save task")}</AppButton></>}>
        <div className="space-y-4">
            {error && <div role="alert" className={`${formErrorBannerClass} p-3 text-sm`}>{t.error(error)}</div>}
            <FormField label={t("Task")} id="task-title"><input data-dialog-initial-focus className={inputClass} maxLength={160} value={title} disabled={busy} onChange={event => setTitle(event.target.value)} /></FormField>
            <FormField label={t("Due date and time (device timezone)")} id="task-due"><input className={inputClass} type="datetime-local" value={date} disabled={busy} onChange={event => setDate(event.target.value)} /></FormField>
            <AppSelect label={t("Owner")} value={assigneeId} disabled={busy} onValueChange={setAssignee} options={[{ value: "", label: t("Unassigned") }, ...assignees.map(person => ({ value: person.id, label: person.name || t("Team member") }))]} />
            {task && <AppSelect label={t("Status")} value={status} disabled={busy} onValueChange={value => setStatus(value as "OPEN" | "DONE")} options={[{ value: "OPEN", label: t("Open") }, { value: "DONE", label: t("Completed") }]} />}
        </div>
    </Dialog>;
}
