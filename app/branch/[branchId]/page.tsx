"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bell, CalendarCheck, CheckCircle2, IndianRupee, LayoutGrid, Plus, RefreshCw, Users } from "lucide-react";
import { useTranslation } from "@/components/settings/LocalizedText";
import { useUserPreferences } from "@/components/settings/UserPreferencesApplier";
import { AppButton, AppPanel, PageLoadingSkeleton, PageShell } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { StatCard } from "@/components/dashboard/StatCard";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { OverdueTable } from "@/components/dashboard/OverdueTable";
import { DashboardSourceNote, DashboardSeating, UpcomingFees, DashboardShortcuts } from "@/components/dashboard/DashboardPanels";
import { DashboardCollections } from "@/components/dashboard/DashboardCollections";
import { CollectFeeDialog } from "@/components/payments/CollectFeeDialog";
import { useBranchAccess } from "@/hooks/useBranchAccess";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { getBranchCapabilityDecision } from "@/lib/branchCapabilities";
import { loadBranchDashboardSources, type BranchDashboardSources } from "@/lib/branchDashboard";
import { dashboardActivity, dashboardPriorities } from "@/lib/dashboardPresentation";

export default function BranchDashboardPage({ params }: { params: Promise<{ branchId: string }> }) {
    const { branchId } = use(params);
    const { user } = useUser();
    // Reset private values, queue selection and dialogs only when the security scope changes.
    return <DashboardWorkspace key={`${user?.id ?? "anonymous"}:${branchId}`} branchId={branchId} />;
}

