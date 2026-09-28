"use client";
import { CalendarClock, Pencil, UserRound } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { RowActionsMenu } from "@/components/ui/RowActionsMenu";
import { pageGridCardClass, pageGridCardHoverClass } from "@/components/ui/pageSurface";
import { useTranslation } from "@/components/settings/LocalizedText";
import { useUserPreferences } from "@/components/settings/UserPreferencesApplier";
import type { DashboardTask } from "@/lib/dashboardContracts";
import { cn } from "@/lib/utils";

export function TaskState({ task }: { task: DashboardTask }) {
    const t = useTranslation();
    return <Badge variant={task.status === "DONE" ? "success" : "warning"}>{t.owned(task.status === "DONE" ? "Completed" : "Open")}</Badge>;
}

/** Task-only values and callbacks; no reads, permissions or business rules shared with Students. */
export function TaskRecordCard({ task, canEdit, onEdit }: { task: DashboardTask; canEdit: boolean; onEdit: () => void }) {
    const t = useTranslation(); const { formatDateTime } = useUserPreferences();
    return <article data-task-record-card className={cn(pageGridCardClass, pageGridCardHoverClass, "ui-record-card")}>
        <div className="ui-record-card-identity">
            <Avatar name={task.title} size="sm" tone="quiet" />
            <div className="min-w-0 flex-1"><p className="ui-record-card-name">{canEdit ? <button type="button" className="ui-record-card-details" aria-label={`${t("Edit task")} · ${task.title}`} onClick={onEdit}>{task.title}</button> : task.title}</p></div>
            {canEdit && <div className="ui-record-card-actions"><RowActionsMenu actions={[{ label: "Edit task", icon: Pencil, onClick: onEdit }]} /></div>}
        </div>
        <div className="ui-record-card-context"><UserRound size={14} aria-hidden="true" /><span className="min-w-0 break-words">{t("Owner")}: {task.assigneeName || t("Unassigned")}</span></div>
        <div className="ui-record-card-summary">
            <div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0 flex-1"><p className="flex items-center gap-1 text-xs text-[color:var(--text-muted)]"><CalendarClock size={14} aria-hidden="true" />{t("Due date")}</p><p className="mt-1 break-words text-sm font-semibold">{task.dueAt ? formatDateTime(task.dueAt) : t("Not scheduled")}</p></div><TaskState task={task} /></div>
            <p className="ui-record-card-joined mt-2">{t("Updated")}: {formatDateTime(task.updatedAt)}</p>
        </div>
    </article>;
}
