"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Bell, BellOff, Check, Clock, RefreshCw } from "lucide-react";
import { AppButton, Dialog } from "@/components/ui";
import { useTranslation } from "@/components/settings/LocalizedText";
import { useUserPreferences } from "@/components/settings/UserPreferencesApplier";
import { useBranchAccess } from "@/hooks/useBranchAccess";
import { getBranchCapabilityDecision } from "@/lib/branchCapabilities";
import type { DashboardNotification } from "@/lib/dashboardContracts";
import { chromeIconButtonClass } from "@/components/ui/chromeSurface";
import { dashboardRequest, ResourceError, useDashboardResource } from "@/components/dashboard-features/shared";
import { notificationLabels } from "@/lib/dashboardLabels";

export function BranchNotifications() {
    const pathname = usePathname();
    const branchId = pathname?.match(/^\/branch\/([^/]+)/)?.[1];
    const { ownerKey } = useUserPreferences();
    return branchId ? <NotificationCenter key={`${ownerKey}:${branchId}`} branchId={branchId} /> : null;
}
function NotificationCenter({ branchId }: { branchId: string }) {
    const t = useTranslation(); const { formatDateTime } = useUserPreferences();
    const { access } = useBranchAccess(branchId);
    const resource = useDashboardResource<{ items: DashboardNotification[]; unreadCount: number }>(`/api/branches/${branchId}/dashboard/notifications`);
    const [open, setOpen] = useState(false); const [all, setAll] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
    const saving = useRef(false); const mutation = useRef<AbortController | null>(null);
    const reload = resource.reload;
    useEffect(() => {
        const refresh = () => { if (document.visibilityState === "visible" && !saving.current) void reload(); };
        const interval = window.setInterval(refresh, 60_000); window.addEventListener("focus", refresh);
        return () => { window.clearInterval(interval); window.removeEventListener("focus", refresh); mutation.current?.abort(); };
    }, [reload]);
    const writable = getBranchCapabilityDecision(access, "dashboard").allowed && access?.billingExperience?.accessMode !== "READ_ONLY"
        && (!access?.billingExperience?.branch?.billingStatus || access.billingExperience.branch.billingStatus === "ACTIVE");
    const update = useCallback(async (items: DashboardNotification[], action: "READ" | "SNOOZE" | "DISMISS") => {
        if (saving.current) return;
        saving.current = true; setBusy(true); setError(null);
        const controller = new AbortController(); mutation.current = controller;
        try {
            for (const item of items) await dashboardRequest(`/api/branches/${branchId}/dashboard/notifications`, "PATCH", { key: item.key, action,
                ...(action === "SNOOZE" ? { snoozeUntil: new Date(Date.now() + 86_400_000).toISOString() } : {}) }, controller.signal);
            if (!controller.signal.aborted) await reload();
        } catch (error) { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Something went wrong. Try again."); }
        finally { saving.current = false; if (!controller.signal.aborted) setBusy(false); }
    }, [branchId, reload]);
    const items = (resource.data?.items ?? []).filter(item => all || (!item.dismissed && (!item.snoozedUntil || Date.parse(item.snoozedUntil) <= Date.now())));
    return <>
        <button type="button" aria-label={t("Notifications")} aria-haspopup="dialog" aria-expanded={open} className={`${chromeIconButtonClass} relative reference-notification-bell`} onClick={() => setOpen(true)}>
            <Bell size={20} aria-hidden="true" />{Boolean(resource.data?.unreadCount) && <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#b82338] px-1 text-[10px] font-semibold text-white">{resource.data!.unreadCount}</span>}
        </button>
        <Dialog open={open} title={t("Notifications")} description={t("Current branch alerts")} onClose={() => setOpen(false)} className="max-w-xl">
            <div className="space-y-4"><ResourceError error={resource.error || error} retry={() => void reload()} />
                <div className="flex flex-wrap items-center gap-2"><AppButton variant="secondary" disabled={resource.loading || busy} onClick={() => void reload()}><RefreshCw size={14} />{t("Refresh")}</AppButton>
                    <AppButton variant="secondary" disabled={!writable || busy || !items.some(item => !item.read)} onClick={() => void update(items.filter(item => !item.read), "READ")}>{t("Mark all read")}</AppButton>
                    <label className="ml-auto flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={all} onChange={event => setAll(event.target.checked)} />{t("Show all alerts")}</label></div>
                {resource.loading && !resource.data && <p role="status">{t("Loading notifications")}</p>}
                {!resource.loading && !resource.error && !items.length && <p className="py-6 text-center text-sm">{t("No new alerts. Unresolved work remains available in its source worklist.")}</p>}
                {items.map(item => <article key={item.key} className="rounded-xl border border-[color:var(--ui-panel-border)] p-3">
                    <div className="flex items-start gap-3"><span className="mt-1 rounded-lg bg-emerald-50 p-2 text-emerald-800"><Bell size={17} /></span><div className="min-w-0 flex-1"><Link href={item.href} onClick={() => setOpen(false)} className="inline-flex min-h-11 items-center font-semibold underline">{t.owned(notificationLabels[item.kind])} · {item.count}</Link><p className="text-xs text-[color:var(--text-muted)]">{t("Open the source to review and resolve this work.")}</p>
                        {item.snoozedUntil && Date.parse(item.snoozedUntil) > Date.now() && <p className="mt-1 text-xs">{t("Snoozed until {date}", { date: formatDateTime(item.snoozedUntil) })}</p>}
                        {item.dismissed && <p className="mt-1 text-xs">{t("Dismissed")}</p>}
                    </div>{!item.read && <span className="mt-3 h-2 w-2 rounded-full bg-emerald-700" aria-label={t("Unread")} />}</div>
                    <div className="mt-2 flex flex-wrap gap-2"><AppButton variant="quiet" disabled={!writable || busy || item.read} onClick={() => void update([item], "READ")}><Check size={14} />{t("Mark read")}</AppButton><AppButton variant="quiet" disabled={!writable || busy} onClick={() => void update([item], "SNOOZE")}><Clock size={14} />{t("Snooze 24 hours")}</AppButton><AppButton variant="quiet" disabled={!writable || busy || item.dismissed} onClick={() => void update([item], "DISMISS")}><BellOff size={14} />{t("Dismiss")}</AppButton></div>
                </article>)}
                {!writable && <p className="text-xs">{t("Alert preferences cannot be changed while this branch is read-only.")}</p>}
            </div>
        </Dialog>
    </>;
}