function DashboardWorkspace({ branchId }: { branchId: string }) {
    const t = useTranslation();
    const router = useRouter();
    const toast = useToast();
    const { access, loading: accessLoading } = useBranchAccess(branchId);
    const { formatNumber, formatDateTime } = useUserPreferences();
    const compactLayout = useMediaQuery("(max-width: 1023px)");
    const [data, setData] = useState<BranchDashboardSources | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);
    const [completedRefreshKey, setCompletedRefreshKey] = useState(-1);
    const refreshing = refreshKey !== completedRefreshKey;
    const [error, setError] = useState(false);
    const [collect, setCollect] = useState<{ studentId: string; paymentId: string } | null>(null);
    const refresh = useCallback(() => { setError(false); setRefreshKey(key => key + 1); }, []);
    const money = (value: number) => formatNumber(value, { style: "currency", currency: "INR", maximumFractionDigits: 0 });
    const base = `/branch/${encodeURIComponent(branchId)}`;

    useEffect(() => {
        if (accessLoading || !access) return;
        let cancelled = false;
        loadBranchDashboardSources(branchId, {
            ...access.permissions,
            analytics: getBranchCapabilityDecision(access, "analyticsView").allowed,
        }).then(sources => {
            if (!cancelled) setData({ ...sources, updatedAt: new Date().toISOString() });
        }).catch(() => {
            if (!cancelled) setError(true);
        }).finally(() => {
            if (!cancelled) setCompletedRefreshKey(refreshKey);
        });
        return () => { cancelled = true; };
    }, [access, accessLoading, branchId, refreshKey]);

    // Re-read on returning from an operation or another tab. No polling.
    useEffect(() => {
        const onReturn = () => { if (document.visibilityState === "visible" && !collect) refresh(); };
        window.addEventListener("focus", onReturn);
        window.addEventListener("pageshow", onReturn);
        return () => {
            window.removeEventListener("focus", onReturn);
            window.removeEventListener("pageshow", onReturn);
        };
    }, [collect, refresh]);

    if (accessLoading || (!data && !error && access)) {
        return <PageShell data-dashboard-refinement="true"><PageLoadingSkeleton label={t("Loading branch dashboard")} variant="dashboard" rows={4} /></PageShell>;
    }
    if (!access) return <PageShell><p role="alert">{t("You do not have access to this branch.")}</p></PageShell>;
    if (!data) return <PageShell><DashboardSourceNote status="error" label={t("Dashboard")} onRetry={refresh} /></PageShell>;

    const priorities = dashboardPriorities(data);
    const snap = data.snapshot;
    const attendance = data.attendance;
    const addDecision = getBranchCapabilityDecision(access, "studentsManage");
    const activity = dashboardActivity(data);
    const failed = Object.values(data.resources).some(status => status === "error");
    const attentionUnknown = [data.resources.overdue, data.resources.upcoming].includes("error");
    const attentionRestricted = data.resources.overdue === "restricted";
    const unavailable = (status: string) => status === "restricted" ? t("Restricted") : t("Unavailable");
    const activityErrors = ["students", "allocations", "payments"] as const;
    const upcomingPanel = <UpcomingFees key="upcoming" data={data} branchId={branchId} onRetry={refresh} />;
    const followUpPanel = data.resources.overdue === "success"
        ? <OverdueTable key="followups" payments={data.overduePayments} branchId={branchId}
            recordDecision={getBranchCapabilityDecision(access, "paymentsRecord")} canViewStudents={access.permissions.students}
            followUps={data.followUps?.items} followUpsStatus={data.resources.followUps}
            onCollect={payment => setCollect({ studentId: payment.studentId, paymentId: payment.paymentId })} />
        : <AppPanel key="followups" title={t("Follow-ups")}><DashboardSourceNote status={data.resources.overdue} label={t("Recorded overdue fees")} onRetry={refresh} /></AppPanel>;
    const worklists = <div className="dashboard-worklists" key="worklists">
        {compactLayout ? [followUpPanel, upcomingPanel] : [upcomingPanel, followUpPanel]}
    </div>;
    const collections = <DashboardCollections key="collections" data={data} onRetry={refresh} />;
    const seating = <DashboardSeating key="seating" data={data} branchId={branchId} access={access} onRetry={refresh} />;
    const side = <div className="dashboard-side-column" key="side">
        {activity.length || !activityErrors.some(source => data.resources[source] === "error")
            ? <RecentActivity items={activity} branchId={branchId} />
            : <AppPanel title={t("Recent activity")}><p className="text-sm">{t("Recent activity could not be verified because one or more data sources failed.")}</p></AppPanel>}
        {activityErrors.filter(source => data.resources[source] === "error").map(source => <DashboardSourceNote key={source} status="error"
            label={t.owned(source === "payments" ? "Collection activity" : source === "students" ? "Student activity" : "Allocation activity")} onRetry={refresh} />)}
        <DashboardShortcuts branchId={branchId} access={access} />
    </div>;

    return (
        <PageShell data-dashboard-refinement="true" aria-busy={refreshing}>
            <header className="dashboard-heading">
                <div>
                    <p className="dashboard-eyebrow">{t("Branch overview")}</p>
                    <h1>{access.branchName}</h1>
                </div>
                <div className="dashboard-primary-actions">
                    <AppButton variant="quiet" size="sm" icon={RefreshCw} isLoading={refreshing} onClick={refresh}>{t("Refresh")}</AppButton>
                    {access.permissions.view_payments && <AppButton variant="secondary" size="sm" onClick={() => router.push(`${base}/payments`)}>{t("Review payments")}</AppButton>}
                    {access.permissions.students && <AppButton variant="primary" size="sm" icon={Plus} disabled={!addDecision.allowed}
                        title={addDecision.allowed ? undefined : t.owned(addDecision.reason ?? "")}
                        onClick={() => router.push(`${base}/students?action=add`)}>{t("Add student")}</AppButton>}
                </div>
            </header>
            <div className="dashboard-freshness" role="status">
                <span>{refreshing ? t("Refreshing dashboard…") : t("Updated {time}", { time: formatDateTime(data.updatedAt) })}</span>
                {(failed || error) && <span className="text-[color:var(--ui-tone-warning-text)]">{t("Some sources are unavailable. See the affected sections below.")}</span>}
                {error && <span>{t("Previously loaded values may be stale.")}</span>}
            </div>

            <section className="dashboard-action-center" aria-labelledby="action-center-title">
                <div className="dashboard-section-heading">
                    <div className="dashboard-section-title">
                        <Bell size={19} aria-hidden="true" />
                        <h2 id="action-center-title">{t("Action Center")}</h2>
                        {priorities.length > 0 && <span className="dashboard-priority-count" aria-label={t("{count} priority groups", { count: formatNumber(priorities.length) })}>{formatNumber(priorities.length)}</span>}
                        {priorities.length === 2 && <span className="dashboard-section-context">{t("Recorded overdue fees first, then fees due today.")}</span>}
                    </div>
                </div>
                <div className="dashboard-priorities">
                    {priorities.map(group => <article className="dashboard-priority" data-priority={group.kind} key={group.kind}>
                        <div className="dashboard-priority-icon" aria-hidden="true">{group.kind === "overdue" ? <IndianRupee size={20} /> : <CalendarCheck size={20} />}</div>
                        <div className="min-w-0 flex-1">
                            <p className="dashboard-priority-value">{group.kind === "overdue" ? money(group.amount!) : formatNumber(group.count)}</p>
                            <h3>{group.kind === "overdue" ? t("Overdue fees") : t("Fees due today")}</h3>
                            <p className="dashboard-priority-description">{group.kind === "overdue"
                                ? t("{count} fee periods", { count: formatNumber(group.count) })
                                : t("Includes expected fees · review first")}</p>
                        </div>
                        <Link href={`${base}${group.href}`} className="dashboard-text-link">{group.kind === "overdue" ? t("Review overdue") : t("Open fee queue")} <span aria-hidden="true">→</span></Link>
                    </article>)}
                    {priorities.length === 0 && <div className="dashboard-calm-state">
                        <CheckCircle2 size={20} aria-hidden="true" />
                        <div><p className="font-semibold">{attentionUnknown ? t("Priorities could not be confirmed") : attentionRestricted ? t("Your available workspace") : t("Nothing needs attention in these queues")}</p>
                            <p>{attentionUnknown ? t("Retry the unavailable sources to check current work.") : attentionRestricted ? t("Fee priorities are not included in your access.") : t("No recorded overdue fees or fees due today. Upcoming dates remain below.")}</p></div>
                    </div>}
                </div>
                {data.resources.overdue === "error" && <DashboardSourceNote status="error" label={t("Recorded overdue fees")} onRetry={refresh} />}
                {data.resources.upcoming === "error" && <DashboardSourceNote status="error" label={t("Fees due today")} onRetry={refresh} />}
            </section>

            <section className="dashboard-summary" aria-label={t("Current branch summary")}>
                <StatCard title={t("Collected this month")} value={snap ? money(snap.paidAmount) : unavailable(data.resources.analytics)}
                    sub="By collection date, including older fees" icon={IndianRupee} accent="emerald" />
                <StatCard title={t("Active students")} value={snap ? formatNumber(snap.activeStudents) : data.resources.students === "success" ? formatNumber(data.students.filter(row => row.status === "ACTIVE").length) : unavailable(data.resources.students)}
                    sub="Student profiles with active status" icon={Users} accent="cyan" />
                <StatCard title={t("Shift slot utilization")} value={snap ? formatNumber(snap.occupancyRate / 100, { style: "percent", maximumFractionDigits: 0 }) : unavailable(data.resources.analytics)}
                    sub={snap ? t("{used} of {total} shift slots", { used: formatNumber(snap.assignedSeats), total: formatNumber(snap.totalSeats) }) : ""}
                    icon={LayoutGrid} accent="violet" />
                <StatCard title={t("Present today")} value={attendance ? formatNumber(attendance.counts.attended) : unavailable(data.resources.attendance)}
                    sub="Students with a mark or recorded visit" icon={CalendarCheck} accent="neutral" />
            </section>

            <div className="dashboard-workspace-grid">
                {compactLayout ? [worklists, collections, seating, side] : [collections, seating, side, worklists]}
            </div>
            {collect && <CollectFeeDialog branchId={branchId} studentId={collect.studentId} paymentId={collect.paymentId}
                onClose={() => setCollect(null)} onSaved={() => {
                    refresh();
                    toast.show({ title: "Payment recorded. Updating dashboard…", tone: "success" });
                }} />}
        </PageShell>
    );
}
