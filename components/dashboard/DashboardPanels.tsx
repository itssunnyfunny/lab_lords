"use client";

import Link from "next/link";
import { ArrowRight, CalendarCheck, Grid2X2, RefreshCw } from "lucide-react";
import { AppButton, AppPanel } from "@/components/ui";
import { useTranslation } from "@/components/settings/LocalizedText";
import { useUserPreferences } from "@/components/settings/UserPreferencesApplier";
import { getBranchCapabilityDecision } from "@/lib/branchCapabilities";
import type { BranchDashboardSources, DashboardResourceStatus } from "@/lib/branchDashboard";
import type { BranchAccess } from "@/types";
import { DashboardCollections } from "./DashboardCollections";

export function DashboardSourceNote({ status, label, onRetry }: { status: DashboardResourceStatus; label: string; onRetry: () => void }) {
    const t = useTranslation();
    return <div className="dashboard-source-note" role={status === "error" ? "status" : undefined}>
        <p>{status === "restricted" ? t("{source}: not included in your access.", { source: label }) : t("{source}: could not be refreshed.", { source: label })}</p>
        {status === "error" && <AppButton variant="quiet" size="sm" icon={RefreshCw} onClick={onRetry}>{t("Retry")}</AppButton>}
    </div>;
}

type PanelProps = { data: BranchDashboardSources; branchId: string; onRetry: () => void };

export function DashboardSnapshots({ data, branchId, access, onRetry }: PanelProps & { access: BranchAccess }) {
    const t = useTranslation();
    const { formatNumber, formatDate } = useUserPreferences();
    const snap = data.snapshot;
    const attendance = data.attendance;
    const base = `/branch/${encodeURIComponent(branchId)}`;
    return <div className="dashboard-snapshots">
        <DashboardCollections data={data} onRetry={onRetry} />
        <AppPanel title={t("Seating & attendance")} className="dashboard-seating">
            <div className="dashboard-seating-section">
                <div className="dashboard-seating-heading"><h3>{t("Shift slots")}</h3><span>{t("Allocated / capacity")}</span></div>
                {snap ? <>
                    {(snap.seatDetails?.shifts ?? []).map(shift => <div key={shift.shiftId} className="dashboard-shift">
                        <div><span>{shift.shiftName}</span><span>{t("{used} / {total} slots", { used: formatNumber(shift.used), total: formatNumber(shift.capacity) })}</span></div>
                        <meter min={0} max={Math.max(shift.capacity, 1)} value={shift.used} aria-label={t("{shift}: allocated shift slots", { shift: shift.shiftName })} />
                    </div>)}
                    {!snap.seatDetails?.shifts.length && <p className="dashboard-footnote">{t("No shifts configured")}</p>}
                </> : <DashboardSourceNote status={data.resources.analytics} label={t("Shift slots")} onRetry={onRetry} />}
            </div>
            <div className="dashboard-attendance-section">
                <h3>{t("Attendance today")}</h3>
                {attendance ? <>
                    <p className="dashboard-footnote">{formatDate(`${attendance.date}T12:00:00`, { day: "numeric", month: "short" })} · {attendance.timezone}</p>
                    <dl className="dashboard-attendance-facts">
                        <div><dt>{t("Not marked")}</dt><dd>{attendance.counts.notMarked === null ? "—" : formatNumber(attendance.counts.notMarked)}</dd></div>
                        <div><dt>{t("Marked absent")}</dt><dd>{formatNumber(attendance.counts.absent)}</dd></div>
                        <div><dt>{t("Open visits")}</dt><dd>{formatNumber(attendance.counts.open)}</dd></div>
                    </dl>
                </> : <DashboardSourceNote status={data.resources.attendance} label={t("Attendance today")} onRetry={onRetry} />}
                {access.permissions.students && <Link className="dashboard-text-link" href={`${base}/attendance`}>{t("Open attendance")} <ArrowRight size={13} /></Link>}
            </div>
            <details className="dashboard-details"><summary>{t("About slots & attendance")}</summary>
                <p>{t("A physical seat may contribute a slot in more than one shift.")}</p>
                <p>{t("Not marked does not mean absent. Open visits can include earlier dates.")}</p>
                <p>{t("Present today counts students with a present mark or recorded visit.")}</p>
            </details>
        </AppPanel>
    </div>;
}

export function UpcomingFees({ data, branchId, onRetry }: PanelProps) {
    const t = useTranslation();
    const { formatDate, formatNumber } = useUserPreferences();
    const page = data.upcoming;
    return <AppPanel title={t("Upcoming fees")} description={t("Next 7 days")} contentClassName="p-0" className="dashboard-upcoming"
        action={data.resources.upcoming !== "restricted" && <Link className="dashboard-text-link" href={`/branch/${encodeURIComponent(branchId)}/renewals`}>{t("View all")} <ArrowRight size={13} /></Link>}>
        {page ? <>
            {page.items.length ? <ul className="dashboard-upcoming-list">{page.items.map(row => <li key={row.key}>
                <div><p className="font-medium">{row.studentName}</p><p className="dashboard-footnote">{formatDate(row.dueDate, { day: "numeric", month: "short" })}</p></div>
                <div className="dashboard-upcoming-amount"><span className="font-semibold tabular-nums">{formatNumber(row.amount, { style: "currency", currency: "INR", maximumFractionDigits: 0 })}</span>
                    <span className="dashboard-fee-kind">{row.expected ? t("Expected fee") : t("Recorded fee")}</span></div>
            </li>)}</ul> : <p className="p-4 text-sm">{t("No upcoming fee dates in this window.")}</p>}
            <details className="dashboard-details px-4 pb-2"><summary>{t("About expected fees")}</summary><p>{t("Expected fees are estimates, not recorded debt or membership expiry.")}</p></details>
            {page.nextCursor && <p className="dashboard-footnote px-4 pb-4">{t("Showing {shown} of {total} fee periods.", { shown: formatNumber(page.items.length), total: formatNumber(page.counts.UPCOMING) })}</p>}
        </> : <DashboardSourceNote status={data.resources.upcoming} label={t("Upcoming fee dates")} onRetry={onRetry} />}
    </AppPanel>;
}

export function DashboardShortcuts({ branchId, access }: { branchId: string; access: BranchAccess }) {
    const t = useTranslation();
    const base = `/branch/${encodeURIComponent(branchId)}`;
    const actions = [
        { capability: "allocationsManage" as const, href: "/allocations", label: "Assign seat", icon: Grid2X2 },
        { capability: "shiftsView" as const, href: "/shifts", label: "Review shifts", icon: CalendarCheck },
    ].map(action => ({ ...action, decision: getBranchCapabilityDecision(access, action.capability) }))
        .filter(action => action.decision.allowed || action.decision.blocker !== "permission");
    if (!actions.length) return null;
    return <nav className="dashboard-shortcuts" aria-label={t("Quick actions")}>
        <h2>{t("Quick actions")}</h2>
        <div>{actions.map(action => action.decision.allowed
            ? <Link key={action.href} href={`${base}${action.href}`}><action.icon size={16} />{t.owned(action.label)}<ArrowRight size={13} /></Link>
            : <button key={action.href} disabled title={t.owned(action.decision.reason ?? "")}><action.icon size={16} />{t.owned(action.label)}</button>)}</div>
    </nav>;
}
